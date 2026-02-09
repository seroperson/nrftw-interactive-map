// Resource type definitions and colors

import { ResourceType, ResourceGroup, Resource } from "./types";

const TYPES = {
  ore: {
    iron: "#4D4D4D",
    copper: "#B87333",
    silver: "#C0C0C0",
    gold: "#FFD700",
  },
  wood: {
    birch: "#F5DEB3",
    spruce: "#6B8E23",
    pine: "#556B2F",
  },
  herb: {
    artemisia: "#9ACD32",
    dracaena: "#228B22",
    lithops: "#90EE90",
    mushroom: "#DDA0DD",
  },
  food: {
    blueberry: "#4169E1",
    firebrandberry: "#DC143C",
    horseshoe_crab: "#20B2AA",
    potato: "#D2B48C",
    tomato: "#FF6347",
  },
  fishing: {
    carp: "#a6c3db",
    trout: "#657e93",
    bass: "#315B7E",
  },
  digging: {
    tier1: "#CD853F",
    tier2: "#D2691E",
    tier3: "#A0522D",
  },
  bonfire: "#FF4500",
  ladder: "#A0826D",
  whisper: "#00BFFF",
  loot: {
    chest: "#DAA520",
    shiny: "#FFD700",
    container: "#FFD700"
  },
};

export function getResourceColor(resourceType: string): string {
  const lower = resourceType.toLowerCase();

  // Check if it's a direct type (bonfire, ladder, whisper)
  if (typeof TYPES[lower as keyof typeof TYPES] === "string") {
    return TYPES[lower as keyof typeof TYPES] as string;
  }

  // Check if it's a subtype within a group
  for (const [group, value] of Object.entries(TYPES)) {
    if (typeof value === "object" && !Array.isArray(value)) {
      const color = value[lower as keyof typeof value];
      if (color) {
        return color;
      }
    }
  }

  // Fallback color
  return "#FF00FF";
}

export function extractResourceType(resource: any): string {
  // Use subtype as the resource type identifier
  if (resource.subtype) {
    return resource.subtype;
  }
  if (resource.type) {
    return resource.type;
  }
  return "unknown";
}

export function getResourceGroup(resource: any): string {
  // Use type as the group identifier
  if (resource.type) {
    return resource.type;
  }
  return "unknown";
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
    const group = getResourceGroup(resource);

    counts.set(subtype, (counts.get(subtype) || 0) + 1);
    typeToGroup.set(subtype, group);
  });

  // Create resource type entries for each subtype
  for (const [subtype, count] of counts.entries()) {
    if (count > 0) {
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
