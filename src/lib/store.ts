import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AppState, SettingsState } from "../types";

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentContext: undefined,
      currentNamespace: "default",
      currentView: "dashboard",
      theme: "dark",
      podSearchFilter: undefined,
      deploymentSearchFilter: undefined,
      serviceSearchFilter: undefined,
      setCurrentContext: (context) => set({ currentContext: context }),
      setCurrentNamespace: (namespace) => set({ currentNamespace: namespace }),
      setCurrentView: (view) => set({ currentView: view }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => {
        const currentTheme = get().theme;
        set({ theme: currentTheme === "dark" ? "light" : "dark" });
      },
      setPodSearchFilter: (filter) => set({ podSearchFilter: filter }),
      setDeploymentSearchFilter: (filter) => set({ deploymentSearchFilter: filter }),
      setServiceSearchFilter: (filter) => set({ serviceSearchFilter: filter }),
    }),
    {
      name: "kubesail-storage",
    }
  )
);

// Default settings
const defaultSettings = {
  refreshIntervals: {
    pods: 5000,
    deployments: 10000,
    services: 10000,
    nodes: 30000,
    metrics: 5000,
    cluster: 30000,
  },
  metrics: {
    enabled: true,
    autoRefresh: true,
  },
  display: {
    itemsPerPage: 50,
    compactMode: false,
    showNamespaceColumn: true,
  },
  performance: {
    enableAutoRefresh: true,
    requestTimeout: 30000,
    cacheStaleTime: 2000,
    maxRetryAttempts: 2,
  },
  advanced: {
    enableAnimations: true,
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...defaultSettings,
      updateRefreshInterval: (key, value) =>
        set((state) => ({
          refreshIntervals: {
            ...state.refreshIntervals,
            [key]: value,
          },
        })),
      updateMetricsSetting: (key, value) =>
        set((state) => ({
          metrics: {
            ...state.metrics,
            [key]: value,
          },
        })),
      updateDisplaySetting: (key, value) =>
        set((state) => ({
          display: {
            ...state.display,
            [key]: value,
          },
        })),
      updatePerformanceSetting: (key, value) =>
        set((state) => ({
          performance: {
            ...state.performance,
            [key]: value,
          },
        })),
      updateAdvancedSetting: (key, value) =>
        set((state) => ({
          advanced: {
            ...state.advanced,
            [key]: value,
          },
        })),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: "kubesail-settings",
    }
  )
);
