// State management with localStorage persistence

import { AppState, ViewportState, OpenedPopup } from "./types";

export class StateManager {
  private readonly STORAGE_KEY = "nrftw_map_state";
  private state: AppState;
  private listeners: Set<(state: AppState) => void> = new Set();
  private urlParams: { viewport?: ViewportState; openedPopup?: OpenedPopup } =
    {};

  constructor() {
    this.state = this.loadInitialState();
  }

  private loadInitialState(): AppState {
    // Read URL parameters for viewport and openedPopup only
    this.urlParams = this.loadFromURL();

    // Load main state from localStorage or defaults
    const storageState = this.loadFromLocalStorage();
    const baseState = storageState || this.getDefaultState();

    // Override viewport and openedPopup from URL if available
    if (this.urlParams.viewport) {
      baseState.viewport = this.urlParams.viewport;
    }
    if (this.urlParams.openedPopup) {
      baseState.openedPopup = this.urlParams.openedPopup;
    }

    return baseState;
  }

  public getUrlParams(): {
    viewport?: ViewportState;
    openedPopup?: OpenedPopup;
  } {
    return this.urlParams;
  }

  private getDefaultState(): AppState {
    return {
      viewport: {
        x: 6144,
        y: 6144,
        scale: 0.1,
      },
      visibleResources: new Set(["iron", "copper", "silver"]),
      openedPopup: null,
      expandedGroups: new Set(["ore"]),
      mapFilter: "none",
    };
  }

  private loadFromURL(): {
    viewport?: ViewportState;
    openedPopup?: OpenedPopup;
  } {
    try {
      const params = new URLSearchParams(window.location.search);
      const result: { viewport?: ViewportState; openedPopup?: OpenedPopup } =
        {};

      // Read viewport parameters
      if (params.has("x") && params.has("y") && params.has("scale")) {
        const x = parseFloat(params.get("x")!);
        const y = parseFloat(params.get("y")!);
        const scale = parseFloat(params.get("scale")!);

        if (!isNaN(x) && !isNaN(y) && !isNaN(scale)) {
          result.viewport = { x, y, scale };
        }
      }

      // Read openedPopup parameters
      if (
        params.has("idA") &&
        params.has("idB") &&
        params.has("idC") &&
        params.has("idD")
      ) {
        const idA = parseInt(params.get("idA")!);
        const idB = parseInt(params.get("idB")!);
        const idC = parseInt(params.get("idC")!);
        const idD = parseInt(params.get("idD")!);

        if (!isNaN(idA) && !isNaN(idB) && !isNaN(idC) && !isNaN(idD)) {
          result.openedPopup = { idA, idB, idC, idD };
        }
      }

      return result;
    } catch (e) {
      console.error("Failed to load parameters from URL:", e);
      return {};
    }
  }

  private loadFromLocalStorage(): AppState | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const data = JSON.parse(stored);

      return {
        viewport: data.viewport || this.getDefaultState().viewport,
        visibleResources: new Set(data.visibleResources || []),
        openedPopup: data.openedPopup || null,
        expandedGroups: new Set(data.expandedGroups || []),
        mapFilter: data.mapFilter || "none",
      };
    } catch (e) {
      console.error("Failed to load state from localStorage:", e);
      return null;
    }
  }

  public getState(): AppState {
    return this.state;
  }

  public updateViewport(viewport: ViewportState): void {
    if (JSON.stringify(this.state.viewport) != JSON.stringify(viewport)) {
      this.state.viewport = viewport;
      this.saveToLocalStorage();
      this.notifyListeners();
    }
  }

  public toggleResourceType(resourceType: string): void {
    if (this.state.visibleResources.has(resourceType)) {
      this.state.visibleResources.delete(resourceType);
    } else {
      this.state.visibleResources.add(resourceType);
    }
    this.saveToLocalStorage();
    this.notifyListeners();
  }

  public setVisibleResources(types: Set<string>): void {
    this.state.visibleResources = types;
    this.saveToLocalStorage();
    this.notifyListeners();
  }

  public setOpenedPopup(popup: OpenedPopup | null): void {
    this.state.openedPopup = popup;
    this.saveToLocalStorage();
    this.notifyListeners();
  }

  public toggleGroupExpansion(groupName: string): void {
    if (this.state.expandedGroups.has(groupName)) {
      this.state.expandedGroups.delete(groupName);
    } else {
      this.state.expandedGroups.add(groupName);
    }
    this.saveToLocalStorage();
    this.notifyListeners();
  }

  public setMapFilter(filter: string): void {
    this.state.mapFilter = filter;
    this.saveToLocalStorage();
    this.notifyListeners();
  }

  public getShareableURL(): string {
    const url = new URL(window.location.origin + window.location.pathname);

    // Add viewport parameters
    url.searchParams.set("x", this.state.viewport.x.toFixed(1).toString());
    url.searchParams.set("y", this.state.viewport.y.toFixed(1).toString());
    url.searchParams.set(
      "scale",
      this.state.viewport.scale.toFixed(1).toString(),
    );

    // Add openedPopup parameters if there's an opened popup
    if (this.state.openedPopup) {
      url.searchParams.set("idA", this.state.openedPopup.idA.toString());
      url.searchParams.set("idB", this.state.openedPopup.idB.toString());
      url.searchParams.set("idC", this.state.openedPopup.idC.toString());
      url.searchParams.set("idD", this.state.openedPopup.idD.toString());
    }

    return url.toString();
  }

  private saveToLocalStorage(): void {
    try {
      const data = {
        viewport: this.state.viewport,
        visibleResources: Array.from(this.state.visibleResources),
        openedPopup: this.state.openedPopup,
        expandedGroups: Array.from(this.state.expandedGroups),
        mapFilter: this.state.mapFilter,
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save state to localStorage:", e);
    }
  }

  public subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }
}
