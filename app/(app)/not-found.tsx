import Link from "next/link";
import { btn } from "@/lib/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="mb-2 text-xl font-semibold">No encontramos lo que buscabas</h1>
      <p className="mb-6 text-sm opacity-70">Puede que se haya borrado o que el link esté mal.</p>
      <Link href="/" className={btn}>
        Ir al inicio
      </Link>
    </div>
  );
}
