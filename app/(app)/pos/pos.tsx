"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { type CobrarResult, cobrarVenta } from "@/lib/pos/actions";
import { buscarPorCodigo, esCodigo, filtrarProductos } from "@/lib/pos/search";
import { formatMoney } from "@/lib/money";
import { type PromoParaPrecio, calcularVenta } from "@/lib/pricing";
import type { ProductoOpcion } from "@/lib/productos/queries";
import { MEDIOS_PAGO, type MedioPago, medioPagoLabel } from "@/lib/types";
import { btn, btnPrimary, card, cx, errorBox, input, inputBase, okBox } from "@/lib/ui";

type LineaCarrito = { producto_id: string; cantidad: number };

export function Pos({
  productos,
  promos,
  fecha,
}: {
  productos: ProductoOpcion[];
  promos: PromoParaPrecio[];
  fecha: string;
}) {
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const [busqueda, setBusqueda] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [descTipo, setDescTipo] = useState<"monto" | "porcentaje">("monto");
  const [descValor, setDescValor] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago | null>(null);
  const [resultado, setResultado] = useState<CobrarResult | null>(null);
  const [cobrando, startCobro] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const sugerencias = useMemo(() => filtrarProductos(productos, busqueda), [productos, busqueda]);

  const descuento = useMemo(() => {
    const valor = Number(descValor.replace(",", "."));
    return descValor.trim() && Number.isFinite(valor) && valor > 0 ? { tipo: descTipo, valor } : null;
  }, [descTipo, descValor]);

  const totales = useMemo(
    () =>
      calcularVenta(
        carrito.flatMap((l) => {
          const producto = porId.get(l.producto_id);
          return producto ? [{ producto, cantidad: l.cantidad }] : [];
        }),
        "minorista",
        promos,
        fecha,
        descuento,
      ),
    [carrito, porId, promos, fecha, descuento],
  );

  function agregar(producto: ProductoOpcion) {
    setResultado(null);
    setAviso(null);
    setCarrito((c) => {
      const existe = c.find((l) => l.producto_id === producto.id);
      if (existe) return c.map((l) => (l.producto_id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l));
      return [...c, { producto_id: producto.id, cantidad: 1 }];
    });
    setBusqueda("");
    searchRef.current?.focus();
  }

  function onEnter() {
    const texto = busqueda.trim();
    if (!texto) return;
    const exacto = buscarPorCodigo(productos, texto);
    if (exacto) return agregar(exacto);
    // Un código numérico (lector de barras) solo agrega si coincide exacto: "000" no debe
    // agregar un producto que se llama "5000 puffs".
    if (!esCodigo(texto) && sugerencias.length === 1) return agregar(sugerencias[0]);
    setAviso(!esCodigo(texto) && sugerencias.length ? "Elegí un producto de la lista" : `No se encontró "${texto}"`);
  }

  function setCantidad(id: string, cantidad: number) {
    setCarrito((c) =>
      cantidad <= 0 ? c.filter((l) => l.producto_id !== id) : c.map((l) => (l.producto_id === id ? { ...l, cantidad } : l)),
    );
  }

  function cobrar() {
    if (!medioPago) {
      setAviso("Elegí un medio de pago");
      return;
    }
    startCobro(async () => {
      const r = await cobrarVenta({ items: carrito, medio_pago: medioPago, descuento });
      setResultado(r);
      if (r.ok) {
        setCarrito([]);
        setDescValor("");
        setMedioPago(null);
        setAviso(null);
      }
    });
  }

  const faltaStock = carrito.some((l) => (porId.get(l.producto_id)?.stock ?? 0) < l.cantidad);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem] lg:items-start">
      {/* Buscador */}
      <section className="space-y-3">
        <div className="relative">
          <input
            ref={searchRef}
            autoFocus
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setAviso(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter();
              }
            }}
            placeholder="Buscar o escanear código de barras…"
            aria-label="Buscar producto"
            className={cx(input, "py-3 text-base")}
          />
          {sugerencias.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-black/15 bg-background shadow-lg dark:border-white/20">
              {sugerencias.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => agregar(p)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.nombre}</span>
                      <span className="text-xs opacity-60">
                        {p.sku} · stock {p.stock}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatMoney(p.precio_minorista)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {aviso && <p className={errorBox}>{aviso}</p>}

        {resultado?.ok && (
          <div className={cx(okBox, "space-y-2")}>
            <p className="font-medium">
              Venta #{resultado.venta.numero} cobrada: {formatMoney(resultado.venta.total)} (
              {medioPagoLabel(resultado.venta.medio_pago)})
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/ventas/${resultado.venta.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className={btn}
              >
                Ver / imprimir comprobante
              </a>
            </div>
          </div>
        )}
        {resultado && !resultado.ok && (
          <p role="alert" className={errorBox}>
            {resultado.error}
          </p>
        )}

        {/* Carrito */}
        <div className={card}>
          <h2 className="mb-2 font-semibold">Carrito</h2>
          {totales.lineas.length === 0 ? (
            <p className="py-6 text-center text-sm opacity-60">Buscá o escaneá un producto para agregarlo.</p>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {totales.lineas.map((l) => {
                const p = porId.get(l.producto_id)!;
                const sinStock = p.stock < l.cantidad;
                return (
                  <li key={l.producto_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate font-medium">{p.nombre}</p>
                      <p className="text-xs opacity-60">
                        {formatMoney(l.precio_unitario)} c/u
                        {sinStock && <span className="text-red-600 dark:text-red-400"> · hay {p.stock} en stock</span>}
                      </p>
                      {l.promocion && (
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {l.promocion.nombre}: −{formatMoney(l.descuento)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Quitar uno de ${p.nombre}`}
                        onClick={() => setCantidad(l.producto_id, l.cantidad - 1)}
                        className={cx(btn, "h-9 w-9 px-0")}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={l.cantidad}
                        aria-label={`Cantidad de ${p.nombre}`}
                        onChange={(e) => setCantidad(l.producto_id, Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                        className={cx(inputBase, "w-16 px-1 text-center")}
                      />
                      <button
                        type="button"
                        aria-label={`Agregar uno de ${p.nombre}`}
                        onClick={() => setCantidad(l.producto_id, l.cantidad + 1)}
                        className={cx(btn, "h-9 w-9 px-0")}
                      >
                        +
                      </button>
                    </div>
                    <div className="w-24 text-right tabular-nums">
                      {l.descuento > 0 && <div className="text-xs line-through opacity-50">{formatMoney(l.bruto)}</div>}
                      <div className="font-medium">{formatMoney(l.total)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Cobro */}
      <aside className={cx(card, "space-y-4 lg:sticky lg:top-4")}>
        <div>
          <p className="mb-1 text-sm font-medium">Descuento general</p>
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
              max={descTipo === "porcentaje" ? 100 : undefined}
              value={descValor}
              onChange={(e) => setDescValor(e.target.value)}
              placeholder="0"
              aria-label="Valor del descuento"
              className={input}
            />
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium">Medio de pago</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
            {MEDIOS_PAGO.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={medioPago === m.value}
                onClick={() => {
                  setMedioPago(m.value);
                  setAviso(null);
                }}
                className={cx(
                  btn,
                  medioPago === m.value && "border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <dl className="space-y-1 border-t border-black/10 pt-3 text-sm dark:border-white/15">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(totales.subtotal + totales.descuentoItems)}</dd>
          </div>
          {totales.descuentoItems > 0 && (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <dt>Promociones</dt>
              <dd className="tabular-nums">−{formatMoney(totales.descuentoItems)}</dd>
            </div>
          )}
          {totales.descuentoGeneral > 0 && (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <dt>Descuento</dt>
              <dd className="tabular-nums">−{formatMoney(totales.descuentoGeneral)}</dd>
            </div>
          )}
          <div className="flex justify-between pt-1 text-xl font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(totales.total)}</dd>
          </div>
        </dl>

        {faltaStock && (
          <p className="text-xs text-red-600 dark:text-red-400">Hay productos sin stock suficiente.</p>
        )}
        <button
          type="button"
          onClick={cobrar}
          disabled={cobrando || totales.lineas.length === 0}
          className={cx(btnPrimary, "w-full py-3 text-base")}
        >
          {cobrando ? "Cobrando…" : `Cobrar ${formatMoney(totales.total)}`}
        </button>
        {carrito.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("¿Vaciar el carrito?")) setCarrito([]);
            }}
            className="w-full text-center text-xs underline opacity-60"
          >
            Vaciar carrito
          </button>
        )}
      </aside>
    </div>
  );
}
