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
  respawnFreq?: string;
  missChance?: number;
  anyTags?: string[];
  allTags?: string[];
  noneTags?: string[];
  spawnConditions?: any[];
}

export interface QuestCondition {
  questGuid: string;
  state: string;
  conditionType: string;
}

export interface QuestStepCondition {
  questGuid: string;
  state: string;
  conditionType: string;
}

export interface WorldEventCondition {
  eventGuid: string;
  state: string;
  conditionType: string;
}

export interface ConditionSet {
  questSteps: QuestStepCondition[] | null;
  quests: QuestCondition[] | null;
  worldEvents: WorldEventCondition[] | null;
  timesOfDay: any[] | null;
  hasItems: any[] | null;
  hasModifiers: any[] | null;
  activities: any[] | null;
  boons: any[] | null;
  hasGold: any | null;
}

export interface SpawnConditions {
  requiredSpawnConditions: ConditionSet;
  disableConditions: ConditionSet;
  respawnConditions: ConditionSet;
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
  spawnConditions?: SpawnConditions;
  classname?: string;
  derivedType?: string; // For spawners with multiple tags, stores which type this instance represents
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
