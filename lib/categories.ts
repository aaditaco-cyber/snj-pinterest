import type { JewelryCategory } from "./types";

export const CATEGORIES: { value: JewelryCategory; label: string }[] = [
  { value: "rings", label: "Rings" },
  { value: "earrings", label: "Earrings" },
  { value: "necklaces", label: "Necklaces" },
  { value: "bracelets", label: "Bracelets" },
  { value: "pendants", label: "Pendants" },
  { value: "tennis", label: "Tennis" },
  { value: "bridal", label: "Bridal" },
  { value: "gemstone", label: "Gemstone" },
  { value: "other", label: "Other" },
];

export const CATEGORY_LABEL: Record<JewelryCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<JewelryCategory, string>;

export const FOLDER_COLORS = [
  "#b08d57", // champagne gold
  "#7c3aed", // royal purple
  "#0ea5e9", // sapphire blue
  "#10b981", // emerald
  "#ef4444", // ruby red
  "#f59e0b", // amber
  "#ec4899", // rose pink
  "#0d9488", // teal
  "#525252", // graphite
  "#d97706", // bronze
];
