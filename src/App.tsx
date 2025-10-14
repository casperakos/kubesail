import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./components/Sidebar";
import { NamespaceSelector } from "./components/NamespaceSelector";
import { ThemeToggle } from "./components/ThemeToggle";
import { CommandPalette } from "./components/CommandPalette";
import { Dashboard } from "./features/dashboard/Dashboard";
import { PodsList } from "./features/pods/PodsList";
import { DeploymentsList } from "./features/deployments/DeploymentsList";
import { ServicesList } from "./features/services/ServicesList";
import { IngressesList } from "./features/ingresses/IngressesList";
import { IstioResourcesList } from "./features/ingresses/IstioResourcesList";
import { ConfigMapsList } from "./features/configmaps/ConfigMapsList";
import { SecretsList } from "./features/secrets/SecretsList";
import { WorkloadsList } from "./features/workloads/WorkloadsList";
import { StorageList } from "./features/storage/StorageList";
import { RBACList } from "./features/rbac/RBACList";
import { NodesList } from "./features/nodes/NodesList";
import { EventsList } from "./features/events/EventsList";
import { PortForwardsPage } from "./features/portforwards/PortForwardsPage";
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

      <header className="border-b border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Namespace</h2>
          </div>
          <NamespaceSelector />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="group px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-xl flex items-center gap-2 hover:shadow-md hover:border-primary/30 transition-all duration-200 bg-background/50 backdrop-blur-sm"
          >
            <span className="font-medium">Search</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-lg border border-border/50 bg-muted/50 px-2 font-mono text-[10px] font-medium shadow-sm group-hover:border-primary/30 transition-colors">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {currentView === "dashboard" && <Dashboard />}
        {currentView === "pods" && <PodsList />}
        {currentView === "deployments" && <DeploymentsList />}
        {currentView === "services" && <ServicesList />}
        {currentView === "ingresses" && <IngressesList />}
        {currentView === "istio" && <IstioResourcesList />}
        {currentView === "configmaps" && <ConfigMapsList />}
        {currentView === "secrets" && <SecretsList />}
        {currentView === "statefulsets" && <WorkloadsList />}
        {currentView === "daemonsets" && <WorkloadsList />}
        {currentView === "jobs" && <WorkloadsList />}
        {currentView === "cronjobs" && <WorkloadsList />}
        {currentView === "storage" && <StorageList />}
        {currentView === "rbac" && <RBACList />}
        {currentView === "nodes" && <NodesList />}
        {currentView === "events" && <EventsList />}
        {currentView === "portforwards" && <PortForwardsPage />}
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
