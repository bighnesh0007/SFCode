/**
 * The cosmetic store catalogue. Cosmetics only: nothing here affects grading
 * or ranking. `style` is a token the client maps to visuals; it is never
 * inserted into HTML or CSS directly.
 */
export const SLOTS = ["frame", "badge", "accent", "editor", "banner"] as const;
export type Slot = (typeof SLOTS)[number];

/** How special an item is: shown as a coloured tier on the card, and roughly tracks price. */
export const RARITIES = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

export interface StoreItem {
  id: string;
  slot: Slot;
  name: string;
  description: string;
  price: number;
  style: string;
  rarity: Rarity;
}

export const STORE_ITEMS: readonly StoreItem[] = [
  // Frames
  { id: "frame-sky", slot: "frame", name: "Sky frame", description: "A blue ring around your avatar.", price: 30, style: "sky", rarity: "common" },
  { id: "frame-gold", slot: "frame", name: "Gold frame", description: "A gold ring for the dedicated.", price: 120, style: "gold", rarity: "rare" },
  { id: "frame-pulse", slot: "frame", name: "Pulse frame", description: "An animated ring that ripples outward.", price: 150, style: "pulse", rarity: "rare" },
  { id: "frame-neon", slot: "frame", name: "Neon frame", description: "A flickering cyan-and-pink neon tube.", price: 180, style: "neon", rarity: "rare" },
  { id: "frame-rainbow", slot: "frame", name: "Prism frame", description: "An animated ring that cycles through colours.", price: 220, style: "prism", rarity: "epic" },
  { id: "frame-aurora", slot: "frame", name: "Aurora frame", description: "A shifting gradient ring.", price: 250, style: "aurora", rarity: "epic" },
  { id: "frame-galaxy", slot: "frame", name: "Galaxy frame", description: "A slowly orbiting ring of deep-space colours.", price: 320, style: "galaxy", rarity: "epic" },
  { id: "frame-ember", slot: "frame", name: "Ember frame", description: "A ring that flickers like a campfire.", price: 350, style: "ember", rarity: "epic" },
  { id: "frame-holo", slot: "frame", name: "Holographic frame", description: "A rainbow foil ring that shimmers as it turns.", price: 600, style: "holo", rarity: "legendary" },
  // Banners (behind your profile header)
  { id: "banner-sunset", slot: "banner", name: "Sunset banner", description: "Warm dusk colours behind your profile header.", price: 100, style: "sunset", rarity: "common" },
  { id: "banner-waves", slot: "banner", name: "Ocean banner", description: "Gentle layered waves that drift.", price: 120, style: "waves", rarity: "common" },
  { id: "banner-circuit", slot: "banner", name: "Circuit banner", description: "A circuit board with pulses running along its traces.", price: 180, style: "circuit", rarity: "rare" },
  { id: "banner-aurora", slot: "banner", name: "Aurora banner", description: "Northern lights rippling across the sky.", price: 200, style: "aurora", rarity: "rare" },
  { id: "banner-starfield", slot: "banner", name: "Starfield banner", description: "Twinkling stars on a deep night sky.", price: 300, style: "starfield", rarity: "epic" },
  { id: "banner-synthwave", slot: "banner", name: "Synthwave banner", description: "A neon grid racing toward a retro sun.", price: 350, style: "synthwave", rarity: "epic" },
  { id: "banner-coderain", slot: "banner", name: "Code Rain banner", description: "Falling columns of green glyphs.", price: 500, style: "coderain", rarity: "legendary" },
  // Badges
  { id: "badge-bulk", slot: "badge", name: "Bulkified", description: "Never met a loop you couldn't bulkify.", price: 40, style: "bulk", rarity: "common" },
  { id: "badge-trigger", slot: "badge", name: "Trigger Tamer", description: "A badge beside your name.", price: 40, style: "trigger", rarity: "common" },
  { id: "badge-soql", slot: "badge", name: "Query Whisperer", description: "For the SOQL fans.", price: 40, style: "soql", rarity: "common" },
  { id: "badge-flow", slot: "badge", name: "Flow Master", description: "No code, all logic.", price: 40, style: "flow", rarity: "common" },
  { id: "badge-lwc", slot: "badge", name: "LWC Artisan", description: "Components, crafted.", price: 100, style: "lwc", rarity: "rare" },
  { id: "badge-async", slot: "badge", name: "Async Ace", description: "Queueables, batches and futures, mastered.", price: 100, style: "async", rarity: "rare" },
  { id: "badge-limits", slot: "badge", name: "Governor Limit Survivor", description: "101 SOQL queries? Not on your watch.", price: 150, style: "limits", rarity: "rare" },
  { id: "badge-champion", slot: "badge", name: "Contest Champion", description: "Bragging rights.", price: 300, style: "champion", rarity: "epic" },
  { id: "badge-legend", slot: "badge", name: "Legend", description: "A gilded badge with a shine that sweeps across it.", price: 800, style: "legend", rarity: "legendary" },
  // Name effects
  { id: "accent-emerald", slot: "accent", name: "Emerald name", description: "Your name in emerald on profiles and boards.", price: 60, style: "emerald", rarity: "common" },
  { id: "accent-violet", slot: "accent", name: "Violet name", description: "Your name in violet.", price: 60, style: "violet", rarity: "common" },
  { id: "accent-glow", slot: "accent", name: "Neon glow name", description: "Your name glows like a neon sign.", price: 160, style: "glow", rarity: "rare" },
  { id: "accent-shimmer", slot: "accent", name: "Shimmer name", description: "A gradient that sweeps across your name.", price: 280, style: "shimmer", rarity: "epic" },
  { id: "accent-flame", slot: "accent", name: "Flame name", description: "Your name in flickering fire colours.", price: 300, style: "flame", rarity: "epic" },
  { id: "accent-holo", slot: "accent", name: "Holographic name", description: "Rainbow foil lettering that shifts as it moves.", price: 450, style: "holo", rarity: "legendary" },
  // Editor themes
  { id: "editor-midnight", slot: "editor", name: "Midnight editor", description: "A deep purple theme for the code editor.", price: 100, style: "midnight", rarity: "rare" },
  { id: "editor-paper", slot: "editor", name: "Paper editor", description: "A warm, low-glare light theme for the code editor.", price: 100, style: "paper", rarity: "rare" },
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
