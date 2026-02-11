// Resource type definitions and colors

import { ResourceType, ResourceGroup, Resource } from "./types";

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
  ladder: SubGroupDef;
  whisper: SubGroupDef;
  loot_spawn: {
    shiny: SubGroupDef;
    special_shiny: SubGroupDef;
    small_chest: SubGroupDef;
    medium_chest: SubGroupDef;
    large_chest: SubGroupDef;
    special_chest: SubGroupDef;
  };
  interactible: {
    ladder: SubGroupDef;
    door: SubGroupDef;
    lever: SubGroupDef;
    readable: SubGroupDef;
    other: SubGroupDef;
  };
};

interface SubGroupDef {
  displayName: string;
  color: string;
}

const TYPES: MainGroupTypes = {
  ore: {
    iron: {
      displayName: "Iron",
      color: "#4D4D4D",
    },
    copper: {
      displayName: "Copper",
      color: "#B87333",
    },
    silver: {
      displayName: "Silver",
      color: "#C0C0C0",
    },
  },
  wood: {
    birch: {
      displayName: "Birch",
      color: "#F5DEB3",
    },
    spruce: {
      displayName: "Spruce",
      color: "#6B8E23",
    },
    pine: {
      displayName: "Pine",
      color: "#556B2F",
    },
  },
  herb: {
    artemisia: {
      displayName: "Artemisia",
      color: "#9ACD32",
    },
    dracaena: {
      displayName: "Dracaena",
      color: "#228B22",
    },
    lithops: {
      displayName: "Lithops",
      color: "#90EE90",
    },
    mushroom: {
      displayName: "Mushroom",
      color: "#DDA0DD",
    },
  },
  food: {
    blueberry: {
      displayName: "Blueberry",
      color: "#4169E1",
    },
    firebrandberry: {
      displayName: "Firebrand Berry",
      color: "#DC143C",
    },
    horseshoe_crab: {
      displayName: "Horseshoe Crab",
      color: "#20B2AA",
    },
    potato: {
      displayName: "Potato",
      color: "#D2B48C",
    },
    tomato: {
      displayName: "Tomato",
      color: "#FF6347",
    },
  },
  fishing: {
    carp: {
      displayName: "Carp",
      color: "#a6c3db",
    },
    trout: {
      displayName: "Trout",
      color: "#657e93",
    },
    bass: {
      displayName: "Bass",
      color: "#315B7E",
    },
  },
  digging: {
    displayName: "Dig Spot",
    color: "#A0522D",
  },
  bonfire: {
    displayName: "Bonfire",
    color: "#FF4500",
  },
  ladder: {
    displayName: "Ladder",
    color: "#A0826D",
  },
  whisper: {
    displayName: "Whisper",
    color: "#00BFFF",
  },
  loot_spawn: {
    shiny: {
      displayName: "Shiny",
      color: "#FFD700",
    },
    special_shiny: {
      displayName: "Special Shiny",
      color: "#FF8C00",
    },
    small_chest: {
      displayName: "Small Chest",
      color: "#8B7355",
    },
    medium_chest: {
      displayName: "Medium Chest",
      color: "#CD853F",
    },
    large_chest: {
      displayName: "Large Chest",
      color: "#DAA520",
    },
    special_chest: {
      displayName: "Special Chest",
      color: "#B8860B",
    },
  },
  interactible: {
    ladder: {
      displayName: "Ladder",
      color: "#A0826D",
    },
    door: {
      displayName: "Door",
      color: "#8B4513",
    },
    lever: {
      displayName: "Lever",
      color: "#CD853F",
    },
    readable: {
      displayName: "Readable",
      color: "#DEB887",
    },
    other: {
      displayName: "Other",
      color: "#D2691E",
    },
  }
};

// Type utilities to extract all valid resource type keys
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

// Get resource definition from TYPES - strongly typed, no casts
function getResourceDef(
  resourceType: ResourceTypeKey,
): SubGroupDef | undefined {
  // Check if it's a direct type (bonfire, ladder, whisper)
  if (isMainGroup(resourceType)) {
    const value = TYPES[resourceType];
    if (isSubGroupDef(value)) {
      return value;
    }
    // If it's a group (ore, wood, etc.), fall through to check subtypes
  }

  // Check if it's a subtype within a group (iron, birch, etc.)
  for (const groupValue of Object.values(TYPES)) {
    // Skip direct SubGroupDef entries
    if (isSubGroupDef(groupValue)) {
      continue;
    }

    // For nested groups, check if resourceType is a key in the group
    if (
      typeof groupValue === "object" &&
      groupValue !== null &&
      resourceType in groupValue
    ) {
      // TypeScript now knows resourceType is a key of groupValue
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
  // For nested groups like ore, wood, loot_spawn, return formatted version
  if (groupType === "loot_spawn") {
    return "Loot Spawn";
  }
  return groupType.charAt(0).toUpperCase() + groupType.slice(1);
}

export function extractResourceType(resource: Resource): string {
  // Special handling for loot_spawn - determine subtype from lootSpawnInfo
  if (resource.type === "loot_spawn") {
    if (resource.lootSpawnInfo) {
      const info = resource.lootSpawnInfo;

      // Priority order: special types first, then regular chests, then shiny
      if (info.specialChest) return "special_chest";
      if (info.specialShiny) return "special_shiny";
      if (info.largeChest) return "large_chest";
      if (info.mediumChest) return "medium_chest";
      if (info.smallChest) return "small_chest";
      if (info.shiny) return "shiny";
    }

    // Fallback for loot_spawn without valid lootSpawnInfo - use small_chest as default
    return "small_chest";
  }

  // Use subtype as the resource type identifier
  return resource.subtype || resource.type || "unknown";
}

export function createResourceTypes(
  resources: Resource[],
): Map<string, ResourceType> {
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

export function createResourceGroups(
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
      // Sort types alphabetically
      types.sort();

      groupMap.set(groupName, {
        name: groupName,
        types: types,
        expanded: false,
      });
    }
  }

  return groupMap;
}
