import { useState, useMemo } from "react";
import { useConfigMaps, useDeleteConfigMap } from "../../hooks/useKube";
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
import { RefreshCw, Eye, Search, X, FileText, Trash2 } from "lucide-react";
import { ConfigMapInfo } from "../../types";
import { YamlViewer } from "../../components/YamlViewer";

export function ConfigMapsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const { data: configmaps, isLoading, error, refetch } = useConfigMaps(currentNamespace);
  const deleteConfigMap = useDeleteConfigMap();
  const [selectedConfigMap, setSelectedConfigMap] = useState<ConfigMapInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<{name: string; namespace: string} | null>(null);
  const [configmapToDelete, setConfigmapToDelete] = useState<string | null>(null);

  const handleDelete = (configmapName: string) => {
    setConfigmapToDelete(configmapName);
  };

  const confirmDelete = () => {
    if (configmapToDelete) {
      const configmap = configmaps?.find(cm => cm.name === configmapToDelete);
      if (configmap) {
        deleteConfigMap.mutate({
          namespace: configmap.namespace,
          configmapName: configmapToDelete,
        });
      }
      setConfigmapToDelete(null);
    }
  };

  const cancelDelete = () => {
    setConfigmapToDelete(null);
  };

  // Filter configmaps based on search query
  const filteredConfigMaps = useMemo(() => {
    if (!configmaps) return [];
    if (!searchQuery) return configmaps;

    const query = searchQuery.toLowerCase();
    return configmaps.filter(cm =>
      cm.name.toLowerCase().includes(query) ||
      Object.keys(cm.data).some(key => key.toLowerCase().includes(query))
    );
  }, [configmaps, searchQuery]);

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
        Error loading configmaps: {error.message}
      </div>
    );
  }

  if (!configmaps || configmaps.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No configmaps found in namespace "{currentNamespace}"
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
              ConfigMaps
            </h2>
            <Badge variant="secondary" className="ml-2">
              {filteredConfigMaps?.length || 0} {searchQuery && `of ${configmaps?.length || 0}`}
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
            placeholder="Search by name or key..."
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
            <TableHead>Keys</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredConfigMaps.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                {searchQuery ? `No configmaps found matching "${searchQuery}"` : "No configmaps found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredConfigMaps.map((cm) => (
            <TableRow key={cm.name}>
              <TableCell className="font-medium">{cm.name}</TableCell>
              {showNamespaceColumn && <TableCell>{cm.namespace}</TableCell>}
              <TableCell>
                <Badge variant="secondary">{cm.keys} keys</Badge>
              </TableCell>
              <TableCell>{cm.age}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedResource({name: cm.name, namespace: cm.namespace})}
                    title="View YAML"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedConfigMap(cm)}
                    title="View data"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(cm.name)}
                    disabled={deleteConfigMap.isPending}
                    title="Delete configmap"
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

      {selectedResource && (
        <YamlViewer
          resourceType="configmap"
          resourceName={selectedResource.name}
          namespace={selectedResource.namespace}
          onClose={() => setSelectedResource(null)}
        />
      )}

      {selectedConfigMap && (
        <ConfigMapViewer
          configmap={selectedConfigMap}
          onClose={() => setSelectedConfigMap(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {configmapToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Deletion</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete configmap <span className="font-mono text-foreground">"{configmapToDelete}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelDelete}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteConfigMap.isPending}
              >
                {deleteConfigMap.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ConfigMapViewerProps {
  configmap: ConfigMapInfo;
  onClose: () => void;
}

function ConfigMapViewer({ configmap, onClose }: ConfigMapViewerProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-lg w-[90%] h-[80%] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold">{configmap.name}</h2>
            <p className="text-sm text-muted-foreground">
              {configmap.keys} keys • {configmap.age}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close (ESC)
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            {Object.entries(configmap.data).map(([key, value]) => (
              <div key={key} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{key}</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(value);
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                  {value}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
