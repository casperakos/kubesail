import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
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
  Plus,
  Edit2,
  Trash2,
  Save,
} from "lucide-react";

interface ContextInfo {
  name: string;
  cluster: string;
  namespace?: string;
  user: string;
  current: boolean;
}

interface SavedKubeconfig {
  id: string;
  name: string;
  path: string;
  addedAt: number;
}

const SAVED_KUBECONFIGS_KEY = "saved-kubeconfigs";

const getSavedKubeconfigs = (): SavedKubeconfig[] => {
  try {
    const saved = localStorage.getItem(SAVED_KUBECONFIGS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveSavedKubeconfigs = (configs: SavedKubeconfig[]) => {
  try {
    localStorage.setItem(SAVED_KUBECONFIGS_KEY, JSON.stringify(configs));
  } catch (error) {
    console.error("Failed to save kubeconfigs:", error);
  }
};

// Helper function to expand tilde in paths
const expandTildePath = async (path: string): Promise<string> => {
  if (path.startsWith("~/")) {
    const home = await homeDir();
    return path.replace("~", home);
  }
  return path;
};

export function ClusterSelector() {
  const [currentContext, setCurrentContext] = useState<ContextInfo | null>(null);
  const [contexts, setContexts] = useState<ContextInfo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedKubeconfigs, setSavedKubeconfigs] = useState<SavedKubeconfig[]>(getSavedKubeconfigs());
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [newConfigName, setNewConfigName] = useState("");
  const [newConfigPath, setNewConfigPath] = useState("");
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [switchInProgress, setSwitchInProgress] = useState(false);

  const loadContexts = async (forceReload: boolean = false) => {
    try {
      console.log("Fetching contexts from backend...");
      const [ctxs, current] = await Promise.all([
        invoke<ContextInfo[]>("get_kubeconfig_contexts"),
        invoke<ContextInfo | null>("get_current_context_info"),
      ]);

      console.log("Loaded contexts:", ctxs.length, "contexts", ctxs);
      console.log("Current context:", current);

      setContexts(ctxs);
      setCurrentContext(current);
      setError(null);
    } catch (err) {
      console.error("Error loading contexts:", err);
      setError(err instanceof Error ? err.message : "Failed to load contexts");
      // Don't clear contexts on error unless it's a force reload
      if (forceReload) {
        setContexts([]);
        setCurrentContext(null);
      }
    }
  };

  // Load kubeconfig files once on component mount, then load contexts
  useEffect(() => {
    const loadKubeconfigFilesAndContexts = async () => {
      try {
        const expandedPaths = await Promise.all(
          savedKubeconfigs.map(async (c) => await expandTildePath(c.path))
        );

        if (expandedPaths.length > 0) {
          const kubeconfigValue = expandedPaths.join(':');
          console.log("Setting kubeconfig paths:", kubeconfigValue);
          await invoke("load_custom_kubeconfig_file", { path: kubeconfigValue });
          console.log("Kubeconfig paths set successfully");
        }

        // Now load contexts after kubeconfig files are set
        await loadContexts();
      } catch (err) {
        console.error("Failed to set kubeconfig paths:", err);
      }
    };

    loadKubeconfigFilesAndContexts();
  }, [savedKubeconfigs]);

  // Also load contexts when modal is opened to ensure fresh data
  useEffect(() => {
    if (showModal) {
      loadContexts();
    }
  }, [showModal]);

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
    // Don't allow switching if we don't have contexts loaded
    if (contexts.length === 0) {
      console.error("Cannot switch context: no contexts loaded");
      setError("Please wait for contexts to load before switching");
      return;
    }

    // Don't allow switching if another switch is already in progress
    if (switchInProgress) {
      console.error("Cannot switch context: another switch is in progress");
      setError("Another context switch is in progress. Please refresh the page if you cancelled authentication.");
      return;
    }

    setSwitchInProgress(true);
    setLoading(true);
    setError(null);

    // Store current state before attempting switch
    const previousContexts = [...contexts];
    const previousCurrentContext = currentContext;

    console.log("Attempting to switch to context:", contextName);
    console.log("Current contexts count:", previousContexts.length);

    // Create a timeout promise (10 seconds - enough time for auth but not too long if cancelled)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Operation timed out - authentication may have been cancelled")), 10000);
    });

    try {
      // Race between the actual operation and timeout
      await Promise.race([
        invoke("switch_kube_context", { contextName }),
        timeoutPromise
      ]);
      await loadContexts();
      setShowModal(false);
      setSwitchInProgress(false);
      // Reload the page to refresh all data
      window.location.reload();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to switch context";
      console.error("Context switch error:", errorMessage);
      console.log("Restoring previous state with", previousContexts.length, "contexts");

      // Immediately restore the previous state - don't try to reload from backend
      // as the backend state might be corrupted by the failed switch
      setContexts(previousContexts);
      setCurrentContext(previousCurrentContext);
      setError(errorMessage + " - You can try another context, but if it also fails, please refresh the page");
      setLoading(false);
      setSwitchInProgress(false);
    }
  };

  const handleBrowseConfig = async () => {
    try {
      const selected = await open({
        title: "Select Kubeconfig File",
        defaultPath: "~/.kube",
        filters: [
          {
            name: "Kubeconfig",
            extensions: ["yaml", "yml", "config", "*"],
          },
        ],
      });

      if (selected) {
        setNewConfigPath(selected);
      }
    } catch (err) {
      console.error("Error browsing for config:", err);
      setError(err instanceof Error ? err.message : "Failed to browse for config");
    }
  };

  const handleSaveConfig = () => {
    if (!newConfigName.trim() || !newConfigPath.trim()) {
      setError("Please provide both name and path");
      return;
    }

    const newConfig: SavedKubeconfig = {
      id: Date.now().toString(),
      name: newConfigName.trim(),
      path: newConfigPath.trim(),
      addedAt: Date.now(),
    };

    const updated = [...savedKubeconfigs, newConfig];
    setSavedKubeconfigs(updated);
    saveSavedKubeconfigs(updated);

    setNewConfigName("");
    setNewConfigPath("");
    setShowAddConfig(false);
    setError(null);
  };

  const handleDeleteConfig = (id: string) => {
    const updated = savedKubeconfigs.filter(c => c.id !== id);
    setSavedKubeconfigs(updated);
    saveSavedKubeconfigs(updated);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="group flex items-center gap-3 px-5 py-2.5 rounded-xl bg-card border-2 border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200"
      >
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Server className="w-4 h-4 text-primary" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-primary/70 font-bold uppercase tracking-wider">Cluster</span>
          <span className="text-sm font-bold text-foreground">
            {currentContext?.cluster || "No cluster"}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />
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
                <Button onClick={() => loadContexts(true)} variant="ghost" size="sm" disabled={loading} title="Force reload contexts">
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
                    disabled={loading || context.current || switchInProgress}
                    className={`w-full p-4 rounded-xl border transition-all duration-200 text-left ${
                      context.current
                        ? "bg-gradient-to-r from-slate-500/10 to-zinc-500/10 border-primary/20 shadow-sm"
                        : "bg-background/50 border-border/50 hover:border-primary/30 hover:shadow-md"
                    } ${(loading || switchInProgress) ? "opacity-50 cursor-not-allowed" : ""}`}
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

            {/* Saved Kubeconfigs Section */}
            {savedKubeconfigs.length > 0 && !showAddConfig && (
              <div className="px-6 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Kubeconfig Locations
                    <span className="ml-2 text-xs text-muted-foreground/70">
                      (All contexts from these files are available)
                    </span>
                  </h3>
                </div>
                <div className="space-y-2">
                  {savedKubeconfigs.map((config) => (
                    <div
                      key={config.id}
                      className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground">{config.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{config.path}</div>
                      </div>
                      <Button
                        onClick={() => handleDeleteConfig(config.id)}
                        variant="ghost"
                        size="sm"
                        disabled={loading}
                        className="text-destructive hover:text-destructive ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Config Form */}
            {showAddConfig && (
              <div className="px-6 pb-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Name
                    </label>
                    <input
                      type="text"
                      value={newConfigName}
                      onChange={(e) => setNewConfigName(e.target.value)}
                      placeholder="e.g., Production, Staging"
                      className="w-full px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Path
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newConfigPath}
                        onChange={(e) => setNewConfigPath(e.target.value)}
                        placeholder="~/.kube/config"
                        className="flex-1 px-3 py-2 bg-background border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <Button onClick={handleBrowseConfig} variant="outline" size="sm">
                        <FolderOpen className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSaveConfig} className="flex-1" disabled={loading}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        setShowAddConfig(false);
                        setNewConfigName("");
                        setNewConfigPath("");
                        setError(null);
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="p-6 border-t border-border/50 bg-gradient-to-br from-background/80 to-background/50">
              {!showAddConfig && (
                <Button
                  onClick={() => setShowAddConfig(true)}
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Location
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
