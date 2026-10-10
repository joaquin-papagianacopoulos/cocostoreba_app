import { EmptyState, PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <EmptyState title="Próximamente">KPIs y gráficos.</EmptyState>
    </>
  );
}
