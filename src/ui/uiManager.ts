// UI management for sidebar and controls

import { LoadedResources, OpenedPopup, Resource } from "../types";
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
  extractResourceType,
  getResourceColor,
} from "../resourceManager";
import {
  formatResourceTitle,
  formatCoordinates,
  formatGuidHtml,
  formatPathHtml,
  formatClassnameHtml,
  formatDropHtml,
  formatLootSpawnInfoHtml,
  formatSpawnConditionsHtml,
} from "./formatters";

export class UIManager {
  private stateManager: StateManager;
  private sidebar: HTMLElement | null = null;
  private toggleBtn: HTMLElement | null = null;
  private preventAutoClose: boolean = false;
  private onPopupChange: ((popup: OpenedPopup | null) => void) | null = null;
  private loadedResources: LoadedResources | null = null;
  private isSearchMode: boolean = false;
  private sidebarOriginalContent: string = "";
  private previousVisibleResources: Set<string> = new Set();
  private searchQuery: string = "";
  private searchFilteredResourceIds: Set<string> = new Set();
  private isRegexMode: boolean = false;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.sidebar = document.getElementById("sidebar");
    this.toggleBtn = document.getElementById("toggle-sidebar");
    this.setupMapFilters();
    this.setupResourceDetailsUI();
    this.setupFeatureSelectionHandlers();
    this.setupSearchButton();
  }

  public setupEventListeners(loadedResources: LoadedResources): void {
    // Store loaded resources for search functionality
    this.loadedResources = loadedResources;

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

        // Deselect any selected object when closing sidebar on mobile
        const detailsSection = document.getElementById("resource-details-section");
        if (detailsSection && detailsSection.style.display !== "none") {
          const event = new CustomEvent("closeResourceDetails");
          window.dispatchEvent(event);
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

    // Expert mode checkbox
    const expertModeCheckbox = document.getElementById(
      "expert-mode",
    ) as HTMLInputElement;
    if (expertModeCheckbox) {
      // Set initial state
      expertModeCheckbox.checked =
        this.stateManager.getState().expertMode;

      // Handle changes
      expertModeCheckbox.addEventListener("change", () => {
        this.stateManager.setExpertMode(expertModeCheckbox.checked);
      });
    }

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

    this.stateManager.subscribe((state) => {
      this.renderResourceFilters(loadedResources);
      this.updateMapFilterButtons();

      // Update expert mode checkbox
      const expertModeCheckbox = document.getElementById(
        "expert-mode",
      ) as HTMLInputElement;
      if (expertModeCheckbox) {
        expertModeCheckbox.checked = state.expertMode;
      }
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
    // Use event delegation on the sidebar to handle close button clicks
    // This ensures it works even after the sidebar HTML is recreated
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) {
      console.warn("Sidebar element not found");
      return;
    }

    // Handle close button click using event delegation
    sidebar.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.id === "close-resource-details") {
        const detailsSection = document.getElementById("resource-details-section");
        const detailsContent = document.getElementById("resource-details-content");

        if (detailsSection && detailsContent) {
          detailsSection.style.display = "none";
          detailsContent.innerHTML = "";
        }

        // Dispatch event for map renderer to clear selection
        const event = new CustomEvent("closeResourceDetails");
        window.dispatchEvent(event);

        // Notify state manager
        if (this.onPopupChange) {
          this.onPopupChange(null);
        }
      }
    });
  }

  private setupFeatureSelectionHandlers(): void {
    // Handle feature selection from map
    window.addEventListener("featureSelected", ((event: CustomEvent) => {
      const featureData = event.detail;

      // If in search mode, we need to update the search UI to include the resource details
      if (this.isSearchMode) {
        this.showResourceDetailsInSearchMode(featureData);
      } else {
        // Look up elements dynamically each time to handle DOM recreation after search mode
        const detailsSection = document.getElementById("resource-details-section");
        const detailsContent = document.getElementById("resource-details-content");

        if (!detailsSection || !detailsContent) {
          console.warn("Resource details elements not found");
          return;
        }

        // Build popup HTML
        const popupHtml = this.buildResourceDetailsHTML(featureData);
        detailsContent.innerHTML = popupHtml;
        detailsSection.style.display = "block";

        // Ensure sidebar is open when selecting a resource
        this.ensureSidebarOpen();

        // Scroll the section into view with padding
        this.scrollToResourceDetails(detailsSection);
      }

      // Notify state manager
      if (this.onPopupChange) {
        this.onPopupChange({
          id: featureData.id,
        });
      }
    }) as EventListener);

    // Handle feature deselection
    window.addEventListener("featureDeselected", () => {
      if (!this.isSearchMode) {
        // Look up elements dynamically each time to handle DOM recreation after search mode
        const detailsSection = document.getElementById("resource-details-section");
        const detailsContent = document.getElementById("resource-details-content");

        if (detailsSection && detailsContent) {
          detailsSection.style.display = "none";
          detailsContent.innerHTML = "";
        }
      }

      // Notify state manager
      if (this.onPopupChange) {
        this.onPopupChange(null);
      }
    });
  }

  private scrollToResourceDetails(_detailsSection?: HTMLElement): void {
    // Use setTimeout to ensure sidebar animation and rendering complete first
    setTimeout(() => {
      const sidebarContent = document.querySelector('.sidebar-content');
      if (sidebarContent) {
        // Scroll to top to show the resource details section
        sidebarContent.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 100);
  }

  private showResourceDetailsInSearchMode(featureData: any): void {
    const sidebarContent = document.querySelector(".sidebar-content");
    if (!sidebarContent) return;

    // Build resource details HTML
    const popupHtml = this.buildResourceDetailsHTML(featureData);

    // Create search UI with resource details at the top
    const searchHTML = `
      <section class="filter-section" id="resource-details-section-search">
        <div class="resource-details-header">
          <h2>Selected Resource</h2>
          <button id="close-resource-details-search" class="btn-close-details" aria-label="Close details">×</button>
        </div>
        <div id="resource-details-content-search">${popupHtml}</div>
      </section>
      <div class="search-container">
        <div class="search-header">
          <h2>Search</h2>
          <button id="close-search" class="btn-close-search" aria-label="Close search">×</button>
        </div>
        <div class="search-field-container">
          <input
            type="text"
            id="search-field"
            class="search-field"
            placeholder="Search by object name..."
            autocomplete="off"
            value="${this.searchQuery}"
          />
          <button id="regex-toggle" class="btn-regex-toggle ${this.isRegexMode ? 'active' : ''}" title="Toggle regex search">.*</button>
        </div>
        <div id="search-results" class="search-results"></div>
      </div>
    `;

    sidebarContent.innerHTML = searchHTML;

    // Setup event listeners
    const searchField = document.getElementById("search-field") as HTMLInputElement;
    const closeSearchBtn = document.getElementById("close-search");
    const closeDetailsBtn = document.getElementById("close-resource-details-search");
    const regexToggle = document.getElementById("regex-toggle");
    const searchResults = document.getElementById("search-results");

    if (searchField && searchResults) {
      // Perform search with current query
      if (this.searchQuery) {
        this.performSearch(this.searchQuery, searchResults);
      }

      // Handle search input
      searchField.addEventListener("input", (e) => {
        const query = (e.target as HTMLInputElement).value.trim();
        this.searchQuery = query;
        this.performSearch(query, searchResults);
      });
    }

    if (regexToggle) {
      regexToggle.addEventListener("click", () => {
        this.isRegexMode = !this.isRegexMode;
        regexToggle.classList.toggle("active", this.isRegexMode);

        // Re-run search with new mode
        if (searchResults) {
          this.performSearch(this.searchQuery, searchResults);
        }
      });
    }

    if (closeSearchBtn) {
      closeSearchBtn.addEventListener("click", () => {
        this.hideSearchUI();
      });
    }

    if (closeDetailsBtn) {
      closeDetailsBtn.addEventListener("click", () => {
        // Clear the selected feature
        const event = new CustomEvent("closeResourceDetails");
        window.dispatchEvent(event);

        // Re-render search UI without details
        this.showSearchUI();
      });
    }

    // Scroll to top to show resource details
    this.scrollToResourceDetails(document.getElementById("resource-details-section-search")!);
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
  // Search Functionality
  // ============================================================================

  private setupSearchButton(): void {
    const searchBtn = document.getElementById("search-btn");
    if (!searchBtn) return;

    searchBtn.addEventListener("click", () => {
      this.showSearchUI();
    });
  }

  private showSearchUI(): void {
    const sidebarContent = document.querySelector(".sidebar-content");
    if (!sidebarContent) return;

    // Save original content and state if not already in search mode
    if (!this.isSearchMode) {
      this.sidebarOriginalContent = sidebarContent.innerHTML;
      // Store current visible resources
      this.previousVisibleResources = new Set(this.stateManager.getState().visibleResources);

      // Enable all resource types so search can find items from any type
      if (this.loadedResources) {
        const allTypes = new Set(this.loadedResources.resourceTypes.keys());
        this.stateManager.setVisibleResources(allTypes);
      }
    }

    this.isSearchMode = true;

    // Create search UI
    const searchHTML = `
      <div class="search-container">
        <div class="search-header">
          <h2>Search</h2>
          <button id="close-search" class="btn-close-search" aria-label="Close search">×</button>
        </div>
        <div class="search-field-container">
          <input
            type="text"
            id="search-field"
            class="search-field"
            placeholder="Search by object name..."
            autocomplete="off"
            value="${this.searchQuery}"
          />
          <button id="regex-toggle" class="btn-regex-toggle ${this.isRegexMode ? 'active' : ''}" title="Toggle regex search">.*</button>
        </div>
        <div id="search-results" class="search-results"></div>
      </div>
    `;

    sidebarContent.innerHTML = searchHTML;

    // Ensure sidebar is open
    this.ensureSidebarOpen();

    // Setup search event listeners
    const searchField = document.getElementById("search-field") as HTMLInputElement;
    const closeBtn = document.getElementById("close-search");
    const regexToggle = document.getElementById("regex-toggle");
    const searchResults = document.getElementById("search-results");

    if (searchField && searchResults) {
      // Focus on search field
      setTimeout(() => searchField.focus(), 100);

      // Perform initial search if there's a query
      if (this.searchQuery) {
        this.performSearch(this.searchQuery, searchResults);
      }

      // Handle search input
      searchField.addEventListener("input", (e) => {
        const query = (e.target as HTMLInputElement).value.trim();
        this.searchQuery = query;
        this.performSearch(query, searchResults);
      });
    }

    if (regexToggle) {
      regexToggle.addEventListener("click", () => {
        this.isRegexMode = !this.isRegexMode;
        regexToggle.classList.toggle("active", this.isRegexMode);

        // Re-run search with new mode
        if (searchResults) {
          this.performSearch(this.searchQuery, searchResults);
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.hideSearchUI();
      });
    }
  }

  private hideSearchUI(): void {
    const sidebarContent = document.querySelector(".sidebar-content");
    if (!sidebarContent || !this.isSearchMode) return;

    // Restore original content
    sidebarContent.innerHTML = this.sidebarOriginalContent;
    this.isSearchMode = false;
    this.searchQuery = "";
    this.isRegexMode = false;

    // Clear search filter
    this.searchFilteredResourceIds.clear();

    // Restore previous visible resources
    this.stateManager.setVisibleResources(this.previousVisibleResources);

    // Dispatch event to clear search filter
    const event = new CustomEvent("searchFilterResources", {
      detail: { resourceIds: null },
    });
    window.dispatchEvent(event);

    // Re-render the entire UI to restore all event listeners
    if (this.loadedResources) {
      this.renderResourceFilters(this.loadedResources);
      this.setupEventListeners(this.loadedResources);
      // Re-attach search and map filter button listeners
      this.reattachButtonListeners();
    }
  }

  private reattachButtonListeners(): void {
    // Re-attach search button listener
    const searchBtn = document.getElementById("search-btn");
    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        this.showSearchUI();
      });
    }

    // Re-attach map filter button listeners
    const buttons = document.querySelectorAll(".btn-map-filter");
    buttons.forEach((button) => {
      const filterId = button.id.replace("filter-", "");
      button.addEventListener("click", () => {
        this.stateManager.setMapFilter(filterId);
      });
    });
  }

  private performSearch(query: string, resultsContainer: HTMLElement): void {
    // Clear previous results
    resultsContainer.innerHTML = "";

    // Only search if query has at least 3 characters (or 1+ for regex)
    const minLength = this.isRegexMode ? 1 : 3;
    if (query.length < minLength) {
      resultsContainer.innerHTML = `
        <div class="search-no-results">
          Enter at least ${minLength} character${minLength > 1 ? 's' : ''} to search
        </div>
      `;
      // Clear search filter
      this.searchFilteredResourceIds.clear();
      this.applySearchFilter();
      return;
    }

    if (!this.loadedResources) return;

    let matchingResources: Resource[] = [];

    if (this.isRegexMode) {
      // Regex mode - try to use query as regex pattern
      try {
        const regex = new RegExp(query, 'i'); // Case-insensitive by default
        matchingResources = this.loadedResources.resources.filter((resource) => {
          return resource.name && regex.test(resource.name);
        });
      } catch (error) {
        // Invalid regex pattern
        resultsContainer.innerHTML = `
          <div class="search-no-results">
            Invalid regex pattern: ${(error as Error).message}
          </div>
        `;
        this.searchFilteredResourceIds.clear();
        this.applySearchFilter();
        return;
      }
    } else {
      // Normal mode - simple text search (case-insensitive)
      const queryLower = query.toLowerCase();
      matchingResources = this.loadedResources.resources.filter((resource) => {
        return resource.name && resource.name.toLowerCase().includes(queryLower);
      });
    }

    // Deduplicate results by ID (spawners with multiple tags create multiple entries)
    const seenIds = new Set<string>();
    const uniqueResources: Resource[] = [];
    for (const resource of matchingResources) {
      if (!seenIds.has(resource.id)) {
        seenIds.add(resource.id);
        uniqueResources.push(resource);
      }
    }

    // Display results
    if (uniqueResources.length === 0) {
      resultsContainer.innerHTML = `
        <div class="search-no-results">
          No results found for "${query}"
        </div>
      `;
      // Clear search filter to show nothing
      this.searchFilteredResourceIds.clear();
      this.applySearchFilter();
      return;
    }

    // Sort results by name
    uniqueResources.sort((a, b) => a.name.localeCompare(b.name));

    // Store matching resource IDs
    this.searchFilteredResourceIds.clear();
    uniqueResources.forEach((resource) => {
      this.searchFilteredResourceIds.add(resource.id);
    });

    // Apply search filter to show only matching items
    this.applySearchFilter();

    // Render results
    uniqueResources.forEach((resource) => {
      const resultItem = this.createSearchResultItem(resource, query);
      resultsContainer.appendChild(resultItem);
    });
  }

  private applySearchFilter(): void {
    // Dispatch event to filter map by specific resource IDs
    const event = new CustomEvent("searchFilterResources", {
      detail: { resourceIds: this.searchFilteredResourceIds },
    });
    window.dispatchEvent(event);
  }

  private createSearchResultItem(resource: Resource, query: string): HTMLElement {
    const item = document.createElement("div");
    item.className = "search-result-item";

    // Get resource color
    const resourceType = extractResourceType(resource);
    const color = isValidResourceType(resourceType)
      ? getResourceColor(resourceType)
      : "#FF00FF";

    // Highlight matching text
    const highlightedName = this.highlightMatch(resource.name, query);

    // Get display name for type
    const typeDisplayName = isValidResourceType(resourceType)
      ? getResourceDisplayName(resourceType)
      : resourceType;

    item.innerHTML = `
      <span class="search-result-icon" style="background-color: ${color}"></span>
      <div class="search-result-content">
        <div class="search-result-name">${highlightedName}</div>
        <div class="search-result-type">${typeDisplayName}</div>
      </div>
    `;

    // Handle click to focus on map
    item.addEventListener("click", () => {
      this.focusOnResource(resource);
    });

    return item;
  }

  private highlightMatch(text: string, query: string): string {
    if (!text) return "";

    const regex = new RegExp(`(${this.escapeRegex(query)})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private focusOnResource(resource: Resource): void {
    // Dispatch event to pan and zoom to the resource location
    const panEvent = new CustomEvent("panToResource", {
      detail: {
        worldX: resource.worldX,
        worldZ: resource.worldZ,
        region: resource.region,
      },
    });
    window.dispatchEvent(panEvent);

    // Dispatch event to select the feature on the map
    const selectEvent = new CustomEvent("selectFeatureByCoords", {
      detail: { id: resource.id },
    });
    window.dispatchEvent(selectEvent);
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
      id,
      path,
      classname,
      drop,
      lootSpawnInfo,
      spawnConditions,
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
      ${formatGuidHtml("popup", id)}
      ${formatPathHtml("popup", path)}
      ${formatClassnameHtml("popup", classname)}
      ${formatDropHtml("popup", drop)}
      ${formatLootSpawnInfoHtml("popup", lootSpawnInfo)}
      ${formatSpawnConditionsHtml("popup", spawnConditions)}
    `;
  }
}
