import { useServices, useDeleteService } from "../../hooks/useKube";
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
import { RefreshCw, Search, X, Code, ArrowRightLeft, Trash2, FileText } from "lucide-react";
import { useState, useMemo } from "react";
import { YamlViewer } from "../../components/YamlViewer";
import { ResourceDescribeViewer } from "../../components/ResourceDescribeViewer";
import { PortForwardModal } from "../../components/PortForwardModal";

export function ServicesList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const { data: services, isLoading, error, refetch } = useServices(currentNamespace);
  const deleteService = useDeleteService();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<{name: string; namespace: string} | null>(null);
  const [selectedServiceForDescribe, setSelectedServiceForDescribe] = useState<{name: string; namespace: string} | null>(null);
  const [selectedServiceForPortForward, setSelectedServiceForPortForward] = useState<{name: string; namespace: string} | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);

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
            <TableHead>Name</TableHead>
            {showNamespaceColumn && <TableHead>Namespace</TableHead>}
            <TableHead>Type</TableHead>
            <TableHead>Cluster IP</TableHead>
            <TableHead>External IP</TableHead>
            <TableHead>Ports</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredServices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                {searchQuery ? `No services found matching "${searchQuery}"` : "No services found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredServices.map((service) => (
            <TableRow key={service.name}>
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
            </TableRow>
            ))
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
