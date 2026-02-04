// Main application entry point

import { Resource } from './types';
import { CoordinateConverter } from './coordinateConverter';
import { MapRenderer } from './mapRenderer';
import { StateManager } from './stateManager';
import { UIManager } from './ui';
import { createResourceTypes, createResourceGroups } from './resourceData';

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
    
    this.renderer = new MapRenderer('map', this.converter);
    
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
      
      // Set default visible resources if none are set
      if (state.visibleResources.size === 0) {
        const allTypes = new Set(Array.from(resourceTypes.keys()));
        this.stateManager.setVisibleResources(allTypes);
      }
      
      this.applyState();
      
      // Track previous visible resources to detect changes
      let previousVisibleResources = new Set(state.visibleResources);
      
      // Subscribe to state changes
      this.stateManager.subscribe((state) => {
        this.renderer.setVisibleResourceTypes(state.visibleResources);
        this.renderer.setCustomMarkers(state.customMarkers);
        this.uiManager.renderCustomMarkers(state.customMarkers);
        
        // Close popup when visible resources change
        const resourcesChanged = previousVisibleResources.size !== state.visibleResources.size ||
          Array.from(previousVisibleResources).some(r => !state.visibleResources.has(r));
        
        if (resourcesChanged) {
          this.renderer.closePopup();
          previousVisibleResources = new Set(state.visibleResources);
        }
        
        // Update map cursor based on marker mode
        const mapElement = document.getElementById('map');
        if (mapElement) {
          mapElement.classList.toggle('marker-mode', state.markerMode);
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
      
      // Setup marker click handler
      this.setupMarkerClickHandler();
      
      // Setup coordinate display
      this.setupCoordinateDisplay();
      
      // Load map tiles
      this.renderer.loadMapImage(); // Uses default 'tiles/{z}/{y}/{x}.jpg'

      this.renderer.setupViewportListeners(this.stateManager);
      
      console.log('Interactive map initialized successfully');
      console.log(`Loaded ${this.resources.length} resources`);
      
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this.showError('Failed to load map data. Please check the console for details.');
    }
  }

  private async loadResources(): Promise<void> {
    try {
      // Try to load ore_coordinates.csv from the parent directory
      const response = await fetch('../ore_coordinates.csv');
      if (!response.ok) {
        throw new Error('Failed to load ore_coordinates.csv');
      }
      
      const csvText = await response.text();
      this.resources = this.parseResourceCSV(csvText);
      this.renderer.setResources(this.resources);
      
    } catch (error) {
      console.warn('Could not load ore_coordinates.csv', error);
    }
  }

  private parseResourceCSV(csvText: string): Resource[] {
    const lines = csvText.trim().split('\n');
    const resources: Resource[] = [];
    
    // Map dimensions from coordinateConverter
    const MAP_WIDTH = 16384;
    const MAP_HEIGHT = 16384;
    
    let totalObjects = 0;
    let filteredObjects = 0;
    let duplicateObjects = 0;
    
    // Track seen objects to filter duplicates
    // Key format: "type:subtype:worldX:worldZ" (rounded to avoid floating point issues)
    const seenObjects = new Set<string>();
    
    // Skip header: Type,Subtype,Name,File,Line,RawX,RawY,RawZ,id_a,id_b,id_c,id_d
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 8) continue;

      const type = parts[0].trim();
      const subtype = parts[1].trim();
      const name = parts[2].trim();
      const filePath = parts[3].trim();
      const lineNum = parseInt(parts[4]);
      const rawX = parseFloat(parts[5]);
      const rawY = parseFloat(parts[6]);
      const rawZ = parseFloat(parts[7]);
      
      // Parse GUIDs if available (columns 8-11)
      const idA = parts.length > 8 ? parseInt(parts[8]) : undefined;
      const idB = parts.length > 9 ? parseInt(parts[9]) : undefined;
      const idC = parts.length > 10 ? parseInt(parts[10]) : undefined;
      const idD = parts.length > 11 ? parseInt(parts[11]) : undefined;

      // Convert from Unity units (appears to be in centimeters * 65536) to game world units
      const worldX = rawX / 1_000_000;
      const worldY = rawY / 1_000_000;
      const worldZ = rawZ / 1_000_000;

      totalObjects++;

      // Extract region from file path
      const region = this.extractRegionFromPath(filePath);

      // Project world coordinates to image coordinates
      const imageCoords = this.converter.worldToImage(worldX, worldZ, region);
      
      // Filter out-of-bounds objects based on actual projection
      if (imageCoords.x < 0 || imageCoords.x >= MAP_WIDTH ||
          imageCoords.y < 0 || imageCoords.y >= MAP_HEIGHT) {
        filteredObjects++;
        continue;
      }

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
        line: lineNum,
        idA,
        idB,
        idC,
        idD
      });
    }
    
    console.log(`Filtered ${filteredObjects} out-of-bounds objects out of ${totalObjects} total objects`);
    console.log(`Filtered ${duplicateObjects} duplicate objects`);
    console.log(`Loaded ${resources.length} unique in-bounds resources`);
    
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
    return 'default';
  }

  private async loadRegionTransforms(): Promise<void> {
    try {
      const response = await fetch('../region_transforms.csv');
      if (!response.ok) {
        console.warn('No region_transforms.csv found, using default transforms');
        return;
      }
      
      const csvText = await response.text();
      this.converter.loadTransformsFromCSV(csvText);
      
    } catch (error) {
      console.warn('Could not load region transforms:', error);
    }
  }

  private applyState(): void {
    const state = this.stateManager.getState();
    
    // Apply viewport state
    this.renderer.setViewportState(
      state.viewport.x,
      state.viewport.y,
      state.viewport.scale
    );
    
    // Apply resource visibility
    this.renderer.setVisibleResourceTypes(state.visibleResources);
    
    // Apply custom markers
    this.renderer.setCustomMarkers(state.customMarkers);
    this.uiManager.renderCustomMarkers(state.customMarkers);
    
    // Apply opened popup if exists
    if (state.openedPopup) {
      this.renderer.setOpenedPopup(state.openedPopup);
    }
  }

  private setupMarkerClickHandler(): void {
    this.renderer.onMapClick((worldX, worldZ) => {
      const state = this.stateManager.getState();
      
      if (state.markerMode) {
        // Create new marker
        const marker = {
          id: `marker_${Date.now()}`,
          worldX: worldX,
          worldZ: worldZ,
          label: 'New Marker'
        };
        
        this.stateManager.addCustomMarker(marker);
        
        // Exit marker mode
        this.stateManager.setMarkerMode(false);
        const addMarkerBtn = document.getElementById('add-marker-mode');
        if (addMarkerBtn) {
          addMarkerBtn.classList.remove('active');
          addMarkerBtn.textContent = 'Add Marker Mode';
        }
        const markerHint = document.getElementById('marker-mode-hint');
        markerHint?.classList.add('hidden');
      }
    });
  }

  private setupCoordinateDisplay(): void {
    // Listen for coordinate updates from the map
    window.addEventListener('mapcoordinates', ((e: CustomEvent) => {
      this.uiManager.updateCoordinatesDisplay(e.detail.worldX, e.detail.worldZ);
    }) as EventListener);
    
    // Update viewport state periodically
    setInterval(() => {
      const viewport = this.renderer.getViewportState();
      this.stateManager.updateViewport(viewport);
    }, 1000);
  }

  private showError(message: string): void {
    const container = document.getElementById('map-container');
    if (container) {
      const errorDiv = document.createElement('div');
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new InteractiveMapApp());
} else {
  new InteractiveMapApp();
}
