import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { checkbox } from "@/lib/forms";
import { round2 } from "@/lib/money";

const num = (v: unknown) => {
  if (typeof v !== "string") return v;
  const s = v.trim().replace(",", ".");
  return s === "" ? undefined : Number(s);
};

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isIsoDate(v), { error: "Fecha inválida" });

/**
 * Valida una promo tal como llega del form y la normaliza a la fila de la base
 * (los campos que no corresponden al tipo/alcance quedan en null). Replica los
 * checks de 0001_inicial.sql para mostrar errores antes de ir a la base.
 */
export const promocionSchema = z
  .object({
    nombre: z.string().trim().min(1, { error: "Ingresá un nombre" }).max(120, { error: "Máximo 120 caracteres" }),
    tipo: z.enum(["porcentaje", "monto_fijo", "nxm"], { error: "Elegí el tipo" }),
    valor: z.preprocess(num, z.number({ error: "Ingresá un número" }).optional()),
    n: z.preprocess(num, z.number({ error: "Ingresá un número" }).int({ error: "Tiene que ser entero" }).optional()),
    m: z.preprocess(num, z.number({ error: "Ingresá un número" }).int({ error: "Tiene que ser entero" }).optional()),
    alcance: z.enum(["producto", "categoria", "todo"], { error: "Elegí el alcance" }),
    producto_id: z.string().optional(),
    categoria_id: z.string().optional(),
    canal: z.enum(["minorista", "mayorista", "ambos"], { error: "Elegí el canal" }),
    fecha_desde: optionalDate,
    fecha_hasta: optionalDate,
    activa: checkbox,
  })
  .superRefine((p, ctx) => {
    if (p.tipo === "porcentaje" && (p.valor === undefined || !(p.valor > 0 && p.valor <= 100))) {
      ctx.addIssue({ code: "custom", path: ["valor"], message: "El porcentaje tiene que estar entre 0 y 100" });
    }
    if (p.tipo === "monto_fijo" && (p.valor === undefined || !(p.valor > 0))) {
      ctx.addIssue({ code: "custom", path: ["valor"], message: "El monto tiene que ser mayor a 0" });
    }
    if (p.tipo === "nxm") {
      if (p.m === undefined || p.m < 1) {
        ctx.addIssue({ code: "custom", path: ["m"], message: "m tiene que ser 1 o más" });
      }
      if (p.n === undefined || p.m === undefined || !(p.n > p.m)) {
        ctx.addIssue({ code: "custom", path: ["n"], message: "n tiene que ser mayor que m (ej. 2x1: n=2, m=1)" });
      }
    }
    const uuid = z.uuid();
    if (p.alcance === "producto" && !uuid.safeParse(p.producto_id).success) {
      ctx.addIssue({ code: "custom", path: ["producto_id"], message: "Elegí el producto" });
    }
    if (p.alcance === "categoria" && !uuid.safeParse(p.categoria_id).success) {
      ctx.addIssue({ code: "custom", path: ["categoria_id"], message: "Elegí la categoría" });
    }
    if (p.fecha_desde && p.fecha_hasta && p.fecha_desde > p.fecha_hasta) {
      ctx.addIssue({ code: "custom", path: ["fecha_hasta"], message: "Tiene que ser igual o posterior al inicio" });
    }
  })
  .transform((p) => ({
    nombre: p.nombre,
    tipo: p.tipo,
    valor: p.tipo === "nxm" ? null : round2(p.valor!),
    n: p.tipo === "nxm" ? p.n! : null,
    m: p.tipo === "nxm" ? p.m! : null,
    alcance: p.alcance,
    producto_id: p.alcance === "producto" ? p.producto_id! : null,
    categoria_id: p.alcance === "categoria" ? p.categoria_id! : null,
    canal: p.canal,
    fecha_desde: p.fecha_desde,
    fecha_hasta: p.fecha_hasta,
    activa: p.activa,
  }));

export type PromocionRow = z.output<typeof promocionSchema>;

export type EstadoPromo = "activa" | "inactiva" | "programada" | "vencida";

/** Estado para mostrar, según el flag y las fechas (hoy en YYYY-MM-DD hora AR). */
export function estadoPromo(
  p: { activa: boolean; fecha_desde: string | null; fecha_hasta: string | null },
  hoy: string,
): EstadoPromo {
  if (!p.activa) return "inactiva";
  if (p.fecha_hasta && hoy > p.fecha_hasta) return "vencida";
  if (p.fecha_desde && hoy < p.fecha_desde) return "programada";
  return "activa";
}

export const TIPO_LABEL = { porcentaje: "Porcentaje", monto_fijo: "Monto fijo por unidad", nxm: "Llevá n, pagá m" };
export const CANAL_LABEL = { minorista: "Minorista", mayorista: "Mayorista", ambos: "Ambos" };
