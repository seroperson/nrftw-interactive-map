// UI management for sidebar and controls

import { LoadedResources, OpenedPopup } from "../types";
import { StateManager } from "../stateManager";
import {
  SIDEBAR_ANIMATION_DURATION,
  COPY_FEEDBACK_DURATION,
} from "../utils/constants";
import {
  getResourceDisplayName,
  getGroupDisplayName,
  isValidResourceType,
  isMainGroup,
  getGroupSortingOrder,
} from "../resourceManager";
import {
  formatResourceTitle,
  formatCoordinates,
  formatGuidHtml,
  formatPathHtml,
  formatDropHtml,
  formatLootSpawnInfoHtml,
} from "./formatters";

export class UIManager {
  private stateManager: StateManager;
  private sidebar: HTMLElement | null = null;
  private toggleBtn: HTMLElement | null = null;
  private preventAutoClose: boolean = false;
  private onPopupChange: ((popup: OpenedPopup | null) => void) | null = null;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.sidebar = document.getElementById("sidebar");
    this.toggleBtn = document.getElementById("toggle-sidebar");
    this.setupMapFilters();
    this.setupResourceDetailsUI();
    this.setupFeatureSelectionHandlers();
  }

  public setupEventListeners(loadedResources: LoadedResources): void {
    // Toggle sidebar
    const toggleBtn = document.getElementById("toggle-sidebar");
    const sidebar = document.getElementById("sidebar");

    toggleBtn?.addEventListener("click", (e) => {
      e.stopPropagation();

      // Clear prevent flag when manually toggling
      this.preventAutoClose = false;

      const isCollapsed = sidebar?.classList.toggle("collapsed");

      // Update button icon and class based on state
      if (toggleBtn) {
        toggleBtn.textContent = isCollapsed ? "▶" : "◀";
        toggleBtn.setAttribute(
          "aria-label",
          isCollapsed ? "Show sidebar" : "Hide sidebar",
        );
        toggleBtn.classList.toggle("sidebar-collapsed", isCollapsed);
      }

      // Trigger map resize after sidebar animation completes
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, SIDEBAR_ANIMATION_DURATION);
    });

    // Close sidebar when clicking on map (on smaller screens)
    const mapContainer = document.getElementById("map-container");
    mapContainer?.addEventListener("click", () => {
      if (!sidebar) return;

      // Don't auto-close if we just opened it programmatically
      if (this.preventAutoClose) {
        return;
      }

      // Check if sidebar is wide enough and screen is not so wide
      const sidebarWidth = 340; // var(--sidebar-width)
      const isSidebarWide = sidebarWidth >= 300;
      const isScreenNarrow = window.innerWidth <= 1024;

      // Close sidebar if it's open, wide enough, and screen is narrow
      if (
        !sidebar.classList.contains("collapsed") &&
        isSidebarWide &&
        isScreenNarrow
      ) {
        sidebar.classList.add("collapsed");

        // Update toggle button
        const toggleBtn = document.getElementById("toggle-sidebar");
        if (toggleBtn) {
          toggleBtn.textContent = "▶";
          toggleBtn.setAttribute("aria-label", "Show sidebar");
          toggleBtn.classList.add("sidebar-collapsed");
        }

        // Trigger map resize after sidebar animation completes
        setTimeout(() => {
          window.dispatchEvent(new Event("resize"));
        }, 400);
      }
    });

    // Check/Uncheck all filters
    const checkAllBtn = document.getElementById("check-all");
    const uncheckAllBtn = document.getElementById("uncheck-all");

    checkAllBtn?.addEventListener("click", () => {
      const allTypes = new Set(loadedResources.resourceTypes.keys());
      this.stateManager.setVisibleResources(allTypes);
      this.renderResourceFilters(loadedResources);
    });

    uncheckAllBtn?.addEventListener("click", () => {
      this.stateManager.setVisibleResources(new Set());
      this.renderResourceFilters(loadedResources);
    });

    // Copy URL
    const copyBtn = document.getElementById("copy-url");
    const feedback = document.getElementById("copy-feedback");

    copyBtn?.addEventListener("click", async () => {
      const url = this.stateManager.getShareableURL();

      try {
        await navigator.clipboard.writeText(url);
        feedback?.classList.remove("hidden");
        setTimeout(
          () => feedback?.classList.add("hidden"),
          COPY_FEEDBACK_DURATION,
        );
      } catch (e) {
        console.error("Failed to copy URL:", e);
      }
    });

    this.stateManager.subscribe(() => {
      this.renderResourceFilters(loadedResources);
      this.updateMapFilterButtons();
    });
  }

  private setupMapFilters(): void {
    const container = document.getElementById("map-filter-buttons");
    if (!container) return;

    const filters = [
      { id: "none", icon: "🌈", label: "Normal" },
      { id: "grayscale", icon: "⚫", label: "B&W" },
      { id: "sepia", icon: "🟤", label: "Sepia" },
      { id: "contrast", icon: "🎱", label: "High Contrast" },
      { id: "brightness", icon: "☀️", label: "Bright" },
      { id: "dark", icon: "🌙", label: "Dark" },
    ];

    filters.forEach((filter) => {
      const button = document.createElement("button");
      button.className = "btn-map-filter";
      button.id = `filter-${filter.id}`;
      button.innerHTML = `
        <span class="map-filter-icon">${filter.icon}</span>
        <span>${filter.label}</span>
      `;

      button.addEventListener("click", () => {
        this.stateManager.setMapFilter(filter.id);
      });

      container.appendChild(button);
    });

    this.updateMapFilterButtons();
  }

  private updateMapFilterButtons(): void {
    const state = this.stateManager.getState();
    const buttons = document.querySelectorAll(".btn-map-filter");

    buttons.forEach((button) => {
      const filterId = button.id.replace("filter-", "");
      if (filterId === state.mapFilter) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });
  }

  public renderResourceFilters(loadedResources: LoadedResources): void {
    const container = document.getElementById("resource-filters");
    if (!container) return;

    container.innerHTML = "";
    const state = this.stateManager.getState();

    // Sort groups by sortingOrder before rendering
    const sortedGroups = Array.from(loadedResources.resourceGroups.entries()).sort(
      ([groupNameA], [groupNameB]) => {
        return getGroupSortingOrder(groupNameA) - getGroupSortingOrder(groupNameB);
      }
    );

    // Render groups
    for (const [groupName, group] of sortedGroups) {
      const groupElement = document.createElement("div");
      groupElement.className = "filter-group-container";

      // Group header
      const groupHeader = document.createElement("div");
      groupHeader.className = "filter-group-header";

      const groupCheckbox = document.createElement("input");
      groupCheckbox.type = "checkbox";
      groupCheckbox.id = `group-${groupName}`;

      // Check if all types in group are visible
      const allVisible = group.types.every((type) =>
        state.visibleResources.has(type),
      );
      const someVisible = group.types.some((type) =>
        state.visibleResources.has(type),
      );
      groupCheckbox.checked = allVisible;
      groupCheckbox.indeterminate = !allVisible && someVisible;

      groupCheckbox.addEventListener("change", () => {
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
        this.renderResourceFilters(loadedResources);
      });

      const groupLabel = document.createElement("div");
      groupLabel.className = "filter-group-label";

      // Create stacked color circles for the group
      const groupColors = document.createElement("div");
      groupColors.className = "group-colors";

      const maxCirclesToShow = 5;
      let circleCount = 0;

      for (const typeName of group.types) {
        const type = loadedResources.resourceTypes.get(typeName);
        if (type && type.count > 0) {
          if (circleCount < maxCirclesToShow) {
            const colorCircle = document.createElement("span");
            colorCircle.className = "group-color-circle";
            colorCircle.style.backgroundColor = type.color;
            colorCircle.title = type.name; // Tooltip showing resource type name
            groupColors.appendChild(colorCircle);
            circleCount++;
          }
        }
      }

      // Show overflow indicator if there are more types
      const totalTypes = group.types.filter((t) => {
        const type = loadedResources.resourceTypes.get(t);
        return type && type.count > 0;
      }).length;

      if (totalTypes > maxCirclesToShow) {
        const overflow = document.createElement("span");
        overflow.className = "group-color-overflow";
        overflow.textContent = `+${totalTypes - maxCirclesToShow}`;
        overflow.title = `${totalTypes - maxCirclesToShow} more types`;
        groupColors.appendChild(overflow);
      }

      const groupNameSpan = document.createElement("span");
      groupNameSpan.textContent = isMainGroup(groupName)
        ? getGroupDisplayName(groupName)
        : groupName.charAt(0).toUpperCase() + groupName.slice(1);

      // Calculate total count for group
      const totalCount = group.types.reduce((sum, type) => {
        const resourceType = loadedResources.resourceTypes.get(type);
        return sum + (resourceType?.count || 0);
      }, 0);

      const groupCountSpan = document.createElement("span");
      groupCountSpan.className = "resource-count";
      groupCountSpan.textContent = `(${totalCount})`;

      groupLabel.appendChild(groupColors);
      groupLabel.appendChild(groupNameSpan);
      groupLabel.appendChild(groupCountSpan);

      groupHeader.appendChild(groupCheckbox);
      groupHeader.appendChild(groupLabel);

      // Make label clickable to toggle expansion or checkbox
      groupHeader.addEventListener("click", (e) => {
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
          this.renderResourceFilters(loadedResources);
          return;
        }
        this.stateManager.toggleGroupExpansion(groupName);
      });

      // Prevent checkbox clicks from bubbling to prevent expansion
      groupCheckbox.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      groupElement.appendChild(groupHeader);

      // Group items (types) - show only if expanded AND group has multiple types
      if (state.expandedGroups.has(groupName) && group.types.length > 1) {
        const groupItems = document.createElement("div");
        groupItems.className = "filter-group-items";

        for (const typeName of group.types) {
          const type = loadedResources.resourceTypes.get(typeName);
          if (!type || type.count === 0) continue;

          const item = document.createElement("label");
          item.className = "filter-item";
          item.htmlFor = `filter-${type.name}`;

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.id = `filter-${type.name}`;
          checkbox.checked = state.visibleResources.has(type.name);

          checkbox.addEventListener("change", () => {
            this.stateManager.toggleResourceType(type.name);

            // After toggling, check if we need to update parent group checkbox
            // This will trigger a re-render which will update the parent state
            this.renderResourceFilters(loadedResources);
          });

          const label = document.createElement("label");
          label.htmlFor = `filter-${type.name}`;

          const colorBox = document.createElement("span");
          colorBox.className = "resource-color";
          colorBox.style.backgroundColor = type.color;

          const nameSpan = document.createElement("span");
          nameSpan.textContent = isValidResourceType(type.name)
            ? getResourceDisplayName(type.name)
            : type.name.charAt(0).toUpperCase() + type.name.slice(1);

          const countSpan = document.createElement("span");
          countSpan.className = "resource-count";
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

  private setupResourceDetailsUI(): void {
    const detailsSection = document.getElementById("resource-details-section");
    const detailsContent = document.getElementById("resource-details-content");
    const closeButton = document.getElementById("close-resource-details");

    if (!detailsSection || !detailsContent || !closeButton) {
      console.warn("Resource details elements not found");
      return;
    }

    // Handle close button click
    closeButton.addEventListener("click", () => {
      detailsSection.style.display = "none";
      detailsContent.innerHTML = "";

      // Dispatch event for map renderer to clear selection
      const event = new CustomEvent("closeResourceDetails");
      window.dispatchEvent(event);

      // Notify state manager
      if (this.onPopupChange) {
        this.onPopupChange(null);
      }
    });
  }

  private setupFeatureSelectionHandlers(): void {
    const detailsSection = document.getElementById("resource-details-section");
    const detailsContent = document.getElementById("resource-details-content");

    if (!detailsSection || !detailsContent) {
      console.warn("Resource details elements not found");
      return;
    }

    // Handle feature selection from map
    window.addEventListener("featureSelected", ((event: CustomEvent) => {
      const featureData = event.detail;

      // Build popup HTML
      const popupHtml = this.buildResourceDetailsHTML(featureData);
      detailsContent.innerHTML = popupHtml;
      detailsSection.style.display = "block";

      // Ensure sidebar is open when selecting a resource
      this.ensureSidebarOpen();

      // Scroll the section into view with padding
      // Use setTimeout to ensure sidebar animation completes first
      setTimeout(() => {
        const sidebarContent = document.querySelector('.sidebar-content');
        if (sidebarContent) {
          const sectionRect = detailsSection.getBoundingClientRect();
          const containerRect = sidebarContent.getBoundingClientRect();
          const padding = 16; // Respect padding

          // Check if element is not fully visible
          if (sectionRect.top < containerRect.top + padding ||
              sectionRect.bottom > containerRect.bottom - padding) {
            // Calculate scroll position with padding
            const scrollTop = sidebarContent.scrollTop +
                            (sectionRect.top - containerRect.top) - padding;
            sidebarContent.scrollTo({ top: scrollTop, behavior: "smooth" });
          }
        }
      }, 100);

      // Notify state manager
      if (this.onPopupChange) {
        this.onPopupChange({
          idA: featureData.idA,
          idB: featureData.idB,
          idC: featureData.idC,
          idD: featureData.idD,
        });
      }
    }) as EventListener);

    // Handle feature deselection
    window.addEventListener("featureDeselected", () => {
      detailsSection.style.display = "none";
      detailsContent.innerHTML = "";

      // Notify state manager
      if (this.onPopupChange) {
        this.onPopupChange(null);
      }
    });
  }

  public ensureSidebarOpen(): void {
    if (!this.sidebar || !this.toggleBtn) return;

    // Check if sidebar is collapsed
    if (this.sidebar.classList.contains("collapsed")) {
      // Set flag to prevent auto-close
      this.preventAutoClose = true;

      // Open the sidebar
      this.sidebar.classList.remove("collapsed");
      this.toggleBtn.textContent = "◀";
      this.toggleBtn.setAttribute("aria-label", "Hide sidebar");
      this.toggleBtn.classList.remove("sidebar-collapsed");

      // Trigger map resize after sidebar animation completes
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, SIDEBAR_ANIMATION_DURATION);

      // Clear the flag after animation completes + small buffer
      setTimeout(() => {
        this.preventAutoClose = false;
      }, SIDEBAR_ANIMATION_DURATION + 100);
    } else {
      // Sidebar already open, but still set flag briefly to prevent immediate close
      this.preventAutoClose = true;
      setTimeout(() => {
        this.preventAutoClose = false;
      }, 100);
    }
  }

  /**
   * Display an error message to the user
   */
  public showError(message: string): void {
    const container = document.getElementById("map-container");
    if (container) {
      const errorDiv = document.createElement("div");
      errorDiv.className = "error-message";
      errorDiv.textContent = message;
      container.appendChild(errorDiv);
    }
  }

  /**
   * Set popup state change callback
   */
  public onPopupStateChange(
    callback: (popup: OpenedPopup | null) => void,
  ): void {
    this.onPopupChange = callback;
  }

  /**
   * Open resource details for a specific popup state
   */
  public setOpenedPopup(popup: OpenedPopup | null): void {
    if (!popup) {
      const detailsSection = document.getElementById(
        "resource-details-section",
      );
      const detailsContent = document.getElementById(
        "resource-details-content",
      );

      if (detailsSection && detailsContent) {
        detailsSection.style.display = "none";
        detailsContent.innerHTML = "";
      }
      return;
    }

    // Dispatch event for map to select the feature
    const event = new CustomEvent("selectFeatureByCoords", {
      detail: popup,
    });
    window.dispatchEvent(event);
  }

  // ============================================================================
  // Resource Details HTML Formatting
  // ============================================================================

  private buildResourceDetailsHTML(featureData: any): string {
    const {
      type,
      subtype,
      name,
      color,
      worldX,
      worldY,
      worldZ,
      idA,
      idB,
      idC,
      idD,
      path,
      drop,
      lootSpawnInfo,
    } = featureData;

    const popupTitle = formatResourceTitle(type, subtype);

    return `
      <div class="popup-header">
        <span class="popup-icon" style="background-color: ${color}"></span>
        <div class="popup-title-group">
          <span class="popup-title">${popupTitle}</span>
          ${name ? `<span class="popup-subtitle">${name}</span>` : ""}
        </div>
      </div>
      ${formatCoordinates("popup", worldX, worldY, worldZ)}
      ${formatGuidHtml("popup", idA, idB, idC, idD)}
      ${formatPathHtml("popup", path)}
      ${formatDropHtml("popup", drop)}
      ${formatLootSpawnInfoHtml("popup", lootSpawnInfo)}
    `;
  }
}
