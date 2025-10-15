import { useEffect, useState } from "react";
import { X, Calendar, AlertCircle, RefreshCw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./ui/Button";

interface CustomResourceDescribeViewerProps {
  group: string;
  version: string;
  plural: string;
  name: string;
  namespace?: string;
  onClose: () => void;
}

export function CustomResourceDescribeViewer({
  group,
  version,
  plural,
  name,
  namespace,
  onClose,
}: CustomResourceDescribeViewerProps) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDescription = async () => {
    setLoading(true);
    setError(null);
    try {
      const desc = await invoke<string>("describe_custom_resource", {
        group,
        version,
        plural,
        name,
        namespace: namespace || null,
      });
      setDescription(desc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch description");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDescription();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 bg-gradient-to-r from-background/95 to-background/80">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-400 to-zinc-400 bg-clip-text text-transparent">
              Resource Details
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {name}
              {namespace && ` (${namespace})`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!loading && !error && (
              <Button onClick={fetchDescription} variant="ghost" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            )}
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground">Loading details...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
                <p className="text-destructive font-semibold mt-4">Error loading details</p>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
                <Button onClick={fetchDescription} className="mt-4">
                  Retry
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
              <pre className="text-sm font-mono whitespace-pre-wrap text-foreground overflow-x-auto">
                {description}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
