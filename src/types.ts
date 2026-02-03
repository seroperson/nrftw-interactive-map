// Type definitions for the interactive map

export interface Coordinates {
  x: number;
  z: number;
}

export interface ImageCoordinates {
  x: number;
  y: number;
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
  line: number;
  idA?: number;
  idB?: number;
  idC?: number;
  idD?: number;
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

export interface CustomMarker {
  id: string;
  worldX: number;
  worldZ: number;
  label: string;
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
  resourceType: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  idA?: number;
  idB?: number;
  idC?: number;
  idD?: number;
}

export interface AppState {
  viewport: ViewportState;
  visibleResources: Set<string>;
  customMarkers: CustomMarker[];
  markerMode: boolean;
  openedPopup: OpenedPopup | null;
  expandedGroups: Set<string>;
}
