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
import { RefreshCw, Search, X, FileText, ArrowRightLeft } from "lucide-react";
import { useState, useMemo } from "react";
import { YamlViewer } from "../../components/YamlViewer";
import { PortForwardModal } from "../../components/PortForwardModal";

export function ServicesList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const { data: services, isLoading, error, refetch } = useServices(currentNamespace);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [selectedServiceForPortForward, setSelectedServiceForPortForward] = useState<string | null>(null);

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
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
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
            <TableHead>Type</TableHead>
            <TableHead>Cluster IP</TableHead>
            <TableHead>External IP</TableHead>
            <TableHead>Ports</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedServiceForPortForward(service.name)}
                    title="Port Forward"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedResource(service.name)}
                    title="View YAML"
                  >
                    <FileText className="w-4 h-4" />
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
          resourceName={selectedResource}
          namespace={currentNamespace}
          onClose={() => setSelectedResource(null)}
        />
      )}

      {selectedServiceForPortForward && (
        <PortForwardModal
          resourceType="service"
          resourceName={selectedServiceForPortForward}
          namespace={currentNamespace}
          onClose={() => setSelectedServiceForPortForward(null)}
        />
      )}
    </div>
  );
}
