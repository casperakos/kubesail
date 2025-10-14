import { useServices } from "../../hooks/useKube";
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

export function ServicesList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const { data: services, isLoading, error, refetch } = useServices(currentNamespace);

  const getTypeVariant = (type: string) => {
    switch (type) {
      case "LoadBalancer":
        return "default";
      case "NodePort":
        return "secondary";
      case "ClusterIP":
        return "secondary";
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
        Error loading services: {error.message}
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No services found in namespace "{currentNamespace}"
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Services</h2>
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Cluster IP</TableHead>
            <TableHead>External IP</TableHead>
            <TableHead>Ports</TableHead>
            <TableHead>Age</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) => (
            <TableRow key={service.name}>
              <TableCell className="font-medium">{service.name}</TableCell>
              <TableCell>
                <Badge variant={getTypeVariant(service.service_type)}>
                  {service.service_type}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {service.cluster_ip}
              </TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">
                {service.external_ip || "-"}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {service.ports}
              </TableCell>
              <TableCell>{service.age}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
