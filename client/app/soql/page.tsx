import { TrackLanding } from "@/components/TrackLanding";

// Server-rendered so search engines see the problem list; the interactive version is /problems?track=soql.
export default function Page() {
  return <TrackLanding track="soql" />;
}
