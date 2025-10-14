import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { X, ArrowRight, Loader } from "lucide-react";

interface PortForwardModalProps {
  resourceType: string;
  resourceName: string;
  namespace: string;
  availablePorts?: number[];
  onClose: () => void;
}

export function PortForwardModal({
  resourceType,
  resourceName,
  namespace,
  availablePorts = [],
  onClose,
}: PortForwardModalProps) {
  const [localPort, setLocalPort] = useState<string>("");
  const [remotePort, setRemotePort] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auto-populate with first available port
  useEffect(() => {
    if (availablePorts.length > 0 && !remotePort) {
      const firstPort = availablePorts[0].toString();
      setRemotePort(firstPort);
      setLocalPort(firstPort);
    }
  }, [availablePorts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const local = parseInt(localPort);
    const remote = parseInt(remotePort);

    if (isNaN(local) || isNaN(remote) || local < 1 || local > 65535 || remote < 1 || remote > 65535) {
      setError("Please enter valid port numbers (1-65535)");
      setLoading(false);
      return;
    }

    try {
      await api.startPortForward(resourceType, resourceName, namespace, local, remote);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start port forward");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Port Forward</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{resourceType}</Badge>
              <span className="text-sm text-muted-foreground">/</span>
              <span className="text-sm font-mono">{resourceName}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {availablePorts.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Quick Select (Container Ports)</label>
              <div className="flex flex-wrap gap-2">
                {availablePorts.map((port) => (
                  <Button
                    key={port}
                    type="button"
                    variant={remotePort === port.toString() ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setRemotePort(port.toString());
                      setLocalPort(port.toString());
                    }}
                  >
                    {port}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Local Port</label>
              <input
                type="number"
                value={localPort}
                onChange={(e) => setLocalPort(e.target.value)}
                placeholder="8080"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                min="1"
                max="65535"
                required
                autoFocus
              />
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground mt-7" />
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Remote Port</label>
              <input
                type="number"
                value={remotePort}
                onChange={(e) => setRemotePort(e.target.value)}
                placeholder="80"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                min="1"
                max="65535"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/50 rounded-lg">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/50 rounded-lg">
              <p className="text-green-500 text-sm font-medium">Port forward started successfully!</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={loading || success}>
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : success ? (
                "Started!"
              ) : (
                "Start Port Forward"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 rounded-b-xl">
          <p className="text-xs text-muted-foreground">
            Traffic from localhost:{localPort || "XXXX"} will be forwarded to {resourceName}:{remotePort || "XXXX"}
          </p>
        </div>
      </div>
    </div>
  );
}
