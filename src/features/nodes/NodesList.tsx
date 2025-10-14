import { useState, useMemo } from "react";
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
import { RefreshCw, Search, X } from "lucide-react";

export function NodesList() {
  const { data: nodes, isLoading, error, refetch } = useNodes();
  const [searchQuery, setSearchQuery] = useState("");

  const getStatusVariant = (status: string) => {
    if (status === "Ready") return "success";
    if (status === "NotReady") return "destructive";
    return "secondary";
  };

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!nodes) return [];
    if (!searchQuery) return nodes;

    const query = searchQuery.toLowerCase();
    return nodes.filter(node =>
      node.name.toLowerCase().includes(query) ||
      node.status.toLowerCase().includes(query) ||
      node.version.toLowerCase().includes(query) ||
      node.internal_ip.toLowerCase().includes(query) ||
      node.roles.some(role => role.toLowerCase().includes(query))
    );
  }, [nodes, searchQuery]);

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Nodes
            </h2>
            <Badge variant="secondary" className="ml-2">
              {filteredNodes?.length || 0} {searchQuery && `of ${nodes?.length || 0}`}
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

      {!filteredNodes || filteredNodes.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm">
          <p className="text-muted-foreground">
            {searchQuery ? `No nodes found matching "${searchQuery}"` : "No nodes found in cluster"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredNodes.map((node) => (
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
      )}
    </div>
  );
}
