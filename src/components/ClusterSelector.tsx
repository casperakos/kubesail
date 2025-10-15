import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import {
  Server,
  Check,
  ChevronDown,
  RefreshCw,
  FolderOpen,
  X,
  AlertCircle,
} from "lucide-react";

interface ContextInfo {
  name: string;
  cluster: string;
  namespace?: string;
  user: string;
  current: boolean;
}

export function ClusterSelector() {
  const [currentContext, setCurrentContext] = useState<ContextInfo | null>(null);
  const [contexts, setContexts] = useState<ContextInfo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContexts = async () => {
    try {
      const [ctxs, current] = await Promise.all([
        invoke<ContextInfo[]>("get_kubeconfig_contexts"),
        invoke<ContextInfo | null>("get_current_context_info"),
      ]);
      setContexts(ctxs);
      setCurrentContext(current);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contexts");
    }
  };

  useEffect(() => {
    loadContexts();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showModal) {
        setShowModal(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal]);

  const handleSwitchContext = async (contextName: string) => {
    setLoading(true);
    setError(null);
    try {
      await invoke("switch_kube_context", { contextName });
      await loadContexts();
      setShowModal(false);
      // Reload the page to refresh all data
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch context");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadCustomConfig = async () => {
    try {
      const selected = await open({
        title: "Select Kubeconfig File",
        filters: [
          {
            name: "Kubeconfig",
            extensions: ["yaml", "yml", "config", "*"],
          },
        ],
      });

      if (selected) {
        setLoading(true);
        setError(null);

        // Log the selected path for debugging
        console.log("Loading custom kubeconfig from:", selected);

        await invoke("load_custom_kubeconfig_file", { path: selected });
        await loadContexts();
        setShowModal(false);
        window.location.reload();
      }
    } catch (err) {
      console.error("Error loading custom config:", err);
      const errorMessage = typeof err === 'string'
        ? err
        : err instanceof Error
          ? err.message
          : "Failed to load custom config";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-background/50 border border-border/50 hover:border-primary/50 hover:shadow-md transition-all duration-200"
      >
        <Server className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-muted-foreground font-medium">CLUSTER</span>
          <span className="text-sm font-semibold text-foreground">
            {currentContext?.cluster || "No cluster"}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground ml-2" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl border border-border/50">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border/50">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-400 to-zinc-400 bg-clip-text text-transparent">
                  Select Cluster
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Switch between configured Kubernetes contexts
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={loadContexts} variant="ghost" size="sm" disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button onClick={() => setShowModal(false)} variant="ghost" size="sm">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {error && (
                <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-destructive">Error</p>
                    <p className="text-sm text-destructive/80 mt-1">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {contexts.map((context) => (
                  <button
                    key={context.name}
                    onClick={() => handleSwitchContext(context.name)}
                    disabled={loading || context.current}
                    className={`w-full p-4 rounded-xl border transition-all duration-200 text-left ${
                      context.current
                        ? "bg-gradient-to-r from-slate-500/10 to-zinc-500/10 border-primary/20 shadow-sm"
                        : "bg-background/50 border-border/50 hover:border-primary/30 hover:shadow-md"
                    } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-foreground">{context.name}</span>
                          {context.current && (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              <Check className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Server className="w-3 h-3" />
                            {context.cluster}
                          </span>
                          {context.namespace && (
                            <span>Namespace: {context.namespace}</span>
                          )}
                          <span>User: {context.user}</span>
                        </div>
                      </div>
                      {context.current && (
                        <div className="ml-4">
                          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {contexts.length === 0 && !error && (
                <div className="text-center py-8">
                  <Server className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No contexts found in kubeconfig</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border/50 bg-gradient-to-br from-background/80 to-background/50">
              <Button
                onClick={handleLoadCustomConfig}
                variant="outline"
                className="w-full"
                disabled={loading}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Load Custom Kubeconfig
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
