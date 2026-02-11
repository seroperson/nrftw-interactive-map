// Item translation utilities
// Maps specificItem IDs to their English names

import itemTranslations from "../assets/item_translations.json";

// Type-safe translation map
const translationMap: Record<string, string> = itemTranslations;

/**
 * Get the English name for a specificItem ID
 * @param itemId - The numeric ID from the game data
 * @returns The English translation if found, otherwise returns the ID as a string
 */
export function getItemName(itemId: number | string): string {
  const id = String(itemId);
  return translationMap[id] || id;
}

/**
 * Check if a translation exists for the given item ID
 * @param itemId - The numeric ID to check
 * @returns True if a translation exists
 */
export function hasTranslation(itemId: number | string): boolean {
  const id = String(itemId);
  return id in translationMap;
}

/**
 * Get all available item IDs that have translations
 * @returns Array of all item IDs as strings
 */
export function getAllItemIds(): string[] {
  return Object.keys(translationMap);
}

/**
 * Get the total number of translated items
 * @returns Count of items with translations
 */
export function getTranslationCount(): number {
  return Object.keys(translationMap).length;
}
