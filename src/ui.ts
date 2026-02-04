// UI management for sidebar and controls

import { ResourceType, CustomMarker, ResourceGroup } from './types';
import { StateManager } from './stateManager';

export class UIManager {
  private stateManager: StateManager;
  private resourceTypes: Map<string, ResourceType>;
  private resourceGroups: Map<string, ResourceGroup>;
  private onMarkerClick: ((worldX: number, worldZ: number) => void) | null = null;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.resourceTypes = new Map();
    this.resourceGroups = new Map();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Toggle sidebar
    const toggleBtn = document.getElementById('toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    
    toggleBtn?.addEventListener('click', () => {
      sidebar?.classList.toggle('collapsed');
    });

    // Check/Uncheck all filters
    const checkAllBtn = document.getElementById('check-all');
    const uncheckAllBtn = document.getElementById('uncheck-all');
    
    checkAllBtn?.addEventListener('click', () => {
      const allTypes = new Set(this.resourceTypes.keys());
      this.stateManager.setVisibleResources(allTypes);
      this.renderResourceFilters();
    });
    
    uncheckAllBtn?.addEventListener('click', () => {
      this.stateManager.setVisibleResources(new Set());
      this.renderResourceFilters();
    });

    // Add marker mode
    const addMarkerBtn = document.getElementById('add-marker-mode');
    const markerHint = document.getElementById('marker-mode-hint');
    
    addMarkerBtn?.addEventListener('click', () => {
      const isActive = addMarkerBtn.classList.toggle('active');
      markerHint?.classList.toggle('hidden', !isActive);
      this.stateManager.setMarkerMode(isActive);
      
      addMarkerBtn.textContent = isActive ? 'Cancel' : 'Add Marker Mode';
    });

    // Copy URL
    const copyBtn = document.getElementById('copy-url');
    const feedback = document.getElementById('copy-feedback');
    
    copyBtn?.addEventListener('click', async () => {
      const url = this.stateManager.getShareableURL();
      
      try {
        await navigator.clipboard.writeText(url);
        feedback?.classList.remove('hidden');
        setTimeout(() => feedback?.classList.add('hidden'), 2000);
      } catch (e) {
        console.error('Failed to copy URL:', e);
      }
    });

    this.stateManager.subscribe((_) => {
      console.log("Updating")
      this.renderResourceFilters();
    });
  }

  public setResourceTypes(types: Map<string, ResourceType>): void {
    this.resourceTypes = types;
    this.renderResourceFilters();
  }

  public setResourceGroups(groups: Map<string, ResourceGroup>): void {
    this.resourceGroups = groups;
    this.renderResourceFilters();
  }

  private renderResourceFilters(): void {
    const container = document.getElementById('resource-filters');
    if (!container) return;

    container.innerHTML = '';
    const state = this.stateManager.getState();

    // Render groups
    for (const [groupName, group] of this.resourceGroups.entries()) {
      const groupElement = document.createElement('div');
      groupElement.className = 'filter-group-container';

      // Group header
      const groupHeader = document.createElement('div');
      groupHeader.className = 'filter-group-header';
      
      const groupCheckbox = document.createElement('input');
      groupCheckbox.type = 'checkbox';
      groupCheckbox.id = `group-${groupName}`;
      
      // Check if all types in group are visible
      const allVisible = group.types.every(type => state.visibleResources.has(type));
      const someVisible = group.types.some(type => state.visibleResources.has(type));
      groupCheckbox.checked = allVisible;
      groupCheckbox.indeterminate = !allVisible && someVisible;
      
      groupCheckbox.addEventListener('change', () => {
        // Toggle all types in group
        const shouldEnable = groupCheckbox.checked;
        for (const type of group.types) {
          if (shouldEnable && !state.visibleResources.has(type)) {
            this.stateManager.toggleResourceType(type);
          } else if (!shouldEnable && state.visibleResources.has(type)) {
            this.stateManager.toggleResourceType(type);
          }
        }
        // Re-render to update all checkboxes
        this.renderResourceFilters();
      });

      const groupLabel = document.createElement('div');
      groupLabel.className = 'filter-group-label';
      
      // Create stacked color circles for the group
      const groupColors = document.createElement('div');
      groupColors.className = 'group-colors';
      
      const maxCirclesToShow = 5;
      let circleCount = 0;
      
      for (const typeName of group.types) {
        const type = this.resourceTypes.get(typeName);
        if (type && type.count > 0) {
          if (circleCount < maxCirclesToShow) {
            const colorCircle = document.createElement('span');
            colorCircle.className = 'group-color-circle';
            colorCircle.style.backgroundColor = type.color;
            colorCircle.title = type.name; // Tooltip showing resource type name
            groupColors.appendChild(colorCircle);
            circleCount++;
          }
        }
      }
      
      // Show overflow indicator if there are more types
      const totalTypes = group.types.filter(t => {
        const type = this.resourceTypes.get(t);
        return type && type.count > 0;
      }).length;
      
      if (totalTypes > maxCirclesToShow) {
        const overflow = document.createElement('span');
        overflow.className = 'group-color-overflow';
        overflow.textContent = `+${totalTypes - maxCirclesToShow}`;
        overflow.title = `${totalTypes - maxCirclesToShow} more types`;
        groupColors.appendChild(overflow);
      }
      
      const groupNameSpan = document.createElement('span');
      groupNameSpan.textContent = groupName.charAt(0).toUpperCase() + groupName.slice(1);
      
      // Calculate total count for group
      const totalCount = group.types.reduce((sum, type) => {
        const resourceType = this.resourceTypes.get(type);
        return sum + (resourceType?.count || 0);
      }, 0);
      
      const groupCountSpan = document.createElement('span');
      groupCountSpan.className = 'resource-count';
      groupCountSpan.textContent = `(${totalCount})`;

      groupLabel.appendChild(groupColors);
      groupLabel.appendChild(groupNameSpan);
      groupLabel.appendChild(groupCountSpan);

      groupHeader.appendChild(groupCheckbox);
      groupHeader.appendChild(groupLabel);
      
      // Make label clickable to toggle expansion or checkbox
      groupHeader.addEventListener('click', (e) => {
        e.preventDefault();
        // For single-type groups, toggle the checkbox instead of expanding
        if (group.types.length === 1) {
          // Toggle the single type in the group
          const shouldEnable = !groupCheckbox.checked;
          for (const type of group.types) {
            if (shouldEnable && !state.visibleResources.has(type)) {
              this.stateManager.toggleResourceType(type);
            } else if (!shouldEnable && state.visibleResources.has(type)) {
              this.stateManager.toggleResourceType(type);
            }
          }
          // Re-render to update all checkboxes
          this.renderResourceFilters();
          return;
        }
        this.stateManager.toggleGroupExpansion(groupName);
        console.log(`Toggle group expansion ${groupName}`)
      });
      
      // Prevent checkbox clicks from bubbling to prevent expansion
      groupCheckbox.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      groupElement.appendChild(groupHeader);

      // Group items (types) - show only if expanded AND group has multiple types
      if (state.expandedGroups.has(groupName) && group.types.length > 1) {
        const groupItems = document.createElement('div');
        groupItems.className = 'filter-group-items';

        for (const typeName of group.types) {
          const type = this.resourceTypes.get(typeName);
          if (!type || type.count === 0) continue;

          const item = document.createElement('label');
          item.className = 'filter-item';
          item.htmlFor = `filter-${type.name}`;

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `filter-${type.name}`;
          checkbox.checked = state.visibleResources.has(type.name);
          
          checkbox.addEventListener('change', () => {
            this.stateManager.toggleResourceType(type.name);
            
            // After toggling, check if we need to update parent group checkbox
            // This will trigger a re-render which will update the parent state
            this.renderResourceFilters();
          });

          const label = document.createElement('label');
          label.htmlFor = `filter-${type.name}`;
          
          const colorBox = document.createElement('span');
          colorBox.className = 'resource-color';
          colorBox.style.backgroundColor = type.color;
          
          const nameSpan = document.createElement('span');
          nameSpan.textContent = type.name.charAt(0).toUpperCase() + type.name.slice(1);
          
          const countSpan = document.createElement('span');
          countSpan.className = 'resource-count';
          countSpan.textContent = `(${type.count})`;

          label.appendChild(colorBox);
          label.appendChild(nameSpan);
          label.appendChild(countSpan);

          item.appendChild(checkbox);
          item.appendChild(label);
          groupItems.appendChild(item);
        }

        groupElement.appendChild(groupItems);
      }

      container.appendChild(groupElement);
    }
  }

  public renderCustomMarkers(markers: CustomMarker[]): void {
    const container = document.getElementById('custom-markers-list');
    if (!container) return;

    container.innerHTML = '';

    for (const marker of markers) {
      const item = document.createElement('div');
      item.className = 'marker-item';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = marker.label;
      input.placeholder = 'Marker label';
      
      input.addEventListener('change', () => {
        this.stateManager.updateCustomMarker(marker.id, input.value);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '🗑️';
      deleteBtn.title = 'Delete marker';
      
      deleteBtn.addEventListener('click', () => {
        this.stateManager.removeCustomMarker(marker.id);
      });

      item.appendChild(input);
      item.appendChild(deleteBtn);
      container.appendChild(item);
    }
  }

  public updateCoordinatesDisplay(worldX: number, worldZ: number): void {
    const display = document.getElementById('coordinates-display');
    if (display) {
      display.textContent = `World: ${worldX.toFixed(1)}, ${worldZ.toFixed(1)}`;
    }
  }

  public setOnMarkerClick(callback: (worldX: number, worldZ: number) => void): void {
    this.onMarkerClick = callback;
  }

  public handleCanvasClick(worldX: number, worldZ: number): void {
    if (this.onMarkerClick) {
      this.onMarkerClick(worldX, worldZ);
    }
  }
}
