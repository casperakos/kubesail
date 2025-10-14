import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useAppStore } from "../lib/store";
import { useNamespaces, usePods, useDeployments, useServices } from "../hooks/useKube";
import {
  Box,
  Server,
  Network,
  Globe,
  Layers,
  FileText,
  Moon,
  Sun,
  Search,
  Settings,
  Lock,
  Database,
  HardDrive,
  Activity,
  Cpu,
  LayoutDashboard,
  Code,
  Eye,
  ArrowRight,
} from "lucide-react";
import { ResourceType } from "../types";
import { Badge } from "./ui/Badge";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [selectedResource, setSelectedResource] = useState<{type: string; name: string; namespace: string} | null>(null);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setCurrentNamespace = useAppStore((state) => state.setCurrentNamespace);
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const theme = useAppStore((state) => state.theme);

  // Fetch all resources for search
  const { data: namespaces } = useNamespaces();
  const { data: pods } = usePods("");
  const { data: deployments } = useDeployments("");
  const { data: services } = useServices("");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onClose]);

  if (!open) return null;

  const navigateTo = (view: ResourceType) => {
    setCurrentView(view);
    onClose();
  };

  const switchNamespace = (namespace: string) => {
    setCurrentNamespace(namespace);
    onClose();
  };

  const handleToggleTheme = () => {
    toggleTheme();
    onClose();
  };

  const handleResourceAction = (type: string, name: string, namespace: string, action: 'view' | 'logs' | 'yaml') => {
    // Navigate to the resource view and set the namespace
    setCurrentNamespace(namespace);

    if (action === 'view') {
      // Navigate to the appropriate view
      if (type === 'pod') setCurrentView('pods');
      else if (type === 'deployment') setCurrentView('deployments');
      else if (type === 'service') setCurrentView('services');
    }
    // For logs and yaml, we'd need to pass state or use URL params
    // For now, just navigate to the view
    onClose();
  };

  // Filter resources based on search
  const filteredPods = pods?.filter(p =>
    search === "" || p.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 5) || [];

  const filteredDeployments = deployments?.filter(d =>
    search === "" || d.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 5) || [];

  const filteredServices = services?.filter(s =>
    search === "" || s.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 5) || [];

  const hasResources = filteredPods.length > 0 || filteredDeployments.length > 0 || filteredServices.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4 animate-fade-in" onClick={onClose}>
      <Command
        className="rounded-xl border border-border/50 shadow-2xl bg-gradient-to-br from-card/95 to-card/90 backdrop-blur-xl text-foreground w-full max-w-3xl animate-slide-in"
        value={search}
        onValueChange={setSearch}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-border/50 px-4 bg-gradient-to-r from-background/50 to-background/30">
          <Search className="mr-3 h-5 w-5 shrink-0 text-primary" />
          <Command.Input
            placeholder="Search pods, deployments, services... or type a command"
            className="flex h-14 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            autoFocus
          />
        </div>
        <Command.List className="max-h-[500px] overflow-y-auto p-3 custom-scrollbar">
          <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>

          {/* Resources Section - Show when searching */}
          {search && hasResources && (
            <>
              {filteredPods.length > 0 && (
                <Command.Group heading="Pods" className="px-2 py-2">
                  {filteredPods.map((pod) => (
                    <Command.Item
                      key={`pod-${pod.name}-${pod.namespace}`}
                      onSelect={() => handleResourceAction('pod', pod.name, pod.namespace, 'view')}
                      className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1 group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20">
                          <Box className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{pod.name}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono">{pod.namespace}</span>
                            <span className="mx-2">•</span>
                            <Badge variant={
                              pod.status.toLowerCase() === 'running' ? 'success' :
                              pod.status.toLowerCase() === 'pending' ? 'warning' : 'destructive'
                            } className="text-[10px] py-0 px-1.5">
                              {pod.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {filteredDeployments.length > 0 && (
                <Command.Group heading="Deployments" className="px-2 py-2">
                  {filteredDeployments.map((deployment) => (
                    <Command.Item
                      key={`deployment-${deployment.name}-${deployment.namespace}`}
                      onSelect={() => handleResourceAction('deployment', deployment.name, deployment.namespace, 'view')}
                      className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1 group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20">
                          <Server className="w-4 h-4 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{deployment.name}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono">{deployment.namespace}</span>
                            <span className="mx-2">•</span>
                            <span>{deployment.ready}</span>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {filteredServices.length > 0 && (
                <Command.Group heading="Services" className="px-2 py-2">
                  {filteredServices.map((service) => (
                    <Command.Item
                      key={`service-${service.name}-${service.namespace}`}
                      onSelect={() => handleResourceAction('service', service.name, service.namespace, 'view')}
                      className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1 group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20">
                          <Network className="w-4 h-4 text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{service.name}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono">{service.namespace}</span>
                            <span className="mx-2">•</span>
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                              {service.service_type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </>
          )}

          {/* Navigation Section - Show when not searching or no resource results */}
          {(!search || !hasResources) && (
            <>
              <Command.Group heading="Navigation" className="px-2 py-2">
                <Command.Item
                  onSelect={() => navigateTo("dashboard")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1"
                >
                  <LayoutDashboard className="w-4 h-4 text-primary" />
                  <span>Dashboard</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigateTo("pods")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1"
                >
                  <Box className="w-4 h-4" />
                  <span>Pods</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigateTo("deployments")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1"
                >
                  <Server className="w-4 h-4" />
                  <span>Deployments</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigateTo("services")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1"
                >
                  <Network className="w-4 h-4" />
                  <span>Services</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigateTo("ingresses")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1"
                >
                  <Globe className="w-4 h-4" />
                  <span>Ingresses</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigateTo("configmaps")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1"
                >
                  <Settings className="w-4 h-4" />
                  <span>ConfigMaps</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigateTo("secrets")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1"
                >
                  <Lock className="w-4 h-4" />
                  <span>Secrets</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigateTo("nodes")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1"
                >
                  <Cpu className="w-4 h-4" />
                  <span>Nodes</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => navigateTo("events")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1"
                >
                  <Activity className="w-4 h-4" />
                  <span>Events</span>
                </Command.Item>
              </Command.Group>

              {namespaces && namespaces.length > 0 && (
                <Command.Group heading="Switch Namespace" className="px-2 py-2">
                  {namespaces.slice(0, 8).map((ns) => (
                    <Command.Item
                      key={ns.name}
                      onSelect={() => switchNamespace(ns.name)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1"
                    >
                      <Layers className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{ns.name}</span>
                      {ns.name === currentNamespace && (
                        <Badge variant="success" className="ml-auto text-[10px] py-0 px-1.5">Current</Badge>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group heading="Settings" className="px-2 py-2">
                <Command.Item
                  onSelect={handleToggleTheme}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-gradient-to-r hover:from-primary/10 hover:to-primary/5 transition-all mb-1"
                >
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                  <span>Toggle {theme === "dark" ? "Light" : "Dark"} Mode</span>
                </Command.Item>
              </Command.Group>
            </>
          )}
        </Command.List>
      </Command>
    </div>
  );
}
