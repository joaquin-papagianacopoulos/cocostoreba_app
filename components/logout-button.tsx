import { logout } from "@/lib/auth/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="rounded-md border border-black/20 px-3 py-1.5 text-sm dark:border-white/20">
        Salir
      </button>
    </form>
  );
}
