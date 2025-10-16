import { useState, useEffect } from "react";
import { useNamespaces } from "../hooks/useKube";
import { useAppStore } from "../lib/store";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import {
  Check,
  ChevronDown,
  RefreshCw,
  X,
  AlertCircle,
  Layers,
  Search,
} from "lucide-react";

export function NamespaceSelector() {
  const { data: namespaces, isLoading, error, refetch } = useNamespaces();
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const setCurrentNamespace = useAppStore((state) => state.setCurrentNamespace);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showModal) {
        setShowModal(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal]);

  useEffect(() => {
    if (showModal) {
      setSearchQuery("");
    }
  }, [showModal]);

  const handleSelectNamespace = (namespace: string) => {
    setLoading(true);
    setCurrentNamespace(namespace);
    setShowModal(false);
    setLoading(false);
  };

  const handleRefresh = async () => {
    await refetch();
  };

  // Filter namespaces based on search query
  const filteredNamespaces = namespaces?.filter((ns) =>
    ns.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="group flex items-center gap-3 px-5 py-2.5 rounded-xl bg-card border-2 border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-200"
      >
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Layers className="w-4 h-4 text-primary" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-[10px] text-primary/70 font-bold uppercase tracking-wider">Namespace</span>
          <span className="text-sm font-bold text-foreground">
            {currentNamespace || "All Namespaces"}
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
                  Select Namespace
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Switch between Kubernetes namespaces
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleRefresh} variant="ghost" size="sm" disabled={isLoading}>
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
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
                    <p className="text-sm text-destructive/80 mt-1">
                      {error instanceof Error ? error.message : "Failed to load namespaces"}
                    </p>
                  </div>
                </div>
              )}

              {/* Search Input */}
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search namespaces..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                {/* All Namespaces Option - Show when search is empty or matches "all" */}
                {(!searchQuery || "all namespaces".includes(searchQuery.toLowerCase())) && (
                  <button
                    onClick={() => handleSelectNamespace("")}
                    disabled={loading}
                    className={`w-full p-4 rounded-xl border transition-all duration-200 text-left ${
                      currentNamespace === ""
                        ? "bg-gradient-to-r from-slate-500/10 to-zinc-500/10 border-primary/20 shadow-sm"
                        : "bg-background/50 border-border/50 hover:border-primary/30 hover:shadow-md"
                    } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-foreground">All Namespaces</span>
                          {currentNamespace === "" && (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              <Check className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>View resources across all namespaces</span>
                        </div>
                      </div>
                      {currentNamespace === "" && (
                        <div className="ml-4">
                          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                        </div>
                      )}
                    </div>
                  </button>
                )}

                {/* Individual Namespaces */}
                {filteredNamespaces.map((ns) => (
                  <button
                    key={ns.name}
                    onClick={() => handleSelectNamespace(ns.name)}
                    disabled={loading || currentNamespace === ns.name}
                    className={`w-full p-4 rounded-xl border transition-all duration-200 text-left ${
                      currentNamespace === ns.name
                        ? "bg-gradient-to-r from-slate-500/10 to-zinc-500/10 border-primary/20 shadow-sm"
                        : "bg-background/50 border-border/50 hover:border-primary/30 hover:shadow-md"
                    } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-foreground">{ns.name}</span>
                          {currentNamespace === ns.name && (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              <Check className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            {ns.status === "Active" ? "Active" : ns.status}
                          </span>
                          {ns.creationTimestamp && (
                            <span>
                              Created: {new Date(ns.creationTimestamp).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      {currentNamespace === ns.name && (
                        <div className="ml-4">
                          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {filteredNamespaces.length === 0 && !error && searchQuery && (
                <div className="text-center py-8">
                  <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No namespaces match "{searchQuery}"</p>
                </div>
              )}

              {namespaces && namespaces.length === 0 && !error && !searchQuery && (
                <div className="text-center py-8">
                  <Layers className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No namespaces found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
