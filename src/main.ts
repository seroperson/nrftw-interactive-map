// Main application entry point

import { CoordinateConverter } from "./utils/coordinateConverter";
import { MapRenderer } from "./mapRenderer";
import { StateManager } from "./stateManager";
import { UIManager } from "./ui/uiManager";
import { ResourceLoader } from "./resourceManager";
import { VIEWPORT_UPDATE_INTERVAL } from "./utils/constants";
import itemCoordinates from "./assets/item_coordinates.csv?raw";
import regionOffsets from "./assets/region_offsets.csv?raw";
import itemDisabledJson from "./assets/item_disabled.json?raw";
import { LoadedResources } from "./types";

class InteractiveMapApp {
  private converter: CoordinateConverter;
  private renderer: MapRenderer;
  private stateManager: StateManager;
  private uiManager: UIManager;
  private resourceLoader: ResourceLoader;
  private loadedResources!: LoadedResources;

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
      // Load disabled items first
      this.resourceLoader.loadDisabledItems(itemDisabledJson);

      // Load region transforms
      this.converter.loadTransformsFromCSV(regionOffsets);

      // Load map tiles
      this.renderer.loadMapImage();

      // Load resources with initial state
      this.loadResources();

      // Initialize UI with resource types and groups
      this.uiManager.setupEventListeners(this.loadedResources);
      this.uiManager.renderResourceFilters(this.loadedResources);

      // Apply initial state
      this.applyState(this.loadedResources);

      // Setup state change handlers
      this.setupStateHandlers();

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

  private loadResources(): void {
    const state = this.stateManager.getState();
    const applyDisabledFilter = !state.expertMode;
    this.loadedResources = this.resourceLoader.loadResourceCSV(
      itemCoordinates,
      applyDisabledFilter,
    );

    // Set resources in renderer
    this.renderer.updateResourceLayer(this.loadedResources);
  }

  private setupStateHandlers(): void {
    let previousExpertMode = this.stateManager.getState().expertMode;

    // Subscribe to state changes
    this.stateManager.subscribe((state) => {
      // Check if expertMode changed
      if (state.expertMode !== previousExpertMode) {
        previousExpertMode = state.expertMode;
        // Reload resources with new filter setting
        this.loadResources();
        this.uiManager.renderResourceFilters(this.loadedResources);
      }

      // Apply current state to renderer
      this.renderer.setVisibleResourceTypes(
        this.loadedResources,
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
    const urlParams = this.stateManager.getUrlParams();

    // Apply viewport state
    this.renderer.setViewportState(
      state.viewport.x,
      state.viewport.y,
      state.viewport.scale,
    );

    // If there's an openedPopup from URL, auto-select only the group containing that object
    if (urlParams.openedPopup) {
      const resource = loadedResources.resources.find(
        (r) =>
          r.idA === urlParams.openedPopup!.idA &&
          r.idB === urlParams.openedPopup!.idB &&
          r.idC === urlParams.openedPopup!.idC &&
          r.idD === urlParams.openedPopup!.idD,
      );

      if (resource) {
        // Find the group for this resource
        const groupName = resource.type;
        const group = loadedResources.resourceGroups.get(groupName);

        if (group) {
          // Set visible resources to only include types from this group
          const groupTypes = new Set(group.types);
          this.stateManager.setVisibleResources(groupTypes);
        }
      }
    }

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
