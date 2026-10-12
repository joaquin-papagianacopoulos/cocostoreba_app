"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCotizacion } from "@/lib/cotizacion-server";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, uniqueViolationField } from "@/lib/db-errors";
import { type FormState, formDataToObject, invalid } from "@/lib/forms";
import { categoriaSchema, productoCreateSchema, productoUpdateSchema } from "@/lib/productos/schema";

function dbFailure(error: Parameters<typeof friendlyDbError>[0]): FormState {
  const message = friendlyDbError(error);
  const field = uniqueViolationField(error);
  return { error: message, fieldErrors: field ? { [field]: message } : undefined };
}

export async function crearProducto(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = productoCreateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { stock_inicial, ...producto } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.from("productos").insert(producto).select("id").single();
  if (error) return dbFailure(error);

  // El stock inicial entra como ajuste para que quede registrado en movimientos_stock.
  if (stock_inicial > 0) {
    const { error: ajusteError } = await supabase.rpc("ajustar_stock", {
      p_producto_id: data.id,
      p_cantidad: stock_inicial,
      p_motivo: "Stock inicial",
    });
    if (ajusteError) {
      revalidatePath("/productos");
      return { error: `Producto creado, pero no se pudo cargar el stock inicial: ${friendlyDbError(ajusteError)}` };
    }
  }

  revalidatePath("/productos");
  redirect("/productos");
}

export async function actualizarProducto(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = productoUpdateSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { moneda, precio_minorista, precio_mayorista, ...resto } = parsed.data;

  const supabase = await createClient();
  const { data: actual } = await supabase.from("productos").select("moneda").eq("id", id).maybeSingle();
  if (!actual) return { error: "El producto no existe" };
  const cambiaMoneda = (actual as { moneda: string }).moneda !== moneda;

  // La moneda no se edita directo: cambiar_moneda_producto convierte también el costo.
  const { error } = await supabase
    .from("productos")
    .update(cambiaMoneda ? resto : { ...resto, precio_minorista, precio_mayorista })
    .eq("id", id);
  if (error) return dbFailure(error);

  if (cambiaMoneda) {
    const cotizacion = await getCotizacion();
    if (!cotizacion) return { error: "No hay cotización del dólar disponible: no se pudo cambiar la moneda" };
    const { error: monedaError } = await supabase.rpc("cambiar_moneda_producto", {
      p_producto_id: id,
      p_moneda: moneda,
      p_cotizacion: cotizacion.venta,
      p_precio_minorista: precio_minorista,
      p_precio_mayorista: precio_mayorista,
    });
    if (monedaError) return { error: friendlyDbError(monedaError, "No se pudo cambiar la moneda") };
  }

  revalidatePath("/productos");
  redirect("/productos");
}

export async function cambiarActivoProducto(id: string, activo: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("productos").update({ activo }).eq("id", id);
  if (error) throw new Error(friendlyDbError(error));
  revalidatePath("/productos");
}

export async function crearCategoria(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = categoriaSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("categorias").insert(parsed.data);
  if (error) return dbFailure(error);

  revalidatePath("/productos", "layout");
  return { ok: true, message: `Categoría "${parsed.data.nombre}" creada` };
}

export async function renombrarCategoria(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = categoriaSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("categorias").update(parsed.data).eq("id", id);
  if (error) return dbFailure(error);

  revalidatePath("/productos", "layout");
  return { ok: true, message: "Guardado" };
}

export async function borrarCategoria(id: string): Promise<FormState> {
  if (!z.uuid().safeParse(id).success) return { error: "Categoría inválida" };
  const supabase = await createClient();
  // Los productos de la categoría quedan "sin categoría" (FK on delete set null).
  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) return { error: friendlyDbError(error) };
  revalidatePath("/productos", "layout");
  return { ok: true };
}
