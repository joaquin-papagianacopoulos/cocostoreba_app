import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm opacity-70">
        Sesión iniciada{email ? ` como ${email}` : ""}. Próximamente: KPIs y gráficos.
      </p>
      <LogoutButton />
    </main>
  );
}
