import { useCallback, useMemo, useState, useEffect, useRef } from "react";
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
import { ZoomIn, ZoomOut, Maximize2, Download, X, FileText, Search, Copy, ArrowDown, Hash } from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

const nodeTypes = {
  workflowNode: WorkflowNodeComponent,
};

interface WorkflowDAGViewerProps {
  nodes: Record<string, any>;
  namespace?: string;
  workflowName?: string;
  viewMode?: "dag" | "all-logs";
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

export function WorkflowDAGViewer({ nodes: workflowNodes, namespace, workflowName, viewMode = "dag" }: WorkflowDAGViewerProps) {
  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [logs, setLogs] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [followMode, setFollowMode] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [allLogs, setAllLogs] = useState<Array<{stepName: string, logs: string, phase: string, startedAt?: string, nodeId: string}>>([]);
  const [loadingAllLogs, setLoadingAllLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const streamIntervalRef = useRef<number | null>(null);

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

  // Auto-scroll to bottom when follow mode is enabled
  useEffect(() => {
    if (followMode && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, followMode]);

  // Auto-fetch logs when a Pod node is selected
  useEffect(() => {
    if (selectedNode && selectedNode.type === "Pod" && namespace) {
      fetchLogs();
    }
  }, [selectedNode]);

  // Auto-fetch all logs when switching to all-logs view
  useEffect(() => {
    if (viewMode === "all-logs" && allLogs.length === 0 && namespace) {
      fetchAllLogs();
    }
  }, [viewMode, namespace]);

  // ESC key handler to close modals
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showLogsModal) {
          setShowLogsModal(false);
          setSelectedNode(null);
        }
      }
    };

    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [showLogsModal]);

  // Real-time log streaming for running pods
  useEffect(() => {
    // Clear any existing interval
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    // Set up streaming if the pod is running
    if (selectedNode && selectedNode.type === "Pod" && selectedNode.phase === "Running" && namespace) {
      streamIntervalRef.current = window.setInterval(() => {
        fetchLogs();
      }, 3000); // Refresh every 3 seconds
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
    };
  }, [selectedNode, namespace]);

  // Handle node click
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const fullNodeData = workflowNodes[node.id];
      setSelectedNode(fullNodeData);
      setLogs("");
      setSearchTerm("");
      setShowLogsModal(true);
    },
    [workflowNodes]
  );

  // Fetch logs for a node
  const fetchLogs = useCallback(async () => {
    if (!selectedNode || !namespace) return;

    setLoadingLogs(true);
    try {
      // In Argo Workflows, the node ID doesn't always match the pod name
      // We need to find the pod by its workflow node-id annotation
      const nodeId = selectedNode.id;

      // Fetch all pods in the namespace to find the one with matching node-id annotation
      let podName: string | null = null;
      try {
        const pods = await invoke<any[]>("get_pods", { namespace });
        const matchingPod = pods.find((pod: any) => {
          // First, check if pod has the Argo Workflows node-id annotation
          if (pod.annotations && pod.annotations["workflows.argoproj.io/node-id"] === nodeId) {
            return true;
          }

          // Fallback: check if pod name matches the node ID exactly
          if (pod.name === nodeId) {
            return true;
          }

          // Additional fallback: check if node ID is part of pod name
          // This handles cases where pod name is like "workflow-name-template-name-nodeId"
          return pod.name.includes(nodeId);
        });

        if (matchingPod) {
          podName = matchingPod.name;
          console.log(`Found matching pod: ${podName} for node: ${nodeId}`);
        } else {
          // Fallback to using node ID directly
          podName = nodeId;
          console.warn(`No matching pod found for node: ${nodeId}, will try using node ID as pod name`);
        }
      } catch (podsError) {
        console.error("Failed to fetch pods list:", podsError);
        // Fallback to using node ID directly
        podName = nodeId;
      }

      // Try to fetch logs
      try {
        const logsResult = await invoke<any>("get_pod_logs", {
          namespace,
          podName,
          container: "main", // Argo Workflows uses "main" as default container
        });

        // Handle the log entries format
        if (Array.isArray(logsResult)) {
          setLogs(logsResult.map((entry: any) => entry.message).join('\n'));
        } else {
          setLogs(String(logsResult));
        }
      } catch (podError: any) {
        const errorStr = String(podError);

        if (errorStr.includes('not found') || errorStr.includes('NotFound') || errorStr.includes('404')) {
          // Pod not found - check cluster events for more information
          let detailedMessage = `⚠️ Pod logs are no longer available\n\n` +
            `This pod (${podName}) is not currently in the cluster.\n\n`;

          try {
            // Fetch events to see if there's information about what happened
            const events = await invoke<any[]>("get_events", { namespace });

            // Filter events related to this pod
            const podEvents = events.filter((event: any) =>
              event.object && event.object.includes(podName)
            );

            if (podEvents.length > 0) {
              detailedMessage += `📋 Related Events:\n`;

              // Sort by last_seen (most recent first)
              podEvents.sort((a: any, b: any) => {
                // Simple comparison - events with 'm' are more recent than 'h', etc.
                return a.last_seen.localeCompare(b.last_seen);
              });

              // Show up to 5 most relevant events
              podEvents.slice(0, 5).forEach((event: any) => {
                const eventType = event.event_type === 'Warning' ? '⚠️' : 'ℹ️';
                detailedMessage += `${eventType} ${event.reason}: ${event.message}\n`;
                detailedMessage += `   (${event.last_seen} ago)\n`;
              });

              detailedMessage += `\n`;

              // Check for specific eviction/deletion reasons
              const evicted = podEvents.some((e: any) =>
                e.reason.toLowerCase().includes('evict') ||
                e.message.toLowerCase().includes('evict')
              );
              const oomKilled = podEvents.some((e: any) =>
                e.reason.toLowerCase().includes('oom') ||
                e.message.toLowerCase().includes('oom')
              );

              if (evicted) {
                detailedMessage += `🔍 Analysis: Pod was evicted from the node.\n`;
                detailedMessage += `   This typically happens due to resource pressure on the node.\n\n`;
              } else if (oomKilled) {
                detailedMessage += `🔍 Analysis: Pod was terminated due to Out Of Memory (OOM).\n`;
                detailedMessage += `   Consider increasing memory limits for this workflow step.\n\n`;
              }
            } else {
              detailedMessage += `No recent events found for this pod.\n`;
              detailedMessage += `The pod likely completed and was cleaned up by the workflow TTL policy.\n\n`;
            }
          } catch (eventsError) {
            console.error("Failed to fetch events:", eventsError);
            detailedMessage += `Could not fetch cluster events for additional context.\n\n`;
          }

          detailedMessage += `Possible reasons:\n` +
            `• Pod completed and was cleaned up (workflow TTL policy)\n` +
            `• Pod was evicted due to resource constraints\n` +
            `• Pod retention period expired\n` +
            `• Pod failed and was garbage collected\n\n` +
            `💡 To preserve logs:\n` +
            `• Configure workflow artifact archival in Argo Workflows\n` +
            `• Increase workflow TTL (ttlSecondsAfterFinished)\n` +
            `• Use external log aggregation (Loki, ELK, CloudWatch)\n` +
            `• Enable archive logs in workflow spec\n\n` +
            `Node Information:\n` +
            `• Phase: ${selectedNode.phase}\n` +
            `• Started: ${selectedNode.startedAt ? new Date(selectedNode.startedAt).toLocaleString() : 'N/A'}\n` +
            `• Finished: ${selectedNode.finishedAt ? new Date(selectedNode.finishedAt).toLocaleString() : 'N/A'}`;

          setLogs(detailedMessage);
        } else {
          setLogs(`Error fetching logs: ${podError}`);
        }
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      setLogs(`Error fetching logs: ${error}`);
    } finally {
      setLoadingLogs(false);
    }
  }, [selectedNode, namespace]);

  // Fetch logs from all Pod nodes in the workflow
  const fetchAllLogs = useCallback(async () => {
    if (!workflowNodes || !namespace) return;

    setLoadingAllLogs(true);
    const logsData: Array<{stepName: string, logs: string, phase: string, startedAt?: string, nodeId: string}> = [];

    try {
      // Get all pods first
      const pods = await invoke<any[]>("get_pods", { namespace });

      // Filter to only Pod type nodes
      const podNodes = Object.entries(workflowNodes).filter(
        ([_, node]: [string, any]) => node.type === "Pod"
      );

      // Fetch logs for each pod node
      for (const [nodeId, node] of podNodes) {
        try {
          // Find matching pod
          const matchingPod = pods.find((pod: any) => {
            if (pod.annotations && pod.annotations["workflows.argoproj.io/node-id"] === nodeId) {
              return true;
            }
            if (pod.name === nodeId) {
              return true;
            }
            return pod.name.includes(nodeId);
          });

          if (matchingPod) {
            try {
              const logsResult = await invoke<any>("get_pod_logs", {
                namespace,
                podName: matchingPod.name,
                container: "main",
              });

              let logText = "";
              if (Array.isArray(logsResult)) {
                logText = logsResult.map((entry: any) => entry.message).join('\n');
              } else {
                logText = String(logsResult);
              }

              logsData.push({
                stepName: node.displayName || node.name || nodeId,
                logs: logText || "(No logs available)",
                phase: node.phase || "Unknown",
                startedAt: node.startedAt,
                nodeId: nodeId,
              });
            } catch (logError) {
              logsData.push({
                stepName: node.displayName || node.name || nodeId,
                logs: `(Logs not available: ${logError})`,
                phase: node.phase || "Unknown",
                startedAt: node.startedAt,
                nodeId: nodeId,
              });
            }
          } else {
            logsData.push({
              stepName: node.displayName || node.name || nodeId,
              logs: "(Pod not found - logs may have been cleaned up)",
              phase: node.phase || "Unknown",
              startedAt: node.startedAt,
              nodeId: nodeId,
            });
          }
        } catch (error) {
          console.error(`Failed to fetch logs for ${nodeId}:`, error);
          logsData.push({
            stepName: node.displayName || node.name || nodeId,
            logs: `(Error fetching logs: ${error})`,
            phase: node.phase || "Unknown",
            startedAt: node.startedAt,
            nodeId: nodeId,
          });
        }
      }

      // Sort logs by startedAt timestamp (chronological order)
      logsData.sort((a, b) => {
        if (!a.startedAt && !b.startedAt) return 0;
        if (!a.startedAt) return 1;
        if (!b.startedAt) return -1;
        return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      });

      setAllLogs(logsData);
    } catch (error) {
      console.error("Failed to fetch all logs:", error);
    } finally {
      setLoadingAllLogs(false);
    }
  }, [workflowNodes, namespace]);

  // Download logs to file
  const downloadLogs = useCallback(async () => {
    if (!logs) return;

    const content = logs;
    const fileName = `${selectedNode?.displayName || selectedNode?.name || "node"}-logs.txt`;

    try {
      const filePath = await save({
        defaultPath: fileName,
        filters: [{ name: "Text Files", extensions: ["txt"] }],
      });

      if (filePath) {
        await writeTextFile(filePath, content);
      }
    } catch (error) {
      console.error("Failed to download logs:", error);
    }
  }, [logs, selectedNode]);

  // Copy logs to clipboard
  const copyLogsToClipboard = useCallback(async () => {
    if (!logs) return;

    try {
      await navigator.clipboard.writeText(logs);
    } catch (error) {
      console.error("Failed to copy logs:", error);
    }
  }, [logs]);

  // Filter and highlight logs
  const processedLogs = useMemo(() => {
    if (!logs) return [];

    const lines = logs.split('\n');

    // Filter by search term if provided
    const filteredLines = searchTerm
      ? lines.filter(line => line.toLowerCase().includes(searchTerm.toLowerCase()))
      : lines;

    // Add line numbers and highlighting info
    return filteredLines.map((line, index) => {
      const lowerLine = line.toLowerCase();
      let level: 'error' | 'warn' | 'info' | 'debug' | 'none' = 'none';

      if (lowerLine.includes('error') || lowerLine.includes('fatal') || lowerLine.includes('critical')) {
        level = 'error';
      } else if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
        level = 'warn';
      } else if (lowerLine.includes('info')) {
        level = 'info';
      } else if (lowerLine.includes('debug') || lowerLine.includes('trace')) {
        level = 'debug';
      }

      return {
        lineNumber: index + 1,
        content: line,
        level,
      };
    });
  }, [logs, searchTerm]);

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
    <>
      {viewMode === "dag" ? (
          <div style={{ width: '100%', height: '100%' }}>
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
          </div>
        ) : (
          /* All Logs View */
          <div className="w-full h-full overflow-auto p-6 bg-background">
            <div className="max-w-7xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-bold">All Workflow Logs</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Logs from all workflow steps in chronological order
                </p>
              </div>

              {/* Search and Controls */}
              <div className="flex items-center gap-2 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <Button
                  onClick={() => {
                    setAllLogs([]);
                    fetchAllLogs();
                  }}
                  disabled={loadingAllLogs}
                  size="sm"
                  variant="outline"
                  title="Refresh logs"
                >
                  Refresh
                </Button>
                <Button
                  onClick={() => setShowLineNumbers(!showLineNumbers)}
                  variant="outline"
                  size="sm"
                  title="Toggle line numbers"
                >
                  <Hash className="w-4 h-4" />
                </Button>
                <Button
                  onClick={async () => {
                    if (allLogs.length === 0) return;
                    try {
                      const content = allLogs.map(step =>
                        `${"=".repeat(80)}\n` +
                        `Step: ${step.stepName}\n` +
                        `Phase: ${step.phase}\n` +
                        `${step.startedAt ? `Started: ${new Date(step.startedAt).toLocaleString()}\n` : ''}` +
                        `${"=".repeat(80)}\n\n` +
                        `${step.logs}\n\n`
                      ).join("\n");
                      await navigator.clipboard.writeText(content);
                    } catch (error) {
                      console.error("Failed to copy logs:", error);
                    }
                  }}
                  disabled={allLogs.length === 0}
                  variant="outline"
                  size="sm"
                  title="Copy all logs to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  onClick={async () => {
                    if (allLogs.length === 0) return;
                    try {
                      const content = allLogs.map(step =>
                        `${"=".repeat(80)}\n` +
                        `Step: ${step.stepName}\n` +
                        `Phase: ${step.phase}\n` +
                        `${step.startedAt ? `Started: ${new Date(step.startedAt).toLocaleString()}\n` : ''}` +
                        `${"=".repeat(80)}\n\n` +
                        `${step.logs}\n\n`
                      ).join("\n");
                      const fileName = `${workflowName || "workflow"}-all-logs.txt`;

                      const filePath = await save({
                        defaultPath: fileName,
                        filters: [{ name: "Text Files", extensions: ["txt"] }],
                      });

                      if (filePath) {
                        await writeTextFile(filePath, content);
                      }
                    } catch (error) {
                      console.error("Failed to download logs:", error);
                    }
                  }}
                  disabled={allLogs.length === 0}
                  variant="outline"
                  size="sm"
                  title="Download all logs"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>

              {/* Logs Content */}
              {loadingAllLogs ? (
                <div className="flex items-center justify-center p-12">
                  <div className="text-sm text-muted-foreground">Loading all logs...</div>
                </div>
              ) : allLogs.length === 0 ? (
                <div className="flex items-center justify-center p-12 bg-muted/30 rounded-lg">
                  <div className="text-sm text-muted-foreground">No logs available</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {allLogs.map((step, stepIndex) => {
                    const stepLines = step.logs.split('\n');
                    const filteredLines = searchTerm
                      ? stepLines.filter(line => line.toLowerCase().includes(searchTerm.toLowerCase()))
                      : stepLines;

                    if (searchTerm && filteredLines.length === 0) {
                      return null; // Skip steps with no matching logs
                    }

                    return (
                      <div key={step.nodeId} className="border border-border rounded-lg overflow-hidden">
                        {/* Step Header */}
                        <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-sm">{step.stepName}</h4>
                            {step.startedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Started: {new Date(step.startedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <Badge
                            className={
                              step.phase === "Succeeded"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : step.phase === "Failed" || step.phase === "Error"
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                : step.phase === "Running"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                : ""
                            }
                          >
                            {step.phase}
                          </Badge>
                        </div>

                        {/* Step Logs */}
                        <div className="p-4 bg-background">
                          <div className="text-xs font-mono">
                            {filteredLines.map((line, lineIndex) => {
                              const lowerLine = line.toLowerCase();
                              let level: 'error' | 'warn' | 'info' | 'debug' | 'none' = 'none';

                              if (lowerLine.includes('error') || lowerLine.includes('fatal') || lowerLine.includes('critical')) {
                                level = 'error';
                              } else if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
                                level = 'warn';
                              } else if (lowerLine.includes('info')) {
                                level = 'info';
                              } else if (lowerLine.includes('debug') || lowerLine.includes('trace')) {
                                level = 'debug';
                              }

                              const colorClass =
                                level === "error"
                                  ? "text-red-600 dark:text-red-400"
                                  : level === "warn"
                                  ? "text-yellow-600 dark:text-yellow-400"
                                  : level === "info"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : level === "debug"
                                  ? "text-gray-500 dark:text-gray-400"
                                  : "text-foreground";

                              return (
                                <div key={lineIndex} className="flex hover:bg-muted/50">
                                  {showLineNumbers && (
                                    <span className="text-muted-foreground select-none pr-4 text-right" style={{ minWidth: "3rem" }}>
                                      {lineIndex + 1}
                                    </span>
                                  )}
                                  <span className={`whitespace-pre-wrap break-all ${colorClass}`}>
                                    {line}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      {/* Node Details Modal (Simplified) */}
      {showLogsModal && selectedNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl border border-border shadow-2xl max-w-[95vw] w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="border-b border-border flex items-center justify-between p-6">
              <div>
                <h3 className="text-xl font-bold">
                  {selectedNode.displayName || selectedNode.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Node details and logs
                </p>
              </div>
              <Button
                onClick={() => {
                  setShowLogsModal(false);
                  setSelectedNode(null);
                }}
                variant="ghost"
                size="sm"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>


            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-6">
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

              {/* Exit Code */}
              {selectedNode.outputs?.exitCode && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Exit Code</h4>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <Badge variant={selectedNode.outputs.exitCode === "0" ? "secondary" : "destructive"}>
                      {selectedNode.outputs.exitCode}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Input Parameters */}
              {selectedNode.inputs?.parameters && selectedNode.inputs.parameters.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Input Parameters</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedNode.inputs.parameters.map((param: any, idx: number) => (
                      <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs font-medium font-mono mb-1">{param.name}</p>
                        {param.value && (
                          <p className="text-xs text-muted-foreground font-mono break-all">{param.value}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Output Parameters */}
              {selectedNode.outputs?.parameters && selectedNode.outputs.parameters.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Output Parameters</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedNode.outputs.parameters.map((param: any, idx: number) => (
                      <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs font-medium font-mono mb-1">{param.name}</p>
                        {param.value && (
                          <p className="text-xs text-muted-foreground font-mono break-all">{param.value}</p>
                        )}
                        {param.valueFrom && (
                          <p className="text-xs text-muted-foreground font-mono">
                            From: {param.valueFrom.path || param.valueFrom.expression || JSON.stringify(param.valueFrom)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resource Usage */}
              {selectedNode.resourcesDuration && (selectedNode.resourcesDuration.cpu > 0 || selectedNode.resourcesDuration.memory > 0) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Resource Usage</h4>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    {selectedNode.resourcesDuration.cpu > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">CPU Duration</p>
                        <p className="text-sm font-mono">{selectedNode.resourcesDuration.cpu}s</p>
                      </div>
                    )}
                    {selectedNode.resourcesDuration.memory > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Memory Duration</p>
                        <p className="text-sm font-mono">{selectedNode.resourcesDuration.memory}s</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Logs Section */}
              {namespace && selectedNode.type === "Pod" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Pod Logs
                      {selectedNode.phase === "Running" && (
                        <Badge className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Live
                        </Badge>
                      )}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setShowLineNumbers(!showLineNumbers)}
                        variant="ghost"
                        size="sm"
                        title="Toggle line numbers"
                      >
                        <Hash className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => setFollowMode(!followMode)}
                        variant={followMode ? "default" : "ghost"}
                        size="sm"
                        title="Auto-scroll to bottom"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={copyLogsToClipboard}
                        disabled={!logs}
                        variant="ghost"
                        size="sm"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={downloadLogs}
                        disabled={!logs}
                        variant="ghost"
                        size="sm"
                        title="Download logs"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={fetchLogs}
                        disabled={loadingLogs}
                        size="sm"
                        variant="outline"
                        title="Refresh logs"
                      >
                        {loadingLogs ? <>Loading...</> : <>Refresh</>}
                      </Button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-muted/30 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {loadingLogs && !logs ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="text-sm text-muted-foreground">Loading logs...</div>
                    </div>
                  ) : logs ? (
                    <div
                      ref={logsContainerRef}
                      className="p-4 bg-muted/30 rounded-lg overflow-auto"
                      style={{ maxHeight: "60vh" }}
                    >
                      <div className="text-xs font-mono">
                        {processedLogs.map((logLine, index) => {
                          const colorClass =
                            logLine.level === "error"
                              ? "text-red-600 dark:text-red-400"
                              : logLine.level === "warn"
                              ? "text-yellow-600 dark:text-yellow-400"
                              : logLine.level === "info"
                              ? "text-blue-600 dark:text-blue-400"
                              : logLine.level === "debug"
                              ? "text-gray-500 dark:text-gray-400"
                              : "text-foreground";

                          return (
                            <div key={index} className="flex hover:bg-muted/50">
                              {showLineNumbers && (
                                <span className="text-muted-foreground select-none pr-4 text-right" style={{ minWidth: "3rem" }}>
                                  {logLine.lineNumber}
                                </span>
                              )}
                              <span className={`whitespace-pre-wrap break-all ${colorClass}`}>
                                {logLine.content}
                              </span>
                            </div>
                          );
                        })}
                        <div ref={logsEndRef} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-8 bg-muted/30 rounded-lg">
                      <div className="text-sm text-muted-foreground">No logs available</div>
                    </div>
                  )}

                  {searchTerm && (
                    <div className="text-xs text-muted-foreground">
                      Showing {processedLogs.length} matching {processedLogs.length === 1 ? 'line' : 'lines'}
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
