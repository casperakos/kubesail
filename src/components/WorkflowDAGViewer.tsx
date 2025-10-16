import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  Panel,
  NodeProps,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import { WorkflowNodeComponent } from "./WorkflowNodeComponent";
import { ZoomIn, ZoomOut, Maximize2, Download, X, FileText } from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { invoke } from "@tauri-apps/api/core";

const nodeTypes = {
  workflowNode: WorkflowNodeComponent,
};

interface WorkflowDAGViewerProps {
  nodes: Record<string, any>;
  namespace?: string;
  workflowName?: string;
}

// Layout algorithm using dagre
function getLayoutedElements(nodes: Node[], edges: Edge[], direction = "TB") {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 220;
  const nodeHeight = 120;

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 80,
    nodesep: 60,
    marginx: 20,
    marginy: 20,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// Convert Argo workflow nodes to React Flow format
function convertToReactFlowElements(workflowNodes: Record<string, any>): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeMap = new Map<string, any>();

  // Helper to check if a node should be displayed
  // Argo UI typically shows only "Pod" type nodes (actual execution) and filters out boundary/container nodes
  const shouldDisplayNode = (node: any): boolean => {
    // Always show Pod nodes (actual execution)
    if (node.type === "Pod") {
      return true;
    }

    // Show DAG/Steps nodes if they don't have a boundaryID (top-level templates)
    if ((node.type === "DAG" || node.type === "Steps") && !node.boundaryID) {
      return true;
    }

    // Show TaskGroup nodes
    if (node.type === "TaskGroup") {
      return true;
    }

    // Filter out Retry, StepGroup, DAGTask unless they have no children (leaf nodes)
    if (node.type === "Retry" || node.type === "StepGroup" || node.type === "DAGTask") {
      return false;
    }

    // Show Suspend, Skipped nodes
    if (node.type === "Suspend" || node.type === "Skipped") {
      return true;
    }

    return false;
  };

  // First pass: create nodes for displayable items only
  Object.entries(workflowNodes).forEach(([nodeId, node]: [string, any]) => {
    nodeMap.set(nodeId, node);

    if (shouldDisplayNode(node)) {
      nodes.push({
        id: nodeId,
        type: "workflowNode",
        position: { x: 0, y: 0 }, // Will be set by layout algorithm
        data: {
          label: node.displayName || node.name || nodeId,
          phase: node.phase || "Unknown",
          type: node.type || "Unknown",
          message: node.message,
          startTime: node.startedAt,
          finishTime: node.finishedAt,
        },
      });
    }
  });

  // Create a set of displayed node IDs for quick lookup
  const displayedNodeIds = new Set(nodes.map(n => n.id));

  // Helper to find displayable children recursively
  const findDisplayableChildren = (nodeId: string): string[] => {
    const node = nodeMap.get(nodeId);
    if (!node || !node.children) return [];

    const displayableChildren: string[] = [];

    for (const childId of node.children) {
      if (displayedNodeIds.has(childId)) {
        // Child is displayable, add it
        displayableChildren.push(childId);
      } else {
        // Child is not displayable, recursively get its displayable children
        displayableChildren.push(...findDisplayableChildren(childId));
      }
    }

    return displayableChildren;
  };

  // Second pass: create edges between displayed nodes
  Object.entries(workflowNodes).forEach(([nodeId, node]: [string, any]) => {
    // Only process if this node is displayed
    if (!displayedNodeIds.has(nodeId)) return;

    const displayableChildren = findDisplayableChildren(nodeId);

    displayableChildren.forEach((childId: string) => {
      const childNode = nodeMap.get(childId);
      const isRunning = node.phase === "Running";
      const childRunning = childNode?.phase === "Running";

      // Avoid duplicate edges
      const edgeId = `${nodeId}-${childId}`;
      if (!edges.find(e => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          source: nodeId,
          target: childId,
          type: "smoothstep",
          animated: isRunning || childRunning,
          style: {
            strokeWidth: 2,
            stroke: isRunning || childRunning ? "#3b82f6" : "#9ca3af",
          },
        });
      }
    });
  });

  return { nodes, edges };
}

export function WorkflowDAGViewer({ nodes: workflowNodes, namespace, workflowName }: WorkflowDAGViewerProps) {
  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [logs, setLogs] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Convert and layout nodes
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!workflowNodes || Object.keys(workflowNodes).length === 0) {
      return { nodes: [], edges: [] };
    }

    const { nodes: convertedNodes, edges: convertedEdges } =
      convertToReactFlowElements(workflowNodes);
    return getLayoutedElements(convertedNodes, convertedEdges, direction);
  }, [workflowNodes, direction]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onLayout = useCallback(
    (newDirection: "TB" | "LR") => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        newDirection
      );

      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
      setDirection(newDirection);
    },
    [nodes, edges, setNodes, setEdges]
  );

  // Handle node click
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const fullNodeData = workflowNodes[node.id];
      setSelectedNode(fullNodeData);
      setLogs("");
    },
    [workflowNodes]
  );

  // Fetch logs for a node
  const fetchLogs = useCallback(async () => {
    if (!selectedNode || !namespace) return;

    setLoadingLogs(true);
    try {
      // The pod name is usually the node ID for Argo Workflows
      const podName = selectedNode.id;
      const logs = await invoke<string>("get_pod_logs", {
        namespace,
        podName,
        containerName: "main", // Argo Workflows uses "main" as default container
      });
      setLogs(logs);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      setLogs(`Error fetching logs: ${error}`);
    } finally {
      setLoadingLogs(false);
    }
  }, [selectedNode, namespace]);

  // Count nodes by phase
  const stats = useMemo(() => {
    const phaseCount: Record<string, number> = {};
    Object.values(workflowNodes || {}).forEach((node: any) => {
      const phase = node.phase || "Unknown";
      phaseCount[phase] = (phaseCount[phase] || 0) + 1;
    });
    return phaseCount;
  }, [workflowNodes]);

  if (!workflowNodes || Object.keys(workflowNodes).length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">No workflow nodes available</p>
          <p className="text-sm">The workflow might not have started yet or nodes data is unavailable.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
        }}
        className="bg-background"
      >
        <Background className="bg-muted/20" />
        <Controls className="bg-background border border-border rounded-lg shadow-lg" />
        <MiniMap
          className="bg-background border border-border rounded-lg shadow-lg"
          nodeColor={(node) => {
            const phase = node.data.phase?.toLowerCase();
            switch (phase) {
              case "succeeded":
                return "#22c55e";
              case "failed":
              case "error":
                return "#ef4444";
              case "running":
                return "#3b82f6";
              case "pending":
                return "#eab308";
              default:
                return "#9ca3af";
            }
          }}
        />

        {/* Stats Panel */}
        <Panel position="top-left" className="bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-4 space-y-2">
          <div className="text-sm font-semibold mb-3">Workflow Statistics</div>
          <div className="space-y-1">
            {Object.entries(stats).map(([phase, count]) => (
              <div key={phase} className="flex items-center justify-between gap-4 text-xs">
                <span className="text-muted-foreground">{phase}:</span>
                <span className="font-mono font-semibold">{count}</span>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-border mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-mono font-semibold">
                {Object.keys(workflowNodes).length}
              </span>
            </div>
          </div>
        </Panel>

        {/* Layout Controls */}
        <Panel position="top-right" className="flex gap-2">
          <Button
            onClick={() => onLayout("TB")}
            variant={direction === "TB" ? "default" : "outline"}
            size="sm"
            className="shadow-lg"
          >
            Vertical
          </Button>
          <Button
            onClick={() => onLayout("LR")}
            variant={direction === "LR" ? "default" : "outline"}
            size="sm"
            className="shadow-lg"
          >
            Horizontal
          </Button>
        </Panel>
      </ReactFlow>

      {/* Node Details Modal */}
      {selectedNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl border border-border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h3 className="text-xl font-bold">{selectedNode.displayName || selectedNode.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">Workflow Node Details</p>
              </div>
              <Button
                onClick={() => setSelectedNode(null)}
                variant="ghost"
                size="sm"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* Node Information */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Node Information</h4>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Phase</p>
                    <Badge
                      className={
                        selectedNode.phase === "Succeeded"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : selectedNode.phase === "Failed" || selectedNode.phase === "Error"
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : selectedNode.phase === "Running"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : selectedNode.phase === "Pending"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : ""
                      }
                    >
                      {selectedNode.phase}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Type</p>
                    <p className="text-sm font-mono">{selectedNode.type}</p>
                  </div>
                  {selectedNode.startedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Started</p>
                      <p className="text-sm">{new Date(selectedNode.startedAt).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedNode.finishedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Finished</p>
                      <p className="text-sm">{new Date(selectedNode.finishedAt).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedNode.hostNodeName && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Host Node</p>
                      <p className="text-sm font-mono">{selectedNode.hostNodeName}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {selectedNode.message && (selectedNode.phase === "Failed" || selectedNode.phase === "Error") && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-red-600 uppercase tracking-wide">Error Message</h4>
                  <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-800 dark:text-red-200 font-mono whitespace-pre-wrap">
                      {selectedNode.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Message for other statuses */}
              {selectedNode.message && selectedNode.phase !== "Failed" && selectedNode.phase !== "Error" && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Message</h4>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-foreground font-mono whitespace-pre-wrap">
                      {selectedNode.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Logs Section */}
              {namespace && selectedNode.type === "Pod" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pod Logs</h4>
                    <Button
                      onClick={fetchLogs}
                      disabled={loadingLogs}
                      size="sm"
                      variant="outline"
                    >
                      {loadingLogs ? (
                        <>Loading...</>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          Fetch Logs
                        </>
                      )}
                    </Button>
                  </div>
                  {logs && (
                    <div className="p-4 bg-muted/30 rounded-lg max-h-96 overflow-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap">{logs}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
              <Button onClick={() => setSelectedNode(null)} variant="outline">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
