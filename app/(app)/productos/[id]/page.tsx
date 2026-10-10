import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { formatMoney, parseMoney } from "@/lib/money";
import { actualizarProducto } from "@/lib/productos/actions";
import { createClient } from "@/lib/supabase/server";
import type { Categoria, Producto } from "@/lib/types";
import { btn } from "@/lib/ui";
import { ProductForm } from "../product-form";

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: producto }, { data: categorias }] = await Promise.all([
    supabase.from("productos").select("*").eq("id", id).maybeSingle(),
    supabase.from("categorias").select("*").order("nombre"),
  ]);
  if (!producto) notFound();
  const p = producto as Producto;

  return (
    <>
      <PageHeader
        title={p.nombre}
        description={`SKU ${p.sku} · Stock ${p.stock} · Costo ${formatMoney(parseMoney(p.costo))}`}
        actions={
          <Link href={`/stock?producto=${p.id}`} className={btn}>
            Ver movimientos
          </Link>
        }
      />
      <ProductForm
        action={actualizarProducto.bind(null, p.id)}
        categorias={(categorias as Categoria[] | null) ?? []}
        producto={p}
      />
    </>
  );
}
