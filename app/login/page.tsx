import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar · CocoStore APP" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-black/10 p-6 shadow-sm dark:border-white/15">
        <h1 className="mb-1 text-xl font-semibold">CocoStore APP</h1>
        <p className="mb-6 text-sm opacity-70">Ingresá con tu email y contraseña.</p>
        <LoginForm next={next ?? ""} />
      </div>
    </main>
  );
}
