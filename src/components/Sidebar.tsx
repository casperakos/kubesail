import { useState, useEffect } from "react";
import { useAppStore } from "../lib/store";
import { cn } from "../lib/utils";
import {
  Box,
  Server,
  Network,
  FileText,
  Globe,
  Layers,
  Settings,
  Settings2,
  Lock,
  Database,
  HardDrive,
  Activity,
  Cpu,
  LayoutDashboard,
  Shield,
  ArrowRightLeft,
  GitBranch,
  GitMerge,
  Key,
  FileTextIcon,
  BoxesIcon,
  Workflow,
  Zap,
  Package,
  Clock,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  WifiOff,
} from "lucide-react";
import { ResourceType } from "../types";
import { Logo } from "./Logo";
import { Badge } from "./ui/Badge";
import { useControllerDetection } from "../hooks/useControllerDetection";
import { useNamespaces, usePortForwards } from "../hooks/useKube";

const navSections: {
  title: string;
  items: { icon: typeof Box; label: string; view: ResourceType }[];
}[] = [
  {
    title: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", view: "dashboard" },
    ],
  },
  {
    title: "Quick Access",
    items: [
      { icon: Workflow, label: "Workflows", view: "argo-workflows-workflows" },
      { icon: GitBranch, label: "Applications", view: "argocd-applications" },
    ],
  },
  {
    title: "Workloads",
    items: [
      { icon: Box, label: "Pods", view: "pods" },
      { icon: Server, label: "Deployments", view: "deployments" },
      { icon: Database, label: "StatefulSets", view: "statefulsets" },
      { icon: Layers, label: "DaemonSets", view: "daemonsets" },
      { icon: Clock, label: "Jobs", view: "jobs" },
      { icon: CalendarClock, label: "CronJobs", view: "cronjobs" },
    ],
  },
  {
    title: "Network",
    items: [
      { icon: Network, label: "Services", view: "services" },
      { icon: Globe, label: "Gateways & Routing", view: "gateways" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { icon: Settings, label: "ConfigMaps", view: "configmaps" },
      { icon: Lock, label: "Secrets", view: "secrets" },
    ],
  },
  {
    title: "Storage",
    items: [{ icon: HardDrive, label: "Storage", view: "storage" }],
  },
  {
    title: "Package Management",
    items: [{ icon: Package, label: "Helm Releases", view: "helm" }],
  },
  {
    title: "Cluster",
    items: [
      { icon: Cpu, label: "Nodes", view: "nodes" },
      { icon: Activity, label: "Events", view: "events" },
    ],
  },
  {
    title: "Security",
    items: [{ icon: Shield, label: "RBAC", view: "rbac" }],
  },
  {
    title: "Advanced",
    items: [
      { icon: Database, label: "CRDs", view: "crds" },
      { icon: FileText, label: "Namespaces", view: "namespaces" },
    ],
  },
  {
    title: "Tools",
    items: [
      { icon: ArrowRightLeft, label: "Port Forwards", view: "portforwards" },
      { icon: Settings2, label: "Settings", view: "settings" },
    ],
  },
];

const getControllerIcon = (controllerId: string) => {
  switch (controllerId) {
    case "argocd":
      return GitBranch;
    case "flux":
      return GitMerge;
    case "external-secrets":
      return Key;
    case "sealed-secrets":
      return Lock;
    case "cert-manager":
      return FileTextIcon;
    case "crossplane":
      return BoxesIcon;
    case "argo-workflows":
      return Workflow;
    case "argo-events":
      return Zap;
    default:
      return Database;
  }
};

export function Sidebar() {
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const { data: controllers } = useControllerDetection();
  const { data: namespaces, isError, isFetching, isSuccess } = useNamespaces();
  const { data: portForwards } = usePortForwards();

  // Determine connection status - check if we have successful data or currently fetching
  // If isError is true and we're not fetching, then we're disconnected
  const isConnected = (isSuccess && namespaces !== undefined) || isFetching;

  // Count active port forwards
  const activePortForwardsCount = portForwards?.filter(pf => pf.status === 'running').length || 0;

  // Check which quick access controllers are installed
  const hasArgoWorkflows = controllers?.some(c => c.id === 'argo-workflows');
  const hasArgoCD = controllers?.some(c => c.id === 'argocd');
  const hasQuickAccess = hasArgoWorkflows || hasArgoCD;

  // Default expanded sections (Quick Access only if it has items)
  const defaultExpanded = hasQuickAccess
    ? ["Overview", "Quick Access", "Workloads"]
    : ["Overview", "Workloads"];

  // Load collapsed state from localStorage
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed-sections");
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load sidebar state:", e);
    }
    // Default: all sections except Overview, Quick Access, and Workloads are collapsed
    return new Set(navSections.map(s => s.title).filter(t => !defaultExpanded.includes(t)));
  });

  // Save to localStorage whenever collapsed state changes
  useEffect(() => {
    try {
      localStorage.setItem("sidebar-collapsed-sections", JSON.stringify([...collapsedSections]));
    } catch (e) {
      console.error("Failed to save sidebar state:", e);
    }
  }, [collapsedSections]);

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  // Build Quick Access section dynamically based on installed controllers
  const quickAccessItems = [];
  if (hasArgoWorkflows) {
    quickAccessItems.push({ icon: Workflow, label: "Workflows", view: "argo-workflows-workflows" as ResourceType });
  }
  if (hasArgoCD) {
    quickAccessItems.push({ icon: GitBranch, label: "Applications", view: "argocd-applications" as ResourceType });
  }

  const quickAccessSection = quickAccessItems.length > 0 ? {
    title: "Quick Access",
    items: quickAccessItems,
  } : null;

  // Build dynamic controller section (excluding argo-workflows and argocd since they're in Quick Access)
  const controllerSection = controllers && controllers.length > 0 ? {
    title: "Controllers",
    items: controllers
      .filter(c => c.id !== 'argo-workflows' && c.id !== 'argocd') // Exclude these from Controllers section
      .map((controller) => ({
        icon: getControllerIcon(controller.id),
        label: controller.name,
        view: controller.id as ResourceType,
      })),
  } : null;

  // Filter out sections and build final list
  const filteredNavSections = navSections.filter(section => section.title !== "Quick Access");

  // Build all sections: Overview, Quick Access (if items), other sections, Controllers (if items)
  const allSections = [
    filteredNavSections[0], // Overview
    ...(quickAccessSection ? [quickAccessSection] : []),
    ...filteredNavSections.slice(1, 6), // Workloads through Package Management
    ...(controllerSection && controllerSection.items.length > 0 ? [controllerSection] : []),
    ...filteredNavSections.slice(6), // Cluster, Security, Advanced, Tools
  ];

  return (
    <div className="w-64 border-r bg-gradient-to-b from-card to-card/50 h-screen flex flex-col shadow-xl">
      {/* Logo Section with gradient background */}
      <div className="p-6 bg-gradient-to-br from-background/50 to-background/30 backdrop-blur-sm">
        <Logo />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {allSections.map((section) => {
          const isCollapsed = collapsedSections.has(section.title);
          const hasActiveItem = section.items.some(item => item.view === currentView);

          return (
            <div key={section.title} className="space-y-2">
              {/* Section Header - Clickable */}
              <button
                onClick={() => toggleSection(section.title)}
                className={cn(
                  "w-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-2 py-1.5 rounded-md transition-all duration-200",
                  "hover:bg-accent/40",
                  isCollapsed
                    ? "text-muted-foreground/60"
                    : "text-muted-foreground/80"
                )}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 opacity-40" />
                ) : (
                  <ChevronDown className="w-3 h-3 opacity-40" />
                )}
                <span className="flex-1 text-left">{section.title}</span>
                {isCollapsed && hasActiveItem && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-lg shadow-primary/50" />
                )}
              </button>

              {/* Section Items - Collapsible */}
              {!isCollapsed && (
                <div className="space-y-1 ml-2 transition-all duration-200">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.view;

                    return (
                      <button
                        key={item.view}
                        onClick={() => setCurrentView(item.view)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group relative overflow-hidden",
                          isActive
                            ? "bg-primary/15 text-foreground shadow-sm border border-primary/30 font-semibold"
                            : "hover:bg-accent/60 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {/* Active indicator bar */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-lg shadow-primary/40" />
                        )}

                        {/* Icon */}
                        <div className={cn(
                          "flex items-center justify-center transition-all duration-200",
                          isActive ? "text-primary scale-110" : "text-muted-foreground/60 group-hover:text-foreground group-hover:scale-105"
                        )}>
                          <Icon className="w-[17px] h-[17px]" strokeWidth={isActive ? 2.5 : 2} />
                        </div>

                        <span className="relative z-10 flex-1 text-left">{item.label}</span>

                        {/* Hover effect */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Status Footer with glassmorphism */}
      <div className="p-4 border-t border-border/50 bg-gradient-to-br from-background/80 to-background/50 backdrop-blur-sm space-y-3">
        {/* Port Forwards Indicator */}
        {activePortForwardsCount > 0 && (
          <button
            onClick={() => setCurrentView('portforwards')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-all duration-200 group"
          >
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground flex-1 text-left">
              Port Forwards
            </span>
            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-primary">
              {activePortForwardsCount}
            </Badge>
          </button>
        )}

        {/* Connection Status */}
        <div className="flex items-center gap-2 text-xs">
          {isConnected ? (
            <>
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-75"></div>
              </div>
              <span className="font-medium text-foreground/80">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-500" />
              <span className="font-medium text-red-500/80">Disconnected</span>
            </>
          )}
        </div>

        {/* Version */}
        <div className="text-[10px] text-muted-foreground">
          v2.0.0 • {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
