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
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import { WorkflowNodeComponent } from "./WorkflowNodeComponent";
import { ZoomIn, ZoomOut, Maximize2, Download } from "lucide-react";
import { Button } from "./ui/Button";

const nodeTypes = {
  workflowNode: WorkflowNodeComponent,
};

interface WorkflowDAGViewerProps {
  nodes: Record<string, any>;
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

  // First pass: create all nodes
  Object.entries(workflowNodes).forEach(([nodeId, node]: [string, any]) => {
    nodeMap.set(nodeId, node);

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
  });

  // Second pass: create edges based on children relationships
  Object.entries(workflowNodes).forEach(([nodeId, node]: [string, any]) => {
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((childId: string) => {
        // Only create edge if child exists
        if (nodeMap.has(childId)) {
          const isRunning = node.phase === "Running";
          const childNode = nodeMap.get(childId);
          const childRunning = childNode?.phase === "Running";

          edges.push({
            id: `${nodeId}-${childId}`,
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
    }
  });

  return { nodes, edges };
}

export function WorkflowDAGViewer({ nodes: workflowNodes }: WorkflowDAGViewerProps) {
  const [direction, setDirection] = useState<"TB" | "LR">("TB");

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
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">No workflow nodes available</p>
          <p className="text-sm">The workflow might not have started yet or nodes data is unavailable.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
    </div>
  );
}
