"use client";

import { useMemo, useState } from "react";
import { input } from "@/lib/ui";

type Option = { id: string; sku: string; nombre: string; codigo_barras?: string | null; stock?: number };

/** Select de productos con un campo para filtrar (sirve con muchos productos y en celular). */
export function ProductSelect({
  productos,
  name,
  value,
  onChange,
  required,
}: {
  productos: Option[];
  name?: string;
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const visibles = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return productos;
    return productos.filter(
      (p) =>
        p.id === value ||
        p.nombre.toLowerCase().includes(f) ||
        p.sku.toLowerCase().includes(f) ||
        (p.codigo_barras ?? "").includes(f),
    );
  }, [filter, productos, value]);

  return (
    <div className="flex flex-col gap-1">
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar productos…"
        aria-label="Filtrar productos"
        className={input}
      />
      <select name={name} value={value} onChange={(e) => onChange(e.target.value)} required={required} className={input}>
        <option value="">Elegí un producto</option>
        {visibles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre} ({p.sku}){p.stock !== undefined ? ` · stock ${p.stock}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
