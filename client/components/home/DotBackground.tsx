import { cn } from "@/lib/utils";

/** A dotted grid that fades out from the centre (Aceternity's grid & dot background). Follows the theme via --border. */
export function DotBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--color-border)_1.2px,transparent_1.2px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]",
        className,
      )}
    />
  );
}
