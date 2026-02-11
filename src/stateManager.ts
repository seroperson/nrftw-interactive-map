// State management with URL and localStorage persistence

import { AppState, ViewportState, OpenedPopup } from './types';
import { URL_UPDATE_THROTTLE } from './constants';

export class StateManager {
  private readonly STORAGE_KEY = 'nrftw_map_state';
  private state: AppState;
  private listeners: Set<(state: AppState) => void> = new Set();
  private urlUpdateTimer: number | null = null;

  constructor() {
    this.state = this.loadInitialState();
  }

  private loadInitialState(): AppState {
    // Try to load from URL first, then localStorage, then defaults
    const urlState = this.loadFromURL();
    if (urlState) {
      return urlState;
    }

    const storageState = this.loadFromLocalStorage();
    if (storageState) {
      return storageState;
    }

    return this.getDefaultState();
  }

  private getDefaultState(): AppState {
    return {
      viewport: {
        x: 6144,
        y: 6144,
        scale: 0.1
      },
      visibleResources: new Set(['iron', 'copper', 'silver']),
      openedPopup: null,
      expandedGroups: new Set(['ore']),
      mapFilter: 'none'
    };
  }

  private loadFromURL(): AppState | null {
    try {
      const params = new URLSearchParams(window.location.search);
      
      if (!params.has('state')) {
        return null;
      }

      const encoded = params.get('state')!;
      const decoded = atob(encoded);
      const data = JSON.parse(decoded);

      return {
        viewport: data.viewport || this.getDefaultState().viewport,
        visibleResources: new Set(data.visibleResources || []),
        openedPopup: data.openedPopup || null,
        expandedGroups: new Set(data.expandedGroups || []),
        mapFilter: data.mapFilter || 'none'
      };
    } catch (e) {
      console.error('Failed to load state from URL:', e);
      return null;
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
        mapFilter: data.mapFilter || 'none'
      };
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
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
      this.updateURL();
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
    this.updateURL();
    this.notifyListeners();
  }

  public setVisibleResources(types: Set<string>): void {
    this.state.visibleResources = types;
    this.saveToLocalStorage();
    this.updateURL();
    this.notifyListeners();
  }

  public setOpenedPopup(popup: OpenedPopup | null): void {
    this.state.openedPopup = popup;
    this.saveToLocalStorage();
    this.updateURL();
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
    this.updateURL();
    this.notifyListeners();
  }

  public getShareableURL(): string {
    const data = {
      viewport: this.state.viewport,
      visibleResources: Array.from(this.state.visibleResources),
      openedPopup: this.state.openedPopup,
      expandedGroups: Array.from(this.state.expandedGroups),
      mapFilter: this.state.mapFilter
    };

    const encoded = btoa(JSON.stringify(data));
    const url = new URL(window.location.href);
    url.searchParams.set('state', encoded);

    return url.toString();
  }

  private saveToLocalStorage(): void {
    try {
      const data = {
        viewport: this.state.viewport,
        visibleResources: Array.from(this.state.visibleResources),
        openedPopup: this.state.openedPopup,
        expandedGroups: Array.from(this.state.expandedGroups),
        mapFilter: this.state.mapFilter
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  }

  private updateURL(): void {
    // Throttle URL updates to avoid too many history entries
    if (this.urlUpdateTimer !== null) {
      clearTimeout(this.urlUpdateTimer);
    }

    this.urlUpdateTimer = window.setTimeout(() => {
      try {
        const data = {
          viewport: this.state.viewport,
          visibleResources: Array.from(this.state.visibleResources),
          openedPopup: this.state.openedPopup,
          mapFilter: this.state.mapFilter
        };

        const encoded = btoa(JSON.stringify(data));
        const url = new URL(window.location.href);
        url.searchParams.set('state', encoded);

        // Use replaceState to avoid cluttering browser history
        window.history.replaceState(null, '', url.toString());
      } catch (e) {
        console.error('Failed to update URL:', e);
      }

      this.urlUpdateTimer = null;
    }, URL_UPDATE_THROTTLE);
  }

  public subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }
}
