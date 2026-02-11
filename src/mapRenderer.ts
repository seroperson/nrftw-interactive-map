// OpenLayers-based map renderer

import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Projection } from "ol/proj";
import { getCenter } from "ol/extent";
import XYZ from "ol/source/XYZ";
import { Style, Circle, Fill, Stroke } from "ol/style";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import type { FeatureLike } from "ol/Feature";
import Overlay from "ol/Overlay";

import { Resource, Coordinates, OpenedPopup } from "./types";
import { CoordinateConverter } from "./coordinateConverter";
import {
  getResourceColor,
  extractResourceType,
  getResourceDisplayName,
  isValidResourceType,
} from "./resourceData";
import { StateManager } from "./stateManager";
import { MAP_WIDTH, MAP_HEIGHT, COORD_PRECISION } from "./constants";

export class MapRenderer {
  private map: Map;
  private converter: CoordinateConverter;

  private mapWidth: number = MAP_WIDTH;
  private mapHeight: number = MAP_HEIGHT;

  private resourceLayer: VectorLayer<VectorSource>;

  private resources: Resource[] = [];
  private visibleResourceTypes: Set<string> = new Set();

  private tooltipElement!: HTMLElement;
  private popupOverlay!: Overlay;
  private popupElement!: HTMLElement;
  private popupCloser!: HTMLElement;
  private onPopupChange: ((popup: OpenedPopup | null) => void) | null = null;
  private isPopupOpen: boolean = false;

  constructor(targetElement: string, converter: CoordinateConverter) {
    this.converter = converter;

    // Setup projection for the static image
    const extent = [0, 0, this.mapWidth, this.mapHeight];
    const projection = new Projection({
      code: "NRFTW",
      units: "pixels",
      extent: extent,
    });

    // Create vector layer for resources
    this.resourceLayer = new VectorLayer({
      source: new VectorSource(),
      style: this.getResourceStyle.bind(this),
    });

    // Create the map
    this.map = new Map({
      target: targetElement,
      layers: [this.resourceLayer],
      view: new View({
        projection: projection,
        center: getCenter(extent),
        zoom: 2,
        maxZoom: 8,
        minZoom: 1,
        extent: extent, // Restrict panning to map bounds
        constrainOnlyCenter: false, // Prevents panning beyond the extent
        enableRotation: false, // Disable rotation
      }),
      controls: [], // Remove all default controls (zoom, rotate, attribution)
    });

    // Setup popup overlay
    this.setupPopup();

    // Setup mouse coordinate display
    this.setupCoordinateDisplay();

    // Update resource styles when zoom changes
    this.map.getView().on("change:resolution", () => {
      this.resourceLayer.changed();
    });

    // Handle window resize to update map size
    window.addEventListener("resize", () => {
      this.map.updateSize();
    });
  }

  private setupPopup(): void {
    // Create popup element
    this.popupElement = document.createElement("div");
    this.popupElement.className = "ol-popup";
    this.popupElement.innerHTML = `
      <div class="ol-popup-closer" id="popup-closer">×</div>
      <div class="ol-popup-content" id="popup-content"></div>
    `;

    this.popupCloser = this.popupElement.querySelector(
      "#popup-closer",
    ) as HTMLElement;

    // Create overlay for popup
    this.popupOverlay = new Overlay({
      element: this.popupElement,
      autoPan: {
        animation: {
          duration: 250,
        },
      },
      positioning: "bottom-center",
      offset: [0, -10],
    });

    this.map.addOverlay(this.popupOverlay);

    // Close popup handler
    this.popupCloser.addEventListener("click", () => {
      this.closePopup();
    });

    // Handle clicks on features and map
    this.map.on("click", (evt) => {
      const pixel = evt.pixel;
      const feature = this.map.forEachFeatureAtPixel(pixel, (feat) => feat);

      if (feature) {
        const coordinate = evt.coordinate;
        this.showPopup(feature, coordinate);
      } else {
        // Clicked on empty map - close popup
        this.closePopup();
      }
    });

    // Close popup when user interacts with the map (panning or zooming)
    this.map.on("movestart", () => {
      if (this.isPopupOpen) {
        this.closePopup();
      }
    });

    // Close popup when zooming
    this.map.getView().on("change:resolution", () => {
      if (this.isPopupOpen) {
        this.closePopup();
      }
    });
  }

  private showPopup(feature: FeatureLike, coordinate: number[]): void {
    // Hide tooltip if any
    this.tooltipElement.classList.remove("visible");
    (this.map.getTargetElement() as HTMLElement).style.cursor = "";

    const type = feature.get("resourceType") as string;
    const subtype = feature.get("subtype") as string;
    const resourceType = feature.get("type") as string;
    const worldX = feature.get("worldX") as number;
    const worldY = feature.get("worldY") as number;
    const worldZ = feature.get("worldZ") as number;
    const idA = feature.get("idA") as number;
    const idB = feature.get("idB") as number;
    const idC = feature.get("idC") as number;
    const idD = feature.get("idD") as number;
    const color = feature.get("color") as string;
    const drop = feature.get("drop");
    const lootSpawnInfo = feature.get("lootSpawnInfo");

    // Build popup content with icon
    const contentElement = this.popupElement.querySelector(
      "#popup-content",
    ) as HTMLElement;

    const popupTitle = this.formatResourceTitle(type, subtype);
    const name = feature.get("name") as string;

    const popupHtml = `
      <div class="popup-header">
        <span class="popup-icon" style="background-color: ${color}"></span>
        <div class="popup-title-group">
          <span class="popup-title">${popupTitle}</span>
          ${name ? `<span class="popup-subtitle">${name}</span>` : ""}
        </div>
      </div>
      ${this.formatCoordinates("popup", worldX, worldY, worldZ)}
      ${this.formatGuidHtml("popup", idA, idB, idC, idD)}
      ${this.formatPathHtml("popup", feature.get("path"))}
      ${this.formatDropHtml("popup", drop)}
      ${this.formatLootSpawnInfoHtml("popup", lootSpawnInfo)}
    `;

    contentElement.innerHTML = popupHtml;

    // Show popup at coordinate
    this.popupOverlay.setPosition(coordinate);
    this.isPopupOpen = true;

    // Notify state manager about opened popup
    if (this.onPopupChange) {
      this.onPopupChange({
        resourceType,
        worldX,
        worldY,
        worldZ,
        idA,
        idB,
        idC,
        idD,
      });
    }
  }

  public setupViewportListeners(stateManager: StateManager) {
    this.map.on("moveend", (_) => {
      const viewport = this.getViewportState();
      stateManager.updateViewport(viewport);
    });
  }

  public closePopup(): void {
    this.popupOverlay.setPosition(undefined);
    this.isPopupOpen = false;
    if (this.onPopupChange) {
      this.onPopupChange(null);
    }
  }

  public setOpenedPopup(popup: OpenedPopup | null): void {
    if (!popup) {
      this.closePopup();
      return;
    }

    // Find the feature that matches this popup
    const source = this.resourceLayer.getSource();
    if (!source) return;

    const features = source.getFeatures();
    for (const feature of features) {
      const worldX = feature.get("worldX") as number;
      const worldZ = feature.get("worldZ") as number;

      if (
        Math.abs(worldX - popup.worldX) < 0.1 &&
        Math.abs(worldZ - popup.worldZ) < 0.1
      ) {
        const geometry = feature.getGeometry();
        if (geometry) {
          const coords = (geometry as Point).getCoordinates();
          this.showPopup(feature, coords);
        }
        break;
      }
    }
  }

  public onPopupStateChange(
    callback: (popup: OpenedPopup | null) => void,
  ): void {
    this.onPopupChange = callback;
  }

  public loadMapImage(
    tilesPath: string = `${import.meta.env.BASE_URL}/tiles/{z}/{y}/{x}.jpg`,
  ): void {
    const projection = this.map.getView().getProjection();

    // Create tile layer with XYZ source
    const tileLayer = new TileLayer({
      source: new XYZ({
        url: tilesPath,
        projection: projection,
        tileSize: 256,
        minZoom: 0,
        maxZoom: 6,
      }),
    });

    // Insert tile layer as the base layer
    this.map.getLayers().insertAt(0, tileLayer);
  }

  public setResources(resources: Resource[]): void {
    this.resources = resources;
    this.updateResourceLayer();
  }

  public setVisibleResourceTypes(types: Set<string>): void {
    this.visibleResourceTypes = types;
    this.updateResourceLayer();
  }

  private updateResourceLayer(): void {
    const source = this.resourceLayer.getSource();
    if (!source) return;

    source.clear();

    const visibleResources = this.resources.filter((resource) => {
      const type = extractResourceType(resource);
      return this.visibleResourceTypes.has(type);
    });

    const features: Feature[] = [];
    for (const resource of visibleResources) {
      const coords = this.converter.worldToImage(
        resource.worldX,
        resource.worldZ,
        resource.region,
      );
      features.push(this.createResourceFeature(resource, coords));
    }
    source.addFeatures(features);
  }

  private createResourceFeature(
    resource: Resource,
    coords: Coordinates,
  ): Feature {
    const resourceType = extractResourceType(resource);
    const color = isValidResourceType(resourceType)
      ? getResourceColor(resourceType)
      : "#FF00FF"; // Fallback color for invalid types

    const feature = new Feature({
      geometry: new Point([coords.x, coords.y]), // Coordinates already converted by converter
      name: resource.name,
      type: resourceType,
      color: color,
      resourceType: resource.type,
      path: resource.filePath,
      subtype: resource.subtype,
      worldX: resource.worldX,
      worldY: resource.worldY,
      worldZ: resource.worldZ,
      idA: resource.idA,
      idB: resource.idB,
      idC: resource.idC,
      idD: resource.idD,
      drop: resource.drop,
      lootSpawnInfo: resource.lootSpawnInfo,
    });

    return feature;
  }

  private getResourceStyle(feature: FeatureLike): Style {
    const color = feature.get("color") as string;
    const zoom = this.map.getView().getZoom() || 2;

    // Scale radius based on zoom level (exponential growth)
    // At zoom 2: radius ~4, at zoom 5: radius ~8, at zoom 8: radius ~16
    const baseRadius = 4;
    const scaleFactor = Math.pow(1.2, zoom - 2);
    const radius = Math.max(3, Math.min(20, baseRadius * scaleFactor));

    // Scale stroke width proportionally
    const strokeWidth = Math.max(1, Math.min(4, radius / 3));

    return new Style({
      image: new Circle({
        radius: radius,
        fill: new Fill({ color: color }),
        stroke: new Stroke({ color: "rgba(0, 0, 0, 0.5)", width: strokeWidth }),
      }),
    });
  }

  public getViewportState(): { x: number; y: number; scale: number } {
    const view = this.map.getView();
    const center = view.getCenter() || [this.mapWidth / 2, this.mapHeight / 2];
    const zoom = view.getZoom() || 2;

    return {
      x: center[0],
      y: this.mapHeight - center[1], // Flip Y back
      scale: zoom,
    };
  }

  public setViewportState(x: number, y: number, scale: number): void {
    const view = this.map.getView();
    view.setCenter([x, this.mapHeight - y]); // Flip Y for OpenLayers
    view.setZoom(scale);
  }

  public screenToWorld(screenX: number, screenY: number): Coordinates {
    const coordinate = this.map.getCoordinateFromPixel([screenX, screenY]);
    if (!coordinate) {
      return { x: 0, y: 0 };
    }

    return {
      x: Math.round(coordinate[0]),
      y: Math.round(this.mapHeight - coordinate[1]), // Flip Y back
    };
  }

  private setupCoordinateDisplay(): void {
    // Create tooltip element
    this.tooltipElement = document.createElement("div");
    this.tooltipElement.className = "resource-tooltip";
    document.body.appendChild(this.tooltipElement);

    this.map.on("pointermove", (evt) => {
      const coordinate = evt.coordinate;
      const imageX = coordinate[0];
      const imageY = this.mapHeight - coordinate[1]; // Flip Y back

      const worldCoords = this.converter.imageToWorld(imageX, imageY);

      // Dispatch custom event with coordinates
      const event = new CustomEvent("mapcoordinates", {
        detail: { worldX: worldCoords.x, worldZ: worldCoords.y },
      });
      window.dispatchEvent(event);

      // Check if hovering over a resource feature
      const pixel = evt.pixel;
      const feature = this.map.forEachFeatureAtPixel(pixel, (feat) => feat);

      // Don't show tooltip if popup is open
      if (!this.isPopupOpen && feature) {
        const type = feature.get("resourceType") as string;
        const subtype = feature.get("subtype") as string;
        const worldX = feature.get("worldX") as number;
        const worldY = feature.get("worldY") as number;
        const worldZ = feature.get("worldZ") as number;
        const idA = feature.get("idA") as number;
        const idB = feature.get("idB") as number;
        const idC = feature.get("idC") as number;
        const idD = feature.get("idD") as number;
        const drop = feature.get("drop");
        const lootSpawnInfo = feature.get("lootSpawnInfo");

        const tooltipTitle = this.formatResourceTitle(type, subtype);
        const name = feature.get("name") as string;

        // Build tooltip content
        const tooltipHtml = `
          <div class="tooltip-title-group">
            <div class="tooltip-type">${tooltipTitle}</div>
            ${name ? `<div class="tooltip-subtitle">${name}</div>` : ""}
          </div>
          ${this.formatCoordinates("tooltip", worldX, worldY, worldZ)}
          ${this.formatGuidHtml("tooltip", idA, idB, idC, idD)}
          ${this.formatDropHtml("tooltip", drop)}
          ${this.formatLootSpawnInfoHtml("tooltip", lootSpawnInfo)}
        `;

        // Update tooltip content
        this.tooltipElement.innerHTML = tooltipHtml;

        // Position tooltip near cursor
        this.tooltipElement.style.left = `${(evt.originalEvent as PointerEvent).pageX + 15}px`;
        this.tooltipElement.style.top = `${(evt.originalEvent as PointerEvent).pageY + 15}px`;
        this.tooltipElement.classList.add("visible");

        // Change cursor to pointer
        (this.map.getTargetElement() as HTMLElement).style.cursor = "pointer";
      } else {
        // Hide tooltip
        this.tooltipElement.classList.remove("visible");
        (this.map.getTargetElement() as HTMLElement).style.cursor = "";
      }
    });
  }

  public getMap(): Map {
    return this.map;
  }

  private isDevMode(): boolean {
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

  private formatResourceTitle(type: string, subtype: string): string {
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

  private formatCoordinates(
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

  private formatGuidHtml(
    context: "popup" | "tooltip",
    idA: number,
    idB: number,
    idC: number,
    idD: number,
  ): string {
    if (!this.isDevMode()) {
      return "";
    }
    return `
      <div class="${context}-section ${context}-guid">
        <div class="${context}-section-header">🔑 GUID</div>
        <div class="${context}-section-content">
          <code class="${context}-code">${idA}, ${idB}, ${idC}, ${idD}</code>
        </div>
      </div>
    `;
  }

  private formatPathHtml(context: "popup" | "tooltip", path?: string): string {
    if (!this.isDevMode() || path === undefined) {
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

  private formatDropHtml(context: "popup" | "tooltip", drop: any): string {
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
              `<span class="${context}-badge ${context}-badge-chance">${c.count}x @ ${c.chance}%</span>`,
          )
          .join("");
        html += "</div>";
      }

      if (group.items && group.items.length > 0) {
        html += `<div class="${context}-drop-items">`;
        for (const item of group.items) {
          if (item.specificItem && item.specificItem.length > 0) {
            html += `<div class="${context}-drop-item">`;
            html += `<span class="${context}-item-label">ID:</span> `;
            html += item.specificItem
              .map(
                (id: any) =>
                  `<span class="${context}-badge ${context}-badge-pool">${id}</span>`,
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

  private formatLootSpawnInfoHtml(
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
}
