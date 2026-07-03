/**
 * THE brand module. Every occurrence of the product name flows from here —
 * a rename ("Four Crowns" is the live alternative) is a one-line change.
 * The logo is the name-independent Meridian Rose monogram (see
 * components/brand/MeridianRose.tsx), which works for either name.
 */
export const BRAND = {
  /** The product name. Change here, changes everywhere. */
  name: "Roto Chess",
  tagline: "Four players. One ring. The crown is taken, not given.",
  description:
    "A four-player team chess variant played on a circular board — invented over a decade of real games, now playable online with your table.",
  /** Used in <title> templates: "Lobby · Roto Chess" */
  titleTemplate: (page?: string) =>
    page ? `${page} · ${BRAND.name}` : BRAND.name,
  /** Rules artifact naming. */
  rulebookVersion: "v3.1",
} as const;
