import { useDeployments, useScaleDeployment, useDeleteDeployment, useNamespacePodMetrics, usePods } from "../../hooks/useKube";
import { useAppStore, useSettingsStore } from "../../lib/store";
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
import { RefreshCw, Search, X, FileText, RotateCw, Trash2, Code, ScrollText } from "lucide-react";
import { useState, useMemo } from "react";
import { YamlViewer } from "../../components/YamlViewer";
import { ResourceDescribeViewer } from "../../components/ResourceDescribeViewer";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { PodSelectorModal } from "../../components/PodSelectorModal";
import { LogsViewer } from "../logs/LogsViewer";
import { PodInfo, PodMetrics } from "../../types";
import { LoadingSpinner } from "../../components/LoadingSpinner";

export function DeploymentsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const metricsEnabled = useSettingsStore((state) => state.metrics.enabled);
  const { data: deployments, isLoading, error, refetch } = useDeployments(currentNamespace);
  const scaleDeployment = useScaleDeployment();
  const deleteDeployment = useDeleteDeployment();
  const queryClient = useQueryClient();
  const [scalingDeployment, setScalingDeployment] = useState<string | null>(null);
  const [restartingDeployment, setRestartingDeployment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeployment, setSelectedDeployment] = useState<{name: string; namespace: string} | null>(null);
  const [selectedDeploymentForDescribe, setSelectedDeploymentForDescribe] = useState<{name: string; namespace: string} | null>(null);
  const [deploymentToDelete, setDeploymentToDelete] = useState<string | null>(null);
  const [deploymentToScale, setDeploymentToScale] = useState<{
    name: string;
    currentReplicas: number;
  } | null>(null);
  const [newReplicaCount, setNewReplicaCount] = useState("");
  const [deploymentToRestart, setDeploymentToRestart] = useState<string | null>(null);
  const [loadingPodsFor, setLoadingPodsFor] = useState<string | null>(null);
  const [selectedPodsForLogs, setSelectedPodsForLogs] = useState<Array<{name: string; namespace: string}> | null>(null);
  const [selectedPodForLogs, setSelectedPodForLogs] = useState<{name: string; namespace: string} | null>(null);
  const [podsForSelection, setPodsForSelection] = useState<PodInfo[] | null>(null);

  // Fetch pod metrics data for current namespace
  // Convert empty string to undefined for "all namespaces" case
  const { data: podMetrics, isLoading: podMetricsLoading, error: podMetricsError } = useNamespacePodMetrics(currentNamespace || undefined);
  const { data: pods } = usePods(currentNamespace);

  // Check if we have metrics available (and array has data) and metrics are enabled in settings
  const hasAdvancedMetrics = metricsEnabled && !podMetricsLoading && !podMetricsError && podMetrics && podMetrics.length > 0;

  // Helper to get aggregated metrics for a deployment
  const getDeploymentMetrics = (deploymentName: string, deploymentNamespace: string): { cpu: number; memory: number; podCount: number } | null => {
    if (!hasAdvancedMetrics || !podMetrics || !pods) return null;

    // Find all pods belonging to this deployment
    // Pods created by deployments typically have the deployment name as a prefix followed by a hash
    const deploymentPods = pods.filter(pod =>
      pod.name.startsWith(`${deploymentName}-`) && pod.namespace === deploymentNamespace
    );

    if (deploymentPods.length === 0) return null;

    // Aggregate CPU and memory from matching pod metrics
    let totalCpu = 0;
    let totalMemory = 0;
    let metricsCount = 0;

    deploymentPods.forEach(pod => {
      // Find metrics for this pod
      const metric = podMetrics.find(
        m => m.name === pod.name && m.namespace === pod.namespace
      );

      if (metric) {
        totalCpu += metric.cpu_usage_cores;
        totalMemory += metric.memory_usage_bytes;
        metricsCount++;
      }
    });

    return metricsCount > 0 ? { cpu: totalCpu, memory: totalMemory, podCount: deploymentPods.length } : null;
  };

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

  const restartDeploymentMutation = useMutation({
    mutationFn: ({ namespace, deploymentName }: { namespace: string; deploymentName: string }) =>
      api.restartDeployment(namespace, deploymentName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployments", currentNamespace] });
    },
  });

  const handleScale = (deploymentName: string, currentReplicas: number) => {
    setDeploymentToScale({ name: deploymentName, currentReplicas });
    setNewReplicaCount(currentReplicas.toString());
  };

  const confirmScale = () => {
    if (deploymentToScale) {
      const replicas = parseInt(newReplicaCount, 10);
      if (!isNaN(replicas) && replicas >= 0) {
        const deployment = deployments?.find(d => d.name === deploymentToScale.name);
        if (deployment) {
          setScalingDeployment(deploymentToScale.name);
          scaleDeployment.mutate(
            {
              namespace: deployment.namespace,
              deploymentName: deploymentToScale.name,
              replicas,
            },
            {
              onSettled: () => setScalingDeployment(null),
            }
          );
        }
        setDeploymentToScale(null);
        setNewReplicaCount("");
      }
    }
  };

  const cancelScale = () => {
    setDeploymentToScale(null);
    setNewReplicaCount("");
  };

  const handleRestart = (deploymentName: string) => {
    setDeploymentToRestart(deploymentName);
  };

  const confirmRestart = async () => {
    if (deploymentToRestart) {
      const deployment = deployments?.find(d => d.name === deploymentToRestart);
      if (deployment) {
        setRestartingDeployment(deploymentToRestart);
        try {
          await restartDeploymentMutation.mutateAsync({
            namespace: deployment.namespace,
            deploymentName: deploymentToRestart,
          });
        } finally {
          setRestartingDeployment(null);
        }
      }
      setDeploymentToRestart(null);
    }
  };

  const cancelRestart = () => {
    setDeploymentToRestart(null);
  };

  const handleDelete = (deploymentName: string) => {
    setDeploymentToDelete(deploymentName);
  };

  const confirmDelete = () => {
    if (deploymentToDelete) {
      const deployment = deployments?.find(d => d.name === deploymentToDelete);
      if (deployment) {
        deleteDeployment.mutate({
          namespace: deployment.namespace,
          deploymentName: deploymentToDelete,
        });
      }
      setDeploymentToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeploymentToDelete(null);
  };

  const handleViewLogs = async (resourceName: string, resourceNamespace: string) => {
    setLoadingPodsFor(resourceName);
    try {
      const pods = await api.getPodsForResource(
        "deployment",
        resourceName,
        resourceNamespace
      );

      if (pods.length === 0) {
        alert("No pods found for this deployment");
      } else if (pods.length === 1) {
        // Single pod - show logs directly
        setSelectedPodForLogs({ name: pods[0].name, namespace: pods[0].namespace });
      } else {
        // Multiple pods - show pod selector
        setPodsForSelection(pods);
      }
    } catch (error) {
      console.error("Failed to get pods:", error);
      alert(`Failed to get pods: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingPodsFor(null);
    }
  };

  // Filter deployments based on search query
  const filteredDeployments = useMemo(() => {
    if (!deployments) return [];
    if (!searchQuery) return deployments;

    const query = searchQuery.toLowerCase();
    return deployments.filter(deployment =>
      deployment.name.toLowerCase().includes(query) ||
      deployment.ready.toLowerCase().includes(query)
    );
  }, [deployments, searchQuery]);

  if (isLoading) {
    return <LoadingSpinner message="Loading deployments..." />;
  }

  if (error) {
    return (
      <div className="p-8 rounded-xl border border-destructive/50 bg-gradient-to-br from-destructive/10 to-destructive/5 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-destructive mb-1">Error loading deployments</h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!deployments || deployments.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">No deployments found</h3>
            <p className="text-sm text-muted-foreground">
              No deployments found in namespace "{currentNamespace}"
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
              Deployments
            </h2>
            <Badge variant="secondary" className="ml-2">
              {filteredDeployments?.length || 0} {searchQuery && `of ${deployments?.length || 0}`}
            </Badge>
          </div>
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

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or ready status..."
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
            <TableHead>Name</TableHead>
            {showNamespaceColumn && <TableHead>Namespace</TableHead>}
            <TableHead>Ready</TableHead>
            <TableHead>Up-to-date</TableHead>
            <TableHead>Available</TableHead>
            {hasAdvancedMetrics && (
              <>
                <TableHead>CPU</TableHead>
                <TableHead>Memory</TableHead>
              </>
            )}
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredDeployments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                {searchQuery ? `No deployments found matching "${searchQuery}"` : "No deployments found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredDeployments.map((deployment) => {
            const [ready, total] = deployment.ready.split("/").map(Number);
            const metrics = getDeploymentMetrics(deployment.name, deployment.namespace);

            return (
              <TableRow key={deployment.name}>
                <TableCell className="font-medium">{deployment.name}</TableCell>
                {showNamespaceColumn && <TableCell>{deployment.namespace}</TableCell>}
                <TableCell>
                  <Badge variant={ready === total ? "success" : "warning"}>
                    {deployment.ready}
                  </Badge>
                </TableCell>
                <TableCell>{deployment.up_to_date}</TableCell>
                <TableCell>{deployment.available}</TableCell>
                {hasAdvancedMetrics && (
                  <>
                    <TableCell>
                      {metrics ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium">
                            {formatCores(metrics.cpu)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {metrics.podCount} {metrics.podCount === 1 ? 'pod' : 'pods'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {metrics ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium">
                            {formatBytes(metrics.memory)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {metrics.podCount} {metrics.podCount === 1 ? 'pod' : 'pods'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </>
                )}
                <TableCell>{deployment.age}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDeployment({name: deployment.name, namespace: deployment.namespace})}
                      title="View YAML"
                    >
                      <Code className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDeploymentForDescribe({name: deployment.name, namespace: deployment.namespace})}
                      title="Describe"
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewLogs(deployment.name, deployment.namespace)}
                      disabled={loadingPodsFor === deployment.name}
                      title="View logs"
                    >
                      {loadingPodsFor === deployment.name ? (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ScrollText className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestart(deployment.name)}
                      disabled={restartingDeployment === deployment.name}
                    >
                      <RotateCw className={`w-4 h-4 mr-2 ${restartingDeployment === deployment.name ? "animate-spin" : ""}`} />
                      Restart
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScale(deployment.name, total)}
                      disabled={scalingDeployment === deployment.name}
                    >
                      Scale
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(deployment.name)}
                      disabled={deleteDeployment.isPending}
                      title="Delete deployment"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
            })
          )}
        </TableBody>
      </Table>

      {selectedDeployment && (
        <YamlViewer
          resourceType="deployment"
          resourceName={selectedDeployment.name}
          namespace={selectedDeployment.namespace}
          onClose={() => setSelectedDeployment(null)}
        />
      )}

      {selectedDeploymentForDescribe && (
        <ResourceDescribeViewer
          resourceType="deployment"
          name={selectedDeploymentForDescribe.name}
          namespace={selectedDeploymentForDescribe.namespace}
          onClose={() => setSelectedDeploymentForDescribe(null)}
        />
      )}

      {podsForSelection && (
        <PodSelectorModal
          pods={podsForSelection}
          resourceType="deployment"
          resourceName={podsForSelection[0]?.name.split('-')[0] || ''}
          onSelectPod={(podName, namespace) => {
            setSelectedPodForLogs({ name: podName, namespace });
            setPodsForSelection(null);
          }}
          onSelectAllPods={(pods) => {
            setSelectedPodsForLogs(pods);
            setPodsForSelection(null);
          }}
          onClose={() => setPodsForSelection(null)}
        />
      )}

      {selectedPodForLogs && (
        <LogsViewer
          namespace={selectedPodForLogs.namespace}
          podName={selectedPodForLogs.name}
          onClose={() => setSelectedPodForLogs(null)}
        />
      )}

      {selectedPodsForLogs && (
        <LogsViewer
          namespace={selectedPodsForLogs[0].namespace}
          pods={selectedPodsForLogs}
          onClose={() => setSelectedPodsForLogs(null)}
        />
      )}

      {/* Scale Dialog */}
      {deploymentToScale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Scale Deployment</h3>
            <p className="text-muted-foreground mb-4">
              Deployment: <span className="font-mono text-foreground">"{deploymentToScale.name}"</span>
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Replica Count (Current: {deploymentToScale.currentReplicas})
              </label>
              <input
                type="number"
                min="0"
                value={newReplicaCount}
                onChange={(e) => setNewReplicaCount(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                placeholder="Enter new replica count"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelScale}>
                Cancel
              </Button>
              <Button
                onClick={confirmScale}
                disabled={scaleDeployment.isPending || !newReplicaCount || parseInt(newReplicaCount) < 0}
              >
                {scaleDeployment.isPending ? "Scaling..." : "Scale"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Restart Confirmation Dialog */}
      {deploymentToRestart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Restart</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to restart deployment <span className="font-mono text-foreground">"{deploymentToRestart}"</span>? This will trigger a rolling update and recreate all pods.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelRestart}>
                Cancel
              </Button>
              <Button
                onClick={confirmRestart}
                disabled={restartDeploymentMutation.isPending}
              >
                {restartDeploymentMutation.isPending ? "Restarting..." : "Restart"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deploymentToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Deletion</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete deployment <span className="font-mono text-foreground">"{deploymentToDelete}"</span>? This action cannot be undone and will also delete all associated pods.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelDelete}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteDeployment.isPending}
              >
                {deleteDeployment.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
