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
} from "lucide-react";
import { ResourceType } from "../types";
import { Logo } from "./Logo";
import { useControllerDetection } from "../hooks/useControllerDetection";

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
    title: "Workloads",
    items: [
      { icon: Box, label: "Pods", view: "pods" },
      { icon: Server, label: "Deployments", view: "deployments" },
      { icon: Database, label: "Workloads", view: "statefulsets" },
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
    title: "Custom Resources",
    items: [{ icon: Database, label: "CRDs", view: "crds" }],
  },
  {
    title: "Package Management",
    items: [{ icon: Package, label: "Helm Releases", view: "helm" }],
  },
  {
    title: "Security",
    items: [{ icon: Shield, label: "RBAC", view: "rbac" }],
  },
  {
    title: "Cluster",
    items: [
      { icon: Cpu, label: "Nodes", view: "nodes" },
      { icon: Activity, label: "Events", view: "events" },
      { icon: FileText, label: "Namespaces", view: "namespaces" },
    ],
  },
  {
    title: "Tools",
    items: [
      { icon: ArrowRightLeft, label: "Port Forwards", view: "portforwards" },
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

  // Build dynamic controller section
  const controllerSection = controllers && controllers.length > 0 ? {
    title: "Controllers",
    items: controllers.map((controller) => ({
      icon: getControllerIcon(controller.id),
      label: controller.name,
      view: controller.id as ResourceType,
    })),
  } : null;

  // Combine static sections with dynamic controller section
  const allSections = controllerSection
    ? [...navSections.slice(0, 5), controllerSection, ...navSections.slice(5)]
    : navSections;

  return (
    <div className="w-64 border-r bg-gradient-to-b from-card to-card/50 h-screen flex flex-col shadow-xl">
      {/* Logo Section with gradient background */}
      <div className="p-6 border-b border-border/50 bg-gradient-to-br from-background/50 to-background/30 backdrop-blur-sm">
        <Logo />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
        {allSections.map((section) => (
          <div key={section.title} className="space-y-2">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 mb-3">
              {section.title}
            </h3>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.view;

                return (
                  <button
                    key={item.view}
                    onClick={() => setCurrentView(item.view)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                      isActive
                        ? "bg-gradient-to-r from-slate-500/10 to-zinc-500/10 text-foreground shadow-sm border border-primary/20"
                        : "hover:bg-accent/50 text-muted-foreground hover:text-foreground hover:shadow-sm"
                    )}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-slate-500 to-zinc-500 rounded-r-full" />
                    )}

                    {/* Icon with gradient on active */}
                    <div className={cn(
                      "transition-all duration-200",
                      isActive && "text-blue-500"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <span className="relative z-10">{item.label}</span>

                    {/* Hover effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-r from-blue-500/5 to-purple-500/5" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status Footer with glassmorphism */}
      <div className="p-4 border-t border-border/50 bg-gradient-to-br from-background/80 to-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-xs">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-75"></div>
          </div>
          <span className="font-medium text-foreground/80">Connected</span>
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground">
          v2.0.0 • {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
