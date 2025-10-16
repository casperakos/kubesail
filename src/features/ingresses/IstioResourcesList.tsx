import {
  useIstioVirtualServices,
  useIstioGateways,
  useServices,
  usePods,
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
import { RefreshCw, Network, Shield, ChevronDown, ChevronRight } from "lucide-react";
import { IstioVirtualServiceInfo, IstioGatewayInfo, PodInfo, ServiceInfo } from "../../types";
import { useState, useMemo } from "react";

// Utility function to check if a service selector matches pod labels
function serviceSelectorMatchesPodLabels(
  serviceSelector: Record<string, string> | undefined,
  podLabels: Record<string, string> | undefined
): boolean {
  if (!serviceSelector || Object.keys(serviceSelector).length === 0) {
    return false;
  }
  if (!podLabels) {
    return false;
  }

  // All service selector labels must match pod labels
  return Object.entries(serviceSelector).every(
    ([key, value]) => podLabels[key] === value
  );
}

export function IstioResourcesList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setCurrentNamespace = useAppStore((state) => state.setCurrentNamespace);
  const setPodSearchFilter = useAppStore((state) => state.setPodSearchFilter);
  const setServiceSearchFilter = useAppStore((state) => state.setServiceSearchFilter);
  const [expandedVirtualServices, setExpandedVirtualServices] = useState<Set<string>>(new Set());

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

  const { data: services } = useServices(currentNamespace);
  const { data: pods } = usePods(currentNamespace);

  const toggleVirtualServiceExpand = (vsName: string) => {
    const newExpanded = new Set(expandedVirtualServices);
    if (newExpanded.has(vsName)) {
      newExpanded.delete(vsName);
    } else {
      newExpanded.add(vsName);
    }
    setExpandedVirtualServices(newExpanded);
  };

  const navigateToService = (serviceName?: string) => {
    if (serviceName) {
      setServiceSearchFilter(serviceName);
    } else {
      setServiceSearchFilter(undefined);
    }
    setCurrentView("services");
  };

  const navigateToPod = (podName?: string) => {
    if (podName) {
      setPodSearchFilter(podName);
    } else {
      setPodSearchFilter(undefined);
    }
    setCurrentView("pods");
  };

  // Map destination hosts to services and their pods with routing rules
  const virtualServiceRoutesMap = useMemo(() => {
    if (!services || !pods || !virtualServices) return new Map();

    const map = new Map<string, Array<{
      route: any;
      service: ServiceInfo | null;
      pods: PodInfo[];
    }>>();

    virtualServices.forEach((vs) => {
      const routeDetails: Array<{
        route: any;
        service: ServiceInfo | null;
        pods: PodInfo[];
      }> = [];

      vs.routes.forEach((route) => {
        // Match destination_host with service names (handle both short name and FQDN)
        const matchedService = services.find((svc) => {
          const shortName = svc.name;
          const fqdn = `${svc.name}.${svc.namespace}.svc.cluster.local`;
          return route.destination_host === shortName ||
                 route.destination_host === fqdn ||
                 route.destination_host.startsWith(`${shortName}.`);
        });

        // Find pods for this service
        const matchedPods = matchedService ? pods.filter((pod) =>
          pod.namespace === matchedService.namespace &&
          serviceSelectorMatchesPodLabels(matchedService.selector, pod.labels)
        ) : [];

        routeDetails.push({
          route,
          service: matchedService || null,
          pods: matchedPods,
        });
      });

      map.set(vs.name, routeDetails);
    });

    return map;
  }, [virtualServices, services, pods]);

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
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Hosts</TableHead>
                <TableHead>Gateways</TableHead>
                <TableHead>Destinations</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {virtualServices.flatMap((vs: IstioVirtualServiceInfo) => {
                const routeDetails = virtualServiceRoutesMap.get(vs.name) || [];
                const isExpanded = expandedVirtualServices.has(vs.name);
                const hasRoutes = routeDetails.length > 0;
                const uniqueServices = new Set(routeDetails.map(r => r.service?.name).filter(Boolean));

                return [
                  // Main VirtualService row
                  <TableRow key={vs.name}>
                    <TableCell>
                      {hasRoutes && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleVirtualServiceExpand(vs.name)}
                          className="h-6 w-6"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
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
                    <TableCell>
                      <Badge variant={hasRoutes ? "default" : "secondary"}>
                        {hasRoutes ? `${routeDetails.length} ${routeDetails.length === 1 ? "route" : "routes"}` : "No routes"}
                      </Badge>
                    </TableCell>
                    <TableCell>{vs.age}</TableCell>
                  </TableRow>,
                  // Expandable row for routing flow
                  ...(isExpanded && hasRoutes
                    ? [
                        <TableRow key={`${vs.name}-routes`} className="bg-muted/20">
                          <TableCell colSpan={6}>
                            <div className="px-4 py-3">
                              <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                                Routing Flow ({routeDetails.length} {routeDetails.length === 1 ? "rule" : "rules"})
                              </h4>
                              <div className="space-y-4">
                                {routeDetails.map((routeDetail, routeIdx) => {
                                  const { route, service, pods } = routeDetail;

                                  // Format match conditions
                                  const matchText = route.match_conditions.map((match: any) => {
                                    const parts = [];
                                    if (match.uri_prefix) parts.push(`Prefix: ${match.uri_prefix}`);
                                    if (match.uri_exact) parts.push(`Exact: ${match.uri_exact}`);
                                    if (match.uri_regex) parts.push(`Regex: ${match.uri_regex}`);
                                    if (match.headers && match.headers.length > 0) {
                                      parts.push(`Headers: [${match.headers.join(', ')}]`);
                                    }
                                    return parts.join(' + ');
                                  }).join(' OR ');

                                  return (
                                    <div
                                      key={routeIdx}
                                      className="relative p-4 rounded-lg bg-gradient-to-r from-background/80 to-background/60 border border-border/50"
                                    >
                                      {/* Flow visualization */}
                                      <div className="flex items-center gap-3 flex-wrap">
                                        {/* Match Condition */}
                                        <div className="flex-shrink-0 p-3 rounded-md bg-blue-500/10 border border-blue-500/30">
                                          <div className="text-xs text-muted-foreground mb-1">MATCH</div>
                                          <div className="font-mono text-sm text-blue-600 dark:text-blue-400">
                                            {matchText || '/'}
                                          </div>
                                        </div>

                                        {/* Arrow */}
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                          <div className="w-8 h-0.5 bg-border"></div>
                                          <span className="text-lg">→</span>
                                        </div>

                                        {/* Service */}
                                        <div
                                          className="flex-shrink-0 p-3 rounded-md bg-green-500/10 border border-green-500/30 cursor-pointer hover:bg-green-500/20 transition-colors"
                                          onClick={() => navigateToService(service?.name)}
                                          title={service ? `Click to view ${service.name}` : "Click to view all services"}
                                        >
                                          <div className="text-xs text-muted-foreground mb-1">SERVICE</div>
                                          <div className="flex items-center gap-2">
                                            <Network className="w-4 h-4 text-green-600 dark:text-green-400" />
                                            <span className="font-mono text-sm text-green-600 dark:text-green-400">
                                              {service?.name || route.destination_host}
                                              {route.destination_port && `:${route.destination_port}`}
                                            </span>
                                            {route.weight && (
                                              <Badge variant="outline" className="text-xs">
                                                {route.weight}%
                                              </Badge>
                                            )}
                                          </div>
                                        </div>

                                        {/* Arrow to Pods */}
                                        {service && pods.length > 0 && (
                                          <>
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                              <div className="w-8 h-0.5 bg-border"></div>
                                              <span className="text-lg">→</span>
                                            </div>

                                            {/* Pods */}
                                            <div
                                              className="flex-shrink-0 p-3 rounded-md bg-purple-500/10 border border-purple-500/30"
                                            >
                                              <div className="text-xs text-muted-foreground mb-2">
                                                PODS ({pods.length})
                                              </div>
                                              <div className="space-y-1.5">
                                                {pods.slice(0, 3).map((pod) => (
                                                  <div
                                                    key={pod.name}
                                                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-purple-500/10 p-1 rounded transition-colors"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      navigateToPod(pod.name);
                                                    }}
                                                    title={`Click to view ${pod.name}`}
                                                  >
                                                    <div
                                                      className={`w-2 h-2 rounded-full ${
                                                        pod.status === "Running"
                                                          ? "bg-green-500"
                                                          : pod.status === "Pending"
                                                          ? "bg-yellow-500"
                                                          : "bg-red-500"
                                                      }`}
                                                    ></div>
                                                    <span className="font-mono text-purple-600 dark:text-purple-400 truncate max-w-[200px]">
                                                      {pod.name}
                                                    </span>
                                                  </div>
                                                ))}
                                                {pods.length > 3 && (
                                                  <div
                                                    className="text-xs text-muted-foreground pl-4 cursor-pointer hover:text-foreground transition-colors"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      navigateToPod();
                                                    }}
                                                    title="Click to view all pods"
                                                  >
                                                    +{pods.length - 3} more
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>,
                      ]
                    : []),
                ];
              })}
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
