/* eslint-disable @next/next/no-img-element -- avatars come from Clerk's CDN; next/image would need its domains configured per deploy. */
import { cn } from "@/lib/utils";

export function Avatar({ src, name, size = 32, className }: { src: string | null; name: string; size?: number; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return src ? (
    <img src={src} alt="" width={size} height={size} className={cn("shrink-0 rounded-full bg-muted object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden="true" className={cn("grid shrink-0 place-items-center rounded-full bg-muted font-medium text-muted-foreground", className)} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initial}
    </span>
  );
}
