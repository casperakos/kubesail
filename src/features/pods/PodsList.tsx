import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { usePods, useDeletePod, useNamespacePodMetrics } from "../../hooks/useKube";
import { useAppStore, useSettingsStore } from "../../lib/store";
import { useToastStore } from "../../lib/toastStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Trash2, RefreshCw, FileText, Code, Search, X, ArrowRightLeft, ScrollText, Terminal, MoreVertical } from "lucide-react";
import { ContextMenu, ContextMenuTrigger, type ContextMenuItem } from "../../components/ui/ContextMenu";
import { LogsViewer } from "../logs/LogsViewer";
import { YamlViewer } from "../../components/YamlViewer";
import { ResourceDescribeViewer } from "../../components/ResourceDescribeViewer";
import { PortForwardModal } from "../../components/PortForwardModal";
import { ShellTerminal } from "../../components/ShellTerminal";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import type { PodMetrics, PodInfo } from "../../types";

// Helper functions for formatting
const formatBytes = (bytes: number): string => {
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(1)}MB`;
  return `${(bytes / 1024).toFixed(1)}KB`;
};

const formatCores = (cores: number): string => {
  if (cores < 1) return `${Math.round(cores * 1000)}m`;
  return `${cores.toFixed(2)} cores`;
};

const getStatusVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case "running":
      return "success";
    case "pending":
      return "warning";
    case "failed":
    case "error":
      return "destructive";
    default:
      return "secondary";
  }
};

// Memoized PodRow component to prevent unnecessary re-renders
interface PodRowProps {
  pod: PodInfo;
  metrics: PodMetrics | null;
  showNamespaceColumn: boolean;
  hasAdvancedMetrics: boolean;
  isSelected: boolean;
  isDeleting: boolean;
  onToggleSelection: (podName: string) => void;
  onDelete: (podName: string) => void;
  onPortForward: (pod: { name: string; namespace: string; ports: number[] }) => void;
  onViewYaml: (pod: { name: string; namespace: string }) => void;
  onDescribe: (pod: { name: string; namespace: string }) => void;
  onViewLogs: (pod: { name: string; namespace: string }) => void;
  onShell: (pod: { name: string; namespace: string }) => void;
}

const PodRow = memo(({
  pod,
  metrics,
  showNamespaceColumn,
  hasAdvancedMetrics,
  isSelected,
  isDeleting,
  onToggleSelection,
  onDelete,
  onPortForward,
  onViewYaml,
  onDescribe,
  onViewLogs,
  onShell,
}: PodRowProps) => {
  // Build context menu items for this pod
  const menuItems: ContextMenuItem[] = useMemo(() => [
    ...(pod.ports && pod.ports.length > 0 ? [{
      label: "Port Forward",
      icon: <ArrowRightLeft className="w-4 h-4" />,
      onClick: () => onPortForward({ name: pod.name, namespace: pod.namespace, ports: pod.ports })
    }] : []),
    {
      label: "View YAML",
      icon: <Code className="w-4 h-4" />,
      onClick: () => onViewYaml({ name: pod.name, namespace: pod.namespace })
    },
    {
      label: "Describe",
      icon: <FileText className="w-4 h-4" />,
      onClick: () => onDescribe({ name: pod.name, namespace: pod.namespace })
    },
    {
      label: "View Logs",
      icon: <ScrollText className="w-4 h-4" />,
      onClick: () => onViewLogs({ name: pod.name, namespace: pod.namespace })
    },
    {
      label: "Shell Access",
      icon: <Terminal className="w-4 h-4" />,
      onClick: () => onShell({ name: pod.name, namespace: pod.namespace })
    },
    { separator: true },
    {
      label: "Delete",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => onDelete(pod.name),
      variant: "danger" as const,
      disabled: isDeleting
    }
  ], [pod, onPortForward, onViewYaml, onDescribe, onViewLogs, onShell, onDelete, isDeleting]);

  return (
    <ContextMenuTrigger key={pod.name} items={menuItems}>
      <TableRow>
        <TableCell>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(pod.name)}
            className="w-4 h-4 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        </TableCell>
        <TableCell className="font-medium">{pod.name}</TableCell>
        {showNamespaceColumn && <TableCell>{pod.namespace}</TableCell>}
        <TableCell>
          <Badge variant={getStatusVariant(pod.status)}>
            {pod.status}
          </Badge>
        </TableCell>
        <TableCell>
          {(() => {
            const [ready, total] = pod.ready.split("/").map(Number);
            return (
              <Badge variant={ready === total ? "success" : "warning"}>
                {pod.ready}
              </Badge>
            );
          })()}
        </TableCell>
        <TableCell>{pod.restarts}</TableCell>
        {hasAdvancedMetrics && (
          <>
            <TableCell>
              {metrics ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium">{metrics.cpu_usage}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCores(metrics.cpu_usage_cores)}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              {metrics ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium">{metrics.memory_usage}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(metrics.memory_usage_bytes)}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </TableCell>
          </>
        )}
        <TableCell>{pod.age}</TableCell>
        <TableCell className="text-muted-foreground">
          {pod.node || "-"}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {pod.ip || "-"}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end">
            <ContextMenu items={menuItems}>
              <MoreVertical className="w-4 h-4" />
            </ContextMenu>
          </div>
        </TableCell>
      </TableRow>
    </ContextMenuTrigger>
  );
});

PodRow.displayName = "PodRow";

export function PodsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const podSearchFilter = useAppStore((state) => state.podSearchFilter);
  const setPodSearchFilter = useAppStore((state) => state.setPodSearchFilter);
  const showNamespaceColumn = !currentNamespace;
  const metricsEnabled = useSettingsStore((state) => state.metrics.enabled);
  const { data: pods, isLoading, error, refetch } = usePods(currentNamespace);
  const deletePod = useDeletePod();
  const addToast = useToastStore((state) => state.addToast);

  // Fetch pod metrics data for current namespace
  // Convert empty string to undefined for "all namespaces" case
  const { data: podMetrics, isLoading: podMetricsLoading, error: podMetricsError } = useNamespacePodMetrics(currentNamespace || undefined);

  // Check if we have metrics available (and array has data) and metrics are enabled in settings
  const hasAdvancedMetrics = metricsEnabled && !podMetricsLoading && !podMetricsError && podMetrics && podMetrics.length > 0;

  // Helper to get pod metrics by name and namespace
  const getPodMetrics = useCallback((podName: string, namespace: string): PodMetrics | null => {
    if (!hasAdvancedMetrics || !podMetrics) return null;

    // Find pod metrics by exact name and namespace match
    return podMetrics.find(
      m => m.name === podName && m.namespace === namespace
    ) || null;
  }, [hasAdvancedMetrics, podMetrics]);

  const [selectedPodForLogs, setSelectedPodForLogs] = useState<{name: string; namespace: string} | null>(
    null
  );
  const [selectedPodForYaml, setSelectedPodForYaml] = useState<{name: string; namespace: string} | null>(
    null
  );
  const [selectedPodForDescribe, setSelectedPodForDescribe] = useState<{name: string; namespace: string} | null>(
    null
  );
  const [selectedPodForPortForward, setSelectedPodForPortForward] = useState<{
    name: string;
    namespace: string;
    ports: number[];
  } | null>(null);
  const [selectedPodForShell, setSelectedPodForShell] = useState<{name: string; namespace: string} | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [podToDelete, setPodToDelete] = useState<string | null>(null);
  const [selectedPods, setSelectedPods] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Memoized handlers for pod actions
  const handleTogglePodSelection = useCallback((podName: string) => {
    setSelectedPods(prev => {
      const newSet = new Set(prev);
      if (newSet.has(podName)) {
        newSet.delete(podName);
      } else {
        newSet.add(podName);
      }
      return newSet;
    });
  }, []);

  const handlePortForward = useCallback((pod: { name: string; namespace: string; ports: number[] }) => {
    setSelectedPodForPortForward(pod);
  }, []);

  const handleViewYaml = useCallback((pod: { name: string; namespace: string }) => {
    setSelectedPodForYaml(pod);
  }, []);

  const handleDescribe = useCallback((pod: { name: string; namespace: string }) => {
    setSelectedPodForDescribe(pod);
  }, []);

  const handleViewLogs = useCallback((pod: { name: string; namespace: string }) => {
    setSelectedPodForLogs(pod);
  }, []);

  const handleShell = useCallback((pod: { name: string; namespace: string }) => {
    setSelectedPodForShell(pod);
  }, []);

  const handleDelete = (podName: string) => {
    console.log("Delete button clicked for pod:", podName);
    setPodToDelete(podName);
  };

  const confirmDelete = () => {
    if (podToDelete) {
      console.log("Confirmed deletion, calling mutate");
      const pod = pods?.find(p => p.name === podToDelete);
      if (pod) {
        deletePod.mutate(
          { namespace: pod.namespace, podName: podToDelete },
          {
            onSuccess: () => {
              addToast(`Pod "${podToDelete}" has been deleted`, "success");
            },
            onError: (error) => {
              addToast(`Failed to delete pod: ${error}`, "error");
            },
          }
        );
      }
      setPodToDelete(null);
    }
  };

  const cancelDelete = () => {
    console.log("Deletion cancelled");
    setPodToDelete(null);
  };

  const toggleSelectAll = () => {
    if (selectedPods.size === filteredPods.length && filteredPods.length > 0) {
      setSelectedPods(new Set());
    } else {
      setSelectedPods(new Set(filteredPods.map(pod => pod.name)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedPods.size > 0) {
      setShowBulkDeleteConfirm(true);
    }
  };

  const confirmBulkDelete = async () => {
    console.log("Confirmed bulk deletion for:", Array.from(selectedPods));
    const podCount = selectedPods.size;
    let successCount = 0;
    let errorCount = 0;

    setShowBulkDeleteConfirm(false);

    for (const podName of selectedPods) {
      const pod = pods?.find(p => p.name === podName);
      if (pod) {
        try {
          await deletePod.mutateAsync({ namespace: pod.namespace, podName });
          successCount++;
        } catch (error) {
          console.error(`Failed to delete pod ${podName}:`, error);
          errorCount++;
        }
      }
    }

    // Show final toast after all deletions complete
    if (errorCount === 0) {
      addToast(`${podCount} pod${podCount > 1 ? 's' : ''} have been deleted`, "success");
    } else if (successCount === 0) {
      addToast(`Failed to delete ${podCount} pod${podCount > 1 ? 's' : ''}`, "error");
    } else {
      addToast(`${successCount} pod${successCount > 1 ? 's' : ''} deleted, ${errorCount} failed`, "warning");
    }

    setSelectedPods(new Set());
  };

  const cancelBulkDelete = () => {
    setShowBulkDeleteConfirm(false);
  };

  // Filter pods based on search query
  const filteredPods = useMemo(() => {
    if (!pods) return [];
    if (!searchQuery) return pods;

    const query = searchQuery.toLowerCase();
    return pods.filter(pod =>
      pod.name.toLowerCase().includes(query) ||
      pod.status.toLowerCase().includes(query) ||
      pod.node?.toLowerCase().includes(query) ||
      pod.ip?.toLowerCase().includes(query)
    );
  }, [pods, searchQuery]);

  // Clear selections when namespace changes
  useEffect(() => {
    setSelectedPods(new Set());
  }, [currentNamespace]);

  // Apply search filter from navigation
  useEffect(() => {
    if (podSearchFilter) {
      setSearchQuery(podSearchFilter);
      // Clear the filter after applying it
      setPodSearchFilter(undefined);
    }
  }, [podSearchFilter, setPodSearchFilter]);

  if (isLoading) {
    return <LoadingSpinner message="Loading pods..." />;
  }

  if (error) {
    return (
      <div className="p-8 rounded-xl border border-destructive/50 bg-gradient-to-br from-destructive/10 to-destructive/5 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-destructive mb-1">Error loading pods</h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!pods || pods.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">No pods found</h3>
            <p className="text-sm text-muted-foreground">
              No pods found in namespace "{currentNamespace}"
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with glassmorphism */}
      <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-slate-500 to-zinc-500 rounded-full"></div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Pods
            </h2>
            <Badge variant="secondary" className="ml-2">
              {filteredPods?.length || 0} {searchQuery && `of ${pods?.length || 0}`}
            </Badge>
            {selectedPods.size > 0 && (
              <Badge variant="destructive" className="ml-2">
                {selectedPods.size} selected
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {selectedPods.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={deletePod.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({selectedPods.size})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, status, node, or IP..."
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={selectedPods.size === filteredPods.length && filteredPods.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                />
              </div>
            </TableHead>
            <TableHead>Name</TableHead>
            {showNamespaceColumn && <TableHead>Namespace</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Ready</TableHead>
            <TableHead>Restarts</TableHead>
            {hasAdvancedMetrics && (
              <>
                <TableHead>CPU</TableHead>
                <TableHead>Memory</TableHead>
              </>
            )}
            <TableHead>Age</TableHead>
            <TableHead>Node</TableHead>
            <TableHead>IP</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredPods.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={9 + (showNamespaceColumn ? 1 : 0) + (hasAdvancedMetrics ? 2 : 0)}
                className="text-center py-8 text-muted-foreground"
              >
                {searchQuery ? `No pods found matching "${searchQuery}"` : "No pods found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredPods.map((pod) => (
              <PodRow
                key={pod.name}
                pod={pod}
                metrics={getPodMetrics(pod.name, pod.namespace)}
                showNamespaceColumn={showNamespaceColumn}
                hasAdvancedMetrics={hasAdvancedMetrics}
                isSelected={selectedPods.has(pod.name)}
                isDeleting={deletePod.isPending}
                onToggleSelection={handleTogglePodSelection}
                onDelete={handleDelete}
                onPortForward={handlePortForward}
                onViewYaml={handleViewYaml}
                onDescribe={handleDescribe}
                onViewLogs={handleViewLogs}
                onShell={handleShell}
              />
            ))
          )}
        </TableBody>
      </Table>

      {selectedPodForLogs && (
        <LogsViewer
          namespace={selectedPodForLogs.namespace}
          podName={selectedPodForLogs.name}
          onClose={() => setSelectedPodForLogs(null)}
        />
      )}

      {selectedPodForYaml && (
        <YamlViewer
          resourceType="pod"
          resourceName={selectedPodForYaml.name}
          namespace={selectedPodForYaml.namespace}
          onClose={() => setSelectedPodForYaml(null)}
        />
      )}

      {selectedPodForDescribe && (
        <ResourceDescribeViewer
          resourceType="pod"
          name={selectedPodForDescribe.name}
          namespace={selectedPodForDescribe.namespace}
          onClose={() => setSelectedPodForDescribe(null)}
        />
      )}

      {selectedPodForPortForward && (
        <PortForwardModal
          resourceType="pod"
          resourceName={selectedPodForPortForward.name}
          namespace={selectedPodForPortForward.namespace}
          availablePorts={selectedPodForPortForward.ports}
          onClose={() => setSelectedPodForPortForward(null)}
        />
      )}

      {selectedPodForShell && (
        <ShellTerminal
          podName={selectedPodForShell.name}
          namespace={selectedPodForShell.namespace}
          onClose={() => setSelectedPodForShell(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {podToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Deletion</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete pod <span className="font-mono text-foreground">"{podToDelete}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelDelete}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deletePod.isPending}
              >
                {deletePod.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Bulk Deletion</h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete <span className="font-bold text-foreground">{selectedPods.size}</span> pod{selectedPods.size > 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="max-h-40 overflow-y-auto mb-6 p-3 bg-muted/30 rounded border border-border/50">
              <ul className="text-sm space-y-1">
                {Array.from(selectedPods).map(podName => (
                  <li key={podName} className="font-mono text-foreground">• {podName}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelBulkDelete}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmBulkDelete}
                disabled={deletePod.isPending}
              >
                {deletePod.isPending ? "Deleting..." : `Delete ${selectedPods.size} Pod${selectedPods.size > 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
