import { useState, useMemo } from "react";
import {
  useStatefulSets,
  useDaemonSets,
  useJobs,
  useCronJobs,
  useScaleStatefulSet,
  useRestartStatefulSet,
  useDeleteStatefulSet,
  useRestartDaemonSet,
  useDeleteDaemonSet,
  useDeleteJob,
  useSuspendCronJob,
  useResumeCronJob,
  useDeleteCronJob,
  useNamespacePodMetrics,
  usePods,
} from "../../hooks/useKube";
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
import { RefreshCw, Search, X, FileText, RotateCw, Trash2, Pause, Play, Code, ScrollText, MoreVertical } from "lucide-react";
import { YamlViewer } from "../../components/YamlViewer";
import { ResourceDescribeViewer } from "../../components/ResourceDescribeViewer";
import { ContextMenu, ContextMenuTrigger, type ContextMenuItem } from "../../components/ui/ContextMenu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { PodSelectorModal } from "../../components/PodSelectorModal";
import { LogsViewer } from "../logs/LogsViewer";
import { PodInfo } from "../../types";
import { LoadingSpinner } from "../../components/LoadingSpinner";

type WorkloadType = "statefulsets" | "daemonsets" | "jobs" | "cronjobs";

interface WorkloadsListProps {
  defaultTab?: WorkloadType;
}

export function WorkloadsList({ defaultTab = "statefulsets" }: WorkloadsListProps) {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const [activeTab, setActiveTab] = useState<WorkloadType>(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<{name: string; namespace: string} | null>(null);

  const { data: statefulsets, isLoading: stsLoading, error: stsError, refetch: stsRefetch } =
    useStatefulSets(currentNamespace);
  const { data: daemonsets, isLoading: dsLoading, error: dsError, refetch: dsRefetch } =
    useDaemonSets(currentNamespace);
  const { data: jobs, isLoading: jobsLoading, error: jobsError, refetch: jobsRefetch } =
    useJobs(currentNamespace);
  const { data: cronjobs, isLoading: cjLoading, error: cjError, refetch: cjRefetch } =
    useCronJobs(currentNamespace);

  // Filter StatefulSets based on search query
  const filteredStatefulSets = useMemo(() => {
    if (!statefulsets) return [];
    if (!searchQuery) return statefulsets;
    const query = searchQuery.toLowerCase();
    return statefulsets.filter(sts => sts.name.toLowerCase().includes(query));
  }, [statefulsets, searchQuery]);

  // Filter DaemonSets based on search query
  const filteredDaemonSets = useMemo(() => {
    if (!daemonsets) return [];
    if (!searchQuery) return daemonsets;
    const query = searchQuery.toLowerCase();
    return daemonsets.filter(ds => ds.name.toLowerCase().includes(query));
  }, [daemonsets, searchQuery]);

  // Filter Jobs based on search query
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    if (!searchQuery) return jobs;
    const query = searchQuery.toLowerCase();
    return jobs.filter(job => job.name.toLowerCase().includes(query));
  }, [jobs, searchQuery]);

  // Filter CronJobs based on search query
  const filteredCronJobs = useMemo(() => {
    if (!cronjobs) return [];
    if (!searchQuery) return cronjobs;
    const query = searchQuery.toLowerCase();
    return cronjobs.filter(cj =>
      cj.name.toLowerCase().includes(query) ||
      cj.schedule?.toLowerCase().includes(query)
    );
  }, [cronjobs, searchQuery]);

  const tabs: { value: WorkloadType; label: string; count: number; filteredCount: number }[] = [
    { value: "statefulsets", label: "StatefulSets", count: statefulsets?.length || 0, filteredCount: filteredStatefulSets?.length || 0 },
    { value: "daemonsets", label: "DaemonSets", count: daemonsets?.length || 0, filteredCount: filteredDaemonSets?.length || 0 },
    { value: "jobs", label: "Jobs", count: jobs?.length || 0, filteredCount: filteredJobs?.length || 0 },
    { value: "cronjobs", label: "CronJobs", count: cronjobs?.length || 0, filteredCount: filteredCronJobs?.length || 0 },
  ];

  const handleRefresh = () => {
    switch (activeTab) {
      case "statefulsets":
        stsRefetch();
        break;
      case "daemonsets":
        dsRefetch();
        break;
      case "jobs":
        jobsRefetch();
        break;
      case "cronjobs":
        cjRefetch();
        break;
    }
  };

  const isLoading = stsLoading || dsLoading || jobsLoading || cjLoading;

  const getResourceType = () => {
    switch (activeTab) {
      case "statefulsets":
        return "statefulset";
      case "daemonsets":
        return "daemonset";
      case "jobs":
        return "job";
      case "cronjobs":
        return "cronjob";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-slate-500 to-zinc-500 rounded-full"></div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Workloads
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="flex space-x-1 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <Badge variant="secondary" className="ml-2">
                {searchQuery ? `${tab.filteredCount} of ${tab.count}` : tab.count}
              </Badge>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or schedule..."
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

      {activeTab === "statefulsets" && (
        <StatefulSetsTable
          data={filteredStatefulSets}
          isLoading={stsLoading}
          error={stsError}
          searchQuery={searchQuery}
          onViewYaml={setSelectedResource}
        />
      )}
      {activeTab === "daemonsets" && (
        <DaemonSetsTable
          data={filteredDaemonSets}
          isLoading={dsLoading}
          error={dsError}
          searchQuery={searchQuery}
          onViewYaml={setSelectedResource}
        />
      )}
      {activeTab === "jobs" && (
        <JobsTable
          data={filteredJobs}
          isLoading={jobsLoading}
          error={jobsError}
          searchQuery={searchQuery}
          onViewYaml={setSelectedResource}
        />
      )}
      {activeTab === "cronjobs" && (
        <CronJobsTable
          data={filteredCronJobs}
          isLoading={cjLoading}
          error={cjError}
          searchQuery={searchQuery}
          onViewYaml={setSelectedResource}
        />
      )}

      {selectedResource && (
        <YamlViewer
          resourceType={getResourceType()}
          resourceName={selectedResource.name}
          namespace={selectedResource.namespace}
          onClose={() => setSelectedResource(null)}
        />
      )}
    </div>
  );
}

function StatefulSetsTable({ data, isLoading, error, searchQuery, onViewYaml }: any) {
  const deployments = data;
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const metricsEnabled = useSettingsStore((state) => state.metrics.enabled);
  const scaleStatefulSet = useScaleStatefulSet();
  const deleteStatefulSet = useDeleteStatefulSet();
  const queryClient = useQueryClient();
  const [scalingStatefulSet, setScalingStatefulSet] = useState<string | null>(null);
  const [restartingStatefulSet, setRestartingStatefulSet] = useState<string | null>(null);
  const [statefulsetToDelete, setStatefulsetToDelete] = useState<string | null>(null);
  const [statefulsetToScale, setStatefulsetToScale] = useState<{
    name: string;
    currentReplicas: number;
  } | null>(null);
  const [newReplicaCount, setNewReplicaCount] = useState("");
  const [statefulsetToRestart, setStatefulsetToRestart] = useState<string | null>(null);
  const [loadingPodsFor, setLoadingPodsFor] = useState<string | null>(null);
  const [selectedPodsForLogs, setSelectedPodsForLogs] = useState<Array<{name: string; namespace: string}> | null>(null);
  const [selectedPodForLogs, setSelectedPodForLogs] = useState<{name: string; namespace: string} | null>(null);
  const [podsForSelection, setPodsForSelection] = useState<PodInfo[] | null>(null);
  const [selectedStatefulSetForDescribe, setSelectedStatefulSetForDescribe] = useState<{name: string; namespace: string} | null>(null);

  // Fetch pod metrics data for current namespace
  const { data: podMetrics, isLoading: podMetricsLoading, error: podMetricsError } = useNamespacePodMetrics(currentNamespace || undefined);
  const { data: pods } = usePods(currentNamespace);

  // Check if we have metrics available (and array has data) and metrics are enabled in settings
  const hasAdvancedMetrics = metricsEnabled && !podMetricsLoading && !podMetricsError && podMetrics && podMetrics.length > 0;

  // Helper to get aggregated metrics for a statefulset
  const getStatefulSetMetrics = (statefulsetName: string, statefulsetNamespace: string): { cpu: number; memory: number; podCount: number } | null => {
    if (!hasAdvancedMetrics || !podMetrics || !pods) return null;

    // Find all pods belonging to this statefulset
    // Pods created by statefulsets have the statefulset name as a prefix followed by an index number
    const statefulsetPods = pods.filter(pod =>
      pod.name.startsWith(`${statefulsetName}-`) && pod.namespace === statefulsetNamespace
    );

    if (statefulsetPods.length === 0) return null;

    // Aggregate CPU and memory from matching pod metrics
    let totalCpu = 0;
    let totalMemory = 0;
    let metricsCount = 0;

    statefulsetPods.forEach(pod => {
      const metric = podMetrics.find(
        m => m.name === pod.name && m.namespace === pod.namespace
      );

      if (metric) {
        totalCpu += metric.cpu_usage_cores;
        totalMemory += metric.memory_usage_bytes;
        metricsCount++;
      }
    });

    return metricsCount > 0 ? { cpu: totalCpu, memory: totalMemory, podCount: statefulsetPods.length } : null;
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

  const restartStatefulSetMutation = useMutation({
    mutationFn: ({ namespace, statefulsetName }: { namespace: string; statefulsetName: string }) =>
      api.restartStatefulSet(namespace, statefulsetName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statefulsets", currentNamespace] });
      queryClient.invalidateQueries({ queryKey: ["pods", currentNamespace] });
    },
  });

  const handleScaleStatefulSet = (statefulsetName: string, currentReplicas: number) => {
    setStatefulsetToScale({ name: statefulsetName, currentReplicas });
    setNewReplicaCount(currentReplicas.toString());
  };

  const confirmScaleStatefulSet = () => {
    if (statefulsetToScale) {
      const replicas = parseInt(newReplicaCount, 10);
      if (!isNaN(replicas) && replicas >= 0) {
        const statefulset = deployments?.find((s: any) => s.name === statefulsetToScale.name);
        if (statefulset) {
          setScalingStatefulSet(statefulsetToScale.name);
          scaleStatefulSet.mutate(
            {
              namespace: statefulset.namespace,
              statefulsetName: statefulsetToScale.name,
              replicas,
            },
            {
              onSettled: () => setScalingStatefulSet(null),
            }
          );
        }
        setStatefulsetToScale(null);
        setNewReplicaCount("");
      }
    }
  };

  const cancelScaleStatefulSet = () => {
    setStatefulsetToScale(null);
    setNewReplicaCount("");
  };

  const handleRestartStatefulSet = (statefulsetName: string) => {
    setStatefulsetToRestart(statefulsetName);
  };

  const confirmRestartStatefulSet = async () => {
    if (statefulsetToRestart) {
      const statefulset = deployments?.find((s: any) => s.name === statefulsetToRestart);
      if (statefulset) {
        setRestartingStatefulSet(statefulsetToRestart);
        try {
          await restartStatefulSetMutation.mutateAsync({
            namespace: statefulset.namespace,
            statefulsetName: statefulsetToRestart,
          });
        } finally {
          setRestartingStatefulSet(null);
        }
      }
      setStatefulsetToRestart(null);
    }
  };

  const cancelRestartStatefulSet = () => {
    setStatefulsetToRestart(null);
  };

  const handleDeleteStatefulSet = (statefulsetName: string) => {
    setStatefulsetToDelete(statefulsetName);
  };

  const confirmDeleteStatefulSet = () => {
    if (statefulsetToDelete) {
      const statefulset = deployments?.find((s: any) => s.name === statefulsetToDelete);
      if (statefulset) {
        deleteStatefulSet.mutate({
          namespace: statefulset.namespace,
          statefulsetName: statefulsetToDelete,
        });
      }
      setStatefulsetToDelete(null);
    }
  };

  const cancelDeleteStatefulSet = () => {
    setStatefulsetToDelete(null);
  };

  const handleViewLogs = async (resourceName: string, resourceNamespace: string) => {
    setLoadingPodsFor(resourceName);
    try {
      const pods = await api.getPodsForResource(
        "statefulset",
        resourceName,
        resourceNamespace
      );

      if (pods.length === 0) {
        alert("No pods found for this statefulset");
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

  if (isLoading) {
    return <LoadingSpinner message="Loading statefulsets..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading statefulsets: {error.message}
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {showNamespaceColumn && <TableHead>Namespace</TableHead>}
            <TableHead>Ready</TableHead>
            <TableHead>Replicas</TableHead>
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
          {!data || data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? `No statefulsets found matching "${searchQuery}"`
                  : `No statefulsets found in namespace "${currentNamespace}"`}
              </TableCell>
            </TableRow>
          ) : (
            data.map((sts: any) => {
            const metrics = getStatefulSetMetrics(sts.name, sts.namespace);

            // Build context menu items for this statefulset
            const menuItems: ContextMenuItem[] = [
              {
                label: "View YAML",
                icon: <Code className="w-4 h-4" />,
                onClick: () => onViewYaml({name: sts.name, namespace: sts.namespace})
              },
              {
                label: "Describe",
                icon: <FileText className="w-4 h-4" />,
                onClick: () => setSelectedStatefulSetForDescribe({name: sts.name, namespace: sts.namespace})
              },
              {
                label: "View Logs",
                icon: <ScrollText className="w-4 h-4" />,
                onClick: () => handleViewLogs(sts.name, sts.namespace),
                disabled: loadingPodsFor === sts.name
              },
              {
                label: "Restart",
                icon: <RotateCw className="w-4 h-4" />,
                onClick: () => handleRestartStatefulSet(sts.name),
                disabled: restartingStatefulSet === sts.name
              },
              {
                label: "Scale",
                icon: <RefreshCw className="w-4 h-4" />,
                onClick: () => handleScaleStatefulSet(sts.name, sts.replicas),
                disabled: scalingStatefulSet === sts.name
              },
              { separator: true },
              {
                label: "Delete",
                icon: <Trash2 className="w-4 h-4" />,
                onClick: () => handleDeleteStatefulSet(sts.name),
                variant: "danger" as const,
                disabled: deleteStatefulSet.isPending
              }
            ];

            return (
            <ContextMenuTrigger key={sts.name} items={menuItems}>
              <TableRow>
                <TableCell className="font-medium">{sts.name}</TableCell>
                {showNamespaceColumn && <TableCell>{sts.namespace}</TableCell>}
                <TableCell>
                  <Badge
                    variant={
                      sts.ready === `${sts.replicas}/${sts.replicas}`
                        ? "success"
                        : "warning"
                    }
                  >
                    {sts.ready}
                  </Badge>
                </TableCell>
                <TableCell>{sts.replicas}</TableCell>
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
                <TableCell>{sts.age}</TableCell>
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
            })
          )}
        </TableBody>
      </Table>

      {/* Scale Dialog */}
      {statefulsetToScale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Scale StatefulSet</h3>
            <p className="text-muted-foreground mb-4">
              StatefulSet: <span className="font-mono text-foreground">"{statefulsetToScale.name}"</span>
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Replica Count (Current: {statefulsetToScale.currentReplicas})
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
              <Button variant="outline" onClick={cancelScaleStatefulSet}>
                Cancel
              </Button>
              <Button
                onClick={confirmScaleStatefulSet}
                disabled={scaleStatefulSet.isPending || !newReplicaCount || parseInt(newReplicaCount) < 0}
              >
                {scaleStatefulSet.isPending ? "Scaling..." : "Scale"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Restart Confirmation Dialog */}
      {statefulsetToRestart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Restart</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to restart statefulset <span className="font-mono text-foreground">"{statefulsetToRestart}"</span>? This will trigger a rolling update and recreate all pods.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelRestartStatefulSet}>
                Cancel
              </Button>
              <Button
                onClick={confirmRestartStatefulSet}
                disabled={restartStatefulSetMutation.isPending}
              >
                {restartStatefulSetMutation.isPending ? "Restarting..." : "Restart"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {statefulsetToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Deletion</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete statefulset <span className="font-mono text-foreground">"{statefulsetToDelete}"</span>? This action cannot be undone and will also delete all associated pods.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelDeleteStatefulSet}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteStatefulSet}
                disabled={deleteStatefulSet.isPending}
              >
                {deleteStatefulSet.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {podsForSelection && (
        <PodSelectorModal
          pods={podsForSelection}
          resourceType="statefulset"
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

      {selectedStatefulSetForDescribe && (
        <ResourceDescribeViewer
          resourceType="statefulset"
          name={selectedStatefulSetForDescribe.name}
          namespace={selectedStatefulSetForDescribe.namespace}
          onClose={() => setSelectedStatefulSetForDescribe(null)}
        />
      )}
    </>
  );
}

function DaemonSetsTable({ data, isLoading, error, searchQuery, onViewYaml }: any) {
  const daemonsets = data;
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const metricsEnabled = useSettingsStore((state) => state.metrics.enabled);
  const deleteDaemonSet = useDeleteDaemonSet();
  const queryClient = useQueryClient();
  const [restartingDaemonSet, setRestartingDaemonSet] = useState<string | null>(null);
  const [daemonsetToDelete, setDaemonsetToDelete] = useState<string | null>(null);
  const [daemonsetToRestart, setDaemonsetToRestart] = useState<string | null>(null);
  const [loadingPodsForDS, setLoadingPodsForDS] = useState<string | null>(null);
  const [selectedPodsForLogsDS, setSelectedPodsForLogsDS] = useState<Array<{name: string; namespace: string}> | null>(null);
  const [selectedPodForLogsDS, setSelectedPodForLogsDS] = useState<{name: string; namespace: string} | null>(null);
  const [podsForSelectionDS, setPodsForSelectionDS] = useState<PodInfo[] | null>(null);
  const [selectedDaemonSetForDescribe, setSelectedDaemonSetForDescribe] = useState<{name: string; namespace: string} | null>(null);

  // Fetch pod metrics data for current namespace
  const { data: podMetrics, isLoading: podMetricsLoading, error: podMetricsError } = useNamespacePodMetrics(currentNamespace || undefined);
  const { data: pods } = usePods(currentNamespace);

  // Check if we have metrics available (and array has data) and metrics are enabled in settings
  const hasAdvancedMetrics = metricsEnabled && !podMetricsLoading && !podMetricsError && podMetrics && podMetrics.length > 0;

  // Helper to get aggregated metrics for a daemonset
  const getDaemonSetMetrics = (daemonsetName: string, daemonsetNamespace: string): { cpu: number; memory: number; podCount: number } | null => {
    if (!hasAdvancedMetrics || !podMetrics || !pods) return null;

    // Find all pods belonging to this daemonset
    // Pods created by daemonsets have the daemonset name as a prefix followed by a hash
    const daemonsetPods = pods.filter(pod =>
      pod.name.startsWith(`${daemonsetName}-`) && pod.namespace === daemonsetNamespace
    );

    if (daemonsetPods.length === 0) return null;

    // Aggregate CPU and memory from matching pod metrics
    let totalCpu = 0;
    let totalMemory = 0;
    let metricsCount = 0;

    daemonsetPods.forEach(pod => {
      const metric = podMetrics.find(
        m => m.name === pod.name && m.namespace === pod.namespace
      );

      if (metric) {
        totalCpu += metric.cpu_usage_cores;
        totalMemory += metric.memory_usage_bytes;
        metricsCount++;
      }
    });

    return metricsCount > 0 ? { cpu: totalCpu, memory: totalMemory, podCount: daemonsetPods.length } : null;
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

  const restartDaemonSetMutation = useMutation({
    mutationFn: ({ namespace, daemonsetName }: { namespace: string; daemonsetName: string }) =>
      api.restartDaemonSet(namespace, daemonsetName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daemonsets", currentNamespace] });
      queryClient.invalidateQueries({ queryKey: ["pods", currentNamespace] });
    },
  });

  const handleRestartDaemonSet = (daemonsetName: string) => {
    setDaemonsetToRestart(daemonsetName);
  };

  const confirmRestartDaemonSet = async () => {
    if (daemonsetToRestart) {
      const daemonset = daemonsets?.find((ds: any) => ds.name === daemonsetToRestart);
      if (daemonset) {
        setRestartingDaemonSet(daemonsetToRestart);
        try {
          await restartDaemonSetMutation.mutateAsync({
            namespace: daemonset.namespace,
            daemonsetName: daemonsetToRestart,
          });
        } finally {
          setRestartingDaemonSet(null);
        }
      }
      setDaemonsetToRestart(null);
    }
  };

  const cancelRestartDaemonSet = () => {
    setDaemonsetToRestart(null);
  };

  const handleDeleteDaemonSet = (daemonsetName: string) => {
    setDaemonsetToDelete(daemonsetName);
  };

  const confirmDeleteDaemonSet = () => {
    if (daemonsetToDelete) {
      const daemonset = daemonsets?.find((ds: any) => ds.name === daemonsetToDelete);
      if (daemonset) {
        deleteDaemonSet.mutate({
          namespace: daemonset.namespace,
          daemonsetName: daemonsetToDelete,
        });
      }
      setDaemonsetToDelete(null);
    }
  };

  const cancelDeleteDaemonSet = () => {
    setDaemonsetToDelete(null);
  };

  const handleViewLogsDaemonSet = async (resourceName: string, resourceNamespace: string) => {
    setLoadingPodsForDS(resourceName);
    try {
      const pods = await api.getPodsForResource(
        "daemonset",
        resourceName,
        resourceNamespace
      );

      if (pods.length === 0) {
        alert("No pods found for this daemonset");
      } else if (pods.length === 1) {
        // Single pod - show logs directly
        setSelectedPodForLogsDS({ name: pods[0].name, namespace: pods[0].namespace });
      } else {
        // Multiple pods - show pod selector
        setPodsForSelectionDS(pods);
      }
    } catch (error) {
      console.error("Failed to get pods:", error);
      alert(`Failed to get pods: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingPodsForDS(null);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading daemonsets..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading daemonsets: {error.message}
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {showNamespaceColumn && <TableHead>Namespace</TableHead>}
            <TableHead>Desired</TableHead>
            <TableHead>Current</TableHead>
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
          {!data || data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? `No daemonsets found matching "${searchQuery}"`
                  : `No daemonsets found in namespace "${currentNamespace}"`}
              </TableCell>
            </TableRow>
          ) : (
            data.map((ds: any) => {
            const metrics = getDaemonSetMetrics(ds.name, ds.namespace);

            // Build context menu items for this daemonset
            const menuItems: ContextMenuItem[] = [
              {
                label: "View YAML",
                icon: <Code className="w-4 h-4" />,
                onClick: () => onViewYaml({name: ds.name, namespace: ds.namespace})
              },
              {
                label: "Describe",
                icon: <FileText className="w-4 h-4" />,
                onClick: () => setSelectedDaemonSetForDescribe({name: ds.name, namespace: ds.namespace})
              },
              {
                label: "View Logs",
                icon: <ScrollText className="w-4 h-4" />,
                onClick: () => handleViewLogsDaemonSet(ds.name, ds.namespace),
                disabled: loadingPodsForDS === ds.name
              },
              {
                label: "Restart",
                icon: <RotateCw className="w-4 h-4" />,
                onClick: () => handleRestartDaemonSet(ds.name),
                disabled: restartingDaemonSet === ds.name
              },
              { separator: true },
              {
                label: "Delete",
                icon: <Trash2 className="w-4 h-4" />,
                onClick: () => handleDeleteDaemonSet(ds.name),
                variant: "danger" as const,
                disabled: deleteDaemonSet.isPending
              }
            ];

            return (
            <ContextMenuTrigger key={ds.name} items={menuItems}>
              <TableRow>
                <TableCell className="font-medium">{ds.name}</TableCell>
                {showNamespaceColumn && <TableCell>{ds.namespace}</TableCell>}
                <TableCell>{ds.desired}</TableCell>
                <TableCell>{ds.current}</TableCell>
                <TableCell>
                  <Badge variant={ds.ready === ds.desired ? "success" : "warning"}>
                    {ds.ready}
                  </Badge>
                </TableCell>
                <TableCell>{ds.up_to_date}</TableCell>
                <TableCell>{ds.available}</TableCell>
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
                <TableCell>{ds.age}</TableCell>
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
            })
          )}
        </TableBody>
      </Table>

      {/* Restart Confirmation Dialog */}
      {daemonsetToRestart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Restart</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to restart daemonset <span className="font-mono text-foreground">"{daemonsetToRestart}"</span>? This will trigger a rolling update and recreate all pods.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelRestartDaemonSet}>
                Cancel
              </Button>
              <Button
                onClick={confirmRestartDaemonSet}
                disabled={restartDaemonSetMutation.isPending}
              >
                {restartDaemonSetMutation.isPending ? "Restarting..." : "Restart"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {daemonsetToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Deletion</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete daemonset <span className="font-mono text-foreground">"{daemonsetToDelete}"</span>? This action cannot be undone and will also delete all associated pods.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelDeleteDaemonSet}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteDaemonSet}
                disabled={deleteDaemonSet.isPending}
              >
                {deleteDaemonSet.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {podsForSelectionDS && (
        <PodSelectorModal
          pods={podsForSelectionDS}
          resourceType="daemonset"
          resourceName={podsForSelectionDS[0]?.name.split('-')[0] || ''}
          onSelectPod={(podName, namespace) => {
            setSelectedPodForLogsDS({ name: podName, namespace });
            setPodsForSelectionDS(null);
          }}
          onSelectAllPods={(pods) => {
            setSelectedPodsForLogsDS(pods);
            setPodsForSelectionDS(null);
          }}
          onClose={() => setPodsForSelectionDS(null)}
        />
      )}

      {selectedPodForLogsDS && (
        <LogsViewer
          namespace={selectedPodForLogsDS.namespace}
          podName={selectedPodForLogsDS.name}
          onClose={() => setSelectedPodForLogsDS(null)}
        />
      )}

      {selectedPodsForLogsDS && (
        <LogsViewer
          namespace={selectedPodsForLogsDS[0].namespace}
          pods={selectedPodsForLogsDS}
          onClose={() => setSelectedPodsForLogsDS(null)}
        />
      )}

      {selectedDaemonSetForDescribe && (
        <ResourceDescribeViewer
          resourceType="daemonset"
          name={selectedDaemonSetForDescribe.name}
          namespace={selectedDaemonSetForDescribe.namespace}
          onClose={() => setSelectedDaemonSetForDescribe(null)}
        />
      )}
    </>
  );
}

function JobsTable({ data, isLoading, error, searchQuery, onViewYaml }: any) {
  const jobs = data;
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const deleteJob = useDeleteJob();
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [loadingPodsForJob, setLoadingPodsForJob] = useState<string | null>(null);
  const [selectedPodsForLogsJob, setSelectedPodsForLogsJob] = useState<Array<{name: string; namespace: string}> | null>(null);
  const [selectedPodForLogsJob, setSelectedPodForLogsJob] = useState<{name: string; namespace: string} | null>(null);
  const [podsForSelectionJob, setPodsForSelectionJob] = useState<PodInfo[] | null>(null);
  const [selectedJobForDescribe, setSelectedJobForDescribe] = useState<{name: string; namespace: string} | null>(null);

  const handleDeleteJob = (jobName: string) => {
    setJobToDelete(jobName);
  };

  const confirmDeleteJob = () => {
    if (jobToDelete) {
      const job = jobs?.find((j: any) => j.name === jobToDelete);
      if (job) {
        deleteJob.mutate({
          namespace: job.namespace,
          jobName: jobToDelete,
        });
      }
      setJobToDelete(null);
    }
  };

  const cancelDeleteJob = () => {
    setJobToDelete(null);
  };

  const handleViewLogsJob = async (resourceName: string, resourceNamespace: string) => {
    setLoadingPodsForJob(resourceName);
    try {
      const pods = await api.getPodsForResource(
        "job",
        resourceName,
        resourceNamespace
      );

      if (pods.length === 0) {
        alert("No pods found for this job");
      } else if (pods.length === 1) {
        // Single pod - show logs directly
        setSelectedPodForLogsJob({ name: pods[0].name, namespace: pods[0].namespace });
      } else {
        // Multiple pods - show pod selector
        setPodsForSelectionJob(pods);
      }
    } catch (error) {
      console.error("Failed to get pods:", error);
      alert(`Failed to get pods: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoadingPodsForJob(null);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading jobs..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">Error loading jobs: {error.message}</div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {showNamespaceColumn && <TableHead>Namespace</TableHead>}
            <TableHead>Completions</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Succeeded</TableHead>
            <TableHead>Failed</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!data || data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? `No jobs found matching "${searchQuery}"`
                  : `No jobs found in namespace "${currentNamespace}"`}
              </TableCell>
            </TableRow>
          ) : (
            data.map((job: any) => {
              // Build context menu items for this job
              const menuItems: ContextMenuItem[] = [
                {
                  label: "View YAML",
                  icon: <Code className="w-4 h-4" />,
                  onClick: () => onViewYaml({name: job.name, namespace: job.namespace})
                },
                {
                  label: "Describe",
                  icon: <FileText className="w-4 h-4" />,
                  onClick: () => setSelectedJobForDescribe({name: job.name, namespace: job.namespace})
                },
                {
                  label: "View Logs",
                  icon: <ScrollText className="w-4 h-4" />,
                  onClick: () => handleViewLogsJob(job.name, job.namespace),
                  disabled: loadingPodsForJob === job.name
                },
                { separator: true },
                {
                  label: "Delete",
                  icon: <Trash2 className="w-4 h-4" />,
                  onClick: () => handleDeleteJob(job.name),
                  variant: "danger" as const,
                  disabled: deleteJob.isPending
                }
              ];

              return (
                <ContextMenuTrigger key={job.name} items={menuItems}>
                  <TableRow>
                    <TableCell className="font-medium">{job.name}</TableCell>
                    {showNamespaceColumn && <TableCell>{job.namespace}</TableCell>}
                    <TableCell>{job.completions}</TableCell>
                    <TableCell>
                      {job.active > 0 && (
                        <Badge variant="warning">{job.active}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.succeeded > 0 && (
                        <Badge variant="success">{job.succeeded}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {job.failed > 0 && (
                        <Badge variant="destructive">{job.failed}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{job.duration}</TableCell>
                    <TableCell>{job.age}</TableCell>
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
            })
          )}
        </TableBody>
      </Table>

      {/* Delete Confirmation Dialog */}
      {jobToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Deletion</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete job <span className="font-mono text-foreground">"{jobToDelete}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelDeleteJob}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteJob}
                disabled={deleteJob.isPending}
              >
                {deleteJob.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {podsForSelectionJob && (
        <PodSelectorModal
          pods={podsForSelectionJob}
          resourceType="job"
          resourceName={podsForSelectionJob[0]?.name.split('-')[0] || ''}
          onSelectPod={(podName, namespace) => {
            setSelectedPodForLogsJob({ name: podName, namespace });
            setPodsForSelectionJob(null);
          }}
          onSelectAllPods={(pods) => {
            setSelectedPodsForLogsJob(pods);
            setPodsForSelectionJob(null);
          }}
          onClose={() => setPodsForSelectionJob(null)}
        />
      )}

      {selectedPodForLogsJob && (
        <LogsViewer
          namespace={selectedPodForLogsJob.namespace}
          podName={selectedPodForLogsJob.name}
          onClose={() => setSelectedPodForLogsJob(null)}
        />
      )}

      {selectedPodsForLogsJob && (
        <LogsViewer
          namespace={selectedPodsForLogsJob[0].namespace}
          pods={selectedPodsForLogsJob}
          onClose={() => setSelectedPodsForLogsJob(null)}
        />
      )}

      {selectedJobForDescribe && (
        <ResourceDescribeViewer
          resourceType="job"
          name={selectedJobForDescribe.name}
          namespace={selectedJobForDescribe.namespace}
          onClose={() => setSelectedJobForDescribe(null)}
        />
      )}
    </>
  );
}

function CronJobsTable({ data, isLoading, error, searchQuery, onViewYaml }: any) {
  const cronjobs = data;
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const suspendCronJob = useSuspendCronJob();
  const resumeCronJob = useResumeCronJob();
  const deleteCronJob = useDeleteCronJob();
  const [suspendingCronJob, setSuspendingCronJob] = useState<string | null>(null);
  const [resumingCronJob, setResumingCronJob] = useState<string | null>(null);
  const [cronjobToDelete, setCronjobToDelete] = useState<string | null>(null);
  const [cronjobToSuspend, setCronjobToSuspend] = useState<string | null>(null);
  const [cronjobToResume, setCronjobToResume] = useState<string | null>(null);
  const [selectedCronJobForDescribe, setSelectedCronJobForDescribe] = useState<{name: string; namespace: string} | null>(null);

  const handleSuspendCronJob = (cronjobName: string) => {
    setCronjobToSuspend(cronjobName);
  };

  const confirmSuspendCronJob = async () => {
    if (cronjobToSuspend) {
      const cronjob = cronjobs?.find((cj: any) => cj.name === cronjobToSuspend);
      if (cronjob) {
        setSuspendingCronJob(cronjobToSuspend);
        try {
          await suspendCronJob.mutateAsync({
            namespace: cronjob.namespace,
            cronjobName: cronjobToSuspend,
          });
        } finally {
          setSuspendingCronJob(null);
        }
      }
      setCronjobToSuspend(null);
    }
  };

  const cancelSuspendCronJob = () => {
    setCronjobToSuspend(null);
  };

  const handleResumeCronJob = (cronjobName: string) => {
    setCronjobToResume(cronjobName);
  };

  const confirmResumeCronJob = async () => {
    if (cronjobToResume) {
      const cronjob = cronjobs?.find((cj: any) => cj.name === cronjobToResume);
      if (cronjob) {
        setResumingCronJob(cronjobToResume);
        try {
          await resumeCronJob.mutateAsync({
            namespace: cronjob.namespace,
            cronjobName: cronjobToResume,
          });
        } finally {
          setResumingCronJob(null);
        }
      }
      setCronjobToResume(null);
    }
  };

  const cancelResumeCronJob = () => {
    setCronjobToResume(null);
  };

  const handleDeleteCronJob = (cronjobName: string) => {
    setCronjobToDelete(cronjobName);
  };

  const confirmDeleteCronJob = () => {
    if (cronjobToDelete) {
      const cronjob = cronjobs?.find((cj: any) => cj.name === cronjobToDelete);
      if (cronjob) {
        deleteCronJob.mutate({
          namespace: cronjob.namespace,
          cronjobName: cronjobToDelete,
        });
      }
      setCronjobToDelete(null);
    }
  };

  const cancelDeleteCronJob = () => {
    setCronjobToDelete(null);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading cronjobs..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading cronjobs: {error.message}
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {showNamespaceColumn && <TableHead>Namespace</TableHead>}
            <TableHead>Schedule</TableHead>
            <TableHead>Suspended</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Last Schedule</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!data || data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? `No cronjobs found matching "${searchQuery}"`
                  : `No cronjobs found in namespace "${currentNamespace}"`}
              </TableCell>
            </TableRow>
          ) : (
            data.map((cj: any) => {
              // Build context menu items for this cronjob
              const menuItems: ContextMenuItem[] = [
                {
                  label: "View YAML",
                  icon: <Code className="w-4 h-4" />,
                  onClick: () => onViewYaml({name: cj.name, namespace: cj.namespace})
                },
                {
                  label: "Describe",
                  icon: <FileText className="w-4 h-4" />,
                  onClick: () => setSelectedCronJobForDescribe({name: cj.name, namespace: cj.namespace})
                },
                ...(cj.suspend ? [{
                  label: "Resume",
                  icon: <Play className="w-4 h-4" />,
                  onClick: () => handleResumeCronJob(cj.name),
                  disabled: resumingCronJob === cj.name
                }] : [{
                  label: "Suspend",
                  icon: <Pause className="w-4 h-4" />,
                  onClick: () => handleSuspendCronJob(cj.name),
                  disabled: suspendingCronJob === cj.name
                }]),
                { separator: true },
                {
                  label: "Delete",
                  icon: <Trash2 className="w-4 h-4" />,
                  onClick: () => handleDeleteCronJob(cj.name),
                  variant: "danger" as const,
                  disabled: deleteCronJob.isPending
                }
              ];

              return (
                <ContextMenuTrigger key={cj.name} items={menuItems}>
                  <TableRow>
                    <TableCell className="font-medium">{cj.name}</TableCell>
                    {showNamespaceColumn && <TableCell>{cj.namespace}</TableCell>}
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {cj.schedule}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cj.suspend ? "warning" : "success"}>
                        {cj.suspend ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cj.active > 0 && <Badge variant="success">{cj.active}</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {cj.last_schedule || "Never"}
                    </TableCell>
                    <TableCell>{cj.age}</TableCell>
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
            })
          )}
        </TableBody>
      </Table>

      {/* Suspend Confirmation Dialog */}
      {cronjobToSuspend && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Suspend</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to suspend cronjob <span className="font-mono text-foreground">"{cronjobToSuspend}"</span>? This will prevent new job executions until resumed.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelSuspendCronJob}>
                Cancel
              </Button>
              <Button
                onClick={confirmSuspendCronJob}
                disabled={suspendCronJob.isPending}
              >
                {suspendCronJob.isPending ? "Suspending..." : "Suspend"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Confirmation Dialog */}
      {cronjobToResume && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Resume</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to resume cronjob <span className="font-mono text-foreground">"{cronjobToResume}"</span>? This will allow new job executions according to the schedule.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelResumeCronJob}>
                Cancel
              </Button>
              <Button
                onClick={confirmResumeCronJob}
                disabled={resumeCronJob.isPending}
              >
                {resumeCronJob.isPending ? "Resuming..." : "Resume"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {cronjobToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Deletion</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete cronjob <span className="font-mono text-foreground">"{cronjobToDelete}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelDeleteCronJob}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteCronJob}
                disabled={deleteCronJob.isPending}
              >
                {deleteCronJob.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedCronJobForDescribe && (
        <ResourceDescribeViewer
          resourceType="cronjob"
          name={selectedCronJobForDescribe.name}
          namespace={selectedCronJobForDescribe.namespace}
          onClose={() => setSelectedCronJobForDescribe(null)}
        />
      )}
    </>
  );
}
