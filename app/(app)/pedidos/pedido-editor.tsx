"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ProductSelect } from "@/components/product-select";
import { formatUsd } from "@/lib/moneda";
import { formatMoney } from "@/lib/money";
import { guardarPedido } from "@/lib/pedidos/actions";
import { type PromoParaPrecio, calcularVenta } from "@/lib/pricing";
import type { ProductoOpcion } from "@/lib/productos/queries";
import { MEDIOS_PAGO, type MedioPago } from "@/lib/types";
import { btn, btnPrimary, card, cx, errorBox, input, inputBase, label } from "@/lib/ui";

export type LineaPedido = { producto_id: string; cantidad: number; precio_unitario: number };

type LineaEditable = { key: number; producto_id: string; cantidad: string; precio: string };

let nextKey = 1;
const toNumber = (s: string) => Number(s.trim().replace(",", "."));

export function PedidoEditor({
  pedidoId,
  productos: todos,
  promos,
  clientes,
  fecha,
  inicial,
}: {
  pedidoId: string | null;
  productos: ProductoOpcion[];
  promos: PromoParaPrecio[];
  clientes: { id: string; nombre: string }[];
  fecha: string;
  inicial?: {
    cliente_id: string;
    lineas: LineaPedido[];
    descuento: number;
    medio_pago: MedioPago | null;
    notas: string | null;
  };
}) {
  const router = useRouter();
  // Sin cotización, los productos en USD no se pueden pedir.
  const productos = useMemo(() => todos.filter((p) => p.disponible), [todos]);
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const [clienteId, setClienteId] = useState(inicial?.cliente_id ?? "");
  const [lineas, setLineas] = useState<LineaEditable[]>(() =>
    inicial?.lineas.length
      ? inicial.lineas.map((l) => ({
          key: nextKey++,
          producto_id: l.producto_id,
          cantidad: String(l.cantidad),
          precio: String(l.precio_unitario),
        }))
      : [{ key: nextKey++, producto_id: "", cantidad: "1", precio: "" }],
  );
  const [descTipo, setDescTipo] = useState<"monto" | "porcentaje">("monto");
  const [descValor, setDescValor] = useState(inicial?.descuento ? String(inicial.descuento) : "");
  const [medioPago, setMedioPago] = useState<MedioPago | "">(inicial?.medio_pago ?? "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();

  const update = (key: number, patch: Partial<LineaEditable>) =>
    setLineas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const validas = lineas.flatMap((l) => {
    const producto = porId.get(l.producto_id);
    const cantidad = toNumber(l.cantidad);
    const precio = toNumber(l.precio);
    if (!producto || !Number.isInteger(cantidad) || cantidad <= 0 || !Number.isFinite(precio) || precio < 0) return [];
    return [{ key: l.key, producto, cantidad, precioUnitario: precio }];
  });

  const descuento = useMemo(() => {
    const v = toNumber(descValor);
    return descValor.trim() && Number.isFinite(v) && v > 0 ? { tipo: descTipo, valor: v } : null;
  }, [descTipo, descValor]);

  const totales = calcularVenta(validas, "mayorista", promos, fecha, descuento);
  // calcularVenta conserva el orden de las líneas (todas tienen cantidad > 0).
  const calcPorKey = new Map(validas.map((l, i) => [l.key, totales.lineas[i]]));

  function guardar() {
    setError(null);
    setMensaje(null);
    if (validas.length !== lineas.length) {
      setError("Completá producto, cantidad entera y precio en todas las líneas (o quitá las vacías)");
      return;
    }
    startGuardar(async () => {
      const r = await guardarPedido({
        id: pedidoId,
        cliente_id: clienteId,
        items: validas.map((l) => ({
          producto_id: l.producto.id,
          cantidad: l.cantidad,
          precio_unitario: l.precioUnitario,
        })),
        descuento,
        medio_pago: medioPago || null,
        notas,
      });
      if (!r.ok) return setError(r.error);
      if (pedidoId) {
        setMensaje("Borrador guardado");
        router.refresh();
      } else {
        router.push(`/pedidos/${r.id}`);
      }
    });
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Cliente
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required className={input}>
            <option value="">Elegí un cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          {clientes.length === 0 && (
            <Link href="/clientes/nuevo" className="text-xs font-normal underline">
              Primero cargá un cliente
            </Link>
          )}
        </label>
        <label className={label}>
          Medio de pago <span className="font-normal opacity-60">(opcional)</span>
          <select value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago | "")} className={input}>
            <option value="">A definir</option>
            {MEDIOS_PAGO.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        {lineas.map((l) => {
          const producto = porId.get(l.producto_id);
          const calc = calcPorKey.get(l.key);
          return (
            <div key={l.key} className={cx(card, "grid gap-3 sm:grid-cols-[1fr_6rem_8rem_8rem] sm:items-end")}>
              <div className="flex flex-col gap-1 text-sm font-medium">
                Producto
                <ProductSelect
                  productos={productos}
                  value={l.producto_id}
                  required
                  onChange={(id) =>
                    update(l.key, { producto_id: id, precio: String(porId.get(id)?.precio_mayorista ?? "") })
                  }
                />
              </div>
              <label className={label}>
                Cantidad
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={l.cantidad}
                  onChange={(e) => update(l.key, { cantidad: e.target.value })}
                  className={input}
                />
              </label>
              <label className={label}>
                Precio unitario
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.precio}
                  onChange={(e) => update(l.key, { precio: e.target.value })}
                  className={input}
                />
              </label>
              <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                <span className="text-sm font-medium tabular-nums">{formatMoney(calc?.total ?? 0)}</span>
                <button
                  type="button"
                  onClick={() => setLineas((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}
                  disabled={lineas.length === 1}
                  className="text-xs underline opacity-70 disabled:opacity-30"
                >
                  Quitar
                </button>
              </div>
              {producto && (
                <p className="text-xs opacity-60 sm:col-span-4">
                  Stock {producto.stock} · mayorista {formatMoney(producto.precio_mayorista)}
                  {producto.moneda === "USD" && ` (${formatUsd(producto.original.precio_mayorista)})`}
                  {calc?.promocion && (
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                      {" "}
                      · {calc.promocion.nombre}: −{formatMoney(calc.descuento)}
                    </span>
                  )}
                </p>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setLineas((ls) => [...ls, { key: nextKey++, producto_id: "", cantidad: "1", precio: "" }])}
          className={btn}
        >
          + Agregar producto
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Notas <span className="font-normal opacity-60">(opcional)</span>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={input} />
        </label>
        <div className="space-y-1">
          <p className="text-sm font-medium">Descuento general</p>
          <div className="flex gap-2">
            <select
              value={descTipo}
              onChange={(e) => setDescTipo(e.target.value as "monto" | "porcentaje")}
              aria-label="Tipo de descuento"
              className={cx(inputBase, "w-20 shrink-0")}
            >
              <option value="monto">$</option>
              <option value="porcentaje">%</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={descValor}
              onChange={(e) => setDescValor(e.target.value)}
              placeholder="0"
              aria-label="Valor del descuento"
              className={input}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/15">
        <div className="text-sm">
          {totales.descuentoItems > 0 && <div>Promociones: −{formatMoney(totales.descuentoItems)}</div>}
          {totales.descuentoGeneral > 0 && <div>Descuento: −{formatMoney(totales.descuentoGeneral)}</div>}
          <div className="text-lg font-semibold tabular-nums">Total {formatMoney(totales.total)}</div>
        </div>
        <button type="button" onClick={guardar} disabled={guardando} className={btnPrimary}>
          {guardando ? "Guardando…" : pedidoId ? "Guardar borrador" : "Crear pedido (borrador)"}
        </button>
      </div>
      {error && (
        <p role="alert" className={errorBox}>
          {error}
        </p>
      )}
      {mensaje && <p className="text-sm text-emerald-700 dark:text-emerald-400">{mensaje}</p>}
      <p className="text-xs opacity-60">Un borrador no descuenta stock. El stock se descuenta al confirmar el pedido.</p>
    </div>
  );
}
