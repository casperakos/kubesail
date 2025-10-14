import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./components/Sidebar";
import { NamespaceSelector } from "./components/NamespaceSelector";
import { ThemeToggle } from "./components/ThemeToggle";
import { CommandPalette } from "./components/CommandPalette";
import { PodsList } from "./features/pods/PodsList";
import { DeploymentsList } from "./features/deployments/DeploymentsList";
import { ServicesList } from "./features/services/ServicesList";
import { IngressesList } from "./features/ingresses/IngressesList";
import { IstioResourcesList } from "./features/ingresses/IstioResourcesList";
import { useAppStore } from "./lib/store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function MainContent() {
  const currentView = useAppStore((state) => state.currentView);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      <header className="border-b bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Namespace:</h2>
          <NamespaceSelector />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border rounded-md flex items-center gap-2"
          >
            <span>Search</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {currentView === "pods" && <PodsList />}
        {currentView === "deployments" && <DeploymentsList />}
        {currentView === "services" && <ServicesList />}
        {currentView === "ingresses" && <IngressesList />}
        {currentView === "istio" && <IstioResourcesList />}
        {currentView === "namespaces" && (
          <div className="p-8 text-center text-muted-foreground">
            Namespaces view coming soon...
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar />
        <MainContent />
      </div>
    </QueryClientProvider>
  );
}

export default App;
