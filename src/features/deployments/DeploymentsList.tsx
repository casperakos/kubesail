import { useDeployments, useScaleDeployment } from "../../hooks/useKube";
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
import { RefreshCw, Search, X } from "lucide-react";
import { useState, useMemo } from "react";

export function DeploymentsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const { data: deployments, isLoading, error, refetch } = useDeployments(currentNamespace);
  const scaleDeployment = useScaleDeployment();
  const [scalingDeployment, setScalingDeployment] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleScale = (deploymentName: string, currentReplicas: number) => {
    const newReplicas = window.prompt(
      `Current replicas: ${currentReplicas}\nEnter new replica count:`,
      currentReplicas.toString()
    );

    if (newReplicas !== null) {
      const replicas = parseInt(newReplicas, 10);
      if (!isNaN(replicas) && replicas >= 0) {
        setScalingDeployment(deploymentName);
        scaleDeployment.mutate(
          {
            namespace: currentNamespace,
            deploymentName,
            replicas,
          },
          {
            onSettled: () => setScalingDeployment(null),
          }
        );
      }
    }
  };

  // Filter deployments based on search query
  const filteredDeployments = useMemo(() => {
    if (!deployments) return [];
    if (!searchQuery) return deployments;

    const query = searchQuery.toLowerCase();
    return deployments.filter(deployment =>
      deployment.name.toLowerCase().includes(query) ||
      deployment.ready.toLowerCase().includes(query)
    );
  }, [deployments, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading deployments...</p>
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
            <h3 className="font-semibold text-destructive mb-1">Error loading deployments</h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!deployments || deployments.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">No deployments found</h3>
            <p className="text-sm text-muted-foreground">
              No deployments found in namespace "{currentNamespace}"
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
              Deployments
            </h2>
            <Badge variant="secondary" className="ml-2">
              {filteredDeployments?.length || 0} {searchQuery && `of ${deployments?.length || 0}`}
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
            placeholder="Search by name or ready status..."
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
            <TableHead>Ready</TableHead>
            <TableHead>Up-to-date</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredDeployments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                {searchQuery ? `No deployments found matching "${searchQuery}"` : "No deployments found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredDeployments.map((deployment) => {
            const [ready, total] = deployment.ready.split("/").map(Number);
            return (
              <TableRow key={deployment.name}>
                <TableCell className="font-medium">{deployment.name}</TableCell>
                <TableCell>
                  <span className={ready === total ? "text-green-500" : "text-yellow-500"}>
                    {deployment.ready}
                  </span>
                </TableCell>
                <TableCell>{deployment.up_to_date}</TableCell>
                <TableCell>{deployment.available}</TableCell>
                <TableCell>{deployment.age}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleScale(deployment.name, total)}
                    disabled={scalingDeployment === deployment.name}
                  >
                    Scale
                  </Button>
                </TableCell>
              </TableRow>
            );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
