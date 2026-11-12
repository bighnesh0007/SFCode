import Link from "next/link";
import { ArrowRight, Cloud } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FEATURES } from "@/lib/features";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-12 sm:py-16">
      <section className="mx-auto max-w-3xl text-center">
        <Badge variant="secondary" className="mb-4">For Salesforce developers</Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Practice Salesforce development <span className="text-primary">for real</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Run Apex against your own connected org, then sharpen SOQL, LWC, triggers and async Apex with
          LeetCode-style challenges.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/playground/apex" className={buttonVariants({ size: "lg" })}>
            Open Apex Playground <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
          <Link href="/settings/org" className={buttonVariants({ size: "lg", variant: "outline" })}>
            <Cloud className="mr-1 h-4 w-4" /> Connect your org
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Link key={f.id} href={f.href} className="group">
              <Card className={cn("h-full transition-colors group-hover:border-primary/50", f.status === "soon" && "opacity-80")}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    {f.status === "live" ? <Badge>Live</Badge> : <Badge variant="outline">Soon</Badge>}
                  </div>
                  <CardTitle className="mt-3">{f.title}</CardTitle>
                  <CardDescription>{f.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
