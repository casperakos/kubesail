import { useState } from "react";
import type { PodInfo } from "../types";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { X } from "lucide-react";

interface PodSelectorModalProps {
  pods: PodInfo[];
  resourceType: string;
  resourceName: string;
  onSelectPod: (podName: string, namespace: string) => void;
  onSelectAllPods: (pods: Array<{name: string; namespace: string}>) => void;
  onClose: () => void;
}

export function PodSelectorModal({
  pods,
  resourceType,
  resourceName,
  onSelectPod,
  onSelectAllPods,
  onClose,
}: PodSelectorModalProps) {
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "running":
        return "success";
      case "pending":
        return "warning";
      case "failed":
      case "error":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const handleViewAll = () => {
    const podsList = pods.map(pod => ({ name: pod.name, namespace: pod.namespace }));
    onSelectAllPods(podsList);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Select Pod for Logs
            </h3>
            <p className="text-sm text-muted-foreground">
              {resourceType}: <span className="font-mono">{resourceName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {pods.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No pods found for this {resourceType}
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Button
                onClick={handleViewAll}
                className="w-full"
                variant="outline"
              >
                View Combined Logs ({pods.length} pods)
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {pods.map((pod) => (
                <button
                  key={pod.name}
                  onClick={() => onSelectPod(pod.name, pod.namespace)}
                  className="w-full p-4 border border-border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-medium text-sm">
                      {pod.name}
                    </span>
                    <Badge variant={getStatusVariant(pod.status)}>
                      {pod.status}
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Ready: {pod.ready}</span>
                    <span>Restarts: {pod.restarts}</span>
                    <span>Age: {pod.age}</span>
                    {pod.node && <span>Node: {pod.node}</span>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
