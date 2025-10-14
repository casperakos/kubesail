import { useState } from "react";
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
import { Trash2, RefreshCw, FileText, Code } from "lucide-react";
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
        Error loading pods: {error.message}
      </div>
    );
  }

  if (!pods || pods.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No pods found in namespace "{currentNamespace}"
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Pods</h2>
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
          {pods.map((pod) => (
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
          ))}
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
