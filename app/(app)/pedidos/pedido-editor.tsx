"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { formatUsd } from "@/lib/moneda";
import { formatMoney } from "@/lib/money";
import { guardarPedido } from "@/lib/pedidos/actions";
import { buscarPorCodigo, filtrarProductos } from "@/lib/pos/search";
import { type PromoParaPrecio, calcularVenta } from "@/lib/pricing";
import type { ProductoOpcion } from "@/lib/productos/queries";
import { MEDIOS_PAGO, type MedioPago } from "@/lib/types";
import { btn, btnPrimary, card, cx, input, inputBase, label } from "@/lib/ui";

export type LineaPedido = { producto_id: string; cantidad: number; precio_unitario: number };

/** Una línea por producto; cantidad y precio como texto mientras se escriben. */
type LineaEditable = { producto_id: string; cantidad: string; precio: string };

const toNumber = (s: string) => Number(s.trim().replace(",", "."));
const MAX_RESULTADOS = 40;

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
  const [busqueda, setBusqueda] = useState("");
  const [lineas, setLineas] = useState<LineaEditable[]>(() => {
    // Junta líneas repetidas del mismo producto (pedidos guardados con la versión anterior).
    const porProducto = new Map<string, LineaEditable>();
    for (const l of inicial?.lineas ?? []) {
      const prev = porProducto.get(l.producto_id);
      porProducto.set(l.producto_id, {
        producto_id: l.producto_id,
        cantidad: String((prev ? Number(prev.cantidad) : 0) + l.cantidad),
        precio: prev?.precio ?? String(l.precio_unitario),
      });
    }
    return [...porProducto.values()];
  });
  const [descTipo, setDescTipo] = useState<"monto" | "porcentaje">("monto");
  const [descValor, setDescValor] = useState(inicial?.descuento ? String(inicial.descuento) : "");
  const [medioPago, setMedioPago] = useState<MedioPago | "">(inicial?.medio_pago ?? "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();

  const enPedido = useMemo(() => new Set(lineas.map((l) => l.producto_id)), [lineas]);
  const resultados = useMemo(
    () => (busqueda.trim() ? filtrarProductos(productos, busqueda, MAX_RESULTADOS) : productos.slice(0, MAX_RESULTADOS)),
    [productos, busqueda],
  );

  const validas = lineas.flatMap((l) => {
    const producto = porId.get(l.producto_id);
    const cantidad = toNumber(l.cantidad);
    const precio = toNumber(l.precio);
    if (!producto || !Number.isInteger(cantidad) || cantidad <= 0 || !Number.isFinite(precio) || precio < 0) return [];
    return [{ producto, cantidad, precioUnitario: precio }];
  });
  const descuento = useMemo(() => {
    const v = toNumber(descValor);
    return descValor.trim() && Number.isFinite(v) && v > 0 ? { tipo: descTipo, valor: v } : null;
  }, [descTipo, descValor]);
  const totales = calcularVenta(validas, "mayorista", promos, fecha, descuento);
  const calcPorProducto = new Map(totales.lineas.map((l) => [l.producto_id, l]));
  const unidades = validas.reduce((s, l) => s + l.cantidad, 0);

  function limpiarAvisos() {
    setError(null);
    setMensaje(null);
  }

  /** Click en un resultado: lo suma al pedido o lo saca si ya estaba. */
  function alternar(p: ProductoOpcion) {
    limpiarAvisos();
    setLineas((ls) =>
      ls.some((l) => l.producto_id === p.id)
        ? ls.filter((l) => l.producto_id !== p.id)
        : [...ls, { producto_id: p.id, cantidad: "1", precio: String(p.precio_mayorista) }],
    );
  }

  function sumar(id: string, delta: number) {
    limpiarAvisos();
    setLineas((ls) =>
      ls.flatMap((l) => {
        if (l.producto_id !== id) return [l];
        const n = Math.max(0, (Number.parseInt(l.cantidad, 10) || 0) + delta);
        return n === 0 ? [] : [{ ...l, cantidad: String(n) }];
      }),
    );
  }

  function update(id: string, patch: Partial<LineaEditable>) {
    limpiarAvisos();
    setLineas((ls) => ls.map((l) => (l.producto_id === id ? { ...l, ...patch } : l)));
  }

  function guardar() {
    limpiarAvisos();
    if (!clienteId) return setError("Elegí un cliente");
    if (lineas.length === 0) return setError("Agregá al menos un producto");
    if (validas.length !== lineas.length) return setError("Revisá cantidades (enteras) y precios del pedido");
    startGuardar(async () => {
      const r = await guardarPedido({
        id: pedidoId,
        cliente_id: clienteId,
        items: validas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad, precio_unitario: l.precioUnitario })),
        descuento,
        medio_pago: medioPago || null,
        notas,
      });
      if (!r.ok) return setError(r.error);
      if (pedidoId) {
        setMensaje("Pedido guardado");
        router.refresh();
      } else {
        router.push(`/pedidos/${r.id}`);
      }
    });
  }

  return (
    <div className="space-y-4 pb-28">
      <label className={cx(label, "max-w-md")}>
        Cliente
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={input}>
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

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* Buscar y elegir productos */}
        <section className={cx(card, "space-y-3")}>
          <h2 className="font-semibold">Agregar productos</h2>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const exacto = buscarPorCodigo(productos, busqueda);
              if (exacto && !enPedido.has(exacto.id)) {
                alternar(exacto);
                setBusqueda("");
              }
            }}
            placeholder="Buscar por nombre, SKU o código…"
            aria-label="Buscar productos"
            className={cx(input, "py-3 text-base")}
          />
          <p className="text-xs opacity-60">Tocá los productos para sumarlos al pedido (podés elegir varios).</p>
          {resultados.length === 0 ? (
            <p className="py-6 text-center text-sm opacity-60">No hay productos que coincidan.</p>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-black/5 overflow-y-auto rounded-lg border border-black/10">
              {resultados.map((p) => {
                const elegido = enPedido.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => alternar(p)}
                      aria-pressed={elegido}
                      className={cx(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm",
                        elegido ? "bg-emerald-50" : "hover:bg-black/5",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cx(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs",
                          elegido ? "border-emerald-600 bg-emerald-600 text-white" : "border-black/30",
                        )}
                      >
                        {elegido ? "✓" : ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.nombre}</span>
                        <span className="text-xs opacity-60">
                          {p.sku} · stock {p.stock}
                        </span>
                      </span>
                      <span className="shrink-0 text-right tabular-nums">
                        {formatMoney(p.precio_mayorista)}
                        {p.moneda === "USD" && (
                          <span className="block text-xs opacity-60">{formatUsd(p.original.precio_mayorista)}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!busqueda.trim() && productos.length > MAX_RESULTADOS && (
            <p className="text-xs opacity-60">
              Mostrando {MAX_RESULTADOS} de {productos.length}: escribí para filtrar.
            </p>
          )}
        </section>

        {/* El pedido */}
        <section className={cx(card, "space-y-3")}>
          <h2 className="font-semibold">
            Pedido{" "}
            <span className="text-sm font-normal opacity-60">
              ({lineas.length} producto{lineas.length === 1 ? "" : "s"}, {unidades} u.)
            </span>
          </h2>
          {lineas.length === 0 ? (
            <p className="py-6 text-center text-sm opacity-60">Todavía no agregaste productos.</p>
          ) : (
            <ul className="divide-y divide-black/10">
              {lineas.map((l) => {
                const p = porId.get(l.producto_id);
                if (!p) return null;
                const calc = calcPorProducto.get(l.producto_id);
                const sinStock = p.stock < (Number.parseInt(l.cantidad, 10) || 0);
                return (
                  <li key={l.producto_id} className="space-y-2 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.nombre}</p>
                        <p className="text-xs opacity-60">
                          {p.sku} · stock {p.stock}
                          {sinStock && <span className="text-red-600"> · no alcanza el stock</span>}
                        </p>
                        {calc?.promocion && (
                          <p className="text-xs font-medium text-emerald-700">
                            {calc.promocion.nombre}: −{formatMoney(calc.descuento)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => alternar(p)}
                        className="shrink-0 text-xs underline opacity-60 hover:opacity-100"
                      >
                        Quitar
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => sumar(l.producto_id, -1)}
                          aria-label={`Restar uno de ${p.nombre}`}
                          className={cx(btn, "h-9 w-9 px-0")}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          value={l.cantidad}
                          onChange={(e) => update(l.producto_id, { cantidad: e.target.value })}
                          aria-label={`Cantidad de ${p.nombre}`}
                          className={cx(inputBase, "w-16 px-1 text-center")}
                        />
                        <button
                          type="button"
                          onClick={() => sumar(l.producto_id, 1)}
                          aria-label={`Sumar uno de ${p.nombre}`}
                          className={cx(btn, "h-9 w-9 px-0")}
                        >
                          +
                        </button>
                      </div>
                      <label className="flex items-center gap-1 text-xs">
                        <span className="opacity-60">$ c/u</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={l.precio}
                          onChange={(e) => update(l.producto_id, { precio: e.target.value })}
                          aria-label={`Precio de ${p.nombre}`}
                          className={cx(inputBase, "w-28 tabular-nums")}
                        />
                      </label>
                      <span className="ml-auto text-right font-medium tabular-nums">{formatMoney(calc?.total ?? 0)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid gap-3 border-t border-black/10 pt-3 sm:grid-cols-2">
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
            <label className={label}>
              Medio de pago
              <select value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago | "")} className={input}>
                <option value="">A definir</option>
                {MEDIOS_PAGO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={cx(label, "sm:col-span-2")}>
              Notas
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={input} />
            </label>
          </div>
        </section>
      </div>

      {/* Barra fija con total y guardar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/95 px-4 py-3 backdrop-blur md:left-56">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            {(totales.descuentoItems > 0 || totales.descuentoGeneral > 0) && (
              <span className="mr-2 opacity-70">
                Descuentos −{formatMoney(totales.descuentoItems + totales.descuentoGeneral)}
              </span>
            )}
            <span className="text-lg font-semibold tabular-nums">Total {formatMoney(totales.total)}</span>
          </div>
          <button type="button" onClick={guardar} disabled={guardando} className={btnPrimary}>
            {guardando ? "Guardando…" : pedidoId ? "Guardar pedido" : "Crear pedido"}
          </button>
        </div>
        {(error || mensaje) && (
          <p
            role={error ? "alert" : "status"}
            className={cx("mx-auto mt-2 max-w-5xl text-sm", error ? "text-red-600" : "text-emerald-700")}
          >
            {error ?? mensaje}
          </p>
        )}
      </div>
    </div>
  );
}
