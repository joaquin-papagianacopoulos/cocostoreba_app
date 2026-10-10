import { AppNav } from "@/components/app-nav";
import { LogoutButton } from "@/components/logout-button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppNav logout={<LogoutButton />} />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
