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
} from "lucide-react";
import { useState, useMemo } from "react";
import { api } from "../../lib/api";
import type { HelmRelease } from "../../types";
import { HelmReleaseDetailsModal } from "./HelmReleaseDetailsModal";

export function HelmReleasesList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRelease, setSelectedRelease] = useState<HelmRelease | null>(null);
  const [releaseToDelete, setReleaseToDelete] = useState<HelmRelease | null>(null);
  const [deletingRelease, setDeletingRelease] = useState<string | null>(null);

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" />
            Helm Releases
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentNamespace === "all" ? "All namespaces" : `Namespace: ${currentNamespace}`}
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="outline"
          size="sm"
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <input
          type="text"
          placeholder="Search releases, charts, or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-3 bg-background border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Stats */}
      {releases && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="text-2xl font-bold">{releases.length}</div>
            <div className="text-sm text-muted-foreground">Total Releases</div>
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-green-500/5 to-green-500/10">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {releases.filter((r) => r.status.toLowerCase() === "deployed").length}
            </div>
            <div className="text-sm text-muted-foreground">Deployed</div>
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-red-500/5 to-red-500/10">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {releases.filter((r) => r.status.toLowerCase() === "failed").length}
            </div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-gradient-to-br from-yellow-500/5 to-yellow-500/10">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {releases.filter((r) => r.status.toLowerCase().includes("pending")).length}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </div>
        </div>
      )}

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
              filteredReleases.map((release) => (
                <TableRow
                  key={`${release.namespace}-${release.name}`}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedRelease(release)}
                >
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
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRelease(release);
                        }}
                        className="h-8 w-8 p-0"
                        title="View Details"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReleaseToDelete(release);
                        }}
                        disabled={deletingRelease === release.name}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Uninstall"
                      >
                        {deletingRelease === release.name ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
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
