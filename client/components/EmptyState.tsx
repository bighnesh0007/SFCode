import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Nothing to show yet: an icon, what's missing, and the one thing to do about it. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string } | React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-4 font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>}
      {action && typeof action === "object" && "href" in action ? (
        <Link href={action.href} className={buttonVariants({ size: "sm", className: "mt-5" })}>
          {action.label}
        </Link>
      ) : (
        action && <div className="mt-5">{action}</div>
      )}
    </div>
  );
}
