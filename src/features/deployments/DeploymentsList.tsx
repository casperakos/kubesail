import { useDeployments, useScaleDeployment, useDeleteDeployment } from "../../hooks/useKube";
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
import { RefreshCw, Search, X, FileText, RotateCw, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { YamlViewer } from "../../components/YamlViewer";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

export function DeploymentsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const { data: deployments, isLoading, error, refetch } = useDeployments(currentNamespace);
  const scaleDeployment = useScaleDeployment();
  const deleteDeployment = useDeleteDeployment();
  const queryClient = useQueryClient();
  const [scalingDeployment, setScalingDeployment] = useState<string | null>(null);
  const [restartingDeployment, setRestartingDeployment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  const [deploymentToDelete, setDeploymentToDelete] = useState<string | null>(null);
  const [deploymentToScale, setDeploymentToScale] = useState<{
    name: string;
    currentReplicas: number;
  } | null>(null);
  const [newReplicaCount, setNewReplicaCount] = useState("");
  const [deploymentToRestart, setDeploymentToRestart] = useState<string | null>(null);

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
        setScalingDeployment(deploymentToScale.name);
        scaleDeployment.mutate(
          {
            namespace: currentNamespace,
            deploymentName: deploymentToScale.name,
            replicas,
          },
          {
            onSettled: () => setScalingDeployment(null),
          }
        );
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
      setRestartingDeployment(deploymentToRestart);
      try {
        await restartDeploymentMutation.mutateAsync({
          namespace: currentNamespace,
          deploymentName: deploymentToRestart,
        });
      } finally {
        setRestartingDeployment(null);
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
      deleteDeployment.mutate({
        namespace: currentNamespace,
        deploymentName: deploymentToDelete,
      });
      setDeploymentToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeploymentToDelete(null);
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
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading deployments...</p>
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
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
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
            return (
              <TableRow key={deployment.name}>
                <TableCell className="font-medium">{deployment.name}</TableCell>
                {showNamespaceColumn && <TableCell>{deployment.namespace}</TableCell>}
                <TableCell>
                  <span className={ready === total ? "text-green-500" : "text-yellow-500"}>
                    {deployment.ready}
                  </span>
                </TableCell>
                <TableCell>{deployment.up_to_date}</TableCell>
                <TableCell>{deployment.available}</TableCell>
                <TableCell>{deployment.age}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDeployment(deployment.name)}
                      title="View YAML"
                    >
                      <FileText className="w-4 h-4" />
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
          resourceName={selectedDeployment}
          namespace={currentNamespace}
          onClose={() => setSelectedDeployment(null)}
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
