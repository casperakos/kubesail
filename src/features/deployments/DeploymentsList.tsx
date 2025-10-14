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
import { Button } from "../../components/ui/Button";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export function DeploymentsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const { data: deployments, isLoading, error, refetch } = useDeployments(currentNamespace);
  const scaleDeployment = useScaleDeployment();
  const [scalingDeployment, setScalingDeployment] = useState<string | null>(null);

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
        Error loading deployments: {error.message}
      </div>
    );
  }

  if (!deployments || deployments.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No deployments found in namespace "{currentNamespace}"
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Deployments</h2>
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
            <TableHead>Ready</TableHead>
            <TableHead>Up-to-date</TableHead>
            <TableHead>Available</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deployments.map((deployment) => {
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
          })}
        </TableBody>
      </Table>
    </div>
  );
}
