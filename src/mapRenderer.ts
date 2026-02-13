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

import { Resource, Coordinates, OpenedPopup, LoadedResources } from "./types";
import { CoordinateConverter } from "./utils/coordinateConverter";
import {
  getResourceColor,
  extractResourceType,
  isValidResourceType,
} from "./resourceManager";
import { StateManager } from "./stateManager";
import { MAP_WIDTH, MAP_HEIGHT } from "./utils/constants";
import {
  formatResourceTitle,
  formatCoordinates,
  formatGuidHtml,
  formatPathHtml,
  formatDropHtml,
  formatLootSpawnInfoHtml,
} from "./ui/formatters";

export class MapRenderer {
  private map: Map;
  private converter: CoordinateConverter;

  private mapWidth: number = MAP_WIDTH;
  private mapHeight: number = MAP_HEIGHT;

  private resourceLayer: VectorLayer<VectorSource>;
  private tileLayer: TileLayer<XYZ> | null = null;
  private mapElement: HTMLElement;
  private currentFilter: string = "none";

  private visibleResourceTypes: Set<string> = new Set();

  private tooltipElement!: HTMLElement;
  private selectedFeature: FeatureLike | null = null;
  private isTouchDevice: boolean = false;

  constructor(targetElement: string, converter: CoordinateConverter) {
    this.converter = converter;

    // Detect if device has touch capability
    this.isTouchDevice = this.detectTouchDevice();

    // Store map element reference
    const element = document.getElementById(targetElement);
    if (!element) {
      throw new Error(`Map element with id '${targetElement}' not found`);
    }
    this.mapElement = element;

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

    // Listen for close resource details event from UI
    window.addEventListener("closeResourceDetails", () => {
      this.clearSelection();
    });

    // Listen for select feature by coords event from UI
    window.addEventListener("selectFeatureByCoords", ((event: CustomEvent) => {
      const popup = event.detail;
      this.selectFeatureByCoords(popup);
    }) as EventListener);
  }

  private setupPopup(): void {
    // Handle clicks on features and map
    this.map.on("click", (evt) => {
      const pixel = evt.pixel;
      const feature = this.map.forEachFeatureAtPixel(pixel, (feat) => feat);

      if (feature) {
        this.selectFeature(feature);
      } else {
        // Clicked on empty map - clear selection
        this.clearSelection();
      }
    });
  }

  private selectFeature(feature: FeatureLike): void {
    // Clear previous selection
    if (this.selectedFeature) {
      // @ts-ignore
      this.selectedFeature.set("selected", false);
    }

    // Set new selection
    this.selectedFeature = feature;
    // @ts-ignore
    feature.set("selected", true);
    this.resourceLayer.changed(); // Trigger re-render to show outline

    // Dispatch event with feature data for UI to handle
    const event = new CustomEvent("featureSelected", {
      detail: {
        type: feature.get("resourceType"),
        subtype: feature.get("subtype"),
        resourceType: feature.get("type"),
        name: feature.get("name"),
        color: feature.get("color"),
        worldX: feature.get("worldX"),
        worldY: feature.get("worldY"),
        worldZ: feature.get("worldZ"),
        idA: feature.get("idA"),
        idB: feature.get("idB"),
        idC: feature.get("idC"),
        idD: feature.get("idD"),
        path: feature.get("path"),
        drop: feature.get("drop"),
        lootSpawnInfo: feature.get("lootSpawnInfo"),
      },
    });
    window.dispatchEvent(event);
  }

  public setupViewportListeners(stateManager: StateManager) {
    this.map.on("moveend", (_) => {
      const viewport = this.getViewportState();
      stateManager.updateViewport(viewport);
    });
  }

  private clearSelection(): void {
    // Clear selection
    if (this.selectedFeature) {
      // @ts-ignore
      this.selectedFeature.set("selected", false);
      this.selectedFeature = null;
      this.resourceLayer.changed(); // Trigger re-render to remove outline
    }

    // Dispatch event to hide sidebar section
    const event = new CustomEvent("featureDeselected");
    window.dispatchEvent(event);
  }

  private selectFeatureByCoords(popup: OpenedPopup): void {
    // Find the feature that matches this popup
    const source = this.resourceLayer.getSource();
    if (!source) return;

    const features = source.getFeatures();
    for (const feature of features) {
      const idA = feature.get("idA") as number;
      const idB = feature.get("idB") as number;
      const idC = feature.get("idC") as number;
      const idD = feature.get("idD") as number;

      if (
        idA == popup.idA &&
        idB == popup.idB &&
        idC == popup.idC &&
        idD == popup.idD
      ) {
        this.selectFeature(feature);
        break;
      }
    }
  }

  public loadMapImage(tilesPath: string = `/tiles/{z}/{y}/{x}.jpg`): void {
    const projection = this.map.getView().getProjection();

    // Create tile layer with XYZ source
    this.tileLayer = new TileLayer({
      source: new XYZ({
        url: tilesPath,
        projection: projection,
        tileSize: 256,
        minZoom: 0,
        maxZoom: 6,
      }),
      className: "tile-layer", // Add custom class for targeting
    });

    // Insert tile layer as the base layer
    this.map.getLayers().insertAt(0, this.tileLayer);

    // Wait for the map to render, then apply any pending filter
    this.map.once("rendercomplete", () => {
      if (this.currentFilter !== "none") {
        this.applyFilterToTileLayer(this.currentFilter);
      }
    });
  }

  public setMapFilter(filterName: string): void {
    // Store the current filter
    this.currentFilter = filterName;

    // Try to apply it immediately
    this.applyFilterToTileLayer(filterName);
  }

  private applyFilterToTileLayer(filterName: string): void {
    if (!this.mapElement) {
      console.warn("Map element not found, cannot apply filter");
      return;
    }

    // Find the tile layer element by the custom class we added
    const tileLayerElement = this.mapElement.querySelector(
      ".tile-layer",
    ) as HTMLElement;

    if (!tileLayerElement) {
      console.warn("Tile layer element not found yet, will retry after render");
      return;
    }

    // Apply the selected filter to the tile layer element
    let filterValue = "none";

    switch (filterName) {
      case "grayscale":
        filterValue = "grayscale(100%)";
        break;
      case "sepia":
        filterValue = "sepia(100%)";
        break;
      case "contrast":
        filterValue = "contrast(150%) saturate(120%)";
        break;
      case "brightness":
        filterValue = "brightness(130%) saturate(110%)";
        break;
      case "dark":
        filterValue = "brightness(70%) contrast(110%)";
        break;
      case "none":
      default:
        filterValue = "none";
        break;
    }

    tileLayerElement.style.filter = filterValue;

    console.log(`Applied filter: ${filterName} (${filterValue}) to tile layer`);
  }

  public setVisibleResourceTypes(
    loadedResources: LoadedResources,
    types: Set<string>,
  ): void {
    this.visibleResourceTypes = types;
    this.updateResourceLayer(loadedResources);
  }

  public updateResourceLayer(loadedResources: LoadedResources): void {
    const source = this.resourceLayer.getSource();
    if (!source) return;

    // Check if the currently selected feature will still be visible
    if (this.selectedFeature) {
      const selectedType = extractResourceType({
        type: this.selectedFeature.get("resourceType"),
        subtype: this.selectedFeature.get("subtype"),
        lootSpawnInfo: this.selectedFeature.get("lootSpawnInfo"),
      } as Resource);

      if (!this.visibleResourceTypes.has(selectedType)) {
        // Selected feature will no longer be visible, clear selection
        this.clearSelection();
      }
    }

    source.clear();

    const visibleResources = loadedResources.resources.filter((resource) => {
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
      const feature = this.createResourceFeature(resource, coords);

      // Restore selection if this was the selected feature
      if (this.selectedFeature) {
        const selectedX = this.selectedFeature.get("worldX");
        const selectedZ = this.selectedFeature.get("worldZ");
        if (
          Math.abs(resource.worldX - selectedX) < 0.1 &&
          Math.abs(resource.worldZ - selectedZ) < 0.1
        ) {
          feature.set("selected", true);
          this.selectedFeature = feature;
        }
      }

      features.push(feature);
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

  private getResourceStyle(feature: FeatureLike): Style | Style[] {
    const color = feature.get("color") as string;
    const zoom = this.map.getView().getZoom() || 2;
    const isSelected = feature.get("selected") === true;

    // Scale radius based on zoom level (exponential growth)
    // At zoom 2: radius ~4, at zoom 5: radius ~8, at zoom 8: radius ~16
    const baseRadius = 4;
    const scaleFactor = Math.pow(1.2, zoom - 2);
    const radius = Math.max(3, Math.min(20, baseRadius * scaleFactor));

    // Scale stroke width proportionally
    const strokeWidth = Math.max(1, Math.min(4, radius / 3));

    // If selected, add multiple strokes for a glowing effect
    if (isSelected) {
      return [
        // Outer glow (largest)
        new Style({
          image: new Circle({
            radius: radius + 4,
            fill: new Fill({ color: "rgba(255, 255, 255, 0.3)" }),
            stroke: new Stroke({
              color: "rgba(255, 255, 255, 0.6)",
              width: 2,
            }),
          }),
        }),
        // Middle outline
        new Style({
          image: new Circle({
            radius: radius + 2,
            stroke: new Stroke({
              color: "#ffffff",
              width: 3,
            }),
          }),
        }),
        // Inner circle (original)
        new Style({
          image: new Circle({
            radius: radius,
            fill: new Fill({ color: color }),
            stroke: new Stroke({
              color: "rgba(255, 255, 255, 0.8)",
              width: strokeWidth,
            }),
          }),
        }),
      ];
    }

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

      // Don't show tooltip if popup is open or on pointer devices (non-touch)
      if (feature && !this.isTouchDevice) {
        const type = feature.get("resourceType") as string;
        const subtype = feature.get("subtype") as string;
        const worldX = feature.get("worldX") as number;
        const worldY = feature.get("worldY") as number;
        const worldZ = feature.get("worldZ") as number;
        const idA = feature.get("idA") as number;
        const idB = feature.get("idB") as number;
        const idC = feature.get("idC") as number;
        const idD = feature.get("idD") as number;
        const path = feature.get("path") as string;
        const drop = feature.get("drop");
        const lootSpawnInfo = feature.get("lootSpawnInfo");

        const tooltipTitle = formatResourceTitle(type, subtype);
        const name = feature.get("name") as string;

        // Build tooltip content
        const tooltipHtml = `
          <div class="tooltip-title-group">
            <div class="tooltip-type">${tooltipTitle}</div>
            ${name ? `<div class="tooltip-subtitle">${name}</div>` : ""}
          </div>
          ${formatCoordinates("tooltip", worldX, worldY, worldZ)}
          ${formatGuidHtml("tooltip", idA, idB, idC, idD)}
          ${formatPathHtml("tooltip", path)}
          ${formatDropHtml("tooltip", drop)}
          ${formatLootSpawnInfoHtml("tooltip", lootSpawnInfo)}
        `;

        // Update tooltip content
        this.tooltipElement.innerHTML = tooltipHtml;

        // Position tooltip near cursor with overflow detection
        const mouseX = (evt.originalEvent as PointerEvent).pageX;
        const mouseY = (evt.originalEvent as PointerEvent).pageY;
        const offset = 15;

        // Get tooltip dimensions (need to make it visible first to measure)
        this.tooltipElement.style.visibility = 'hidden';
        this.tooltipElement.classList.add("visible");
        const tooltipRect = this.tooltipElement.getBoundingClientRect();

        // Check if tooltip would overflow bottom of viewport
        const viewportHeight = window.innerHeight;
        const wouldOverflowBottom = mouseY + offset + tooltipRect.height > viewportHeight;

        // Position tooltip
        this.tooltipElement.style.left = `${mouseX + offset}px`;
        if (wouldOverflowBottom) {
          // Position above cursor
          this.tooltipElement.style.top = `${mouseY - tooltipRect.height - offset}px`;
        } else {
          // Position below cursor
          this.tooltipElement.style.top = `${mouseY + offset}px`;
        }
        this.tooltipElement.style.visibility = 'visible';

        // Change cursor to pointer
        (this.map.getTargetElement() as HTMLElement).style.cursor = "pointer";
      } else {
        // Hide tooltip
        this.tooltipElement.classList.remove("visible");

        // Show pointer cursor on hover over features (for non-touch devices)
        if (feature && !this.isTouchDevice) {
          (this.map.getTargetElement() as HTMLElement).style.cursor = "pointer";
        } else {
          (this.map.getTargetElement() as HTMLElement).style.cursor = "";
        }
      }
    });
  }

  private detectTouchDevice(): boolean {
    return window.matchMedia("(pointer: coarse)").matches;
  }
}
