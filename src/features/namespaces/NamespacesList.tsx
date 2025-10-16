import { useState, useMemo } from "react";
import { useNamespaces } from "../../hooks/useKube";
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
import {
  RefreshCw,
  Search,
  X,
  Layers,
  Code,
  FileText,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Package
} from "lucide-react";
import { NamespaceInfo } from "../../types";
import { YamlViewer } from "../../components/YamlViewer";
import { ResourceDescribeViewer } from "../../components/ResourceDescribeViewer";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ContextMenu, ContextMenuItem, ContextMenuTrigger } from "../../components/ui/ContextMenu";

export function NamespacesList() {
  const { data: namespaces, isLoading, error, refetch } = useNamespaces();
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const setCurrentNamespace = useAppStore((state) => state.setCurrentNamespace);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<{name: string} | null>(null);
  const [selectedResourceForDescribe, setSelectedResourceForDescribe] = useState<{name: string} | null>(null);

  // Filter namespaces based on search query
  const filteredNamespaces = useMemo(() => {
    if (!namespaces) return [];
    if (!searchQuery) return namespaces;
    const query = searchQuery.toLowerCase();
    return namespaces.filter(ns =>
      ns.name.toLowerCase().includes(query) ||
      ns.status.toLowerCase().includes(query)
    );
  }, [namespaces, searchQuery]);

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "success";
      case "terminating":
        return "warning";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <CheckCircle className="w-4 h-4" />;
      case "terminating":
        return <Clock className="w-4 h-4 animate-spin" />;
      default:
        return <XCircle className="w-4 h-4" />;
    }
  };

  const handleSwitchNamespace = (namespaceName: string) => {
    setCurrentNamespace(namespaceName);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading namespaces..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading namespaces: {error.message}
      </div>
    );
  }

  if (!namespaces || namespaces.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No namespaces found in cluster
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
              Namespaces
            </h2>
            <Badge variant="secondary" className="ml-2">
              {filteredNamespaces?.length || 0} {searchQuery && `of ${namespaces?.length || 0}`}
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
            placeholder="Search by name or status..."
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

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {namespaces.filter(ns => ns.status.toLowerCase() === "active").length}
                </p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {namespaces.filter(ns => ns.status.toLowerCase() === "terminating").length}
                </p>
                <p className="text-sm text-muted-foreground">Terminating</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Package className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {namespaces.length}
                </p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredNamespaces.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                {searchQuery ? `No namespaces found matching "${searchQuery}"` : "No namespaces found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredNamespaces.map((ns: NamespaceInfo) => {
              const isCurrentNamespace = currentNamespace === ns.name;

              // Build context menu items for this namespace
              const menuItems: ContextMenuItem[] = [
                {
                  label: "Switch to this namespace",
                  icon: <Layers className="w-4 h-4" />,
                  onClick: () => handleSwitchNamespace(ns.name),
                  disabled: isCurrentNamespace
                },
                { separator: true },
                {
                  label: "View YAML",
                  icon: <Code className="w-4 h-4" />,
                  onClick: () => setSelectedResource({name: ns.name})
                },
                {
                  label: "Describe",
                  icon: <FileText className="w-4 h-4" />,
                  onClick: () => setSelectedResourceForDescribe({name: ns.name})
                }
              ];

              return (
                <ContextMenuTrigger key={ns.name} items={menuItems}>
                  <TableRow className={isCurrentNamespace ? "bg-primary/5" : ""}>
                    <TableCell>
                      {isCurrentNamespace && (
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-muted-foreground" />
                        {ns.name}
                        {isCurrentNamespace && (
                          <Badge variant="default" className="ml-2 bg-primary/10 text-primary border-primary/20">
                            Current
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(ns.status)} className="flex items-center gap-1 w-fit">
                        {getStatusIcon(ns.status)}
                        {ns.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{ns.age}</TableCell>
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

      {selectedResource && (
        <YamlViewer
          resourceType="namespace"
          resourceName={selectedResource.name}
          namespace={undefined}
          onClose={() => setSelectedResource(null)}
        />
      )}

      {selectedResourceForDescribe && (
        <ResourceDescribeViewer
          resourceType="namespace"
          name={selectedResourceForDescribe.name}
          namespace={undefined}
          onClose={() => setSelectedResourceForDescribe(null)}
        />
      )}
    </div>
  );
}
