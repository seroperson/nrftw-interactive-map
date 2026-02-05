// OpenLayers-based map renderer

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Projection } from 'ol/proj';
import { getCenter } from 'ol/extent';
import XYZ from 'ol/source/XYZ';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import type { FeatureLike } from 'ol/Feature';
import Overlay from 'ol/Overlay';

import { Resource, CustomMarker, ImageCoordinates, OpenedPopup } from './types';
import { CoordinateConverter } from './coordinateConverter';
import { getResourceColor, extractResourceType } from './resourceData';
import { StateManager } from './stateManager';

export class MapRenderer {
  private map: Map;
  private converter: CoordinateConverter;
  
  private mapWidth: number = 16384;
  private mapHeight: number = 16384;
  
  private resourceLayer: VectorLayer<VectorSource>;
  private markerLayer: VectorLayer<VectorSource>;
  
  private resources: Resource[] = [];
  private customMarkers: CustomMarker[] = [];
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
      code: 'NRFTW',
      units: 'pixels',
      extent: extent,
    });

    // Create vector layers for resources and markers
    this.resourceLayer = new VectorLayer({
      source: new VectorSource(),
      style: this.getResourceStyle.bind(this),
    });

    this.markerLayer = new VectorLayer({
      source: new VectorSource(),
      style: this.getMarkerStyle.bind(this),
    });

    // Create the map
    this.map = new Map({
      target: targetElement,
      layers: [this.resourceLayer, this.markerLayer],
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
    this.map.getView().on('change:resolution', () => {
      this.resourceLayer.changed();
    });
    
    // Handle window resize to update map size
    window.addEventListener('resize', () => {
      this.map.updateSize();
    });
  }

  private setupPopup(): void {
    // Create popup element
    this.popupElement = document.createElement('div');
    this.popupElement.className = 'ol-popup';
    this.popupElement.innerHTML = `
      <div class="ol-popup-closer" id="popup-closer">×</div>
      <div class="ol-popup-content" id="popup-content"></div>
    `;
    
    this.popupCloser = this.popupElement.querySelector('#popup-closer') as HTMLElement;
    
    // Create overlay for popup
    this.popupOverlay = new Overlay({
      element: this.popupElement,
      autoPan: {
        animation: {
          duration: 250,
        },
      },
      positioning: 'bottom-center',
      offset: [0, -10],
    });
    
    this.map.addOverlay(this.popupOverlay);
    
    // Close popup handler
    this.popupCloser.addEventListener('click', () => {
      this.closePopup();
    });
    
    // Handle clicks on features and map
    this.map.on('click', (evt) => {
      const pixel = evt.pixel;
      const feature = this.map.forEachFeatureAtPixel(pixel, (feat) => {
        if (!feat.get('isCustomMarker')) {
          return feat;
        }
        return null;
      });
      
      if (feature) {
        const coordinate = evt.coordinate;
        this.showPopup(feature, coordinate);
      } else {
        // Clicked on empty map - close popup
        this.closePopup();
      }
    });
  }

  private showPopup(feature: FeatureLike, coordinate: number[]): void {
    // Hide tooltip if any
    this.tooltipElement.classList.remove('visible');
    (this.map.getTargetElement() as HTMLElement).style.cursor = '';

    const type = feature.get('resourceType') as string;
    const subtype = feature.get('subtype') as string;
    const resourceType = feature.get('type') as string;
    const worldX = feature.get('worldX') as number;
    const worldY = feature.get('worldY') as number;
    const worldZ = feature.get('worldZ') as number;
    const idA = feature.get('idA') as number | undefined;
    const idB = feature.get('idB') as number | undefined;
    const idC = feature.get('idC') as number | undefined;
    const idD = feature.get('idD') as number | undefined;
    const color = feature.get('color') as string;
    
    // Build popup content with icon
    const contentElement = this.popupElement.querySelector('#popup-content') as HTMLElement;
    
    const isDevMode = this.isDevMode();

    let popupTitle = null;
    if (type === subtype) { 
      popupTitle = subtype.charAt(0).toUpperCase() + subtype.slice(1);
    } else {
      popupTitle = `${type.charAt(0).toUpperCase() + type.slice(1)}, ${subtype.charAt(0).toUpperCase() + subtype.slice(1)}`
    }
    
    let popupHtml = `
      <div class="popup-header">
        <span class="popup-icon" style="background-color: ${color}"></span>
        <span class="popup-title">${popupTitle}</span>
      </div>
      <div class="popup-coords">X: ${worldX.toFixed(1)}, Y: ${worldY.toFixed(1)}, Z: ${worldZ.toFixed(1)}</div>
    `;
    
    if (isDevMode && idA !== undefined && idB !== undefined && idC !== undefined && idD !== undefined) {
      popupHtml += `
        <div class="popup-guid">
          <div class="popup-guid-label">GUID:</div>
          <div class="popup-guid-values">${idA},${idB},${idC},${idD}</div>
        </div>
      `;
    }
    
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
        idD
      });
    }
  }

  public setupViewportListeners(stateManager: StateManager) {
    this.map.on('moveend', (_) => {
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
      const worldX = feature.get('worldX') as number;
      const worldZ = feature.get('worldZ') as number;
      
      if (Math.abs(worldX - popup.worldX) < 0.1 && Math.abs(worldZ - popup.worldZ) < 0.1) {
        const geometry = feature.getGeometry();
        if (geometry) {
          const coords = (geometry as Point).getCoordinates();
          this.showPopup(feature, coords);
        }
        break;
      }
    }
  }

  public onPopupStateChange(callback: (popup: OpenedPopup | null) => void): void {
    this.onPopupChange = callback;
  }

  public loadMapImage(tilesPath: string = `${import.meta.env.BASE_URL}/tiles/{z}/{y}/{x}.jpg`): void {
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

  public setCustomMarkers(markers: CustomMarker[]): void {
    this.customMarkers = markers;
    this.updateMarkerLayer();
  }

  private updateResourceLayer(): void {
    const source = this.resourceLayer.getSource();
    if (!source) return;

    source.clear();

    const visibleResources = this.resources.filter(resource => {
      const type = extractResourceType(resource);
      return this.visibleResourceTypes.has(type);
    });

    const features: Feature[] = [];
    for (const resource of visibleResources) {
      const coords = this.converter.worldToImage(resource.worldX, resource.worldZ, resource.region);
      features.push(this.createResourceFeature(resource, coords));
    }
    source.addFeatures(features);
  }

  private createResourceFeature(resource: Resource, coords: ImageCoordinates): Feature {
    const resourceType = extractResourceType(resource);
    const feature = new Feature({
      geometry: new Point([coords.x, coords.y]), // Coordinates already converted by converter
      name: resource.name,
      type: resourceType,
      color: getResourceColor(resourceType),
      resourceType: resource.type,
      subtype: resource.subtype,
      worldX: resource.worldX,
      worldY: resource.worldY,
      worldZ: resource.worldZ,
      idA: resource.idA,
      idB: resource.idB,
      idC: resource.idC,
      idD: resource.idD,
    });

    return feature;
  }

  private getResourceStyle(feature: FeatureLike): Style {
    const color = feature.get('color') as string;
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
        stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.5)', width: strokeWidth }),
      }),
    });
  }

  private updateMarkerLayer(): void {
    const source = this.markerLayer.getSource();
    if (!source) return;

    source.clear();

    const features = this.customMarkers.map(marker => {
      const coords = this.converter.worldToImage(marker.worldX, marker.worldZ);
      return this.createMarkerFeature(marker, coords);
    });

    source.addFeatures(features);
  }

  private createMarkerFeature(marker: CustomMarker, coords: ImageCoordinates): Feature {
    const feature = new Feature({
      geometry: new Point([coords.x, this.mapHeight - coords.y]), // Flip Y for OpenLayers
      label: marker.label,
      markerId: marker.id,
      isCustomMarker: true,
    });

    return feature;
  }

  private getMarkerStyle(feature: FeatureLike): Style {
    const label = feature.get('label') as string;
    const zoom = this.map.getView().getZoom() || 2;
    
    const style = new Style({
      image: new Circle({
        radius: 8,
        fill: new Fill({ color: '#ff4444' }),
        stroke: new Stroke({ color: '#000000', width: 4 }),
      }),
    });

    // Show label only at higher zoom levels
    if (zoom > 3 && label) {
      style.setText(new Text({
        text: label,
        offsetY: -15,
        fill: new Fill({ color: '#ffffff' }),
        stroke: new Stroke({ color: '#000000', width: 3 }),
        font: '14px sans-serif',
      }));
    }

    return style;
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

  public screenToWorld(screenX: number, screenY: number): ImageCoordinates {
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
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'resource-tooltip';
    document.body.appendChild(this.tooltipElement);
    
    this.map.on('pointermove', (evt) => {
      const coordinate = evt.coordinate;
      const imageX = coordinate[0];
      const imageY = this.mapHeight - coordinate[1]; // Flip Y back
      
      const worldCoords = this.converter.imageToWorld(imageX, imageY);
      
      // Dispatch custom event with coordinates
      const event = new CustomEvent('mapcoordinates', {
        detail: { worldX: worldCoords.x, worldZ: worldCoords.z }
      });
      window.dispatchEvent(event);
      
      // Check if hovering over a resource feature
      const pixel = evt.pixel;
      const feature = this.map.forEachFeatureAtPixel(pixel, (feat) => {
        // Only show tooltip for resource features, not custom markers
        if (!feat.get('isCustomMarker')) {
          return feat;
        }
        return null;
      });
      
      // Don't show tooltip if popup is open
      if (!this.isPopupOpen && feature) {
        const type = feature.get('resourceType') as string;
        const subtype = feature.get('subtype') as string;
        const worldX = feature.get('worldX') as number;
        const worldY = feature.get('worldY') as number;
        const worldZ = feature.get('worldZ') as number;
        const idA = feature.get('idA') as number | undefined;
        const idB = feature.get('idB') as number | undefined;
        const idC = feature.get('idC') as number | undefined;
        const idD = feature.get('idD') as number | undefined;
        
        // Check if dev mode is active
        const isDevMode = this.isDevMode();

        let tooltipTitle = null;
        if (type === subtype) { 
          tooltipTitle = subtype.charAt(0).toUpperCase() + subtype.slice(1);
        } else {
          tooltipTitle = `${type.charAt(0).toUpperCase() + type.slice(1)}, ${subtype.charAt(0).toUpperCase() + subtype.slice(1)}`
        }
        
        // Build tooltip content
        let tooltipHtml = `
          <div class="tooltip-type">${tooltipTitle}</div>
          <div class="tooltip-coords">X: ${worldX.toFixed(1)}, Y: ${worldY.toFixed(1)}, Z: ${worldZ.toFixed(1)}</div>
        `;
        
        // Add GUID info in dev mode
        if (isDevMode && idA !== undefined && idB !== undefined && idC !== undefined && idD !== undefined) {
          tooltipHtml += `
            <div class="tooltip-guid">
              <div class="tooltip-guid-label">GUID:</div>
              <div class="tooltip-guid-values">${idA},${idB},${idC},${idD}</div>
            </div>
          `;
        }
        
        // Update tooltip content
        this.tooltipElement.innerHTML = tooltipHtml;
        
        // Position tooltip near cursor
        this.tooltipElement.style.left = `${evt.originalEvent.pageX + 15}px`;
        this.tooltipElement.style.top = `${evt.originalEvent.pageY + 15}px`;
        this.tooltipElement.classList.add('visible');
        
        // Change cursor to pointer
        (this.map.getTargetElement() as HTMLElement).style.cursor = 'pointer';
      } else {
        // Hide tooltip
        this.tooltipElement.classList.remove('visible');
        (this.map.getTargetElement() as HTMLElement).style.cursor = '';
      }
    });
  }

  public onMapClick(callback: (worldX: number, worldZ: number) => void): void {
    this.map.on('click', (evt) => {
      const coordinate = evt.coordinate;
      const imageX = coordinate[0];
      const imageY = this.mapHeight - coordinate[1]; // Flip Y back
      console.log(`Image: ${imageX} / ${imageY}`)
      
      const worldCoords = this.converter.imageToWorld(imageX, imageY);
      callback(worldCoords.x, worldCoords.z);
    });
  }

  public getMap(): Map {
    return this.map;
  }

  private isDevMode(): boolean {
    // Check URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('dev')) {
      return true;
    }
    
    // Check localStorage
    try {
      return localStorage.getItem('nrftw_dev_mode') === 'true';
    } catch {
      return false;
    }
  }
}
