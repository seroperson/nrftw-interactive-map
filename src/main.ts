// Main application entry point

import { Resource } from "./types";
import { CoordinateConverter } from "./coordinateConverter";
import { MapRenderer } from "./mapRenderer";
import { StateManager } from "./stateManager";
import { UIManager } from "./ui";
import {
  createResourceTypes,
  createResourceGroups,
  isValidResourceType,
  isValidSubtypeForGroup,
} from "./resourceData";
import { VIEWPORT_UPDATE_INTERVAL } from "./constants";
import oreCoordinates from "./assets/ore_coordinates.csv?raw";
import regionTransform from "./assets/region_transforms.csv?raw";

class InteractiveMapApp {
  private converter: CoordinateConverter;
  private renderer: MapRenderer;
  private stateManager: StateManager;
  private uiManager: UIManager;
  private resources: Resource[] = [];

  constructor() {
    // Initialize core components
    this.converter = new CoordinateConverter();
    this.stateManager = new StateManager();
    this.renderer = new MapRenderer("map", this.converter);
    this.uiManager = new UIManager(this.stateManager);
    this.setupApplication();
  }

  private async setupApplication(): Promise<void> {
    try {
      // Load resources from CSV
      await this.loadResources();

      // Load region transforms if available
      await this.loadRegionTransforms();

      // Initialize UI with resource types and groups
      const resourceTypes = createResourceTypes(this.resources);
      const resourceGroups = createResourceGroups(resourceTypes);
      this.uiManager.setResourceTypes(resourceTypes);
      this.uiManager.setResourceGroups(resourceGroups);

      // Apply initial state
      const state = this.stateManager.getState();

      this.applyState();

      // Track previous visible resources to detect changes
      let previousVisibleResources = new Set(state.visibleResources);

      // Subscribe to state changes
      this.stateManager.subscribe((state) => {
        this.renderer.setVisibleResourceTypes(state.visibleResources);

        // Close popup when visible resources change
        const resourcesChanged =
          previousVisibleResources.size !== state.visibleResources.size ||
          Array.from(previousVisibleResources).some(
            (r) => !state.visibleResources.has(r),
          );

        if (resourcesChanged) {
          this.renderer.closePopup();
          previousVisibleResources = new Set(state.visibleResources);
        }
      });

      // Setup popup state handler (avoid circular updates)
      this.renderer.onPopupStateChange((popup) => {
        const currentPopup = this.stateManager.getState().openedPopup;
        // Only update if popup actually changed
        if (JSON.stringify(popup) !== JSON.stringify(currentPopup)) {
          this.stateManager.setOpenedPopup(popup);
        }
      });

      // Setup coordinate display
      this.setupCoordinateDisplay();

      // Load map tiles
      this.renderer.loadMapImage(); // Uses default 'tiles/{z}/{y}/{x}.jpg'

      this.renderer.setupViewportListeners(this.stateManager);

      console.log("Interactive map initialized successfully");
      console.log(`Loaded ${this.resources.length} resources`);
    } catch (error) {
      console.error("Failed to initialize application:", error);
      this.showError(
        "Failed to load map data. Please check the console for details.",
      );
    }
  }

  private async loadResources(): Promise<void> {
    try {
      this.resources = this.parseResourceCSV(oreCoordinates);
      this.renderer.setResources(this.resources);
    } catch (error) {
      console.warn("Could not load ore_coordinates.csv", error);
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
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
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current);
    return result;
  }

  private parseResourceCSV(csvText: string): Resource[] {
    const lines = csvText.trim().split("\n");
    const resources: Resource[] = [];

    let totalObjects = 0;
    let filteredObjects = 0;
    let duplicateObjects = 0;
    let invalidTypeObjects = 0;

    // Track seen objects to filter duplicates
    // Key format: "type:subtype:worldX:worldZ" (rounded to avoid floating point issues)
    const seenObjects = new Set<string>();

    // Track invalid types for reporting
    const invalidTypes = new Set<string>();

    // Skip header: Type,Subtype,Name,File,RawX,RawY,RawZ,id_a,id_b,id_c,id_d,Drop,LootSpawnInfo
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = this.parseCSVLine(line);
      if (parts.length < 8) continue;

      const type = parts[0].trim().toLowerCase();
      const subtype = parts[1].trim().toLowerCase();
      const name = parts[2].trim();
      const filePath = parts[3].trim();
      const rawX = parseFloat(parts[4]);
      const rawY = parseFloat(parts[5]);
      const rawZ = parseFloat(parts[6]);

      // Parse GUIDs if available (columns 7-10)
      const idA = parseInt(parts[7]);
      const idB = parseInt(parts[8]);
      const idC = parseInt(parts[9]);
      const idD = parseInt(parts[10]);

      // Parse Drop JSON if available (column 11)
      let drop: any = undefined;
      if (parts.length > 11 && parts[11].trim()) {
        try {
          drop = JSON.parse(parts[11]);
        } catch (e) {
          console.warn(`Failed to parse Drop JSON at line ${i + 1}:`, e);
        }
      }

      // Parse LootSpawnInfo JSON if available (column 12)
      let lootSpawnInfo: any = undefined;
      if (parts.length > 12 && parts[12].trim()) {
        try {
          lootSpawnInfo = JSON.parse(parts[12]);
        } catch (e) {
          console.warn(`Failed to parse LootSpawnInfo JSON at line ${i + 1}:`, e);
        }
      }

      totalObjects++;

      // Validate resource types against TYPES definition
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

      // Convert from Unity units (appears to be in centimeters * 65536) to game world units
      const worldX = rawX / 1_000_000;
      const worldY = rawY / 1_000_000;
      const worldZ = rawZ / 1_000_000;

      // Extract region from file path
      const region = this.extractRegionFromPath(filePath);

      // Filter out-of-bounds objects based on actual projection
      /*if (imageCoords.x < 0 || imageCoords.x >= MAP_WIDTH ||
          imageCoords.y < 0 || imageCoords.y >= MAP_HEIGHT) {
        filteredObjects++;
        continue;
      }*/

      // Check for duplicates (same type and coordinates)
      // Round coordinates to 3 decimal places to handle floating point precision
      const coordKey = `${type}:${subtype}:${worldX.toFixed(3)}:${worldZ.toFixed(3)}`;
      if (seenObjects.has(coordKey)) {
        duplicateObjects++;
        continue;
      }
      seenObjects.add(coordKey);

      resources.push({
        type,
        subtype,
        name,
        region,
        worldX,
        worldY,
        worldZ,
        filePath,
        idA,
        idB,
        idC,
        idD,
        drop,
        lootSpawnInfo,
      });
    }

    console.log(
      `Filtered ${filteredObjects} out-of-bounds objects out of ${totalObjects} total objects`,
    );
    console.log(`Filtered ${duplicateObjects} duplicate objects`);
    console.log(`Filtered ${invalidTypeObjects} invalid type objects`);
    if (invalidTypes.size > 0) {
      console.warn(
        `Found ${invalidTypes.size} unique invalid type combinations:`,
        Array.from(invalidTypes),
      );
    }
    console.log(`Loaded ${resources.length} unique valid resources`);

    return resources;
  }

  private extractRegionFromPath(filePath: string): string {
    // Extract region from path like: ExportedProject/Assets/worlds/isolaSacra/coast/coastA/loot/loot.unity
    // We want to get "coastA" not "coast"
    const match = filePath.match(/worlds\/isolaSacra\/[^\/]+\/([^\/]+)/);
    if (match) {
      return match[1];
    }

    // For paths that don't follow the isolaSacra pattern (like infiniteDungeon), use default
    return "default";
  }

  private async loadRegionTransforms(): Promise<void> {
    try {
      this.converter.loadTransformsFromCSV(regionTransform);
    } catch (error) {
      console.warn("Could not load region transforms:", error);
    }
  }

  private applyState(): void {
    const state = this.stateManager.getState();

    // Apply viewport state
    this.renderer.setViewportState(
      state.viewport.x,
      state.viewport.y,
      state.viewport.scale,
    );

    // Apply resource visibility
    this.renderer.setVisibleResourceTypes(state.visibleResources);

    // Apply opened popup if exists
    if (state.openedPopup) {
      this.renderer.setOpenedPopup(state.openedPopup);
    }
  }

  private setupCoordinateDisplay(): void {
    // Update viewport state periodically
    setInterval(() => {
      const viewport = this.renderer.getViewportState();
      this.stateManager.updateViewport(viewport);
    }, VIEWPORT_UPDATE_INTERVAL);
  }

  private showError(message: string): void {
    const container = document.getElementById("map-container");
    if (container) {
      const errorDiv = document.createElement("div");
      errorDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff4444;
        color: white;
        padding: 2rem;
        border-radius: 8px;
        max-width: 400px;
        text-align: center;
      `;
      errorDiv.textContent = message;
      container.appendChild(errorDiv);
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new InteractiveMapApp());
} else {
  new InteractiveMapApp();
}
