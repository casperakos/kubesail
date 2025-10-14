import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAppStore } from "../../lib/store";
import {
  Activity,
  Box,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Layers,
  Network,
  Server,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ClusterMetrics, EventInfo } from "../../types";

export function Dashboard() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  // Fetch cluster-wide metrics
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<ClusterMetrics>({
    queryKey: ["cluster-metrics"],
    queryFn: async () => {
      // For now, aggregate from existing endpoints
      const [pods, nodes, namespaces, deployments, services] = await Promise.all([
        api.getPods("").catch(() => []),
        api.getNodes().catch(() => []),
        api.getNamespaces().catch(() => []),
        api.getDeployments("").catch(() => []),
        api.getServices("").catch(() => []),
      ]);

      return {
        total_nodes: nodes.length,
        ready_nodes: nodes.filter((n) => n.status.toLowerCase() === "ready").length,
        total_pods: pods.length,
        running_pods: pods.filter((p) => p.status.toLowerCase() === "running").length,
        total_namespaces: namespaces.length,
        total_deployments: deployments.length,
        total_services: services.length,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch recent events
  const { data: events } = useQuery<EventInfo[]>({
    queryKey: ["recent-events", currentNamespace],
    queryFn: () => api.getEvents(currentNamespace),
    refetchInterval: 30000,
  });

  const recentEvents = events?.slice(0, 5) || [];

  const metricCards = [
    {
      title: "Nodes",
      value: metrics?.total_nodes || 0,
      subtitle: `${metrics?.ready_nodes || 0} Ready`,
      icon: Cpu,
      color: "from-blue-500 to-blue-600",
      bgColor: "from-blue-500/10 to-blue-600/10",
      onClick: () => setCurrentView("nodes"),
    },
    {
      title: "Pods",
      value: metrics?.total_pods || 0,
      subtitle: `${metrics?.running_pods || 0} Running`,
      icon: Box,
      color: "from-green-500 to-green-600",
      bgColor: "from-green-500/10 to-green-600/10",
      onClick: () => setCurrentView("pods"),
    },
    {
      title: "Deployments",
      value: metrics?.total_deployments || 0,
      subtitle: "Active",
      icon: Server,
      color: "from-purple-500 to-purple-600",
      bgColor: "from-purple-500/10 to-purple-600/10",
      onClick: () => setCurrentView("deployments"),
    },
    {
      title: "Services",
      value: metrics?.total_services || 0,
      subtitle: "Exposed",
      icon: Network,
      color: "from-orange-500 to-orange-600",
      bgColor: "from-orange-500/10 to-orange-600/10",
      onClick: () => setCurrentView("services"),
    },
    {
      title: "Namespaces",
      value: metrics?.total_namespaces || 0,
      subtitle: "Total",
      icon: Layers,
      color: "from-pink-500 to-pink-600",
      bgColor: "from-pink-500/10 to-pink-600/10",
      onClick: () => setCurrentView("namespaces"),
    },
  ];

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-1 h-12 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Cluster Dashboard
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time overview of your Kubernetes cluster
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchMetrics()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.title}
              onClick={card.onClick}
              className="group p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 text-left card-hover"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${card.bgColor} border border-border/30`}>
                  <Icon className={`w-5 h-5 bg-gradient-to-br ${card.color} bg-clip-text text-transparent`} style={{WebkitTextFillColor: 'transparent', WebkitBackgroundClip: 'text', backgroundClip: 'text'}} />
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">{card.title}</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text mb-1">
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground">{card.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Health Status & Recent Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cluster Health */}
        <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Cluster Health</h3>
          </div>

          <div className="space-y-3">
            {/* Nodes Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-muted/30 to-muted/10">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Nodes</span>
              </div>
              <div className="flex items-center gap-2">
                {metrics?.ready_nodes === metrics?.total_nodes ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <Badge variant={metrics?.ready_nodes === metrics?.total_nodes ? "success" : "warning"}>
                  {metrics?.ready_nodes}/{metrics?.total_nodes}
                </Badge>
              </div>
            </div>

            {/* Pods Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-muted/30 to-muted/10">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Pods</span>
              </div>
              <div className="flex items-center gap-2">
                {metrics?.running_pods === metrics?.total_pods ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <Badge variant={metrics?.running_pods === metrics?.total_pods ? "success" : "warning"}>
                  {metrics?.running_pods}/{metrics?.total_pods}
                </Badge>
              </div>
            </div>

            {/* Deployments Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-muted/30 to-muted/10">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Deployments</span>
              </div>
              <Badge variant="success">{metrics?.total_deployments || 0} Active</Badge>
            </div>

            {/* Services Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-muted/30 to-muted/10">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Services</span>
              </div>
              <Badge variant="success">{metrics?.total_services || 0} Exposed</Badge>
            </div>
          </div>
        </div>

        {/* Recent Events */}
        <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Recent Events</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentView("events")}
            >
              View All
            </Button>
          </div>

          <div className="space-y-2">
            {recentEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No recent events
              </div>
            ) : (
              recentEvents.map((event, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-gradient-to-r from-muted/30 to-muted/10 hover:from-muted/40 hover:to-muted/20 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={
                            event.event_type.toLowerCase() === "normal"
                              ? "success"
                              : event.event_type.toLowerCase() === "warning"
                              ? "warning"
                              : "destructive"
                          }
                        >
                          {event.reason}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {event.object}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {event.message}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {event.count > 1 && `${event.count}x`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Quick Actions</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Pods", view: "pods" as const, icon: Box },
            { label: "Deployments", view: "deployments" as const, icon: Server },
            { label: "Services", view: "services" as const, icon: Network },
            { label: "Ingresses", view: "ingresses" as const, icon: Globe },
            { label: "ConfigMaps", view: "configmaps" as const, icon: Database },
            { label: "Secrets", view: "secrets" as const, icon: HardDrive },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.view}
                onClick={() => setCurrentView(action.view)}
                className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 hover:from-primary/10 hover:to-primary/5 hover:border-primary/30 transition-all duration-200 flex flex-col items-center gap-2 group"
              >
                <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
