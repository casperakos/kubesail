import { useState, useEffect } from "react";
import { api } from "../lib/api";
import type { PortForwardInfo } from "../types";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { X, ArrowRight, RefreshCw } from "lucide-react";

interface PortForwardManagerProps {
  onClose: () => void;
}

export function PortForwardManager({ onClose }: PortForwardManagerProps) {
  const [forwards, setForwards] = useState<PortForwardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [stopping, setStoppingId] = useState<string | null>(null);

  const fetchForwards = async () => {
    try {
      const data = await api.listPortForwards();
      setForwards(data);
    } catch (err) {
      console.error("Failed to fetch port forwards:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForwards();
    const interval = setInterval(fetchForwards, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const handleStop = async (id: string) => {
    setStoppingId(id);
    try {
      await api.stopPortForward(id);
      await fetchForwards();
    } catch (err) {
      console.error("Failed to stop port forward:", err);
    } finally {
      setStoppingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Active Port Forwards</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {forwards.length} active {forwards.length === 1 ? "forward" : "forwards"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchForwards} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && forwards.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : forwards.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center text-muted-foreground">
                <p className="font-medium">No active port forwards</p>
                <p className="text-sm mt-1">Start a port forward from the Pods or Services page</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {forwards.map((forward) => (
                <div
                  key={forward.id}
                  className="flex items-center justify-between p-4 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {forward.resource_type}
                      </Badge>
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-medium">{forward.resource_name}</span>
                        <span className="text-xs text-muted-foreground">{forward.namespace}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      <div className="text-sm">
                        <span className="font-mono font-medium">localhost:{forward.local_port}</span>
                        <ArrowRight className="inline-block w-3 h-3 mx-2 text-muted-foreground" />
                        <span className="font-mono text-muted-foreground">{forward.remote_port}</span>
                      </div>
                    </div>
                    <Badge
                      variant={forward.status === "running" ? "success" : "secondary"}
                      className="text-xs ml-auto"
                    >
                      {forward.status}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStop(forward.id)}
                    disabled={stopping === forward.id}
                    className="ml-4"
                  >
                    {stopping === forward.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 rounded-b-xl">
          <p className="text-xs text-muted-foreground">
            Port forwards run via kubectl. Make sure kubectl is installed and configured.
          </p>
        </div>
      </div>
    </div>
  );
}
