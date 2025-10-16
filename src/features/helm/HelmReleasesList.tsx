import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Trash2,
  History,
  FileText,
  Settings,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  MoreVertical,
  Plus,
} from "lucide-react";
import { useState, useMemo } from "react";
import { api } from "../../lib/api";
import type { HelmRelease } from "../../types";
import { HelmReleaseDetailsModal } from "./HelmReleaseDetailsModal";
import { HelmInstallModal, type InstallConfig } from "./HelmInstallModal";
import { ContextMenu, ContextMenuTrigger, type ContextMenuItem } from "../../components/ui/ContextMenu";
import { useToastStore } from "../../lib/toastStore";

export function HelmReleasesList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRelease, setSelectedRelease] = useState<HelmRelease | null>(null);
  const [releaseToDelete, setReleaseToDelete] = useState<HelmRelease | null>(null);
  const [deletingRelease, setDeletingRelease] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Fetch Helm releases
  const { data: releases, isLoading, error, refetch } = useQuery({
    queryKey: ["helm-releases", currentNamespace],
    queryFn: () => api.helmListReleases(currentNamespace === "all" ? undefined : currentNamespace, currentNamespace === "all"),
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (release: HelmRelease) => {
      setDeletingRelease(release.name);
      return api.helmUninstallRelease(release.name, release.namespace);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["helm-releases"] });
      setReleaseToDelete(null);
    },
    onSettled: () => {
      setDeletingRelease(null);
    },
  });

  // Filter releases based on search
  const filteredReleases = useMemo(() => {
    if (!releases) return [];
    return releases.filter(
      (release) =>
        release.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        release.chart.toLowerCase().includes(searchQuery.toLowerCase()) ||
        release.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [releases, searchQuery]);

  // Install handler
  const handleInstall = async (config: InstallConfig) => {
    setIsInstalling(true);
    try {
      await api.helmUpgradeRelease(
        config.releaseName,
        config.chart,
        config.namespace,
        config.values,
        config.createNamespace,
        config.version
      );
      addToast(`Successfully installed ${config.releaseName}`, "success");
      setShowInstallModal(false);
      queryClient.invalidateQueries({ queryKey: ["helm-releases"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to install chart";
      addToast(message, "error");
    } finally {
      setIsInstalling(false);
    }
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "deployed") {
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {status}
        </Badge>
      );
    }
    if (statusLower === "failed") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          {status}
        </Badge>
      );
    }
    if (statusLower === "pending-install" || statusLower === "pending-upgrade") {
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {status}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center space-y-4 p-8 rounded-2xl border border-destructive/50 bg-destructive/5">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-destructive mb-2">Failed to load Helm releases</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Unknown error occurred"}
            </p>
            <p className="text-xs text-muted-foreground">
              Make sure Helm CLI is installed and configured correctly
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with glassmorphism */}
      <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Helm Releases
            </h2>
            <Badge variant="secondary" className="ml-2">
              {filteredReleases?.length || 0} {searchQuery && `of ${releases?.length || 0}`}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowInstallModal(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Install Chart
            </Button>
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
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search releases, charts, or status..."
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
        {releases && (
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Package className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {releases.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {releases.filter((r) => r.status.toLowerCase() === "deployed").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Deployed</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <XCircle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {releases.filter((r) => r.status.toLowerCase() === "failed").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Failed</p>
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
                    {releases.filter((r) => r.status.toLowerCase().includes("pending")).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-border/50 rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm shadow-lg">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border/50">
              <TableHead className="font-semibold">Release Name</TableHead>
              <TableHead className="font-semibold">Namespace</TableHead>
              <TableHead className="font-semibold">Chart</TableHead>
              <TableHead className="font-semibold">App Version</TableHead>
              <TableHead className="font-semibold">Revision</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Updated</TableHead>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-64 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading Helm releases...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredReleases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-64 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Package className="w-12 h-12 text-muted-foreground/50" />
                    <div>
                      <p className="text-lg font-medium text-muted-foreground">
                        {searchQuery ? "No releases found" : "No Helm releases"}
                      </p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        {searchQuery
                          ? "Try adjusting your search query"
                          : "Deploy a Helm chart to get started"}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredReleases.map((release) => {
                // Build context menu items for this release
                const menuItems: ContextMenuItem[] = [
                  {
                    label: "View Details",
                    icon: <FileText className="w-4 h-4" />,
                    onClick: () => setSelectedRelease(release)
                  },
                  { separator: true },
                  {
                    label: "Uninstall",
                    icon: <Trash2 className="w-4 h-4" />,
                    onClick: () => setReleaseToDelete(release),
                    variant: "danger" as const,
                    disabled: deletingRelease === release.name
                  }
                ];

                return (
                  <ContextMenuTrigger key={`${release.namespace}-${release.name}`} items={menuItems}>
                    <TableRow className="hover:bg-muted/30 transition-colors cursor-pointer">
                      <TableCell className="font-medium">{release.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {release.namespace}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{release.chart}</TableCell>
                      <TableCell className="text-muted-foreground">{release.app_version || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {release.revision}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(release.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{release.updated}</TableCell>
                      <TableCell>
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
      </div>

      {/* Release Details Modal */}
      {selectedRelease && (
        <HelmReleaseDetailsModal
          release={selectedRelease}
          onClose={() => setSelectedRelease(null)}
        />
      )}

      {/* Install Modal */}
      {showInstallModal && (
        <HelmInstallModal
          onClose={() => setShowInstallModal(false)}
          onInstall={handleInstall}
          isInstalling={isInstalling}
        />
      )}

      {/* Delete Confirmation Modal */}
      {releaseToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border/50 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-in">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Uninstall Helm Release?</h3>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to uninstall <span className="font-medium text-foreground">{releaseToDelete.name}</span>?
                  This action cannot be undone and will remove all associated resources.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setReleaseToDelete(null)}
                disabled={deletingRelease !== null}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(releaseToDelete)}
                disabled={deletingRelease !== null}
                className="gap-2"
              >
                {deletingRelease ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uninstalling...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Uninstall
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
