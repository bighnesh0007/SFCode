import { cn } from "@/lib/utils";

/** A grey placeholder block shown while content loads. Decorative: hidden from screen readers. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** A page-shaped placeholder: title, a line of text, then content blocks. Announces "Loading". */
export function PageSkeleton({ blocks = 3, className }: { blocks?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("mx-auto w-full max-w-5xl space-y-4 px-4 py-8", className)}>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="space-y-3 pt-4">
        {Array.from({ length: blocks }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}

/** The problem workspace's shape: statement on the left, editor and results on the right. */
export function WorkspaceSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex h-[calc(100vh-3rem)] flex-col md:flex-row">
      <div className="space-y-3 border-b p-5 md:w-2/5 md:border-b-0 md:border-r">
        <Skeleton className="h-7 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-20" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className={cn("h-4", i % 3 === 2 ? "w-3/4" : "w-full")} />
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <Skeleton className="m-2 h-7 w-48" />
        <Skeleton className="mx-2 flex-1 rounded-none" />
        <Skeleton className="m-2 h-24" />
      </div>
    </div>
  );
}
