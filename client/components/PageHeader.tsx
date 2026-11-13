import type { LucideIcon } from "lucide-react";

/** The standard top of a section page: one h1, a short description, optional actions on the right. */
export function PageHeader({ title, description, icon: Icon, actions }: { title: string; description?: React.ReactNode; icon?: LucideIcon; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {Icon && <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />}
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
