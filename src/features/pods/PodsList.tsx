import { useState, useMemo } from "react";
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
import { Trash2, RefreshCw, FileText, Code, Search, X } from "lucide-react";
import { LogsViewer } from "../logs/LogsViewer";
import { YamlViewer } from "../../components/YamlViewer";

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
  const [searchQuery, setSearchQuery] = useState("");

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
    if (window.confirm(`Are you sure you want to delete pod "${podName}"?`)) {
      deletePod.mutate({ namespace: currentNamespace, podName });
    }
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
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                {searchQuery ? `No pods found matching "${searchQuery}"` : "No pods found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredPods.map((pod) => (
            <TableRow key={pod.name}>
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
    </div>
  );
}
