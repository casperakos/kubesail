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
  Settings,
  Lock,
  Database,
  HardDrive,
  Activity,
  Cpu,
  LayoutDashboard,
  ArrowRight,
  Clock,
  CalendarClock,
  History,
  Search,
  Keyboard,
  GitBranch,
  Workflow,
  Shield,
  Package,
  ArrowRightLeft,
  Sun,
  Moon,
} from "lucide-react";
import { ResourceType } from "../types";
import { Badge } from "./ui/Badge";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface RecentItem {
  type: 'view' | 'resource';
  label: string;
  view?: ResourceType;
  resource?: { type: string; name: string; namespace: string };
  timestamp: number;
}

const getRecentItems = (): RecentItem[] => {
  try {
    const items = localStorage.getItem("command-palette-recent");
    return items ? JSON.parse(items) : [];
  } catch {
    return [];
  }
};

const saveRecentItem = (item: Omit<RecentItem, 'timestamp'>) => {
  try {
    const recent = getRecentItems();
    const newItem = { ...item, timestamp: Date.now() };
    const filtered = recent.filter(r => r.type !== item.type || r.label !== item.label);
    const updated = [newItem, ...filtered].slice(0, 10);
    localStorage.setItem("command-palette-recent", JSON.stringify(updated));
  } catch {
    // Ignore errors
  }
};

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setCurrentNamespace = useAppStore((state) => state.setCurrentNamespace);
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const theme = useAppStore((state) => state.theme);
  const setPodSearchFilter = useAppStore((state) => state.setPodSearchFilter);
  const setDeploymentSearchFilter = useAppStore((state) => state.setDeploymentSearchFilter);
  const setServiceSearchFilter = useAppStore((state) => state.setServiceSearchFilter);

  const { data: namespaces } = useNamespaces();
  const { data: pods } = usePods("");
  const { data: deployments } = useDeployments("");
  const { data: services } = useServices("");

  const recentItems = getRecentItems();

  useEffect(() => {
    if (open) {
      setSearch("");
      setShowHelp(false);
    }
  }, [open]);

  useEffect(() => {
    if (search === "?") {
      setShowHelp(true);
      setSearch("");
    }

    // Autocomplete suggestions
    const prefixes = ['pod ', 'deploy ', 'deployment ', 'service ', 'svc ', 'namespace ', 'ns '];
    const lowerSearch = search.toLowerCase();

    let bestMatch = '';
    for (const prefix of prefixes) {
      if (prefix.startsWith(lowerSearch) && lowerSearch.length > 0 && lowerSearch.length < prefix.length) {
        if (!bestMatch || prefix.length < bestMatch.length) {
          bestMatch = prefix;
        }
      }
    }

    setSuggestion(bestMatch ? bestMatch.slice(search.length) : '');
  }, [search]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close with ESC
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Accept suggestion with right arrow
      if (e.key === 'ArrowRight' && suggestion) {
        e.preventDefault();
        setSearch(search + suggestion);
        setSuggestion('');
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, search, suggestion, onClose]);

  if (!open) return null;

  const navigateTo = (view: ResourceType, label?: string) => {
    saveRecentItem({ type: 'view', label: label || view, view });
    setCurrentView(view);
    onClose();
  };

  const switchNamespace = (namespace: string) => {
    // "all" means switch to all namespaces (empty string)
    setCurrentNamespace(namespace === 'all' ? '' : namespace);
    onClose();
  };

  const handleToggleTheme = () => {
    toggleTheme();
    onClose();
  };

  const handleResourceAction = (type: string, name: string, namespace: string) => {
    saveRecentItem({
      type: 'resource',
      label: `${type}: ${name}`,
      resource: { type, name, namespace }
    });

    setCurrentNamespace(namespace);

    // Set search filter to highlight the selected resource
    if (type === 'pod') {
      setPodSearchFilter(name);
      setCurrentView('pods');
    } else if (type === 'deployment') {
      setDeploymentSearchFilter(name);
      setCurrentView('deployments');
    } else if (type === 'service') {
      setServiceSearchFilter(name);
      setCurrentView('services');
    }

    onClose();
  };

  // Parse search: "pod relay" or "namespace kube-system" or just "relay"
  const parseSearch = (query: string) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return { type: null, term: '' };

    if (trimmed.startsWith('pod ')) return { type: 'pod', term: trimmed.slice(4).trim() };
    if (trimmed.startsWith('deploy ')) return { type: 'deployment', term: trimmed.slice(7).trim() };
    if (trimmed.startsWith('deployment ')) return { type: 'deployment', term: trimmed.slice(11).trim() };
    if (trimmed.startsWith('svc ')) return { type: 'service', term: trimmed.slice(4).trim() };
    if (trimmed.startsWith('service ')) return { type: 'service', term: trimmed.slice(8).trim() };
    if (trimmed.startsWith('namespace ')) return { type: 'namespace', term: trimmed.slice(10).trim() };
    if (trimmed.startsWith('ns ')) return { type: 'namespace', term: trimmed.slice(3).trim() };

    return { type: null, term: trimmed };
  };

  const { type: searchType, term: searchTerm } = parseSearch(search);

  // Simple filtering
  const filterByName = (items: any[] | undefined) => {
    if (!items) return [];
    if (!searchTerm) return items.slice(0, 5);
    return items.filter(item => item.name.toLowerCase().includes(searchTerm)).slice(0, 10);
  };

  const filteredPods = searchType === null || searchType === 'pod' ? filterByName(pods) : [];
  const filteredDeployments = searchType === null || searchType === 'deployment' ? filterByName(deployments) : [];
  const filteredServices = searchType === null || searchType === 'service' ? filterByName(services) : [];

  // Filter namespaces
  const filteredNamespaces = searchType === 'namespace' || (!searchType && searchTerm)
    ? (namespaces || []).filter(ns => !searchTerm || ns.name.toLowerCase().includes(searchTerm)).slice(0, 10)
    : [];

  // Check if we should show "All Namespaces" option
  const showAllNamespacesOption = searchType === 'namespace' || (searchTerm && 'all'.includes(searchTerm.toLowerCase()));

  const hasResults = filteredPods.length > 0 || filteredDeployments.length > 0 || filteredServices.length > 0 || filteredNamespaces.length > 0;

  // Navigation items
  const navItems = [
    { view: "dashboard" as ResourceType, label: "Dashboard", icon: LayoutDashboard, color: "text-blue-500" },
    { view: "argo-workflows-workflows" as ResourceType, label: "Workflows", icon: Workflow, color: "text-purple-500" },
    { view: "argocd-applications" as ResourceType, label: "Applications", icon: GitBranch, color: "text-green-500" },
    { view: "pods" as ResourceType, label: "Pods", icon: Box, color: "text-cyan-500" },
    { view: "deployments" as ResourceType, label: "Deployments", icon: Server, color: "text-purple-500" },
    { view: "statefulsets" as ResourceType, label: "StatefulSets", icon: Database, color: "text-indigo-500" },
    { view: "daemonsets" as ResourceType, label: "DaemonSets", icon: Layers, color: "text-pink-500" },
    { view: "jobs" as ResourceType, label: "Jobs", icon: Clock, color: "text-orange-500" },
    { view: "cronjobs" as ResourceType, label: "CronJobs", icon: CalendarClock, color: "text-yellow-500" },
    { view: "services" as ResourceType, label: "Services", icon: Network, color: "text-orange-500" },
    { view: "gateways" as ResourceType, label: "Gateways", icon: Globe, color: "text-green-500" },
    { view: "configmaps" as ResourceType, label: "ConfigMaps", icon: FileText, color: "text-gray-500" },
    { view: "secrets" as ResourceType, label: "Secrets", icon: Lock, color: "text-red-500" },
    { view: "storage" as ResourceType, label: "Storage", icon: HardDrive, color: "text-blue-500" },
    { view: "helm" as ResourceType, label: "Helm", icon: Package, color: "text-teal-500" },
    { view: "nodes" as ResourceType, label: "Nodes", icon: Cpu, color: "text-green-500" },
    { view: "events" as ResourceType, label: "Events", icon: Activity, color: "text-yellow-500" },
    { view: "rbac" as ResourceType, label: "RBAC", icon: Shield, color: "text-red-500" },
    { view: "portforwards" as ResourceType, label: "Port Forwards", icon: ArrowRightLeft, color: "text-purple-500" },
    { view: "settings" as ResourceType, label: "Settings", icon: Settings, color: "text-gray-500" },
  ];

  const filteredNavItems = searchTerm && !searchType
    ? navItems.filter(item => item.label.toLowerCase().includes(searchTerm))
    : navItems.slice(0, 8);

  if (showHelp) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4" onClick={onClose}>
        <div className="rounded-xl border border-border/50 shadow-2xl bg-card text-foreground w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-6">
            <Keyboard className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Keyboard Shortcuts</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
              <span className="text-sm">Open command palette</span>
              <kbd className="px-2 py-1 text-xs font-mono rounded bg-muted border border-border">⌘ K</kbd>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
              <span className="text-sm">Navigate items</span>
              <kbd className="px-2 py-1 text-xs font-mono rounded bg-muted border border-border">↑ ↓</kbd>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
              <span className="text-sm">Accept autocomplete</span>
              <kbd className="px-2 py-1 text-xs font-mono rounded bg-muted border border-border">→</kbd>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
              <span className="text-sm">Search pods</span>
              <kbd className="px-2 py-1 text-xs font-mono rounded bg-muted border border-border">pod [name]</kbd>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
              <span className="text-sm">Switch namespace</span>
              <kbd className="px-2 py-1 text-xs font-mono rounded bg-muted border border-border">ns [name]</kbd>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
              <span className="text-sm">View all namespaces</span>
              <kbd className="px-2 py-1 text-xs font-mono rounded bg-muted border border-border">ns all</kbd>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
              <span className="text-sm">Search all resources</span>
              <kbd className="px-2 py-1 text-xs font-mono rounded bg-muted border border-border">[name]</kbd>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4" onClick={onClose}>
      <Command className="rounded-xl border border-border/50 shadow-2xl bg-card text-foreground w-full max-w-3xl" onClick={(e) => e.stopPropagation()} shouldFilter={false}>
        <div className="flex items-center border-b border-border/50 px-4 relative">
          <Search className="mr-3 h-5 w-5 text-primary" />
          <div className="relative flex-1">
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search: 'relay', 'pod relay', 'ns all' (? for help)"
              className="flex h-14 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground relative z-10"
              autoFocus
            />
            {suggestion && (
              <div className="absolute left-0 top-0 h-14 py-3 text-sm text-muted-foreground/40 pointer-events-none flex items-center">
                <span className="invisible">{search}</span>
                <span>{suggestion}</span>
              </div>
            )}
          </div>
        </div>
        <Command.List className="max-h-[500px] overflow-y-auto p-3">
          {!search && recentItems.length === 0 && !hasResults && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Type to search resources or navigation
            </div>
          )}

          {/* Recent Items */}
          {!search && recentItems.length > 0 && (
            <Command.Group heading="Recent">
              {recentItems.slice(0, 5).map((item, i) => (
                <Command.Item
                  key={i}
                  onSelect={() => {
                    if (item.view) navigateTo(item.view);
                    else if (item.resource) handleResourceAction(item.resource.type, item.resource.name, item.resource.namespace);
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
                >
                  <History className="w-4 h-4" />
                  <span className="text-sm">{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Pods */}
          {filteredPods.length > 0 && (
            <Command.Group heading="Pods">
              {filteredPods.map((pod) => (
                <Command.Item
                  key={`pod-${pod.name}-${pod.namespace}`}
                  onSelect={() => handleResourceAction('pod', pod.name, pod.namespace)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
                >
                  <Box className="w-4 h-4 text-cyan-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{pod.name}</div>
                    <div className="text-xs text-muted-foreground">{pod.namespace}</div>
                  </div>
                  <Badge variant={pod.status.toLowerCase() === 'running' ? 'success' : 'warning'}>{pod.status}</Badge>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Deployments */}
          {filteredDeployments.length > 0 && (
            <Command.Group heading="Deployments">
              {filteredDeployments.map((d) => (
                <Command.Item
                  key={`deploy-${d.name}-${d.namespace}`}
                  onSelect={() => handleResourceAction('deployment', d.name, d.namespace)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
                >
                  <Server className="w-4 h-4 text-purple-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.namespace} • {d.ready}</div>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Services */}
          {filteredServices.length > 0 && (
            <Command.Group heading="Services">
              {filteredServices.map((s) => (
                <Command.Item
                  key={`svc-${s.name}-${s.namespace}`}
                  onSelect={() => handleResourceAction('service', s.name, s.namespace)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
                >
                  <Network className="w-4 h-4 text-orange-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.namespace} • {s.service_type}</div>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Namespaces */}
          {(filteredNamespaces.length > 0 || showAllNamespacesOption) && (
            <Command.Group heading="Namespaces">
              {/* All Namespaces option */}
              {showAllNamespacesOption && (
                <Command.Item
                  key="ns-all"
                  onSelect={() => switchNamespace('all')}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-purple-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">All Namespaces</div>
                    <div className="text-xs text-muted-foreground">View resources across all namespaces</div>
                  </div>
                  {currentNamespace === '' && (
                    <Badge variant="success" className="text-xs">Active</Badge>
                  )}
                </Command.Item>
              )}

              {filteredNamespaces.map((ns) => (
                <Command.Item
                  key={`ns-${ns.name}`}
                  onSelect={() => switchNamespace(ns.name)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-blue-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{ns.name}</div>
                    {ns.name === currentNamespace && (
                      <div className="text-xs text-muted-foreground">Current namespace</div>
                    )}
                  </div>
                  {ns.name === currentNamespace && (
                    <Badge variant="success" className="text-xs">Active</Badge>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Navigation */}
          {!searchType && (
            <Command.Group heading="Navigation">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.view}
                    onSelect={() => navigateTo(item.view, item.label)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
                  >
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-sm">{item.label}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          )}

          {/* Actions */}
          {!search && (
            <Command.Group heading="Actions">
              <Command.Item onSelect={handleToggleTheme} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer">
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span className="text-sm">Toggle Theme</span>
              </Command.Item>
              <Command.Item onSelect={() => setShowHelp(true)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer">
                <Keyboard className="w-4 h-4" />
                <span className="text-sm">Keyboard Shortcuts</span>
                <kbd className="ml-auto px-1.5 py-0.5 text-xs font-mono rounded bg-muted border border-border">?</kbd>
              </Command.Item>
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
}
