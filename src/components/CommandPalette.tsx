import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useAppStore } from "../lib/store";
import { useNamespaces } from "../hooks/useKube";
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
} from "lucide-react";
import { ResourceType } from "../types";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setCurrentNamespace = useAppStore((state) => state.setCurrentNamespace);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const theme = useAppStore((state) => state.theme);
  const { data: namespaces } = useNamespaces();

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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[20vh]">
      <Command
        className="rounded-lg border shadow-2xl bg-popover text-popover-foreground w-full max-w-2xl"
        value={search}
        onValueChange={setSearch}
      >
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Command.Input
            placeholder="Type a command or search..."
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            autoFocus
          />
        </div>
        <Command.List className="max-h-[400px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>

          <Command.Group heading="Workloads" className="px-2 py-2">
            <Command.Item
              onSelect={() => navigateTo("pods")}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              <Box className="w-4 h-4" />
              <span>Pods</span>
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo("deployments")}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              <Server className="w-4 h-4" />
              <span>Deployments</span>
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo("statefulsets")}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              <Database className="w-4 h-4" />
              <span>Workloads (StatefulSets, DaemonSets, Jobs)</span>
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Network" className="px-2 py-2">
            <Command.Item
              onSelect={() => navigateTo("services")}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              <Network className="w-4 h-4" />
              <span>Services</span>
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo("ingresses")}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              <Globe className="w-4 h-4" />
              <span>Ingresses</span>
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo("istio")}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              <Layers className="w-4 h-4" />
              <span>Istio</span>
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Configuration" className="px-2 py-2">
            <Command.Item
              onSelect={() => navigateTo("configmaps")}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              <Settings className="w-4 h-4" />
              <span>ConfigMaps</span>
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo("secrets")}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              <Lock className="w-4 h-4" />
              <span>Secrets</span>
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Storage & Cluster" className="px-2 py-2">
            <Command.Item
              onSelect={() => navigateTo("storage")}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              <HardDrive className="w-4 h-4" />
              <span>Storage (PV & PVC)</span>
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo("nodes")}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              <Cpu className="w-4 h-4" />
              <span>Nodes</span>
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo("events")}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              <Activity className="w-4 h-4" />
              <span>Events</span>
            </Command.Item>
            <Command.Item
              onSelect={() => navigateTo("namespaces")}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              <FileText className="w-4 h-4" />
              <span>Namespaces</span>
            </Command.Item>
          </Command.Group>

          {namespaces && namespaces.length > 0 && (
            <Command.Group heading="Switch Namespace" className="px-2 py-2">
              {namespaces.slice(0, 10).map((ns) => (
                <Command.Item
                  key={ns.name}
                  onSelect={() => switchNamespace(ns.name)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
                >
                  <span className="text-xs text-muted-foreground">ns:</span>
                  <span>{ns.name}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group heading="Settings" className="px-2 py-2">
            <Command.Item
              onSelect={handleToggleTheme}
              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-accent"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
              <span>Toggle {theme === "dark" ? "Light" : "Dark"} Mode</span>
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
