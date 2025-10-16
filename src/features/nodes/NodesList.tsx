import { useState, useMemo, useEffect } from "react";
import { useNodes, useClusterMetricsData } from "../../hooks/useKube";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/Table";
import { RefreshCw, Search, X, Cpu, MemoryStick, Server, Box, Activity, ExternalLink, HardDrive, Network, Calendar, Code, Ban, CircleSlash, Unplug, Trash2, FileText } from "lucide-react";
import { NodeInfo, NodeMetrics } from "../../types";
import { YamlViewer } from "../../components/YamlViewer";
import { api } from "../../lib/api";
import { useAppStore } from "../../lib/store";

// Utility functions to parse and format resources
const parseMemory = (mem: string): number => {
  // Convert memory to GB
  if (mem.endsWith("Ki")) {
    return parseInt(mem.slice(0, -2)) / (1024 * 1024);
  } else if (mem.endsWith("Mi")) {
    return parseInt(mem.slice(0, -2)) / 1024;
  } else if (mem.endsWith("Gi")) {
    return parseInt(mem.slice(0, -2));
  } else if (mem.endsWith("Ti")) {
    return parseInt(mem.slice(0, -2)) * 1024;
  }
  return parseInt(mem) / (1024 * 1024 * 1024);
};

const formatMemory = (mem: string): string => {
  const gb = parseMemory(mem);
  if (gb >= 1000) {
    return `${(gb / 1024).toFixed(1)} TB`;
  }
  return `${gb.toFixed(1)} GB`;
};

const parseCPU = (cpu: string): number => {
  // Convert CPU to cores
  if (cpu.endsWith("m")) {
    return parseInt(cpu.slice(0, -1)) / 1000;
  }
  return parseInt(cpu);
};

const formatCPU = (cpu: string): string => {
  const cores = parseCPU(cpu);
  if (cores < 1) {
    return `${(cores * 1000).toFixed(0)}m`;
  }
  return `${cores.toFixed(1)} cores`;
};

const calculatePercentage = (allocatable: string, capacity: string, isMemory: boolean = false): number => {
  if (isMemory) {
    const alloc = parseMemory(allocatable);
    const cap = parseMemory(capacity);
    return cap > 0 ? (alloc / cap) * 100 : 0;
  } else {
    const alloc = parseCPU(allocatable);
    const cap = parseCPU(capacity);
    return cap > 0 ? (alloc / cap) * 100 : 0;
  }
};

// Helpers for metrics formatting
const formatBytes = (bytes: number): string => {
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(1)}MB`;
  return `${(bytes / 1024).toFixed(1)}KB`;
};

const formatCoresFromNumber = (cores: number): string => {
  if (cores < 1) return `${Math.round(cores * 1000)}m`;
  return `${cores.toFixed(2)} cores`;
};

interface ResourceBarProps {
  label: string;
  allocatable: string;
  capacity: string;
  isMemory?: boolean;
  icon: React.ReactNode;
}

function ResourceBar({ label, allocatable, capacity, isMemory = false, icon }: ResourceBarProps) {
  const percentage = calculatePercentage(allocatable, capacity, isMemory);
  const allocatableFormatted = isMemory ? formatMemory(allocatable) : formatCPU(allocatable);
  const capacityFormatted = isMemory ? formatMemory(capacity) : formatCPU(capacity);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-mono text-xs">
          {allocatableFormatted} / {capacityFormatted}
        </span>
      </div>
      <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all ${
            percentage > 90
              ? "bg-gradient-to-r from-green-500 to-emerald-500"
              : percentage > 70
              ? "bg-gradient-to-r from-blue-500 to-cyan-500"
              : "bg-gradient-to-r from-slate-500 to-zinc-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground text-right">
        {percentage.toFixed(1)}% allocatable
      </div>
    </div>
  );
}

interface NodeDetailModalProps {
  node: NodeInfo | null;
  nodeMetrics?: NodeMetrics | null;
  onClose: () => void;
  onViewYaml: (node: NodeInfo) => void;
  onViewDescribe: (node: NodeInfo) => void;
}

function NodeDetailModal({ node, nodeMetrics, onClose, onViewYaml, onViewDescribe }: NodeDetailModalProps) {
  const [isOperating, setIsOperating] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  if (!node) return null;

  const getStatusVariant = (status: string): "success" | "destructive" | "secondary" => {
    if (status === "Ready") return "success";
    if (status === "NotReady") return "destructive";
    return "secondary";
  };

  const handleCordon = async () => {
    setIsOperating(true);
    setOperationError(null);
    try {
      await api.cordonNode(node.name);
      onClose(); // Close modal on success to refresh the list
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "Failed to cordon node");
    } finally {
      setIsOperating(false);
    }
  };

  const handleUncordon = async () => {
    setIsOperating(true);
    setOperationError(null);
    try {
      await api.uncordonNode(node.name);
      onClose(); // Close modal on success to refresh the list
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "Failed to uncordon node");
    } finally {
      setIsOperating(false);
    }
  };

  const handleDrain = async () => {
    if (!confirm(`Are you sure you want to drain node "${node.name}"? This will evict all pods from this node.`)) {
      return;
    }
    setIsOperating(true);
    setOperationError(null);
    try {
      await api.drainNode(node.name);
      onClose(); // Close modal on success to refresh the list
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "Failed to drain node");
    } finally {
      setIsOperating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to DELETE node "${node.name}"? This action cannot be undone!`)) {
      return;
    }
    setIsOperating(true);
    setOperationError(null);
    try {
      await api.deleteNode(node.name);
      onClose(); // Close modal on success to refresh the list
    } catch (err) {
      setOperationError(err instanceof Error ? err.message : "Failed to delete node");
    } finally {
      setIsOperating(false);
    }
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 p-6 border-b border-border bg-card/95 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Server className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold">{node.name}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={getStatusVariant(node.status)}>{node.status}</Badge>
                {node.roles.length > 0 ? (
                  node.roles.map((role) => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline">worker</Badge>
                )}
                {node.gpu_capacity && (
                  <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-500">
                    GPU x{node.gpu_capacity}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onViewDescribe(node)}>
                <FileText className="w-4 h-4 mr-2" />
                Describe
              </Button>
              <Button variant="outline" size="sm" onClick={() => onViewYaml(node)}>
                <Code className="w-4 h-4 mr-2" />
                YAML
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Node Operations Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              Node Operations
            </h3>

            {operationError && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/50 text-destructive text-sm">
                {operationError}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                onClick={handleCordon}
                disabled={isOperating}
                className="flex items-center gap-2"
              >
                <Ban className="w-4 h-4" />
                Cordon
              </Button>

              <Button
                variant="outline"
                onClick={handleUncordon}
                disabled={isOperating}
                className="flex items-center gap-2"
              >
                <CircleSlash className="w-4 h-4" />
                Uncordon
              </Button>

              <Button
                variant="outline"
                onClick={handleDrain}
                disabled={isOperating}
                className="flex items-center gap-2 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
              >
                <Unplug className="w-4 h-4" />
                Drain
              </Button>

              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isOperating}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>

          {/* Resource Capacity Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Resource Capacity
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResourceBar
                label="CPU"
                allocatable={node.cpu_allocatable}
                capacity={node.cpu_capacity}
                icon={<Cpu className="w-4 h-4" />}
              />
              <ResourceBar
                label="Memory"
                allocatable={node.memory_allocatable}
                capacity={node.memory_capacity}
                isMemory={true}
                icon={<MemoryStick className="w-4 h-4" />}
              />
            </div>

            {/* Resource Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="w-4 h-4 text-blue-500" />
                  <p className="text-xs font-semibold text-blue-500">CPU Capacity</p>
                </div>
                <p className="text-2xl font-bold">{formatCPU(node.cpu_capacity)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCPU(node.cpu_allocatable)} allocatable
                </p>
              </div>

              <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <MemoryStick className="w-4 h-4 text-purple-500" />
                  <p className="text-xs font-semibold text-purple-500">Memory Capacity</p>
                </div>
                <p className="text-2xl font-bold">{formatMemory(node.memory_capacity)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatMemory(node.memory_allocatable)} allocatable
                </p>
              </div>

              <div className="p-4 rounded-lg bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Box className="w-4 h-4 text-cyan-500" />
                  <p className="text-xs font-semibold text-cyan-500">Pods Capacity</p>
                </div>
                <p className="text-2xl font-bold">{node.pods_capacity}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {node.pods_allocatable} allocatable
                </p>
              </div>

              {node.gpu_capacity && (
                <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="w-4 h-4 text-green-500" />
                    <p className="text-xs font-semibold text-green-500">GPU Capacity</p>
                  </div>
                  <p className="text-2xl font-bold">{node.gpu_capacity}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {node.gpu_capacity === "1" ? "GPU" : "GPUs"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Metrics Section */}
          {nodeMetrics && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Real-time Usage
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CPU Usage */}
                <div className="p-6 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Cpu className="w-5 h-5 text-muted-foreground" />
                    <h4 className="font-semibold">CPU Usage</h4>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-2xl font-bold">{nodeMetrics.cpu_usage}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatCoresFromNumber(nodeMetrics.cpu_usage_cores)}
                        </span>
                      </div>
                      <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground/70 transition-all duration-500"
                          style={{
                            width: `${Math.min((nodeMetrics.cpu_usage_cores / parseCPU(node.cpu_capacity)) * 100, 100)}%`
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                        <span>Current usage</span>
                        <span>
                          {((nodeMetrics.cpu_usage_cores / parseCPU(node.cpu_capacity)) * 100).toFixed(1)}% of capacity
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Memory Usage */}
                <div className="p-6 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2 mb-4">
                    <MemoryStick className="w-5 h-5 text-muted-foreground" />
                    <h4 className="font-semibold">Memory Usage</h4>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-2xl font-bold">{nodeMetrics.memory_usage}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatBytes(nodeMetrics.memory_usage_bytes)}
                        </span>
                      </div>
                      <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground/70 transition-all duration-500"
                          style={{
                            width: `${Math.min((nodeMetrics.memory_usage_bytes / (parseMemory(node.memory_capacity) * 1024 ** 3)) * 100, 100)}%`
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                        <span>Current usage</span>
                        <span>
                          {((nodeMetrics.memory_usage_bytes / (parseMemory(node.memory_capacity) * 1024 ** 3)) * 100).toFixed(1)}% of capacity
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Node Information Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              Node Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">General</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">Kubelet Version</span>
                    <span className="text-sm font-mono">{node.version}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">Age</span>
                    <span className="text-sm font-medium">{node.age}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">Roles</span>
                    <div className="flex gap-1">
                      {node.roles.length > 0 ? (
                        node.roles.map((role) => (
                          <Badge key={role} variant="secondary" className="text-xs">
                            {role}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          worker
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Network className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Network</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">Internal IP</span>
                    <span className="text-sm font-mono">{node.internal_ip}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">External IP</span>
                    <span className="text-sm font-mono">{node.external_ip || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <Badge variant={getStatusVariant(node.status)} className="text-xs">
                      {node.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Information Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary" />
              System Information
            </h3>
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Operating System</p>
                  <p className="text-sm font-medium">{node.os_image}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Kernel Version</p>
                  <p className="text-sm font-mono">{node.kernel_version}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Container Runtime</p>
                  <p className="text-sm font-mono">{node.container_runtime}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Architecture</p>
                  <p className="text-sm font-mono">amd64</p>
                </div>
              </div>
            </div>
          </div>

          {/* Resource Allocation Summary */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Resource Allocation
            </h3>
            <div className="p-4 rounded-lg bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">CPU Allocation</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-mono">{formatCPU(node.cpu_capacity)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Allocatable:</span>
                      <span className="font-mono text-green-600 dark:text-green-400">
                        {formatCPU(node.cpu_allocatable)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">System Reserved:</span>
                      <span className="font-mono text-orange-600 dark:text-orange-400">
                        {formatCPU(
                          (parseCPU(node.cpu_capacity) - parseCPU(node.cpu_allocatable)).toString()
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Memory Allocation</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-mono">{formatMemory(node.memory_capacity)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Allocatable:</span>
                      <span className="font-mono text-green-600 dark:text-green-400">
                        {formatMemory(node.memory_allocatable)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">System Reserved:</span>
                      <span className="font-mono text-orange-600 dark:text-orange-400">
                        {formatMemory(
                          (parseMemory(node.memory_capacity) - parseMemory(node.memory_allocatable))
                            .toFixed(1) + "Gi"
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Pod Allocation</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-mono">{node.pods_capacity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Allocatable:</span>
                      <span className="font-mono text-green-600 dark:text-green-400">
                        {node.pods_allocatable}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">System Reserved:</span>
                      <span className="font-mono text-orange-600 dark:text-orange-400">
                        {parseInt(node.pods_capacity) - parseInt(node.pods_allocatable)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Node Describe Viewer Component
interface NodeDescribeViewerProps {
  nodeName: string;
  onClose: () => void;
}

function NodeDescribeViewer({ nodeName, onClose }: NodeDescribeViewerProps) {
  const theme = useAppStore((state) => state.theme);
  const [description, setDescription] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDescription = async () => {
      setLoading(true);
      setError(null);
      try {
        const desc = await api.describeNode(nodeName);
        setDescription(desc);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch node description");
      } finally {
        setLoading(false);
      }
    };

    fetchDescription();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [nodeName, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-card/95 to-card/90 border border-border/50 rounded-xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col backdrop-blur-xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-gradient-to-r from-background/50 to-background/30">
          <div>
            <h2 className="text-lg font-semibold">Node Description</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono">{nodeName}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-muted/30 to-muted/20">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-destructive text-center">
                <p className="font-semibold mb-2">Error loading description</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && description && (
            <pre className="font-mono text-sm whitespace-pre-wrap break-words">
              {description}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border/50 bg-gradient-to-r from-background/50 to-background/30 text-sm text-muted-foreground">
          <span>{description.split("\n").length} lines</span>
          <span>Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}

export function NodesList() {
  const { data: nodes, isLoading, error, refetch } = useNodes();
  const { data: clusterMetricsData } = useClusterMetricsData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null);
  const [selectedNodeForYaml, setSelectedNodeForYaml] = useState<NodeInfo | null>(null);
  const [selectedNodeForDescribe, setSelectedNodeForDescribe] = useState<NodeInfo | null>(null);

  const getStatusVariant = (status: string): "success" | "destructive" | "secondary" => {
    if (status === "Ready") return "success";
    if (status === "NotReady") return "destructive";
    return "secondary";
  };

  // Helper to get node metrics by name
  const getNodeMetrics = (nodeName: string): NodeMetrics | null => {
    if (!clusterMetricsData?.node_metrics) return null;
    return clusterMetricsData.node_metrics.find(m => m.name === nodeName) || null;
  };

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!nodes) return [];
    if (!searchQuery) return nodes;

    const query = searchQuery.toLowerCase();
    return nodes.filter(
      (node) =>
        node.name.toLowerCase().includes(query) ||
        node.status.toLowerCase().includes(query) ||
        node.version.toLowerCase().includes(query) ||
        node.internal_ip.toLowerCase().includes(query) ||
        node.roles.some((role) => role.toLowerCase().includes(query))
    );
  }, [nodes, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <div
              className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"
              style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
            ></div>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading nodes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-xl border border-destructive/50 bg-gradient-to-br from-destructive/10 to-destructive/5 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-destructive mb-1">Error loading nodes</h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-slate-500 to-zinc-500 rounded-full"></div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                Cluster Nodes
              </h2>
              <Badge variant="secondary" className="ml-2">
                {filteredNodes?.length || 0} {searchQuery && `of ${nodes?.length || 0}`}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, status, role, version, or IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-background/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Nodes Table */}
        {!filteredNodes || filteredNodes.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                <Server className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">No nodes found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? `No nodes found matching "${searchQuery}"` : "No nodes found in cluster"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>Memory</TableHead>
                  <TableHead>Pods</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNodes.map((node) => {
                  const cpuPercent = calculatePercentage(node.cpu_allocatable, node.cpu_capacity, false);
                  const memoryPercent = calculatePercentage(node.memory_allocatable, node.memory_capacity, true);
                  const metrics = getNodeMetrics(node.name);

                  return (
                    <TableRow
                      key={node.name}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedNode(node)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Server className="w-4 h-4 text-muted-foreground" />
                          {node.name}
                          {node.gpu_capacity && (
                            <Badge variant="default" className="ml-2 bg-gradient-to-r from-green-500 to-emerald-500 text-xs">
                              GPU
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(node.status)} className="text-xs">
                          {node.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {node.roles.length > 0 ? (
                            node.roles.map((role) => (
                              <Badge key={role} variant="secondary" className="text-xs">
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              worker
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-[80px]">
                            {metrics ? (
                              <>
                                <div className="text-xs font-medium mb-1">
                                  {metrics.cpu_usage}
                                </div>
                                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden mb-1">
                                  <div
                                    className="h-full bg-foreground/70 rounded-full transition-all"
                                    style={{ width: `${Math.min((metrics.cpu_usage_cores / parseCPU(node.cpu_capacity)) * 100, 100)}%` }}
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatCoresFromNumber(metrics.cpu_usage_cores)} / {formatCPU(node.cpu_capacity)}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-xs text-muted-foreground mb-1">
                                  {formatCPU(node.cpu_allocatable)} / {formatCPU(node.cpu_capacity)}
                                </div>
                                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      cpuPercent > 90
                                        ? "bg-green-500"
                                        : cpuPercent > 70
                                        ? "bg-blue-500"
                                        : "bg-purple-500"
                                    }`}
                                    style={{ width: `${cpuPercent}%` }}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-[80px]">
                            {metrics ? (
                              <>
                                <div className="text-xs font-medium mb-1">
                                  {metrics.memory_usage}
                                </div>
                                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden mb-1">
                                  <div
                                    className="h-full bg-foreground/70 rounded-full transition-all"
                                    style={{ width: `${Math.min((metrics.memory_usage_bytes / (parseMemory(node.memory_capacity) * 1024 ** 3)) * 100, 100)}%` }}
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatBytes(metrics.memory_usage_bytes)} / {formatMemory(node.memory_capacity)}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-xs text-muted-foreground mb-1">
                                  {formatMemory(node.memory_allocatable)} / {formatMemory(node.memory_capacity)}
                                </div>
                                <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      memoryPercent > 90
                                        ? "bg-green-500"
                                        : memoryPercent > 70
                                        ? "bg-blue-500"
                                        : "bg-purple-500"
                                    }`}
                                    style={{ width: `${memoryPercent}%` }}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono">
                          {node.pods_allocatable} / {node.pods_capacity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono">{node.version}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{node.age}</span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(node);
                        }}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedNode && (
        <NodeDetailModal
          node={selectedNode}
          nodeMetrics={getNodeMetrics(selectedNode.name)}
          onClose={() => setSelectedNode(null)}
          onViewYaml={(node) => {
            setSelectedNodeForYaml(node);
            setSelectedNode(null);
          }}
          onViewDescribe={(node) => {
            setSelectedNodeForDescribe(node);
            setSelectedNode(null);
          }}
        />
      )}
      {selectedNodeForYaml && (
        <YamlViewer
          resourceType="node"
          resourceName={selectedNodeForYaml.name}
          namespace=""
          onClose={() => setSelectedNodeForYaml(null)}
        />
      )}
      {selectedNodeForDescribe && (
        <NodeDescribeViewer
          nodeName={selectedNodeForDescribe.name}
          onClose={() => setSelectedNodeForDescribe(null)}
        />
      )}
    </>
  );
}
