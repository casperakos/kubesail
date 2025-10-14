import { useState } from "react";
import { useConfigMaps } from "../../hooks/useKube";
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
import { RefreshCw, Eye } from "lucide-react";
import { ConfigMapInfo } from "../../types";

export function ConfigMapsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const { data: configmaps, isLoading, error, refetch } = useConfigMaps(currentNamespace);
  const [selectedConfigMap, setSelectedConfigMap] = useState<ConfigMapInfo | null>(null);

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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">ConfigMaps</h2>
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
            <TableHead>Keys</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {configmaps.map((cm) => (
            <TableRow key={cm.name}>
              <TableCell className="font-medium">{cm.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{cm.keys} keys</Badge>
              </TableCell>
              <TableCell>{cm.age}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedConfigMap(cm)}
                  title="View data"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedConfigMap && (
        <ConfigMapViewer
          configmap={selectedConfigMap}
          onClose={() => setSelectedConfigMap(null)}
        />
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
