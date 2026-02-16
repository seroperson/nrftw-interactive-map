// Shared HTML formatting utilities for resource display

import { COORD_PRECISION } from "../utils/constants";
import {
  isValidResourceType,
  getResourceDisplayName,
} from "../resourceManager";
import { getItemName } from "../utils/itemTranslations";
import conditionTranslationsStr from "../assets/condition_translations.json?raw";

// Load condition translations (quests, questSteps, worldEvents)
let conditionTranslations: any = null;

async function loadConditionTranslations() {
  if (conditionTranslations === null) {
    try {
      conditionTranslations = JSON.parse(conditionTranslationsStr);
    } catch (error) {
      console.warn("Could not load condition translations:", error);
      conditionTranslations = { quests: {}, questSteps: {}, worldEvents: {} };
    }
  }
  return conditionTranslations;
}

// Initialize translations loading
loadConditionTranslations();

/**
 * Format camelCase or snake_case names into readable titles
 * Examples:
 *   faithAndFlame -> Faith And Flame
 *   spilledBloodStep020GoToRookeryAfterBreach -> Spilled Blood Step 020 Go To Rookery After Breach
 */
function formatName(name: string): string {
  // Split on capital letters, numbers, and underscores
  return (
    name
      // Insert space before capital letters
      .replace(/([A-Z])/g, " $1")
      // Replace underscores with spaces
      .replace(/_/g, " ")
      // Insert space before numbers
      .replace(/(\d+)/g, " $1 ")
      // Clean up multiple spaces
      .replace(/\s+/g, " ")
      // Trim and capitalize first letter
      .trim()
      .replace(/^./, (str) => str.toUpperCase())
  );
}

function getQuestName(questGuid: string): string {
  if (!conditionTranslations) return questGuid;
  const rawName = conditionTranslations.quests?.[questGuid];
  return rawName ? formatName(rawName) : questGuid;
}

function getQuestStepName(stepGuid: string): string {
  if (!conditionTranslations) return stepGuid;
  const rawName = conditionTranslations.questSteps?.[stepGuid];
  return rawName ? formatName(rawName) : stepGuid;
}

function getWorldEventName(eventGuid: string): string {
  if (!conditionTranslations) return eventGuid;
  const rawName = conditionTranslations.worldEvents?.[eventGuid];
  return rawName ? formatName(rawName) : eventGuid;
}

/**
 * Check if expert mode is enabled
 */
export function isDevMode(): boolean {
  try {
    const storedState = localStorage.getItem("nrftw_map_state");
    if (storedState) {
      const state = JSON.parse(storedState);
      return state.expertMode === true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Format resource type and subtype into a display title
 */
export function formatResourceTitle(type: string, subtype: string): string {
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
  id: string,
): string {
  if (!isDevMode()) {
    return "";
  }
  return `
    <div class="${context}-section ${context}-guid">
      <div class="${context}-section-header">🔑 GUID</div>
      <div class="${context}-section-content">
        <code class="${context}-code">${id}</code>
      </div>
    </div>
  `;
}

/**
 * Format file path into HTML (only in expert mode)
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
 * Format classname into HTML (only in expert mode)
 */
export function formatClassnameHtml(
  context: "popup" | "tooltip",
  classname?: string,
): string {
  if (!isDevMode() || !classname) {
    return "";
  }
  return `
    <div class="${context}-section ${context}-classname">
      <div class="${context}-section-header">🏷️ Classname</div>
      <div class="${context}-section-content">
        <code class="${context}-code">${classname}</code>
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
 * Get emoji for spawner tag
 */
function getSpawnerEmoji(tag: string): string {
  const tagLower = tag.toLowerCase();

  // Enemy types
  if (tagLower.includes("plague")) return "💀";
  if (tagLower.includes("rat")) return "🐀";
  if (tagLower.includes("boss")) return "👑";
  if (tagLower.includes("elite")) return "⭐";
  if (tagLower.includes("critter")) return "🐻";

  // Loot types
  if (tagLower.includes("shiny")) return "✨";
  if (tagLower.includes("chest")) return "📦";

  // Default
  return "🎯";
}

/**
 * Get spawner type category for badge styling
 */
function getSpawnerType(tag: string): string {
  const tagLower = tag.toLowerCase();

  // Shiny categories
  if (tagLower.includes("shiny")) {
    if (tagLower.includes("special")) return "special-shiny";
    return "shiny";
  }

  // Chest categories
  if (tagLower.includes("chest")) {
    if (tagLower.includes("special")) return "special-chest";
    return "chest";
  }

  // Critters (small animals)
  if (
    tagLower.includes("rat") ||
    tagLower.includes("critter") ||
    tagLower.includes("deer")
  ) {
    return "critter";
  }

  // All other enemies (default for enemy types)
  if (
    tagLower.includes("wolf") ||
    tagLower.includes("bear") ||
    tagLower.includes("boss") ||
    tagLower.includes("elite")
  ) {
    return "enemy";
  }

  // Default to enemy category
  return "enemy";
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
  html += `<div class="${context}-section-header">📍 Spawner Info</div>`;
  html += `<div class="${context}-section-content">`;

  const anyTags = lootSpawnInfo.anyTags || [];
  const allTags = lootSpawnInfo.allTags || [];
  const noneTags = lootSpawnInfo.noneTags || [];

  const hasAnyTags =
    anyTags.length > 0 || allTags.length > 0 || noneTags.length > 0;

  if (hasAnyTags) {
    // Any Tags (at least one of these)
    if (anyTags.length > 0) {
      html += `<div class="${context}-tag-group">`;
      html += `<div class="${context}-tag-group-label">Any of:</div>`;
      html += `<div class="${context}-badges">`;
      anyTags.forEach((tag: string) => {
        const emoji = getSpawnerEmoji(tag);
        const formattedTag = formatName(tag);
        const spawnerType = getSpawnerType(tag);
        const badgeClass = `${context}-badge ${context}-badge-spawner-${spawnerType}`;
        html += `<span class="${badgeClass}">${emoji} ${formattedTag}</span>`;
      });
      html += `</div></div>`;
    }

    // All Tags (must have all of these)
    if (allTags.length > 0) {
      html += `<div class="${context}-tag-group">`;
      html += `<div class="${context}-tag-group-label">Combination of:</div>`;
      html += `<div class="${context}-badges">`;
      allTags.forEach((tag: string) => {
        const emoji = getSpawnerEmoji(tag);
        const formattedTag = formatName(tag);
        const spawnerType = getSpawnerType(tag);
        const badgeClass = `${context}-badge ${context}-badge-spawner-${spawnerType}`;
        html += `<span class="${badgeClass}">${emoji} ${formattedTag}</span>`;
      });
      html += `</div></div>`;
    }

    // None Tags (must not have any of these)
    if (noneTags.length > 0) {
      html += `<div class="${context}-tag-group">`;
      html += `<div class="${context}-tag-group-label">But not:</div>`;
      html += `<div class="${context}-badges">`;
      noneTags.forEach((tag: string) => {
        const emoji = getSpawnerEmoji(tag);
        const formattedTag = formatName(tag);
        const spawnerType = getSpawnerType(tag);
        const badgeClass = `${context}-badge ${context}-badge-spawner-${spawnerType} ${context}-badge-negated`;
        html += `<span class="${badgeClass}">${emoji} ${formattedTag}</span>`;
      });
      html += `</div></div>`;
    }
  }

  // Display respawn info
  const hasRespawnInfo =
    lootSpawnInfo.respawnFreq ||
    (lootSpawnInfo.missChance !== undefined &&
      lootSpawnInfo.missChance !== null);

  if (hasRespawnInfo) {
    if (lootSpawnInfo.respawnFreq) {
      html += `<div class="${context}-tag-group">`;
      html += `<div class="${context}-tag-group-label">Respawn Frequency:</div>`;
      html += `<div class="${context}-badges">`;
      html += `<span class="${context}-badge ${context}-badge-pool">${lootSpawnInfo.respawnFreq}</span>`;
      html += `</div></div>`;
    }

    if (
      lootSpawnInfo.missChance !== undefined &&
      lootSpawnInfo.missChance !== null
    ) {
      html += `<div class="${context}-tag-group">`;
      html += `<div class="${context}-tag-group-label">Miss Chance:</div>`;
      html += `<div class="${context}-badges">`;
      html += `<span class="${context}-badge ${context}-badge-pool">${(lootSpawnInfo.missChance * 100).toFixed(0)}%</span>`;
      html += `</div></div>`;
    }
  }

  if (allTags.length === 0 && !hasRespawnInfo) {
    html += `<div class="${context}-empty">No spawn info</div>`;
  }

  html += "</div></div>";
  return html;
}

/**
 * Helper to check if a condition set has any non-empty conditions
 */
function hasAnyConditions(conditionSet: any): boolean {
  if (!conditionSet) return false;

  return (
    (Array.isArray(conditionSet.questSteps) &&
      conditionSet.questSteps.length > 0) ||
    (Array.isArray(conditionSet.quests) && conditionSet.quests.length > 0) ||
    (Array.isArray(conditionSet.worldEvents) &&
      conditionSet.worldEvents.length > 0) ||
    (Array.isArray(conditionSet.timesOfDay) &&
      conditionSet.timesOfDay.length > 0) ||
    (Array.isArray(conditionSet.hasItems) &&
      conditionSet.hasItems.length > 0) ||
    (Array.isArray(conditionSet.hasModifiers) &&
      conditionSet.hasModifiers.length > 0) ||
    (Array.isArray(conditionSet.activities) &&
      conditionSet.activities.length > 0) ||
    (Array.isArray(conditionSet.boons) && conditionSet.boons.length > 0) ||
    conditionSet.hasGold !== null
  );
}

/**
 * Format a single condition set (quests, worldEvents, etc.)
 */
function formatConditionSet(
  context: "popup" | "tooltip",
  conditionSet: any,
  title: string,
): string {
  if (!hasAnyConditions(conditionSet)) {
    return "";
  }

  let html = `<div class="${context}-condition-subsection">`;
  html += `<div class="${context}-tag-group-label">${title}</div>`;
  html += `<div class="${context}-condition-subsection-content">`;

  // Quest Steps
  if (
    Array.isArray(conditionSet.questSteps) &&
    conditionSet.questSteps.length > 0
  ) {
    html += `<div class="${context}-condition-item">`;
    html += `<span class="${context}-item-label">Quest Steps:</span>`;
    html += `<div class="${context}-condition-values">`;
    conditionSet.questSteps.forEach((step: any) => {
      const stepName = getQuestStepName(step.questGuid);
      html += `<span class="${context}-badge" title="${step.questGuid}">${stepName} (${step.state})</span>`;
    });
    html += `</div></div>`;
  }

  // Quests
  if (Array.isArray(conditionSet.quests) && conditionSet.quests.length > 0) {
    html += `<div class="${context}-condition-item">`;
    html += `<span class="${context}-item-label">Quests:</span>`;
    html += `<div class="${context}-condition-values">`;
    conditionSet.quests.forEach((quest: any) => {
      const questName = getQuestName(quest.questGuid);
      html += `<span class="${context}-badge" title="${quest.questGuid}">${questName} (${quest.state})</span>`;
    });
    html += `</div></div>`;
  }

  // World Events
  if (
    Array.isArray(conditionSet.worldEvents) &&
    conditionSet.worldEvents.length > 0
  ) {
    html += `<div class="${context}-condition-item">`;
    html += `<span class="${context}-item-label">World Events:</span>`;
    html += `<div class="${context}-condition-values">`;
    conditionSet.worldEvents.forEach((event: any) => {
      const eventName = getWorldEventName(event.eventGuid);
      html += `<span class="${context}-badge" title="${event.eventGuid}">${eventName} (${event.state})</span>`;
    });
    html += `</div></div>`;
  }

  // Times of Day
  if (
    Array.isArray(conditionSet.timesOfDay) &&
    conditionSet.timesOfDay.length > 0
  ) {
    html += `<div class="${context}-condition-item">`;
    html += `<span class="${context}-item-label">Times of Day:</span>`;
    html += `<div class="${context}-condition-values">`;
    conditionSet.timesOfDay.forEach((time: any) => {
      html += `<span class="${context}-badge">${JSON.stringify(time)}</span>`;
    });
    html += `</div></div>`;
  }

  // Has Items
  if (
    Array.isArray(conditionSet.hasItems) &&
    conditionSet.hasItems.length > 0
  ) {
    html += `<div class="${context}-condition-item">`;
    html += `<span class="${context}-item-label">Has Items:</span>`;
    html += `<div class="${context}-condition-values">`;
    conditionSet.hasItems.forEach((item: any) => {
      html += `<span class="${context}-badge">${JSON.stringify(item)}</span>`;
    });
    html += `</div></div>`;
  }

  // Has Modifiers
  if (
    Array.isArray(conditionSet.hasModifiers) &&
    conditionSet.hasModifiers.length > 0
  ) {
    html += `<div class="${context}-condition-item">`;
    html += `<span class="${context}-item-label">Has Modifiers:</span>`;
    html += `<div class="${context}-condition-values">`;
    conditionSet.hasModifiers.forEach((modifier: any) => {
      html += `<span class="${context}-badge">${JSON.stringify(modifier)}</span>`;
    });
    html += `</div></div>`;
  }

  // Activities
  if (
    Array.isArray(conditionSet.activities) &&
    conditionSet.activities.length > 0
  ) {
    html += `<div class="${context}-condition-item">`;
    html += `<span class="${context}-item-label">Activities:</span>`;
    html += `<div class="${context}-condition-values">`;
    conditionSet.activities.forEach((activity: any) => {
      html += `<span class="${context}-badge">${JSON.stringify(activity)}</span>`;
    });
    html += `</div></div>`;
  }

  // Boons
  if (Array.isArray(conditionSet.boons) && conditionSet.boons.length > 0) {
    html += `<div class="${context}-condition-item">`;
    html += `<span class="${context}-item-label">Boons:</span>`;
    html += `<div class="${context}-condition-values">`;
    conditionSet.boons.forEach((boon: any) => {
      html += `<span class="${context}-badge">${JSON.stringify(boon)}</span>`;
    });
    html += `</div></div>`;
  }

  // Has Gold
  if (conditionSet.hasGold !== null && conditionSet.hasGold !== undefined) {
    html += `<div class="${context}-condition-item">`;
    html += `<span class="${context}-item-label">Has Gold:</span>`;
    html += `<span class="${context}-condition-value">${conditionSet.hasGold}</span>`;
    html += `</div>`;
  }

  html += `</div></div>`;
  return html;
}

/**
 * Format spawn conditions into HTML
 */
export function formatSpawnConditionsHtml(
  context: "popup" | "tooltip",
  spawnConditions: any,
): string {
  if (
    !spawnConditions ||
    (typeof spawnConditions === "object" &&
      Object.keys(spawnConditions).length === 0)
  ) {
    return "";
  }

  // Check if there are any non-empty conditions
  const hasRequiredConditions = hasAnyConditions(
    spawnConditions.requiredSpawnConditions,
  );
  const hasDisableConditions = hasAnyConditions(
    spawnConditions.disableConditions,
  );
  const hasRespawnConditions = hasAnyConditions(
    spawnConditions.respawnConditions,
  );

  // If all condition sets are empty, don't show the section
  if (
    !hasRequiredConditions &&
    !hasDisableConditions &&
    !hasRespawnConditions
  ) {
    return "";
  }

  let html = `<div class="${context}-section ${context}-spawn-conditions">`;
  html += `<div class="${context}-section-header">⚙️ Conditions</div>`;
  html += `<div class="${context}-section-content">`;

  // Spawn Conditions
  html += formatConditionSet(
    context,
    spawnConditions.requiredSpawnConditions,
    "Spawn Conditions:",
  );

  // Disable Conditions
  html += formatConditionSet(
    context,
    spawnConditions.disableConditions,
    "Disable Conditions:",
  );

  // Respawn Conditions
  html += formatConditionSet(
    context,
    spawnConditions.respawnConditions,
    "Respawn Conditions:",
  );

  html += "</div></div>";
  return html;
}
