// Tipos de filas de la base (SPEC §3). Los numeric llegan de PostgREST como number
// o string: siempre pasarlos por parseMoney antes de operar.

export type Numeric = number | string;

export type Categoria = { id: string; nombre: string; created_at: string };

export type Producto = {
  id: string;
  sku: string;
  codigo_barras: string | null;
  nombre: string;
  categoria_id: string | null;
  costo: Numeric;
  precio_minorista: Numeric;
  precio_mayorista: Numeric;
  stock: number;
  stock_minimo: number;
  activo: boolean;
  created_at: string;
};

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  cuit: string | null;
  notas: string | null;
  created_at: string;
};

export type TipoMovimiento = "compra" | "venta" | "ajuste" | "anulacion";

export type MovimientoStock = {
  id: string;
  producto_id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  referencia_id: string | null;
  motivo: string | null;
  fecha: string;
};

export type TipoPromocion = "porcentaje" | "monto_fijo" | "nxm";
export type AlcancePromocion = "producto" | "categoria" | "todo";
export type CanalPromocion = "minorista" | "mayorista" | "ambos";

export type Promocion = {
  id: string;
  nombre: string;
  tipo: TipoPromocion;
  valor: Numeric | null;
  n: number | null;
  m: number | null;
  alcance: AlcancePromocion;
  producto_id: string | null;
  categoria_id: string | null;
  canal: CanalPromocion;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  activa: boolean;
  created_at: string;
};

export type CanalVenta = "minorista" | "mayorista";
export type EstadoVenta = "borrador" | "confirmado" | "entregado" | "anulado";
export type MedioPago = "efectivo" | "transferencia" | "debito" | "credito" | "otro";

export const MEDIOS_PAGO: { value: MedioPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "otro", label: "Otro" },
];

export function medioPagoLabel(value: MedioPago | null | undefined): string {
  return MEDIOS_PAGO.find((m) => m.value === value)?.label ?? "—";
}

export type Venta = {
  id: string;
  numero: number | null;
  canal: CanalVenta;
  estado: EstadoVenta;
  cliente_id: string | null;
  fecha: string | null;
  subtotal: Numeric;
  descuento: Numeric;
  total: Numeric;
  medio_pago: MedioPago | null;
  notas: string | null;
  created_at: string;
};

export type VentaItem = {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: Numeric;
  costo_unitario: Numeric;
  descuento: Numeric;
  promocion_id: string | null;
  total: Numeric;
};

export type CategoriaGasto = { id: string; nombre: string };

export type Gasto = {
  id: string;
  fecha: string;
  categoria_id: string;
  monto: Numeric;
  descripcion: string;
  comprobante_path: string | null;
  created_at: string;
};

export type Configuracion = {
  id: 1;
  nombre_negocio: string;
  cuit: string | null;
  direccion: string | null;
  telefono: string | null;
  logo_path: string | null;
  pie_comprobante: string | null;
};
