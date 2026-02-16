// Resource management: definitions, loading, and parsing

import {
  ResourceType,
  ResourceGroup,
  Resource,
  LoadedResources,
} from "./types";

// ============================================================================
// Resource Type Definitions
// ============================================================================

type MainGroupTypes = {
  ore: {
    iron: SubGroupDef;
    copper: SubGroupDef;
    silver: SubGroupDef;
  };
  wood: {
    birch: SubGroupDef;
    spruce: SubGroupDef;
    pine: SubGroupDef;
  };
  herb: {
    artemisia: SubGroupDef;
    dracaena: SubGroupDef;
    lithops: SubGroupDef;
    mushroom: SubGroupDef;
  };
  food: {
    blueberry: SubGroupDef;
    firebrandberry: SubGroupDef;
    horseshoe_crab: SubGroupDef;
    potato: SubGroupDef;
    tomato: SubGroupDef;
  };
  fishing: {
    carp: SubGroupDef;
    trout: SubGroupDef;
    bass: SubGroupDef;
  };
  digging: SubGroupDef;
  bonfire: SubGroupDef;
  whisper: SubGroupDef;
  spawner: {
    spawner: SubGroupDef;
    shiny: SubGroupDef;
    special_shiny: SubGroupDef;
    small_chest: SubGroupDef;
    medium_chest: SubGroupDef;
    large_chest: SubGroupDef;
    special_chest: SubGroupDef;
  };
  interactible: {
    ladder: SubGroupDef;
    wall_climb: SubGroupDef;
    door: SubGroupDef;
    lever: SubGroupDef;
    readable: SubGroupDef;
    entrance: SubGroupDef;
    house_entrance: SubGroupDef;
    platform: SubGroupDef;
    other: SubGroupDef;
  };
  destructible: {
    des_door: SubGroupDef;
    wall: SubGroupDef;
  };
  npc: {
    animal: SubGroupDef;
    boss: SubGroupDef;
    enemies: SubGroupDef;
    npc_other: SubGroupDef;
  };
};

interface SubGroupDef {
  displayName: string;
  color: string;
  sortingOrder: number;
}

const TYPES: MainGroupTypes = {
  ore: {
    copper: {
      displayName: "Copper",
      color: "#D84315",
      sortingOrder: 1,
    },
    iron: {
      displayName: "Iron",
      color: "#9E9E9E",
      sortingOrder: 2,
    },
    silver: {
      displayName: "Silver",
      color: "#ECEFF1",
      sortingOrder: 3,
    },
  },
  wood: {
    birch: {
      displayName: "Birch",
      color: "#F4E4C1",
      sortingOrder: 1,
    },
    spruce: {
      displayName: "Spruce",
      color: "#2D5016",
      sortingOrder: 2,
    },
    pine: {
      displayName: "Pine",
      color: "#7CB342",
      sortingOrder: 3,
    },
  },
  herb: {
    artemisia: {
      displayName: "Artemisia",
      color: "#CDDC39",
      sortingOrder: 1,
    },
    dracaena: {
      displayName: "Dracaena",
      color: "#00C853",
      sortingOrder: 2,
    },
    lithops: {
      displayName: "Lithops",
      color: "#69F0AE",
      sortingOrder: 3,
    },
    mushroom: {
      displayName: "Mushroom",
      color: "#E040FB",
      sortingOrder: 4,
    },
  },
  food: {
    blueberry: {
      displayName: "Blueberry",
      color: "#3D5AFE",
      sortingOrder: 1,
    },
    firebrandberry: {
      displayName: "Firebrand Berry",
      color: "#FF1744",
      sortingOrder: 2,
    },
    horseshoe_crab: {
      displayName: "Horseshoe Crab",
      color: "#668300",
      sortingOrder: 3,
    },
    potato: {
      displayName: "Potato",
      color: "#b38759",
      sortingOrder: 4,
    },
    tomato: {
      displayName: "Tomato",
      color: "#FF5722",
      sortingOrder: 5,
    },
  },
  fishing: {
    carp: {
      displayName: "Carp",
      color: "#82B1FF",
      sortingOrder: 1,
    },
    trout: {
      displayName: "Trout",
      color: "#2962FF",
      sortingOrder: 2,
    },
    bass: {
      displayName: "Bass",
      color: "#0D47A1",
      sortingOrder: 3,
    },
  },
  digging: {
    displayName: "Dig Spot",
    color: "#8D6E63",
    sortingOrder: 60,
  },
  bonfire: {
    displayName: "Bonfire",
    color: "#FF6F00",
    sortingOrder: 70,
  },
  whisper: {
    displayName: "Whisper",
    color: "#18FFFF",
    sortingOrder: 90,
  },
  spawner: {
    spawner: {
      displayName: "Spawner (Other)",
      color: "#9E9E9E",
      sortingOrder: 1,
    },
    shiny: {
      displayName: "Shiny",
      color: "#FFD700",
      sortingOrder: 2,
    },
    special_shiny: {
      displayName: "Special Shiny",
      color: "#FF6D00",
      sortingOrder: 3,
    },
    small_chest: {
      displayName: "Small Chest",
      color: "#A1887F",
      sortingOrder: 4,
    },
    medium_chest: {
      displayName: "Medium Chest",
      color: "#FFA726",
      sortingOrder: 5,
    },
    large_chest: {
      displayName: "Large Chest",
      color: "#F57C00",
      sortingOrder: 6,
    },
    special_chest: {
      displayName: "Special Chest",
      color: "#E65100",
      sortingOrder: 7,
    },
  },
  interactible: {
    readable: {
      displayName: "Readable",
      color: "#F4D03F",
      sortingOrder: 1,
    },
    ladder: {
      displayName: "Ladder",
      color: "#8B4513",
      sortingOrder: 2,
    },
    wall_climb: {
      displayName: "Wall Climb",
      color: "#7F8C8D",
      sortingOrder: 3,
    },
    door: {
      displayName: "Door",
      color: "#6B4423",
      sortingOrder: 4,
    },
    lever: {
      displayName: "Lever",
      color: "#E67E22",
      sortingOrder: 5,
    },
    entrance: {
      displayName: "Entrance",
      color: "#9B59B6",
      sortingOrder: 6,
    },
    house_entrance: {
      displayName: "House",
      color: "#27AE60",
      sortingOrder: 7,
    },
    platform: {
      displayName: "Platform",
      color: "#3498DB",
      sortingOrder: 8,
    },
    other: {
      displayName: "Other",
      color: "#95A5A6",
      sortingOrder: 9,
    },
  },
  destructible: {
    des_door: {
      displayName: "Door",
      color: "#A0522D",
      sortingOrder: 1,
    },
    wall: {
      displayName: "Wall",
      color: "#708090",
      sortingOrder: 2,
    },
  },
  npc: {
    animal: {
      displayName: "Animal",
      color: "#9370DB",
      sortingOrder: 1,
    },
    boss: {
      displayName: "Boss",
      color: "#8B0000",
      sortingOrder: 2,
    },
    enemies: {
      displayName: "Enemies",
      color: "#DC143C",
      sortingOrder: 3,
    },
    npc_other: {
      displayName: "Other",
      color: "#32CD32",
      sortingOrder: 4,
    },
  },
};

// Main group sorting orders
const GROUP_SORTING_ORDER: Record<MainGroup, number> = {
  spawner: 10,
  ore: 20,
  wood: 30,
  food: 40,
  fishing: 50,
  digging: 60,
  interactible: 70,
  destructible: 75,
  npc: 77,
  whisper: 80,
  bonfire: 90,
  herb: 100,
};

// ============================================================================
// Type Utilities
// ============================================================================

type PathImpl<T, Key extends keyof T> = Key extends string
  ? T[Key] extends SubGroupDef
    ? Key
    : Key | DeepPaths<T[Key]>
  : never;

type DeepPaths<T> = T extends SubGroupDef
  ? never
  : { [Key in keyof T]: PathImpl<T, Key> }[keyof T];

export type MainGroup = keyof typeof TYPES;
export type ResourceTypeKey = DeepPaths<typeof TYPES>;

// Helper to check if a value is a SubGroupDef
function isSubGroupDef(value: unknown): value is SubGroupDef {
  return (
    typeof value === "object" &&
    value !== null &&
    "color" in value &&
    "displayName" in value
  );
}

// Type guard to check if a key is a MainGroup
export function isMainGroup(key: string): key is MainGroup {
  return key in TYPES;
}

// Runtime validation to check if a string is a valid resource type
export function isValidResourceType(type: string): type is ResourceTypeKey {
  // Check if it's a main group or direct type
  if (isMainGroup(type)) {
    return true;
  }

  // Check if it's a subtype
  for (const value of Object.values(TYPES)) {
    if (!isSubGroupDef(value) && typeof value === "object" && value !== null) {
      if (type in value) {
        return true;
      }
    }
  }

  return false;
}

// Validate that a subtype belongs to a specific group
export function isValidSubtypeForGroup(
  group: string,
  subtype: string,
): boolean {
  if (!isMainGroup(group)) {
    return false;
  }

  const groupValue = TYPES[group];

  // If it's a direct SubGroupDef (bonfire, ladder, whisper), group and subtype should match
  if (isSubGroupDef(groupValue)) {
    return group === subtype;
  }

  // Check if subtype exists in the group
  if (typeof groupValue === "object" && groupValue !== null) {
    return subtype in groupValue;
  }

  return false;
}

// Get resource definition from TYPES
function getResourceDef(
  resourceType: ResourceTypeKey,
): SubGroupDef | undefined {
  // Check if it's a direct type (bonfire, ladder, whisper)
  if (isMainGroup(resourceType)) {
    const value = TYPES[resourceType];
    if (isSubGroupDef(value)) {
      return value;
    }
  }

  // Check if it's a subtype within a group (iron, birch, etc.)
  for (const groupValue of Object.values(TYPES)) {
    if (isSubGroupDef(groupValue)) {
      continue;
    }

    if (
      typeof groupValue === "object" &&
      groupValue !== null &&
      resourceType in groupValue
    ) {
      const potentialDef = (groupValue as Record<string, unknown>)[
        resourceType
      ];
      if (isSubGroupDef(potentialDef)) {
        return potentialDef;
      }
    }
  }

  return undefined;
}

export function getResourceColor(resourceType: ResourceTypeKey): string {
  const def = getResourceDef(resourceType);
  return def?.color ?? "#FF00FF";
}

export function getResourceDisplayName(resourceType: ResourceTypeKey): string {
  const def = getResourceDef(resourceType);
  return def?.displayName ?? resourceType;
}

export function getGroupDisplayName(groupType: MainGroup): string {
  const group = TYPES[groupType];
  if (isSubGroupDef(group)) {
    return group.displayName;
  }
  // For nested groups like ore, wood, spawner, return formatted version
  if (groupType === "spawner") {
    return "Spawner";
  }
  if (groupType === "npc") {
    return "NPC";
  }
  return groupType.charAt(0).toUpperCase() + groupType.slice(1);
}

export function getResourceSortingOrder(resourceType: ResourceTypeKey): number {
  const def = getResourceDef(resourceType);
  return def?.sortingOrder ?? 999;
}

export function getGroupSortingOrder(groupType: string): number {
  if (isMainGroup(groupType)) {
    return GROUP_SORTING_ORDER[groupType];
  }
  return 999;
}

/**
 * Extract all matching resource types for a spawner based on its tags
 * Returns an array of types that the spawner should be categorized under
 */
export function extractResourceTypes(resource: Resource): string[] {
  // Special handling for spawner - determine subtypes from lootSpawnInfo tags
  if (resource.type === "spawner") {
    if (resource.lootSpawnInfo) {
      const info = resource.lootSpawnInfo;

      // Check anyTags and allTags for chest/shiny types
      const tags = [
        ...(info.anyTags || []),
        ...(info.allTags || [])
      ];

      const types: string[] = [];

      // Check for all matching tag types
      if (tags.some(t => t.toLowerCase() === "specialchest")) types.push("special_chest");
      if (tags.some(t => t.toLowerCase() === "specialshiny")) types.push("special_shiny");
      if (tags.some(t => t.toLowerCase() === "largechest")) types.push("large_chest");
      if (tags.some(t => t.toLowerCase() === "mediumchest")) types.push("medium_chest");
      if (tags.some(t => t.toLowerCase() === "smallchest")) types.push("small_chest");
      if (tags.some(t => t.toLowerCase() === "shiny")) types.push("shiny");

      // If we found matching types, return them
      if (types.length > 0) {
        return types;
      }
    }

    // Fallback for spawner without recognized tags
    return ["spawner"];
  }

  // Use subtype as the resource type identifier
  return [resource.subtype || resource.type || "unknown"];
}

/**
 * Extract the primary resource type for a resource (for backward compatibility)
 * For spawners with multiple types, uses the derivedType if available
 */
export function extractResourceType(resource: Resource): string {
  // If this resource has a derivedType (for spawners with multiple tags), use it
  if (resource.derivedType) {
    return resource.derivedType;
  }

  const types = extractResourceTypes(resource);
  return types[0];
}

function createResourceTypes(resources: Resource[]): Map<string, ResourceType> {
  const typeMap = new Map<string, ResourceType>();

  // Count resources by subtype and track their group
  const counts = new Map<string, number>();
  const typeToGroup = new Map<string, string>();

  resources.forEach((resource) => {
    const subtype = extractResourceType(resource);
    const group = resource.type;

    counts.set(subtype, (counts.get(subtype) || 0) + 1);
    typeToGroup.set(subtype, group);
  });

  // Create resource type entries for each subtype
  for (const [subtype, count] of counts.entries()) {
    if (count > 0 && isValidResourceType(subtype)) {
      typeMap.set(subtype, {
        name: subtype,
        color: getResourceColor(subtype),
        visible: true,
        count: count,
        group: typeToGroup.get(subtype),
      });
    }
  }

  return typeMap;
}

function createResourceGroups(
  typeMap: Map<string, ResourceType>,
): Map<string, ResourceGroup> {
  const groupMap = new Map<string, ResourceGroup>();

  // Group types by their group property
  const groupToTypes = new Map<string, string[]>();

  for (const [typeName, type] of typeMap.entries()) {
    if (type.group) {
      if (!groupToTypes.has(type.group)) {
        groupToTypes.set(type.group, []);
      }
      groupToTypes.get(type.group)!.push(typeName);
    }
  }

  // Create group entries
  for (const [groupName, types] of groupToTypes.entries()) {
    if (types.length > 0) {
      // Sort types by sortingOrder
      types.sort((a, b) => {
        const orderA = getResourceSortingOrder(a as ResourceTypeKey);
        const orderB = getResourceSortingOrder(b as ResourceTypeKey);
        return orderA - orderB;
      });

      groupMap.set(groupName, {
        name: groupName,
        types: types,
        expanded: false,
      });
    }
  }

  return groupMap;
}

// ============================================================================
// Resource Loading and Parsing
// ============================================================================

export class ResourceLoader {
  private disabledItems: Set<string> = new Set();
  private loadedResources?: LoadedResources;

  public getResources(): LoadedResources | undefined {
    return this.loadedResources;
  }

  /**
   * Load disabled items from JSON
   */
  public loadDisabledItems(jsonData: string): void {
    try {
      const disabledItemsList = JSON.parse(jsonData) as string[];
      this.disabledItems = new Set(disabledItemsList);
      console.log(`Loaded ${this.disabledItems.size} disabled items`);
    } catch (error) {
      console.warn("Could not load disabled_items.json", error);
      this.disabledItems = new Set();
    }
  }

  /**
   * Parse CSV line handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        // Field separator
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current);
    return result;
  }

  /**
   * Extract region from file path
   */
  private extractRegionFromPath(filePath: string): string {
    // Extract region from path like: ExportedProject/Assets/worlds/isolaSacra/coast/coastA/loot/loot.unity
    return filePath.split("\/")[3];
  }

  /**
   * Parse resources from CSV text
   */
  public loadResourceCSV(
    csvText: string,
    applyDisabledFilter: boolean = true,
  ): LoadedResources {
    const lines = csvText.trim().split("\n");

    let totalObjects = 0;
    let filteredObjects = 0;
    let duplicateObjects = 0;
    let invalidTypeObjects = 0;
    let disabledObjects = 0;

    // Track seen objects to filter duplicates
    // Key format: "type:subtype:worldX:worldZ" (rounded to avoid floating point issues)
    const seenObjects = new Set<string>();

    // Track invalid types for reporting
    const invalidTypes = new Set<string>();

    var loadedResources: LoadedResources = {
      resourceGroups: new Map(),
      resourceTypes: new Map(),
      resources: [],
    };

    // Skip header: Type,Subtype,Name,File,RawX,RawY,RawZ,id,Drop,LootSpawnInfo,Classname
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = this.parseCSVLine(line);
      if (parts.length < 5) continue;

      const type = parts[0].trim().toLowerCase();
      const subtype = parts[1].trim().toLowerCase();
      const name = parts[2].trim();
      const filePath = parts[3].trim();
      const rawX = parseFloat(parts[4]);
      const rawY = parseFloat(parts[5]);
      const rawZ = parseFloat(parts[6]);

      const id = parts[7];

      // Check if this item is disabled (only if filter is enabled)
      if (applyDisabledFilter) {
        if (this.disabledItems.has(id)) {
          disabledObjects++;
          continue;
        }
      }

      // Parse Drop JSON if available (column 9)
      let drop: any = undefined;
      if (parts.length > 8 && parts[8].trim()) {
        try {
          drop = JSON.parse(parts[8]);
        } catch (e) {
          console.warn(`Failed to parse Drop JSON at line ${i + 1}:`, e);
        }
      }

      // Parse LootSpawnInfo JSON if available (column 10)
      let lootSpawnInfo: any = undefined;
      if (parts.length > 9 && parts[9].trim()) {
        try {
          lootSpawnInfo = JSON.parse(parts[9]);
        } catch (e) {
          console.warn(
            `Failed to parse LootSpawnInfo JSON at line ${i + 1}:`,
            e,
          );
        }
      }

      // Parse SpawnConditions JSON if available (column 11)
      let spawnConditions: any = undefined;
      if (parts.length > 10 && parts[10].trim()) {
        try {
          spawnConditions = JSON.parse(parts[10]);
        } catch (e) {
          console.warn(
            `Failed to parse SpawnConditions JSON at line ${i + 1}:`,
            e,
          );
        }
      }

      // Parse classname if available (column 12)
      const classname = parts.length > 11 ? parts[11].trim() : undefined;

      totalObjects++;

      // Validate resource types against TYPES definition
      // Special case: spawner subtype will be determined from lootSpawnInfo later
      if (type !== "spawner") {
        if (!isValidResourceType(type) || !isValidResourceType(subtype)) {
          invalidTypeObjects++;
          const invalidKey = `${type}:${subtype}`;
          if (!invalidTypes.has(invalidKey)) {
            invalidTypes.add(invalidKey);
            console.warn(
              `Invalid resource type in CSV: type="${type}", subtype="${subtype}" at line ${i + 1}`,
            );
          }
          continue;
        }

        // Validate that subtype belongs to the correct group
        if (!isValidSubtypeForGroup(type, subtype)) {
          invalidTypeObjects++;
          const invalidKey = `${type}:${subtype}`;
          if (!invalidTypes.has(invalidKey)) {
            invalidTypes.add(invalidKey);
            console.warn(
              `Subtype "${subtype}" does not belong to group "${type}" at line ${i + 1}`,
            );
          }
          continue;
        }
      } else {
        // For spawner, just validate that the type is valid
        if (!isValidResourceType(type)) {
          invalidTypeObjects++;
          const invalidKey = `${type}:${subtype}`;
          if (!invalidTypes.has(invalidKey)) {
            invalidTypes.add(invalidKey);
            console.warn(
              `Invalid resource type in CSV: type="${type}" at line ${i + 1}`,
            );
          }
          continue;
        }
      }

      // Convert from Unity units (appears to be in centimeters * 65536) to game world units
      const worldX = rawX / 1_000_000;
      const worldY = rawY / 1_000_000;
      const worldZ = rawZ / 1_000_000;

      // Extract region from file path
      const region = this.extractRegionFromPath(filePath);

      const baseResource: Resource = {
        type,
        subtype,
        name,
        region,
        worldX,
        worldY,
        worldZ,
        filePath,
        id,
        drop,
        lootSpawnInfo,
        spawnConditions,
        classname,
      };

      // For spawner type, check if it should be categorized into multiple subgroups
      if (type === "spawner") {
        const matchingTypes = extractResourceTypes(baseResource);

        // Create a resource entry for each matching type
        // This allows the spawner to appear in multiple filter groups
        for (const matchingType of matchingTypes) {
          // Check for duplicates including the derived type
          const coordKey = `${type}:${matchingType}:${worldX.toFixed(3)}:${worldZ.toFixed(3)}`;
          if (seenObjects.has(coordKey)) {
            duplicateObjects++;
            continue;
          }
          seenObjects.add(coordKey);

          loadedResources.resources.push({
            ...baseResource,
            // Store the derived type as a custom property for filtering
            // We'll use this to determine which filter group it belongs to
            derivedType: matchingType,
          } as Resource);
        }
      } else {
        // For non-spawner types, check for duplicates normally
        const coordKey = `${type}:${subtype}:${worldX.toFixed(3)}:${worldZ.toFixed(3)}`;
        if (seenObjects.has(coordKey)) {
          duplicateObjects++;
          continue;
        }
        seenObjects.add(coordKey);

        // Just add the resource normally
        loadedResources.resources.push(baseResource);
      }
    }

    console.log(
      `Filtered ${filteredObjects} out-of-bounds objects out of ${totalObjects} total objects`,
    );
    console.log(`Filtered ${duplicateObjects} duplicate objects`);
    console.log(`Filtered ${invalidTypeObjects} invalid type objects`);
    console.log(`Filtered ${disabledObjects} disabled objects`);
    if (invalidTypes.size > 0) {
      console.warn(
        `Found ${invalidTypes.size} unique invalid type combinations:`,
        Array.from(invalidTypes),
      );
    }
    console.log(
      `Loaded ${loadedResources.resources.length} unique valid resources`,
    );

    const resourceTypes = createResourceTypes(loadedResources.resources);
    const resourceGroups = createResourceGroups(resourceTypes);

    loadedResources.resourceTypes = resourceTypes;
    loadedResources.resourceGroups = resourceGroups;

    this.loadedResources = loadedResources;

    return loadedResources;
  }
}
