import { useServices, useDeleteService, usePods } from "../../hooks/useKube";
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
import { RefreshCw, Search, X, Code, ArrowRightLeft, Trash2, FileText, ChevronDown, ChevronRight, Network } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { YamlViewer } from "../../components/YamlViewer";
import { ResourceDescribeViewer } from "../../components/ResourceDescribeViewer";
import { PortForwardModal } from "../../components/PortForwardModal";
import { PodInfo, ServiceInfo } from "../../types";

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

export function ServicesList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const serviceSearchFilter = useAppStore((state) => state.serviceSearchFilter);
  const setServiceSearchFilter = useAppStore((state) => state.setServiceSearchFilter);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const setPodSearchFilter = useAppStore((state) => state.setPodSearchFilter);
  const showNamespaceColumn = !currentNamespace;
  const { data: services, isLoading, error, refetch } = useServices(currentNamespace);
  const { data: pods } = usePods(currentNamespace);
  const deleteService = useDeleteService();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<{name: string; namespace: string} | null>(null);
  const [selectedServiceForDescribe, setSelectedServiceForDescribe] = useState<{name: string; namespace: string} | null>(null);
  const [selectedServiceForPortForward, setSelectedServiceForPortForward] = useState<{name: string; namespace: string} | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  const handleDelete = (serviceName: string) => {
    setServiceToDelete(serviceName);
  };

  const confirmDelete = () => {
    if (serviceToDelete) {
      const service = services?.find(s => s.name === serviceToDelete);
      if (service) {
        deleteService.mutate({
          namespace: service.namespace,
          serviceName: serviceToDelete,
        });
      }
      setServiceToDelete(null);
    }
  };

  const cancelDelete = () => {
    setServiceToDelete(null);
  };

  const toggleServiceExpand = (serviceName: string) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(serviceName)) {
      newExpanded.delete(serviceName);
    } else {
      newExpanded.add(serviceName);
    }
    setExpandedServices(newExpanded);
  };

  const navigateToPod = (podName?: string) => {
    if (podName) {
      setPodSearchFilter(podName);
    } else {
      setPodSearchFilter(undefined);
    }
    setCurrentView("pods");
  };

  // Compute matched pods for each service
  const servicePodsMap = useMemo(() => {
    if (!services || !pods) return new Map<string, PodInfo[]>();

    const map = new Map<string, PodInfo[]>();
    services.forEach((service) => {
      const matchedPods = pods.filter((pod) =>
        // Match namespace and selector
        pod.namespace === service.namespace &&
        serviceSelectorMatchesPodLabels(service.selector, pod.labels)
      );
      map.set(service.name, matchedPods);
    });
    return map;
  }, [services, pods]);

  // Apply search filter from navigation
  useEffect(() => {
    if (serviceSearchFilter) {
      setSearchQuery(serviceSearchFilter);
      // Clear the filter after applying it
      setServiceSearchFilter(undefined);
    }
  }, [serviceSearchFilter, setServiceSearchFilter]);

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

  // Filter services based on search query
  const filteredServices = useMemo(() => {
    if (!services) return [];
    if (!searchQuery) return services;

    const query = searchQuery.toLowerCase();
    return services.filter(service =>
      service.name.toLowerCase().includes(query) ||
      service.service_type.toLowerCase().includes(query) ||
      service.cluster_ip.toLowerCase().includes(query) ||
      service.external_ip?.toLowerCase().includes(query) ||
      service.ports.toLowerCase().includes(query)
    );
  }, [services, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading services...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-xl border border-destructive/50 bg-gradient-to-br from-destructive/10 to-destructive/5 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-destructive mb-1">Error loading services</h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">No services found</h3>
            <p className="text-sm text-muted-foreground">
              No services found in namespace "{currentNamespace}"
            </p>
          </div>
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
            <div className="w-1 h-8 bg-gradient-to-b from-slate-500 to-zinc-500 rounded-full"></div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Services
            </h2>
            <Badge variant="secondary" className="ml-2">
              {filteredServices?.length || 0} {searchQuery && `of ${services?.length || 0}`}
            </Badge>
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

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, type, IP, or ports..."
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Name</TableHead>
            {showNamespaceColumn && <TableHead>Namespace</TableHead>}
            <TableHead>Type</TableHead>
            <TableHead>Cluster IP</TableHead>
            <TableHead>External IP</TableHead>
            <TableHead>Ports</TableHead>
            <TableHead>Pods</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredServices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                {searchQuery ? `No services found matching "${searchQuery}"` : "No services found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredServices.flatMap((service) => {
              const matchedPods = servicePodsMap.get(service.name) || [];
              const isExpanded = expandedServices.has(service.name);
              const colSpan = showNamespaceColumn ? 10 : 9;

              return [
                // Main service row
                <TableRow key={service.name}>
                  <TableCell>
                    {matchedPods.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleServiceExpand(service.name)}
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
                  <TableCell className="font-medium">{service.name}</TableCell>
                  {showNamespaceColumn && <TableCell>{service.namespace}</TableCell>}
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
                  <TableCell>
                    <Badge variant={matchedPods.length > 0 ? "default" : "secondary"}>
                      {matchedPods.length} {matchedPods.length === 1 ? "pod" : "pods"}
                    </Badge>
                  </TableCell>
                  <TableCell>{service.age}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {service.ports && service.ports !== "-" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedServiceForPortForward({name: service.name, namespace: service.namespace})}
                          title={`Port Forward (${service.ports})`}
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedResource({name: service.name, namespace: service.namespace})}
                        title="View YAML"
                      >
                        <Code className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedServiceForDescribe({name: service.name, namespace: service.namespace})}
                        title="Describe"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(service.name)}
                        disabled={deleteService.isPending}
                        title="Delete service"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>,
                // Expandable row for visual flow
                ...(isExpanded && matchedPods.length > 0
                  ? [
                      <TableRow key={`${service.name}-pods`} className="bg-muted/20">
                        <TableCell colSpan={colSpan}>
                          <div className="px-4 py-3">
                            <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                              Service → Pods Flow
                            </h4>
                            <div className="p-4 rounded-lg bg-gradient-to-r from-background/80 to-background/60 border border-border/50">
                              {/* Flow visualization */}
                              <div className="flex items-center gap-3 flex-wrap">
                                {/* Service */}
                                <div className="flex-shrink-0 p-3 rounded-md bg-green-500/10 border border-green-500/30">
                                  <div className="text-xs text-muted-foreground mb-1">SERVICE</div>
                                  <div className="flex items-center gap-2">
                                    <Network className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    <span className="font-mono text-sm text-green-600 dark:text-green-400">
                                      {service.name}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    <Badge variant="outline" className="text-xs">
                                      {service.service_type}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {service.ports}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Arrow */}
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <div className="w-8 h-0.5 bg-border"></div>
                                  <span className="text-lg">→</span>
                                </div>

                                {/* Pods */}
                                <div className="flex-shrink-0 p-3 rounded-md bg-purple-500/10 border border-purple-500/30">
                                  <div className="text-xs text-muted-foreground mb-2">
                                    PODS ({matchedPods.length})
                                  </div>
                                  <div className="space-y-1.5">
                                    {matchedPods.slice(0, 5).map((pod) => (
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
                                        <span className="text-muted-foreground">
                                          {pod.ready}
                                        </span>
                                      </div>
                                    ))}
                                    {matchedPods.length > 5 && (
                                      <div
                                        className="text-xs text-muted-foreground pl-4 cursor-pointer hover:text-foreground transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigateToPod();
                                        }}
                                        title="Click to view all pods"
                                      >
                                        +{matchedPods.length - 5} more
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>,
                    ]
                  : []),
              ];
            })
          )}
        </TableBody>
      </Table>

      {selectedResource && (
        <YamlViewer
          resourceType="service"
          resourceName={selectedResource.name}
          namespace={selectedResource.namespace}
          onClose={() => setSelectedResource(null)}
        />
      )}

      {selectedServiceForDescribe && (
        <ResourceDescribeViewer
          resourceType="service"
          name={selectedServiceForDescribe.name}
          namespace={selectedServiceForDescribe.namespace}
          onClose={() => setSelectedServiceForDescribe(null)}
        />
      )}

      {selectedServiceForPortForward && (
        <PortForwardModal
          resourceType="service"
          resourceName={selectedServiceForPortForward.name}
          namespace={selectedServiceForPortForward.namespace}
          onClose={() => setSelectedServiceForPortForward(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {serviceToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Deletion</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete service <span className="font-mono text-foreground">"{serviceToDelete}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelDelete}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteService.isPending}
              >
                {deleteService.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
