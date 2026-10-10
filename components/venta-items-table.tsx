import { formatMoney, multiplyMoney, parseMoney } from "@/lib/money";
import type { Venta } from "@/lib/types";
import { medioPagoLabel } from "@/lib/types";
import { cx, table, td, th } from "@/lib/ui";
import type { VentaItemDetalle } from "@/lib/ventas/queries";

/** Detalle de ítems y totales de una venta o pedido (solo lectura). */
export function VentaItemsTable({ venta, items }: { venta: Venta; items: VentaItemDetalle[] }) {
  const descuento = parseMoney(venta.descuento);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/15">
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>Producto</th>
              <th className={cx(th, "text-right")}>Cant.</th>
              <th className={cx(th, "hidden text-right sm:table-cell")}>P. unit.</th>
              <th className={cx(th, "hidden text-right sm:table-cell")}>Descuento</th>
              <th className={cx(th, "text-right")}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const precio = parseMoney(i.precio_unitario);
              const desc = parseMoney(i.descuento);
              return (
                <tr key={i.id}>
                  <td className={td}>
                    <div className="font-medium">{i.producto?.nombre ?? "—"}</div>
                    <div className="text-xs opacity-60">
                      {i.producto?.sku}
                      {i.promocion && ` · ${i.promocion.nombre}`}
                      <span className="sm:hidden"> · {formatMoney(precio)} c/u</span>
                    </div>
                  </td>
                  <td className={cx(td, "text-right tabular-nums")}>{i.cantidad}</td>
                  <td className={cx(td, "hidden text-right tabular-nums sm:table-cell")}>{formatMoney(precio)}</td>
                  <td className={cx(td, "hidden text-right tabular-nums sm:table-cell")}>
                    {desc > 0 ? `−${formatMoney(desc)}` : "—"}
                  </td>
                  <td className={cx(td, "text-right tabular-nums")}>
                    {formatMoney(multiplyMoney(i.cantidad, precio) - desc)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{formatMoney(parseMoney(venta.subtotal))}</dd>
        </div>
        {descuento > 0 && (
          <div className="flex justify-between">
            <dt>Descuento general</dt>
            <dd className="tabular-nums">−{formatMoney(descuento)}</dd>
          </div>
        )}
        <div className="flex justify-between text-lg font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatMoney(parseMoney(venta.total))}</dd>
        </div>
        {venta.medio_pago && (
          <div className="flex justify-between opacity-70">
            <dt>Medio de pago</dt>
            <dd>{medioPagoLabel(venta.medio_pago)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
