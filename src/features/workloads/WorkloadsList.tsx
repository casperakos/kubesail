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
} from "../../hooks/useKube";
import { useAppStore } from "../../lib/store";
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
import { RefreshCw, Search, X, FileText, RotateCw, Trash2, Pause, Play } from "lucide-react";
import { YamlViewer } from "../../components/YamlViewer";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

type WorkloadType = "statefulsets" | "daemonsets" | "jobs" | "cronjobs";

export function WorkloadsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const [activeTab, setActiveTab] = useState<WorkloadType>("statefulsets");
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
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
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
            data.map((sts: any) => (
            <TableRow key={sts.name}>
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
              <TableCell>{sts.age}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewYaml({name: sts.name, namespace: sts.namespace})}
                    title="View YAML"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestartStatefulSet(sts.name)}
                    disabled={restartingStatefulSet === sts.name}
                  >
                    <RotateCw className={`w-4 h-4 mr-2 ${restartingStatefulSet === sts.name ? "animate-spin" : ""}`} />
                    Restart
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleScaleStatefulSet(sts.name, sts.replicas)}
                    disabled={scalingStatefulSet === sts.name}
                  >
                    Scale
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteStatefulSet(sts.name)}
                    disabled={deleteStatefulSet.isPending}
                    title="Delete statefulset"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            ))
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
    </>
  );
}

function DaemonSetsTable({ data, isLoading, error, searchQuery, onViewYaml }: any) {
  const daemonsets = data;
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const deleteDaemonSet = useDeleteDaemonSet();
  const queryClient = useQueryClient();
  const [restartingDaemonSet, setRestartingDaemonSet] = useState<string | null>(null);
  const [daemonsetToDelete, setDaemonsetToDelete] = useState<string | null>(null);
  const [daemonsetToRestart, setDaemonsetToRestart] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
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
            data.map((ds: any) => (
            <TableRow key={ds.name}>
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
              <TableCell>{ds.age}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewYaml({name: ds.name, namespace: ds.namespace})}
                    title="View YAML"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestartDaemonSet(ds.name)}
                    disabled={restartingDaemonSet === ds.name}
                  >
                    <RotateCw className={`w-4 h-4 mr-2 ${restartingDaemonSet === ds.name ? "animate-spin" : ""}`} />
                    Restart
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDaemonSet(ds.name)}
                    disabled={deleteDaemonSet.isPending}
                    title="Delete daemonset"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            ))
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
    </>
  );
}

function JobsTable({ data, isLoading, error, searchQuery, onViewYaml }: any) {
  const jobs = data;
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const deleteJob = useDeleteJob();
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
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
            data.map((job: any) => (
            <TableRow key={job.name}>
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
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewYaml({name: job.name, namespace: job.namespace})}
                    title="View YAML"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteJob(job.name)}
                    disabled={deleteJob.isPending}
                    title="Delete job"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            ))
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
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
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
            data.map((cj: any) => (
            <TableRow key={cj.name}>
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
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewYaml({name: cj.name, namespace: cj.namespace})}
                    title="View YAML"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  {cj.suspend ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResumeCronJob(cj.name)}
                      disabled={resumingCronJob === cj.name}
                      title="Resume cronjob"
                    >
                      <Play className={`w-4 h-4 mr-2 ${resumingCronJob === cj.name ? "animate-pulse" : ""}`} />
                      Resume
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuspendCronJob(cj.name)}
                      disabled={suspendingCronJob === cj.name}
                      title="Suspend cronjob"
                    >
                      <Pause className={`w-4 h-4 mr-2 ${suspendingCronJob === cj.name ? "animate-pulse" : ""}`} />
                      Suspend
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCronJob(cj.name)}
                    disabled={deleteCronJob.isPending}
                    title="Delete cronjob"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            ))
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
    </>
  );
}
