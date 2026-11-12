import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { featureById } from "@/lib/features";

/** Placeholder for a catalogued feature that has not been built yet. */
export function ComingSoon({ id }: { id: string }) {
  const f = featureById(id);
  const Icon = f.icon;
  return (
    <div className="container mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <div className="mb-5 rounded-2xl border bg-primary/10 p-4 text-primary">
        <Icon className="h-8 w-8" />
      </div>
      <Badge variant="secondary" className="mb-3">Coming soon</Badge>
      <h1 className="text-3xl font-bold tracking-tight">{f.title}</h1>
      <p className="mt-3 text-muted-foreground">{f.description}</p>
      <Link href="/playground/apex" className={buttonVariants({ className: "mt-8" })}>
        Try the Apex Playground
      </Link>
    </div>
  );
}
