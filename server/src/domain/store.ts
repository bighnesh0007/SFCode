/**
 * The cosmetic store catalogue. Cosmetics only: nothing here affects grading
 * or ranking. `style` is a token the client maps to visuals; it is never
 * inserted into HTML or CSS directly.
 */
export const SLOTS = ["frame", "badge", "accent", "editor"] as const;
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
  { id: "frame-pulse", slot: "frame", name: "Pulse frame", description: "An animated ring that ripples outward.", price: 150, style: "pulse" },
  { id: "frame-rainbow", slot: "frame", name: "Prism frame", description: "An animated ring that cycles through colours.", price: 220, style: "prism" },
  { id: "editor-midnight", slot: "editor", name: "Midnight editor", description: "A deep purple theme for the code editor.", price: 100, style: "midnight" },
  { id: "editor-paper", slot: "editor", name: "Paper editor", description: "A warm, low-glare light theme for the code editor.", price: 100, style: "paper" },
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

/**
 * Streak Freeze: a consumable. Each purchase is stored as its own item id
 * (streak-freeze-1, -2, …) so the existing purchase table, lock and spend
 * totals handle it. It automatically covers one missed day in the current
 * streak; at most MAX_FREEZES unused at a time.
 */
export const STREAK_FREEZE = { id: "streak-freeze", name: "Streak Freeze", description: "Covers one missed day so your streak survives. Used automatically.", price: 60 } as const;
export const MAX_FREEZES = 2;
export const isFreezeId = (id: string) => /^streak-freeze-\d+$/.test(id);
