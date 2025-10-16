import { useState, useMemo } from "react";
import {
  usePersistentVolumes,
  usePersistentVolumeClaims,
} from "../../hooks/useKube";
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
import { RefreshCw, Search, X, MoreVertical } from "lucide-react";
import { ContextMenu, ContextMenuItem, ContextMenuTrigger } from "../../components/ui/ContextMenu";
import { YamlViewer } from "../../components/YamlViewer";
import { LoadingSpinner } from "../../components/LoadingSpinner";

type StorageType = "pv" | "pvc";

export function StorageList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const [activeTab, setActiveTab] = useState<StorageType>("pvc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<{name: string; namespace?: string} | null>(null);

  const { data: pvs, isLoading: pvLoading, error: pvError, refetch: pvRefetch } =
    usePersistentVolumes();
  const { data: pvcs, isLoading: pvcLoading, error: pvcError, refetch: pvcRefetch } =
    usePersistentVolumeClaims(currentNamespace);

  // Filter PVs based on search query
  const filteredPvs = useMemo(() => {
    if (!pvs) return [];
    if (!searchQuery) return pvs;
    const query = searchQuery.toLowerCase();
    return pvs.filter(pv =>
      pv.name.toLowerCase().includes(query) ||
      pv.status.toLowerCase().includes(query) ||
      pv.claim?.toLowerCase().includes(query) ||
      pv.storage_class?.toLowerCase().includes(query)
    );
  }, [pvs, searchQuery]);

  // Filter PVCs based on search query
  const filteredPvcs = useMemo(() => {
    if (!pvcs) return [];
    if (!searchQuery) return pvcs;
    const query = searchQuery.toLowerCase();
    return pvcs.filter(pvc =>
      pvc.name.toLowerCase().includes(query) ||
      pvc.status.toLowerCase().includes(query) ||
      pvc.volume?.toLowerCase().includes(query) ||
      pvc.storage_class?.toLowerCase().includes(query)
    );
  }, [pvcs, searchQuery]);

  const tabs: { value: StorageType; label: string; count: number; filteredCount: number }[] = [
    { value: "pvc", label: "PersistentVolumeClaims", count: pvcs?.length || 0, filteredCount: filteredPvcs?.length || 0 },
    { value: "pv", label: "PersistentVolumes", count: pvs?.length || 0, filteredCount: filteredPvs?.length || 0 },
  ];

  const handleRefresh = () => {
    if (activeTab === "pv") {
      pvRefetch();
    } else {
      pvcRefetch();
    }
  };

  const isLoading = pvLoading || pvcLoading;

  const getResourceType = () => {
    return activeTab === "pv" ? "persistentvolume" : "persistentvolumeclaim";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-slate-500 to-zinc-500 rounded-full"></div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Storage
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="flex space-x-1 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <Badge variant="secondary" className="ml-2">
                {searchQuery ? `${tab.filteredCount} of ${tab.count}` : tab.count}
              </Badge>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, status, or storage class..."
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
      </div>

      {activeTab === "pv" && (
        <PersistentVolumesTable
          data={filteredPvs}
          isLoading={pvLoading}
          error={pvError}
          searchQuery={searchQuery}
          onViewYaml={setSelectedResource}
        />
      )}
      {activeTab === "pvc" && (
        <PersistentVolumeClaimsTable
          data={filteredPvcs}
          isLoading={pvcLoading}
          error={pvcError}
          searchQuery={searchQuery}
          onViewYaml={setSelectedResource}
        />
      )}

      {selectedResource && (
        <YamlViewer
          resourceType={getResourceType()}
          resourceName={selectedResource.name}
          namespace={selectedResource.namespace}
          onClose={() => setSelectedResource(null)}
        />
      )}
    </div>
  );
}

function PersistentVolumesTable({ data, isLoading, error, searchQuery, onViewYaml }: any) {
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "bound":
        return "success";
      case "available":
        return "secondary";
      case "released":
        return "warning";
      case "failed":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading persistent volumes..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading persistent volumes: {error.message}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Capacity</TableHead>
          <TableHead>Access Modes</TableHead>
          <TableHead>Reclaim Policy</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Claim</TableHead>
          <TableHead>Storage Class</TableHead>
          <TableHead>Age</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!data || data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
              {searchQuery ? `No persistent volumes found matching "${searchQuery}"` : "No persistent volumes found"}
            </TableCell>
          </TableRow>
        ) : (
          data.map((pv: any) => {
            const menuItems: ContextMenuItem[] = [
              {
                label: "View YAML",
                onClick: () => onViewYaml({name: pv.name}),
              },
            ];

            return (
              <ContextMenuTrigger key={pv.name} items={menuItems}>
                <TableRow>
                  <TableCell className="font-medium">{pv.name}</TableCell>
                  <TableCell>{pv.capacity}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {pv.access_modes.map((mode: string) => (
                        <Badge key={mode} variant="secondary" className="text-xs">
                          {mode}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{pv.reclaim_policy}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(pv.status)}>{pv.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {pv.claim || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pv.storage_class || "-"}
                  </TableCell>
                  <TableCell>{pv.age}</TableCell>
                  <TableCell className="text-right">
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
  );
}

function PersistentVolumeClaimsTable({ data, isLoading, error, searchQuery, onViewYaml }: any) {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "bound":
        return "success";
      case "pending":
        return "warning";
      case "lost":
        return "destructive";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading persistent volume claims..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading persistent volume claims: {error.message}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          {showNamespaceColumn && <TableHead>Namespace</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead>Volume</TableHead>
          <TableHead>Capacity</TableHead>
          <TableHead>Access Modes</TableHead>
          <TableHead>Storage Class</TableHead>
          <TableHead>Age</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!data || data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? `No persistent volume claims found matching "${searchQuery}"`
                : `No persistent volume claims found in namespace "${currentNamespace}"`}
            </TableCell>
          </TableRow>
        ) : (
          data.map((pvc: any) => {
            const menuItems: ContextMenuItem[] = [
              {
                label: "View YAML",
                onClick: () => onViewYaml({name: pvc.name, namespace: pvc.namespace}),
              },
            ];

            return (
              <ContextMenuTrigger key={pvc.name} items={menuItems}>
                <TableRow>
                  <TableCell className="font-medium">{pvc.name}</TableCell>
                  {showNamespaceColumn && <TableCell>{pvc.namespace}</TableCell>}
                  <TableCell>
                    <Badge variant={getStatusVariant(pvc.status)}>{pvc.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pvc.volume || "-"}
                  </TableCell>
                  <TableCell>{pvc.capacity || "Pending"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {pvc.access_modes.map((mode: string) => (
                        <Badge key={mode} variant="secondary" className="text-xs">
                          {mode}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pvc.storage_class || "-"}
                  </TableCell>
                  <TableCell>{pvc.age}</TableCell>
                  <TableCell className="text-right">
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
  );
}
