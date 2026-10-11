"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@/lib/db-errors";
import { type ProductoImportado, productosImportadosSchema } from "@/lib/productos/importacion";
import { createClient } from "@/lib/supabase/server";

export type ImportarResult =
  | { ok: true; creados: number; actualizados: number; categorias_creadas: number }
  | { ok: false; error: string };

/** Importa en una sola transacción (RPC importar_productos): o entra todo o no entra nada. */
export async function importarProductos(items: ProductoImportado[]): Promise<ImportarResult> {
  try {
    const parsed = productosImportadosSchema.safeParse(items);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("importar_productos", { p_items: parsed.data }).single();
    if (error) {
      return {
        ok: false,
        error:
          error.code === "PGRST202"
            ? "Falta la función de importación en la base: aplicá la migración 0006_importar_productos.sql"
            : friendlyDbError(error, "No se pudo importar. No se cargó ningún producto."),
      };
    }

    revalidatePath("/productos", "layout");
    revalidatePath("/stock");
    const r = data as { creados: number; actualizados: number; categorias_creadas: number };
    return { ok: true, ...r };
  } catch {
    return { ok: false, error: "No se pudo importar. No se cargó ningún producto." };
  }
}
