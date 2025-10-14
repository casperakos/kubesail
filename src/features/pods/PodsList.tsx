import { useState, useMemo, useEffect } from "react";
import { usePods, useDeletePod } from "../../hooks/useKube";
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
import { Trash2, RefreshCw, FileText, Code, Search, X, ArrowRightLeft } from "lucide-react";
import { LogsViewer } from "../logs/LogsViewer";
import { YamlViewer } from "../../components/YamlViewer";
import { PortForwardModal } from "../../components/PortForwardModal";

export function PodsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const { data: pods, isLoading, error, refetch } = usePods(currentNamespace);
  const deletePod = useDeletePod();
  const [selectedPodForLogs, setSelectedPodForLogs] = useState<string | null>(
    null
  );
  const [selectedPodForYaml, setSelectedPodForYaml] = useState<string | null>(
    null
  );
  const [selectedPodForPortForward, setSelectedPodForPortForward] = useState<{
    name: string;
    ports: number[];
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [podToDelete, setPodToDelete] = useState<string | null>(null);
  const [selectedPods, setSelectedPods] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

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

  const handleDelete = (podName: string) => {
    console.log("Delete button clicked for pod:", podName);
    setPodToDelete(podName);
  };

  const confirmDelete = () => {
    if (podToDelete) {
      console.log("Confirmed deletion, calling mutate");
      deletePod.mutate({ namespace: currentNamespace, podName: podToDelete });
      setPodToDelete(null);
    }
  };

  const cancelDelete = () => {
    console.log("Deletion cancelled");
    setPodToDelete(null);
  };

  const togglePodSelection = (podName: string) => {
    setSelectedPods(prev => {
      const newSet = new Set(prev);
      if (newSet.has(podName)) {
        newSet.delete(podName);
      } else {
        newSet.add(podName);
      }
      return newSet;
    });
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
    for (const podName of selectedPods) {
      deletePod.mutate({ namespace: currentNamespace, podName });
    }
    setSelectedPods(new Set());
    setShowBulkDeleteConfirm(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading pods...</p>
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
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
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
              <input
                type="checkbox"
                checked={selectedPods.size === filteredPods.length && filteredPods.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 cursor-pointer"
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ready</TableHead>
            <TableHead>Restarts</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Node</TableHead>
            <TableHead>IP</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredPods.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                {searchQuery ? `No pods found matching "${searchQuery}"` : "No pods found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredPods.map((pod) => (
            <TableRow key={pod.name}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selectedPods.has(pod.name)}
                  onChange={() => togglePodSelection(pod.name)}
                  className="w-4 h-4 cursor-pointer"
                />
              </TableCell>
              <TableCell className="font-medium">{pod.name}</TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(pod.status)}>
                  {pod.status}
                </Badge>
              </TableCell>
              <TableCell>{pod.ready}</TableCell>
              <TableCell>{pod.restarts}</TableCell>
              <TableCell>{pod.age}</TableCell>
              <TableCell className="text-muted-foreground">
                {pod.node || "-"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {pod.ip || "-"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {pod.ports && pod.ports.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedPodForPortForward({ name: pod.name, ports: pod.ports })}
                      title={`Port Forward (${pod.ports.join(', ')})`}
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedPodForYaml(pod.name)}
                    title="View YAML"
                  >
                    <Code className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedPodForLogs(pod.name)}
                    title="View logs"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(pod.name)}
                    disabled={deletePod.isPending}
                    title="Delete pod"
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

      {selectedPodForLogs && (
        <LogsViewer
          namespace={currentNamespace}
          podName={selectedPodForLogs}
          onClose={() => setSelectedPodForLogs(null)}
        />
      )}

      {selectedPodForYaml && (
        <YamlViewer
          resourceType="pod"
          resourceName={selectedPodForYaml}
          namespace={currentNamespace}
          onClose={() => setSelectedPodForYaml(null)}
        />
      )}

      {selectedPodForPortForward && (
        <PortForwardModal
          resourceType="pod"
          resourceName={selectedPodForPortForward.name}
          namespace={currentNamespace}
          availablePorts={selectedPodForPortForward.ports}
          onClose={() => setSelectedPodForPortForward(null)}
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
