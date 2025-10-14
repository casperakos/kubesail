import { useAppStore } from "../lib/store";
import { cn } from "../lib/utils";
import { Box, Server, Network, FileText, Globe, Layers } from "lucide-react";
import { ResourceType } from "../types";

const navItems: { icon: typeof Box; label: string; view: ResourceType }[] = [
  { icon: Box, label: "Pods", view: "pods" },
  { icon: Server, label: "Deployments", view: "deployments" },
  { icon: Network, label: "Services", view: "services" },
  { icon: Globe, label: "Ingresses", view: "ingresses" },
  { icon: Layers, label: "Istio", view: "istio" },
  { icon: FileText, label: "Namespaces", view: "namespaces" },
];

export function Sidebar() {
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  return (
    <div className="w-64 border-r bg-card h-screen flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          KubeSail
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Kubernetes Management
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view;

          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          Connected
        </div>
      </div>
    </div>
  );
}
