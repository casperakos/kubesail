import {
  useIstioVirtualServices,
  useIstioGateways,
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
import { RefreshCw, Network, Shield } from "lucide-react";
import { IstioVirtualServiceInfo, IstioGatewayInfo } from "../../types";

export function IstioResourcesList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const {
    data: virtualServices,
    isLoading: vsLoading,
    error: vsError,
    refetch: refetchVS,
  } = useIstioVirtualServices(currentNamespace);

  const {
    data: gateways,
    isLoading: gwLoading,
    error: gwError,
    refetch: refetchGW,
  } = useIstioGateways(currentNamespace);

  const isLoading = vsLoading || gwLoading;
  const error = vsError || gwError;

  const handleRefresh = () => {
    refetchVS();
    refetchGW();
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
        Error loading Istio resources: {error.message}
      </div>
    );
  }

  const hasResources =
    (virtualServices && virtualServices.length > 0) ||
    (gateways && gateways.length > 0);

  if (!hasResources) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <Network className="w-12 h-12 text-muted-foreground/50" />
          <p>No Istio resources found in namespace "{currentNamespace}"</p>
          <p className="text-xs">
            Make sure Istio is installed and configured in your cluster
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Istio Service Mesh</h2>
          <p className="text-sm text-muted-foreground mt-1">
            VirtualServices and Gateways for traffic management
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Virtual Services */}
      {virtualServices && virtualServices.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Network className="w-5 h-5" />
            Virtual Services
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Hosts</TableHead>
                <TableHead>Gateways</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {virtualServices.map((vs: IstioVirtualServiceInfo) => (
                <TableRow key={vs.name}>
                  <TableCell className="font-medium">{vs.name}</TableCell>
                  <TableCell>
                    {vs.hosts.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {vs.hosts.map((host, idx) => (
                          <Badge key={idx} variant="secondary">
                            {host}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {vs.gateways.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {vs.gateways.map((gw, idx) => (
                          <Badge key={idx} variant="default">
                            {gw}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">mesh</span>
                    )}
                  </TableCell>
                  <TableCell>{vs.age}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Gateways */}
      {gateways && gateways.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Gateways
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Servers</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gateways.map((gw: IstioGatewayInfo) => (
                <TableRow key={gw.name}>
                  <TableCell className="font-medium">{gw.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      {gw.servers.map((server, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Badge variant="secondary">
                            {server.port} / {server.protocol}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono text-xs">
                            {server.hosts.join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{gw.age}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
