import { Markdown } from "@/components/Markdown";

/** A plain, readable legal page rendered from Markdown. */
export function LegalPage({ title, updated, source }: { title: string; updated: string; source: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated {updated}</p>
      <Markdown source={source} className="markdown mt-6 text-sm leading-relaxed" />
    </div>
  );
}
