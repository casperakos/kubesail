import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import type { PortForwardInfo } from "../../types";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { X, ArrowRight, RefreshCw } from "lucide-react";

export function PortForwardsPage() {
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-slate-500 to-zinc-500 rounded-full"></div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                Port Forwards
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {forwards.length} active {forwards.length === 1 ? "forward" : "forwards"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchForwards} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 rounded-xl border border-border/50 bg-card backdrop-blur-xl shadow-lg">
        {loading && forwards.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                <div
                  className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"
                  style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
                ></div>
              </div>
              <p className="text-sm text-muted-foreground font-medium">Loading port forwards...</p>
            </div>
          </div>
        ) : forwards.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <ArrowRight className="w-8 h-8" />
              </div>
              <p className="font-medium text-lg">No active port forwards</p>
              <p className="text-sm mt-2">Start a port forward from the Pods or Services page</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {forwards.map((forward) => (
              <div
                key={forward.id}
                className="flex items-center justify-between p-5 bg-gradient-to-r from-background/50 to-background/30 border border-border/50 rounded-lg hover:border-primary/50 transition-all duration-200 group"
              >
                <div className="flex items-center gap-6 flex-1">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs font-mono">
                      {forward.resource_type}
                    </Badge>
                    <div className="flex flex-col">
                      <span className="font-mono text-sm font-semibold">{forward.resource_name}</span>
                      <span className="text-xs text-muted-foreground">{forward.namespace}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div className="flex items-center gap-3">
                    <div className="text-sm flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">
                        localhost:{forward.local_port}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
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
                  className="ml-4 hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  {stopping === forward.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Stop
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> Port forwards run via kubectl. Make sure kubectl is installed and configured.
          Forwards automatically stop when the application closes.
        </p>
      </div>
    </div>
  );
}
