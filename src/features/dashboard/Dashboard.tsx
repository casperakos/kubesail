import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAppStore, useSettingsStore } from "../../lib/store";
import { useMetricsCapabilities, useClusterMetricsData } from "../../hooks/useKube";
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
  MemoryStick,
  Zap,
  AlertTriangle,
  Clock,
  Shield,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ClusterMetrics, EventInfo } from "../../types";
import { LoadingSpinner } from "../../components/LoadingSpinner";

export function Dashboard() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const metricsEnabled = useSettingsStore((state) => state.metrics.enabled);

  // Fetch metrics capabilities
  const { data: metricsCapabilities, isLoading: capabilitiesLoading } = useMetricsCapabilities();

  // Fetch advanced cluster metrics
  const { data: clusterMetricsData, isLoading: clusterMetricsLoading, error: clusterMetricsError } = useClusterMetricsData();

  // Fetch basic cluster-wide metrics (fallback)
  const { data: basicMetrics, isLoading: basicMetricsLoading, refetch: refetchBasicMetrics } = useQuery<ClusterMetrics>({
    queryKey: ["cluster-metrics"],
    queryFn: async () => {
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
    refetchInterval: 30000,
  });

  // Fetch recent events
  const { data: events } = useQuery<EventInfo[]>({
    queryKey: ["recent-events", currentNamespace],
    queryFn: () => api.getEvents(currentNamespace),
    refetchInterval: 30000,
  });

  const recentEvents = events?.slice(0, 5) || [];

  // Helper to format bytes to human-readable
  const formatBytes = (bytes: number): string => {
    const gb = bytes / (1024 ** 3);
    if (gb >= 1) return `${gb.toFixed(1)}GB`;
    const mb = bytes / (1024 ** 2);
    if (mb >= 1) return `${mb.toFixed(1)}MB`;
    return `${(bytes / 1024).toFixed(1)}KB`;
  };

  // Helper to format cores
  const formatCores = (cores: number): string => {
    if (cores < 1) return `${Math.round(cores * 1000)}m`;
    return `${cores.toFixed(2)} cores`;
  };

  // Check if we have metrics available and metrics are enabled in settings
  const hasAdvancedMetrics = metricsEnabled && !clusterMetricsLoading && !clusterMetricsError && clusterMetricsData;

  // Calculate health score
  const getHealthScore = () => {
    if (!basicMetrics) return 0;
    const nodeHealth = (basicMetrics.ready_nodes / basicMetrics.total_nodes) * 100;
    const podHealth = (basicMetrics.running_pods / basicMetrics.total_pods) * 100;
    return Math.round((nodeHealth + podHealth) / 2);
  };

  const healthScore = getHealthScore();

  // Get health status color
  const getHealthColor = (score: number) => {
    if (score >= 90) return { bg: "from-green-500/20 to-emerald-500/20", border: "border-green-500/30", text: "text-green-500" };
    if (score >= 70) return { bg: "from-yellow-500/20 to-orange-500/20", border: "border-yellow-500/30", text: "text-yellow-500" };
    return { bg: "from-red-500/20 to-rose-500/20", border: "border-red-500/30", text: "text-red-500" };
  };

  const healthColors = getHealthColor(healthScore);

  if (basicMetricsLoading || capabilitiesLoading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-1 h-12 bg-gradient-to-b from-muted-foreground to-muted rounded-full"></div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Cluster Overview
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time health and performance metrics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {metricsCapabilities && metricsCapabilities.sources.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-lg border border-border/50">
              <Zap className="w-3.5 h-3.5 text-muted-foreground" />
              {metricsCapabilities.sources.map((source, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {source.name}
                </Badge>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchBasicMetrics()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Cluster Health Score & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score Gauge */}
        <div className="lg:col-span-1">
          <div className={`p-6 rounded-xl border ${healthColors.border} bg-gradient-to-br ${healthColors.bg} backdrop-blur-xl shadow-lg`}>
            <div className="flex items-center gap-2 mb-4">
              <Shield className={`w-5 h-5 ${healthColors.text}`} />
              <h3 className="text-lg font-semibold">Cluster Health</h3>
            </div>

            <div className="flex flex-col items-center justify-center py-4">
              {/* Circular progress */}
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-muted/20"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - healthScore / 100)}`}
                    className={healthColors.text}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${healthColors.text}`}>{healthScore}%</div>
                    <div className="text-xs text-muted-foreground">Health</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-center">
                <p className={`text-sm font-semibold ${healthColors.text}`}>
                  {healthScore >= 90 ? "Excellent" : healthScore >= 70 ? "Good" : "Needs Attention"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {basicMetrics?.ready_nodes}/{basicMetrics?.total_nodes} nodes ready • {basicMetrics?.running_pods}/{basicMetrics?.total_pods} pods running
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Resource Summary Cards */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 h-full">
            {/* Nodes Status */}
            <div className="p-5 rounded-xl border border-border/50 bg-gradient-to-br from-muted/20 to-muted/5 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer"
                 onClick={() => setCurrentView("nodes")}>
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                  <Cpu className="w-5 h-5 text-muted-foreground" />
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Nodes</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{basicMetrics?.ready_nodes}</p>
                  <span className="text-sm text-muted-foreground">/ {basicMetrics?.total_nodes}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Ready</p>
              </div>
            </div>

            {/* Pods Status */}
            <div className="p-5 rounded-xl border border-border/50 bg-gradient-to-br from-muted/20 to-muted/5 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer"
                 onClick={() => setCurrentView("pods")}>
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                  <Box className="w-5 h-5 text-muted-foreground" />
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Pods</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{basicMetrics?.running_pods}</p>
                  <span className="text-sm text-muted-foreground">/ {basicMetrics?.total_pods}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Running</p>
              </div>
            </div>

            {/* Workloads Status */}
            <div className="p-5 rounded-xl border border-border/50 bg-gradient-to-br from-muted/20 to-muted/5 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer"
                 onClick={() => setCurrentView("deployments")}>
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                  <Server className="w-5 h-5 text-muted-foreground" />
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Deployments</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{basicMetrics?.total_deployments}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Active</p>
              </div>
            </div>

            {/* Services Status */}
            <div className="p-5 rounded-xl border border-border/50 bg-gradient-to-br from-muted/20 to-muted/5 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 group cursor-pointer"
                 onClick={() => setCurrentView("services")}>
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                  <Network className="w-5 h-5 text-muted-foreground" />
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Services</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{basicMetrics?.total_services}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Exposed</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Metrics Section */}
      {hasAdvancedMetrics && clusterMetricsData && (
        <>
          {/* Resource Usage Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CPU Usage Chart */}
            <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">CPU Resources</h3>
                </div>
                <Badge variant={clusterMetricsData.cpu_usage_percent > 80 ? "destructive" : clusterMetricsData.cpu_usage_percent > 60 ? "warning" : "success"}>
                  {clusterMetricsData.cpu_usage_percent.toFixed(1)}%
                </Badge>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground/80 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(clusterMetricsData.cpu_usage_percent, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{formatCores(clusterMetricsData.total_cpu_usage)} used</span>
                  <span>{formatCores(clusterMetricsData.total_cpu_allocatable)} allocatable</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Capacity</p>
                  <p className="text-sm font-bold">{formatCores(clusterMetricsData.total_cpu_capacity)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Used</p>
                  <p className="text-sm font-bold">{formatCores(clusterMetricsData.total_cpu_usage)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Available</p>
                  <p className="text-sm font-bold">{formatCores(clusterMetricsData.total_cpu_allocatable - clusterMetricsData.total_cpu_usage)}</p>
                </div>
              </div>
            </div>

            {/* Memory Usage Chart */}
            <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                    <MemoryStick className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">Memory Resources</h3>
                </div>
                <Badge variant={clusterMetricsData.memory_usage_percent > 80 ? "destructive" : clusterMetricsData.memory_usage_percent > 60 ? "warning" : "success"}>
                  {clusterMetricsData.memory_usage_percent.toFixed(1)}%
                </Badge>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground/80 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(clusterMetricsData.memory_usage_percent, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>{formatBytes(clusterMetricsData.total_memory_usage)} used</span>
                  <span>{formatBytes(clusterMetricsData.total_memory_allocatable)} allocatable</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Capacity</p>
                  <p className="text-sm font-bold">{formatBytes(clusterMetricsData.total_memory_capacity)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Used</p>
                  <p className="text-sm font-bold">{formatBytes(clusterMetricsData.total_memory_usage)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Available</p>
                  <p className="text-sm font-bold">{formatBytes(clusterMetricsData.total_memory_allocatable - clusterMetricsData.total_memory_usage)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Node Metrics Overview */}
          {clusterMetricsData.node_metrics && clusterMetricsData.node_metrics.length > 0 && (
            <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                    <Server className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Node Metrics</h3>
                    {clusterMetricsData.node_metrics.length > 6 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Showing top 6 by CPU usage
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView("nodes")}
                >
                  View All {clusterMetricsData.node_metrics.length > 6 && `(${clusterMetricsData.node_metrics.length})`}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clusterMetricsData.node_metrics
                  .slice()
                  .sort((a, b) => b.cpu_usage_cores - a.cpu_usage_cores)
                  .slice(0, 6)
                  .map((node) => {
                  const cpuPercent = (node.cpu_usage_cores / (clusterMetricsData.total_cpu_capacity / clusterMetricsData.node_metrics.length)) * 100;
                  const memoryPercent = (node.memory_usage_bytes / (clusterMetricsData.total_memory_capacity / clusterMetricsData.node_metrics.length)) * 100;

                  return (
                    <div
                      key={node.name}
                      className="p-4 rounded-lg bg-muted/20 border border-border/30 hover:border-border/50 transition-all cursor-pointer"
                      onClick={() => setCurrentView("nodes")}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Server className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold truncate flex-1">{node.name}</p>
                      </div>

                      {/* CPU Usage */}
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Cpu className="w-3 h-3" />
                            <span>CPU</span>
                          </div>
                          <span className="font-mono font-medium">{node.cpu_usage}</span>
                        </div>
                        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-foreground/70 transition-all duration-500"
                            style={{ width: `${Math.min(cpuPercent, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{formatCores(node.cpu_usage_cores)}</p>
                      </div>

                      {/* Memory Usage */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MemoryStick className="w-3 h-3" />
                            <span>Memory</span>
                          </div>
                          <span className="font-mono font-medium">{node.memory_usage}</span>
                        </div>
                        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-foreground/70 transition-all duration-500"
                            style={{ width: `${Math.min(memoryPercent, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{formatBytes(node.memory_usage_bytes)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Consumers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top CPU Consumers */}
            <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                  <Zap className="w-4 h-4 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">Top CPU Consumers</h3>
              </div>
              <div className="space-y-2">
                {clusterMetricsData.top_pods_by_cpu.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No pod metrics available
                  </div>
                ) : (
                  clusterMetricsData.top_pods_by_cpu.slice(0, 5).map((pod, idx) => (
                    <div
                      key={`${pod.namespace}-${pod.name}`}
                      className="p-3 rounded-lg bg-muted/20 border border-border/30 hover:border-border/50 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted/40 border border-border/50">
                            <span className="text-xs font-bold text-foreground">{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{pod.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{pod.namespace}</p>
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <p className="text-sm font-bold">{formatCores(pod.cpu_usage_cores)}</p>
                          <p className="text-xs text-muted-foreground">{pod.cpu_usage}</p>
                        </div>
                      </div>
                      {/* Mini usage bar */}
                      <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground/70"
                          style={{
                            width: `${Math.min((pod.cpu_usage_cores / (clusterMetricsData.top_pods_by_cpu[0]?.cpu_usage_cores || 1)) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Memory Consumers */}
            <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                  <Database className="w-4 h-4 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">Top Memory Consumers</h3>
              </div>
              <div className="space-y-2">
                {clusterMetricsData.top_pods_by_memory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No pod metrics available
                  </div>
                ) : (
                  clusterMetricsData.top_pods_by_memory.slice(0, 5).map((pod, idx) => (
                    <div
                      key={`${pod.namespace}-${pod.name}`}
                      className="p-3 rounded-lg bg-muted/20 border border-border/30 hover:border-border/50 transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted/40 border border-border/50">
                            <span className="text-xs font-bold text-foreground">{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{pod.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{pod.namespace}</p>
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <p className="text-sm font-bold">{formatBytes(pod.memory_usage_bytes)}</p>
                          <p className="text-xs text-muted-foreground">{pod.memory_usage}</p>
                        </div>
                      </div>
                      {/* Mini usage bar */}
                      <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground/70"
                          style={{
                            width: `${Math.min((pod.memory_usage_bytes / (clusterMetricsData.top_pods_by_memory[0]?.memory_usage_bytes || 1)) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* No Metrics Available Warning */}
      {!hasAdvancedMetrics && !clusterMetricsLoading && (
        <div className="p-6 rounded-xl border border-border/50 bg-muted/20 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold mb-1">Advanced Metrics Unavailable</h3>
              <p className="text-sm text-muted-foreground">
                {clusterMetricsError
                  ? `Failed to fetch metrics: ${String(clusterMetricsError)}`
                  : "Install metrics-server or Prometheus to view detailed CPU/memory usage and top consumers."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Events */}
        <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Recent Activity</h3>
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
                  className="p-3 rounded-lg bg-muted/20 border border-border/30 hover:border-border/50 transition-all"
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
                    {event.count > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        {event.count}x
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Quick Access</h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Gateways", view: "gateways" as const, icon: Globe },
              { label: "Storage", view: "storage" as const, icon: HardDrive },
              { label: "ConfigMaps", view: "configmaps" as const, icon: Database },
              { label: "RBAC", view: "rbac" as const, icon: Shield },
              { label: "Helm", view: "helm" as const, icon: Layers },
              { label: "CRDs", view: "crds" as const, icon: Server },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.view}
                  onClick={() => setCurrentView(action.view)}
                  className="p-4 rounded-lg border border-border/50 bg-muted/20 hover:border-border/70 hover:bg-muted/30 transition-all duration-200 flex flex-col items-center gap-2 group"
                >
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/30 group-hover:scale-110 transition-transform">
                    <Icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <span className="text-xs font-medium">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
