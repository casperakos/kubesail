import { useIngresses } from "../../hooks/useKube";
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
import { RefreshCw, Shield, Globe } from "lucide-react";
import { IngressInfo } from "../../types";

export function IngressesList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const { data: ingresses, isLoading, error, refetch } = useIngresses(currentNamespace);

  const getIngressClassVariant = (className?: string) => {
    if (!className) return "secondary";
    if (className.includes("nginx")) return "default";
    if (className.includes("istio")) return "success";
    if (className.includes("traefik")) return "warning";
    return "secondary";
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
        Error loading ingresses: {error.message}
      </div>
    );
  }

  if (!ingresses || ingresses.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No ingresses found in namespace "{currentNamespace}"
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Ingress Resources</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Nginx, Istio, Traefik, and other ingress controllers
          </p>
        </div>
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
            <TableHead>Class</TableHead>
            <TableHead>Hosts</TableHead>
            <TableHead>Addresses</TableHead>
            <TableHead>TLS</TableHead>
            <TableHead>Age</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingresses.map((ingress: IngressInfo) => (
            <TableRow key={ingress.name}>
              <TableCell className="font-medium">{ingress.name}</TableCell>
              <TableCell>
                {ingress.class ? (
                  <Badge variant={getIngressClassVariant(ingress.class)}>
                    {ingress.class}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {ingress.hosts.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {ingress.hosts.map((host, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-sm">
                        <Globe className="w-3 h-3" />
                        <span className="font-mono">{host}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">*</span>
                )}
              </TableCell>
              <TableCell>
                {ingress.addresses.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {ingress.addresses.map((addr, idx) => (
                      <span key={idx} className="font-mono text-sm">
                        {addr}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Pending...</span>
                )}
              </TableCell>
              <TableCell>
                {ingress.tls ? (
                  <div className="flex items-center gap-1 text-green-500">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm">Enabled</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">No</span>
                )}
              </TableCell>
              <TableCell>{ingress.age}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
