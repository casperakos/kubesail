import { useNodes } from "../../hooks/useKube";
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
import { RefreshCw } from "lucide-react";

export function NodesList() {
  const { data: nodes, isLoading, error, refetch } = useNodes();

  const getStatusVariant = (status: string) => {
    if (status === "Ready") return "success";
    if (status === "NotReady") return "destructive";
    return "secondary";
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
        Error loading nodes: {error.message}
      </div>
    );
  }

  if (!nodes || nodes.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No nodes found in cluster
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Nodes</h2>
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

      <div className="grid gap-4">
        {nodes.map((node) => (
          <div
            key={node.name}
            className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold">{node.name}</h3>
                <div className="flex gap-2 mt-2">
                  <Badge variant={getStatusVariant(node.status)}>
                    {node.status}
                  </Badge>
                  {node.roles.map((role) => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
              <span className="text-sm text-muted-foreground">{node.age}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-border">
              <div>
                <p className="text-sm text-muted-foreground">Kubelet Version</p>
                <p className="text-sm font-mono">{node.version}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Internal IP</p>
                <p className="text-sm font-mono">{node.internal_ip}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">OS Image</p>
                <p className="text-sm">{node.os_image}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kernel Version</p>
                <p className="text-sm font-mono">{node.kernel_version}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
