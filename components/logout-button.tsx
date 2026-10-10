import { logout } from "@/lib/auth/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
      >
        Salir
      </button>
    </form>
  );
}
