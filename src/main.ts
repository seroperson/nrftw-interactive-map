// Main application entry point

import { CoordinateConverter } from "./utils/coordinateConverter";
import { MapRenderer } from "./mapRenderer";
import { StateManager } from "./stateManager";
import { UIManager } from "./ui/uiManager";
import { ResourceLoader } from "./resourceManager";
import { VIEWPORT_UPDATE_INTERVAL } from "./utils/constants";
import oreCoordinates from "./assets/ore_coordinates.csv?raw";
import regionTransform from "./assets/region_transforms.csv?raw";
import disabledItemsJson from "./assets/disabled_items.json?raw";
import { LoadedResources } from "./types";

class InteractiveMapApp {
  private converter: CoordinateConverter;
  private renderer: MapRenderer;
  private stateManager: StateManager;
  private uiManager: UIManager;
  private resourceLoader: ResourceLoader;

  constructor() {
    // Initialize core components
    this.converter = new CoordinateConverter();
    this.stateManager = new StateManager();
    this.renderer = new MapRenderer("map", this.converter);
    this.uiManager = new UIManager(this.stateManager);
    this.resourceLoader = new ResourceLoader();
    this.setupApplication();
  }

  private async setupApplication(): Promise<void> {
    try {
      // Load disabled items and parse resources
      this.resourceLoader.loadDisabledItems(disabledItemsJson);
      var loadedResources = this.resourceLoader.loadResourceCSV(oreCoordinates);

      // Load region transforms
      this.converter.loadTransformsFromCSV(regionTransform);

      // Set resources in renderer
      this.renderer.updateResourceLayer(loadedResources);

      // Initialize UI with resource types and groups
      this.uiManager.setupEventListeners(loadedResources);
      this.uiManager.renderResourceFilters(loadedResources);

      // Load map tiles
      this.renderer.loadMapImage();

      // Apply initial state
      this.applyState(loadedResources);

      // Setup state change handlers
      this.setupStateHandlers(loadedResources);

      // Setup viewport tracking
      this.setupViewportTracking();

      // Setup renderer listeners
      this.renderer.setupViewportListeners(this.stateManager);

      console.log("Interactive map initialized successfully");
    } catch (error) {
      console.error("Failed to initialize application:", error);

      this.uiManager.showError(
        "Failed to load map data. Please check the console for details.",
      );
    }
  }

  private setupStateHandlers(loadedResources: LoadedResources): void {
    // Subscribe to state changes
    this.stateManager.subscribe((state) => {
      this.renderer.setVisibleResourceTypes(
        loadedResources,
        state.visibleResources,
      );
      this.renderer.setMapFilter(state.mapFilter);
    });

    // Setup popup state handler (avoid circular updates)
    this.uiManager.onPopupStateChange((popup) => {
      const currentPopup = this.stateManager.getState().openedPopup;
      // Only update if popup actually changed
      if (JSON.stringify(popup) !== JSON.stringify(currentPopup)) {
        this.stateManager.setOpenedPopup(popup);
      }
    });
  }

  private setupViewportTracking(): void {
    // Update viewport state periodically
    setInterval(() => {
      const viewport = this.renderer.getViewportState();
      this.stateManager.updateViewport(viewport);
    }, VIEWPORT_UPDATE_INTERVAL);
  }

  private applyState(loadedResources: LoadedResources): void {
    const state = this.stateManager.getState();

    // Apply viewport state
    this.renderer.setViewportState(
      state.viewport.x,
      state.viewport.y,
      state.viewport.scale,
    );

    // Apply resource visibility
    this.renderer.setVisibleResourceTypes(
      loadedResources,
      state.visibleResources,
    );

    // Apply map filter
    this.renderer.setMapFilter(state.mapFilter);

    // Apply opened popup if exists
    if (state.openedPopup) {
      this.uiManager.setOpenedPopup(state.openedPopup);
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new InteractiveMapApp());
} else {
  new InteractiveMapApp();
}
