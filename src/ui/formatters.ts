// Shared HTML formatting utilities for resource display

import { COORD_PRECISION } from "../utils/constants";
import {
  isValidResourceType,
  getResourceDisplayName,
} from "../resourceManager";
import { getItemName } from "../utils/itemTranslations";

/**
 * Check if dev mode is enabled
 */
export function isDevMode(): boolean {
  // Check URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("dev")) {
    return true;
  }
  // Check localStorage
  try {
    return localStorage.getItem("nrftw_dev_mode") === "true";
  } catch {
    return false;
  }
}

/**
 * Format resource type and subtype into a display title
 */
export function formatResourceTitle(type: string, subtype: string): string {
  if (type === "loot_spawn") {
    return "Loot Spawn";
  }
  const typeDisplay = isValidResourceType(type)
    ? getResourceDisplayName(type)
    : type;

  const subtypeDisplay = isValidResourceType(subtype)
    ? getResourceDisplayName(subtype)
    : subtype;

  if (type === subtype) {
    return subtypeDisplay;
  }
  return `${typeDisplay.charAt(0).toUpperCase() + typeDisplay.slice(1)}, ${subtypeDisplay.charAt(0).toUpperCase() + subtypeDisplay.slice(1)}`;
}

/**
 * Format world coordinates into HTML
 */
export function formatCoordinates(
  context: "popup" | "tooltip",
  worldX: number,
  worldY: number,
  worldZ: number,
): string {
  return `
    <div class="${context}-coords">
      <span class="${context}-coord ${context}-coord-x">
        <span class="${context}-coord-label">X</span>
        <span class="${context}-coord-value">${worldX.toFixed(COORD_PRECISION)}</span>
      </span>
      <span class="${context}-coord ${context}-coord-y">
        <span class="${context}-coord-label">Y</span>
        <span class="${context}-coord-value">${worldY.toFixed(COORD_PRECISION)}</span>
      </span>
      <span class="${context}-coord ${context}-coord-z">
        <span class="${context}-coord-label">Z</span>
        <span class="${context}-coord-value">${worldZ.toFixed(COORD_PRECISION)}</span>
      </span>
    </div>
  `;
}

/**
 * Format GUID into HTML (only in dev mode)
 */
export function formatGuidHtml(
  context: "popup" | "tooltip",
  idA: number,
  idB: number,
  idC: number,
  idD: number,
): string {
  if (!isDevMode()) {
    return "";
  }
  return `
    <div class="${context}-section ${context}-guid">
      <div class="${context}-section-header">🔑 GUID</div>
      <div class="${context}-section-content">
        <code class="${context}-code">${idA},${idB},${idC},${idD}</code>
      </div>
    </div>
  `;
}

/**
 * Format file path into HTML (only in dev mode)
 */
export function formatPathHtml(
  context: "popup" | "tooltip",
  path?: string,
): string {
  if (!isDevMode() || path === undefined) {
    return "";
  }
  return `
    <div class="${context}-section ${context}-path">
      <div class="${context}-section-header">📁 File Path</div>
      <div class="${context}-section-content">
        <code class="${context}-code ${context}-code-path">${path}</code>
      </div>
    </div>
  `;
}

/**
 * Format drop information into HTML
 */
export function formatDropHtml(
  context: "popup" | "tooltip",
  drop: any,
): string {
  if (!drop || !drop.groups || drop.groups.length === 0) {
    return "";
  }

  let html = `<div class="${context}-section ${context}-drop">`;
  html += `<div class="${context}-section-header">💎 Drop Rates</div>`;
  html += `<div class="${context}-section-content">`;

  drop.groups.forEach((group: any, groupIndex: number) => {
    // Add separator between groups
    if (groupIndex > 0) {
      html += `<div class="${context}-drop-group-separator"></div>`;
    }

    html += `<div class="${context}-drop-group">`;

    if (group.chances && group.chances.length > 0) {
      html += `<div class="${context}-drop-chances">`;
      html += group.chances
        .map(
          (c: any) =>
            `<span class="${context}-badge ${context}-badge-chance">x${c.count} (${c.chance}%)</span>`,
        )
        .join("");
      html += "</div>";
    }

    if (group.items && group.items.length > 0) {
      html += `<div class="${context}-drop-items">`;
      for (const item of group.items) {
        if (item.specificItem && item.specificItem.length > 0) {
          html += `<div class="${context}-drop-item">`;
          html += `<span class="${context}-item-label">Items:</span> `;
          html += item.specificItem
            .map(
              (id: any) =>
                `<span class="${context}-badge ${context}-badge-pool">${getItemName(id)}</span>`,
            )
            .join(" ");
          html += `</div>`;
        }
        if (item.filterPool && item.filterPool.length > 0) {
          html += `<div class="${context}-drop-item">`;
          html += `<span class="${context}-item-label">Item Pool:</span> `;
          html += item.filterPool
            .map(
              (p: string) =>
                `<span class="${context}-badge ${context}-badge-pool">${p}</span>`,
            )
            .join(" ");
          html += `</div>`;
        }
      }
      html += "</div>";
    }

    html += `</div>`;
  });

  html += "</div></div>";
  return html;
}

/**
 * Format loot spawn information into HTML
 */
export function formatLootSpawnInfoHtml(
  context: "popup" | "tooltip",
  lootSpawnInfo: any,
): string {
  if (
    !lootSpawnInfo ||
    (typeof lootSpawnInfo === "object" &&
      Object.keys(lootSpawnInfo).length === 0)
  ) {
    return "";
  }

  let html = `<div class="${context}-section ${context}-loot-spawn">`;
  html += `<div class="${context}-section-header">📍 Loot Spawn Info</div>`;
  html += `<div class="${context}-section-content">`;

  // Chest/Shiny types as badges
  const typeBadges: string[] = [];

  if (lootSpawnInfo.shiny)
    typeBadges.push(
      `<span class="${context}-badge ${context}-badge-shiny">✨ Shiny</span>`,
    );
  if (lootSpawnInfo.specialShiny)
    typeBadges.push(
      `<span class="${context}-badge ${context}-badge-special">⭐ Special Shiny</span>`,
    );
  if (lootSpawnInfo.smallChest)
    typeBadges.push(
      `<span class="${context}-badge ${context}-badge-chest">📦 Small Chest</span>`,
    );
  if (lootSpawnInfo.mediumChest)
    typeBadges.push(
      `<span class="${context}-badge ${context}-badge-chest">📦 Medium Chest</span>`,
    );
  if (lootSpawnInfo.largeChest)
    typeBadges.push(
      `<span class="${context}-badge ${context}-badge-chest">📦 Large Chest</span>`,
    );
  if (lootSpawnInfo.specialChest)
    typeBadges.push(
      `<span class="${context}-badge ${context}-badge-special">🎁 Special Chest</span>`,
    );

  if (typeBadges.length > 0) {
    html += `<div class="${context}-badges">${typeBadges.join("")}</div>`;
  }

  // Respawn info as properties
  const hasRespawnInfo =
    lootSpawnInfo.respawnChance !== undefined ||
    lootSpawnInfo.respawnFreq ||
    lootSpawnInfo.spawnCondition;

  if (hasRespawnInfo) {
    html += `<div class="${context}-properties">`;

    if (
      lootSpawnInfo.respawnChance !== undefined &&
      lootSpawnInfo.respawnChance !== null
    ) {
      html += `<div class="${context}-property">`;
      html += `<span class="${context}-property-label">Spawn Chance:</span>`;
      html += `<span class="${context}-property-value">${(lootSpawnInfo.respawnChance * 100).toFixed(0)}%</span>`;
      html += `</div>`;
    }

    if (lootSpawnInfo.respawnFreq) {
      html += `<div class="${context}-property">`;
      html += `<span class="${context}-property-label">Frequency:</span>`;
      html += `<span class="${context}-property-value">${lootSpawnInfo.respawnFreq}</span>`;
      html += `</div>`;
    }

    if (lootSpawnInfo.spawnCondition) {
      html += `<div class="${context}-property">`;
      html += `<span class="${context}-property-label">Condition:</span>`;
      html += `<span class="${context}-property-value ${context}-property-value-small">${lootSpawnInfo.spawnCondition}</span>`;
      html += `</div>`;
    }

    html += `</div>`;
  }

  if (typeBadges.length === 0 && !hasRespawnInfo) {
    html += `<div class="${context}-empty">No spawn info</div>`;
  }

  html += "</div></div>";
  return html;
}
