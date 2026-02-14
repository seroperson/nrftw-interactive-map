export interface Coordinates {
  x: number;
  y: number;
}

export interface DropChance {
  chance: number;
  count: number;
}

export interface DropItem {
  specificItem: string[];
  filterPool: string[];
}

export interface DropGroup {
  chances: DropChance[];
  items: DropItem[];
}

export interface Drop {
  groups: DropGroup[];
}

export interface LootSpawnInfo {
  shiny: boolean;
  specialShiny: boolean;
  smallChest: boolean;
  mediumChest: boolean;
  largeChest: boolean;
  specialChest: boolean;
  respawnChance?: number;
  respawnFreq?: string;
  spawnCondition?: string;
}

export interface LoadedResources {
  resources: Resource[];
  resourceGroups: Map<string, ResourceGroup>;
  resourceTypes: Map<string, ResourceType>;
}

export interface Resource {
  type: string;
  subtype: string;
  name: string;
  region: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  filePath: string;
  id: string;
  drop?: Drop;
  lootSpawnInfo?: LootSpawnInfo;
  classname?: string;
}

export interface ResourceType {
  name: string;
  color: string;
  visible: boolean;
  count: number;
  group?: string;
}

export interface ResourceGroup {
  name: string;
  types: string[];
  expanded: boolean;
}

export interface RegionTransform {
  offsetX: number;
  offsetZ: number;
  scaleX: number;
  scaleZ: number;
  flipX: boolean;
  flipZ: boolean;
}

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

export interface OpenedPopup {
  id: string;
}

export interface AppState {
  viewport: ViewportState;
  visibleResources: Set<string>;
  openedPopup: OpenedPopup | null;
  expandedGroups: Set<string>;
  mapFilter: string;
  expertMode: boolean;
}
