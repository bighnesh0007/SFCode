/** The problem tracks as the UI presents them. Mirrors server TRACKS. */
import type { Track } from "./challengesApi";

export const TRACK_INFO: readonly { id: Track; label: string; base: string; blurb: string }[] = [
  { id: "apex", label: "Apex", base: "/challenges", blurb: "Triggers, classes, Batch and async Apex." },
  { id: "soql", label: "SOQL", base: "/soql", blurb: "One query per problem, checked row by row." },
  { id: "debug", label: "Debugging", base: "/debugging", blurb: "Start from broken Apex and fix it." },
  { id: "flow", label: "Flows", base: "/flows", blurb: "Build record-triggered flows in your org, no code." },
  { id: "lwc", label: "LWC", base: "/lwc", blurb: "Build Lightning Web Components, previewed and tested in your browser." },
];

export const trackInfo = (id: Track) => TRACK_INFO.find((t) => t.id === id) ?? TRACK_INFO[0];

export function isTrack(value: string | null): value is Track {
  return TRACK_INFO.some((t) => t.id === value);
}
