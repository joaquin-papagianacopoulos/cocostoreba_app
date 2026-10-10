export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm opacity-70">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-black/15 p-8 text-center dark:border-white/20">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm opacity-70">{children}</div>}
    </div>
  );
}
