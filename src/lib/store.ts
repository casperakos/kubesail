import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AppState } from "../types";

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentContext: undefined,
      currentNamespace: "default",
      currentView: "pods",
      theme: "dark",
      setCurrentContext: (context) => set({ currentContext: context }),
      setCurrentNamespace: (namespace) => set({ currentNamespace: namespace }),
      setCurrentView: (view) => set({ currentView: view }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => {
        const currentTheme = get().theme;
        set({ theme: currentTheme === "dark" ? "light" : "dark" });
      },
    }),
    {
      name: "kubesail-storage",
    }
  )
);
