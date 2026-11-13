import { OG_SIZE, ogCard } from "@/lib/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "SFCode: Salesforce practice problems for Apex, SOQL, LWC and Flow";

export default function Image() {
  return ogCard({ kicker: "Free Salesforce practice", title: "Apex, SOQL, LWC and Flow problems, graded in your own org", footer: "Certification practice · Roadmaps · Contests · sf.bighnesh.space" });
}
