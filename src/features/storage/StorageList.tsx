import { useState } from "react";
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
import { RefreshCw } from "lucide-react";

type StorageType = "pv" | "pvc";

export function StorageList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const [activeTab, setActiveTab] = useState<StorageType>("pvc");

  const { data: pvs, isLoading: pvLoading, error: pvError, refetch: pvRefetch } =
    usePersistentVolumes();
  const { data: pvcs, isLoading: pvcLoading, error: pvcError, refetch: pvcRefetch } =
    usePersistentVolumeClaims(currentNamespace);

  const tabs: { value: StorageType; label: string; count: number }[] = [
    { value: "pvc", label: "PersistentVolumeClaims", count: pvcs?.length || 0 },
    { value: "pv", label: "PersistentVolumes", count: pvs?.length || 0 },
  ];

  const handleRefresh = () => {
    if (activeTab === "pv") {
      pvRefetch();
    } else {
      pvcRefetch();
    }
  };

  const isLoading = pvLoading || pvcLoading;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Storage</h2>
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
              {tab.count}
            </Badge>
          </button>
        ))}
      </div>

      {activeTab === "pv" && (
        <PersistentVolumesTable data={pvs} isLoading={pvLoading} error={pvError} />
      )}
      {activeTab === "pvc" && (
        <PersistentVolumeClaimsTable
          data={pvcs}
          isLoading={pvcLoading}
          error={pvcError}
        />
      )}
    </div>
  );
}

function PersistentVolumesTable({ data, isLoading, error }: any) {
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
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading persistent volumes: {error.message}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No persistent volumes found
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((pv: any) => (
          <TableRow key={pv.name}>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PersistentVolumeClaimsTable({ data, isLoading, error }: any) {
  const currentNamespace = useAppStore((state) => state.currentNamespace);

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
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading persistent volume claims: {error.message}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No persistent volume claims found in namespace "{currentNamespace}"
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Volume</TableHead>
          <TableHead>Capacity</TableHead>
          <TableHead>Access Modes</TableHead>
          <TableHead>Storage Class</TableHead>
          <TableHead>Age</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((pvc: any) => (
          <TableRow key={pvc.name}>
            <TableCell className="font-medium">{pvc.name}</TableCell>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
