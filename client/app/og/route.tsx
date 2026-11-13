import { ogCard } from "@/lib/ogCard";

/** Share card for any page: /og?t=<title>&k=<kicker>. Text is clipped so a crafted URL can't produce a giant image. */
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const title = (q.get("t") ?? "Salesforce practice").slice(0, 90);
  const kicker = (q.get("k") ?? "SFCode").slice(0, 40);
  const res = ogCard({ kicker, title, footer: "Free Salesforce practice · sf.bighnesh.space" });
  res.headers.set("Cache-Control", "public, max-age=86400, immutable");
  return res;
}
