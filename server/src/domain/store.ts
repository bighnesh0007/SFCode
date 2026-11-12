/**
 * The cosmetic store catalogue. Cosmetics only: nothing here affects grading
 * or ranking. `style` is a token the client maps to visuals; it is never
 * inserted into HTML or CSS directly.
 */
export const SLOTS = ["frame", "badge", "accent"] as const;
export type Slot = (typeof SLOTS)[number];

export interface StoreItem {
  id: string;
  slot: Slot;
  name: string;
  description: string;
  price: number;
  style: string;
}

export const STORE_ITEMS: readonly StoreItem[] = [
  { id: "frame-sky", slot: "frame", name: "Sky frame", description: "A blue ring around your avatar.", price: 30, style: "sky" },
  { id: "frame-gold", slot: "frame", name: "Gold frame", description: "A gold ring for the dedicated.", price: 120, style: "gold" },
  { id: "frame-aurora", slot: "frame", name: "Aurora frame", description: "A shifting gradient ring.", price: 250, style: "aurora" },
  { id: "badge-trigger", slot: "badge", name: "Trigger Tamer", description: "A badge beside your name.", price: 40, style: "trigger" },
  { id: "badge-soql", slot: "badge", name: "Query Whisperer", description: "For the SOQL fans.", price: 40, style: "soql" },
  { id: "badge-flow", slot: "badge", name: "Flow Master", description: "No code, all logic.", price: 40, style: "flow" },
  { id: "badge-champion", slot: "badge", name: "Contest Champion", description: "Bragging rights.", price: 300, style: "champion" },
  { id: "accent-emerald", slot: "accent", name: "Emerald name", description: "Your name in emerald on profiles and boards.", price: 60, style: "emerald" },
  { id: "accent-violet", slot: "accent", name: "Violet name", description: "Your name in violet.", price: 60, style: "violet" },
];

export const itemById = (id: string): StoreItem | undefined => STORE_ITEMS.find((i) => i.id === id);
