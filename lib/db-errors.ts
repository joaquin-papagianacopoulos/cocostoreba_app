// Traduce errores de Postgres/PostgREST a mensajes legibles en español.

type PgError = { code?: string; message?: string; details?: string | null } | null | undefined;

const UNIQUE_MESSAGES: Record<string, string> = {
  productos_sku_key: "Ya existe un producto con ese SKU",
  productos_codigo_barras_key: "Ya existe un producto con ese código de barras",
  categorias_nombre_key: "Ya existe una categoría con ese nombre",
  categorias_gasto_nombre_key: "Ya existe una categoría de gasto con ese nombre",
};

const FK_MESSAGES: Record<string, string> = {
  compra_items_producto_id_fkey: "El producto tiene compras registradas: desactivalo en lugar de borrarlo",
  venta_items_producto_id_fkey: "El producto tiene ventas registradas: desactivalo en lugar de borrarlo",
  movimientos_stock_producto_id_fkey: "El producto tiene movimientos de stock: desactivalo en lugar de borrarlo",
  ventas_cliente_id_fkey: "El cliente tiene ventas o pedidos asociados",
  gastos_categoria_id_fkey: "La categoría tiene gastos asociados",
};

/** Busca el nombre de la constraint en el mensaje de Postgres. */
function constraintName(error: NonNullable<PgError>): string | undefined {
  const match = `${error.message ?? ""} ${error.details ?? ""}`.match(/constraint "([^"]+)"/);
  return match?.[1];
}

/** Mensaje para mostrar al usuario. Los errores de las RPC (raise exception) ya vienen en español. */
export function friendlyDbError(error: PgError, fallback = "No se pudo guardar. Probá de nuevo."): string {
  if (!error) return fallback;
  const name = constraintName(error);
  if (error.code === "23505") return (name && UNIQUE_MESSAGES[name]) || "Ya existe un registro con esos datos";
  if (error.code === "23503") return (name && FK_MESSAGES[name]) || "Hay datos relacionados que impiden la operación";
  if (error.code === "23514") return "Algún dato no cumple las reglas (revisá montos y cantidades)";
  if (error.code === "42501") return "No tenés permiso para hacer esto";
  if (error.code === "P0001" && error.message) return error.message; // raise exception de nuestras funciones
  return fallback;
}

/** Qué campo del formulario corresponde a una violación de unicidad (para marcarlo). */
export function uniqueViolationField(error: PgError): string | undefined {
  if (!error || error.code !== "23505") return undefined;
  const name = constraintName(error);
  if (name === "productos_sku_key") return "sku";
  if (name === "productos_codigo_barras_key") return "codigo_barras";
  if (name?.endsWith("nombre_key")) return "nombre";
  return undefined;
}
