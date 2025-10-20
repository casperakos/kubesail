import { useState, useRef, useEffect, useMemo } from "react";
import { usePodLogs, usePodContainers } from "../../hooks/useKube";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import type { LogEntry } from "../../types";
import {
  X,
  Download,
  Search,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  WrapText,
  AlertCircle,
} from "lucide-react";

interface LogsViewerProps {
  namespace: string;
  podName?: string; // Single pod (backwards compatible)
  pods?: Array<{name: string; namespace: string}>; // Multiple pods
  container?: string;
  onClose: () => void;
}

// Color palette for different pods
const POD_COLORS = [
  "text-blue-400",
  "text-purple-400",
  "text-pink-400",
  "text-cyan-400",
  "text-emerald-400",
  "text-amber-400",
  "text-rose-400",
  "text-indigo-400",
  "text-teal-400",
  "text-lime-400",
];

interface EnrichedLogEntry extends LogEntry {
  podColor?: string;
  sortKey?: number;
}

export function LogsViewer({
  namespace,
  podName,
  pods,
  container,
  onClose,
}: LogsViewerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [tailLines, setTailLines] = useState(500);
  const [autoScroll, setAutoScroll] = useState(true);
  const [wrapLines, setWrapLines] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<string | undefined>(container);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Determine if we're in multi-pod mode
  const isMultiPodMode = !!pods && pods.length > 0;
  const effectivePods = isMultiPodMode ? pods : (podName ? [{ name: podName, namespace }] : []);

  // Fetch containers for the first pod (in single pod mode)
  const firstPod = effectivePods[0];
  const { data: containers } = usePodContainers(
    firstPod?.namespace || namespace,
    firstPod?.name || ""
  );

  // Auto-select first container if multiple exist and none selected
  useEffect(() => {
    if (containers && containers.length > 1 && !selectedContainer) {
      setSelectedContainer(containers[0]);
    }
  }, [containers, selectedContainer]);

  // Fetch logs for all pods
  const podLogsQueries = effectivePods.map((pod) => ({
    pod,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    result: usePodLogs(pod.namespace, pod.name, selectedContainer, tailLines),
  }));

  // Combine and enrich logs from all pods
  const combinedLogs = useMemo(() => {
    const allLogs: EnrichedLogEntry[] = [];
    const podColorMap = new Map<string, string>();

    podLogsQueries.forEach((query, index) => {
      const { pod, result } = query;
      const color = POD_COLORS[index % POD_COLORS.length];
      podColorMap.set(pod.name, color);

      if (result.data) {
        result.data.forEach((log) => {
          allLogs.push({
            ...log,
            pod_name: pod.name,
            podColor: color,
            sortKey: log.timestamp ? new Date(log.timestamp).getTime() : 0,
          });
        });
      }
    });

    // Sort by timestamp if available
    return allLogs.sort((a, b) => (a.sortKey || 0) - (b.sortKey || 0));
  }, [podLogsQueries.map(q => q.result.data).join(',')]);

  // Check loading and error states
  const isLoading = podLogsQueries.some((q) => q.result.isLoading);
  const hasErrors = podLogsQueries.some((q) => q.result.isError);
  const errorPods = podLogsQueries
    .filter((q) => q.result.isError)
    .map((q) => q.pod.name);

  // Refetch all pods
  const refetch = () => {
    podLogsQueries.forEach((q) => q.result.refetch());
  };

  const logs = combinedLogs;

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs?.filter((log) =>
    searchTerm
      ? log.message.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  const downloadLogs = () => {
    if (!logs) return;

    const logText = logs
      .map((log) => {
        const prefix = isMultiPodMode ? `[${log.pod_name}] ` : "";
        return `${prefix}${log.timestamp || ""} ${log.message}`;
      })
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName = isMultiPodMode
      ? `combined-logs-${effectivePods.length}-pods.txt`
      : `${podName}-logs.txt`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-card/95 to-card/90 border border-border/50 rounded-xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col backdrop-blur-xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-gradient-to-r from-background/50 to-background/30">
          <div>
            <h2 className="text-lg font-semibold">
              {isMultiPodMode ? "Combined Pod Logs" : "Pod Logs"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {isMultiPodMode ? (
                <>
                  <Badge variant="secondary">{namespace}</Badge>
                  <span className="text-sm text-muted-foreground">/</span>
                  <Badge variant="outline">{effectivePods.length} pods</Badge>
                  {selectedContainer && (
                    <>
                      <span className="text-sm text-muted-foreground">/</span>
                      <Badge>{selectedContainer}</Badge>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Badge variant="secondary">{namespace}</Badge>
                  <span className="text-sm text-muted-foreground">/</span>
                  <span className="text-sm font-mono">{podName}</span>
                  {selectedContainer && (
                    <>
                      <span className="text-sm text-muted-foreground">/</span>
                      <Badge>{selectedContainer}</Badge>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadLogs}>
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 p-4 border-b border-border/50 bg-gradient-to-r from-muted/30 to-muted/20 backdrop-blur-sm">
          <div className="flex-1 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm("")}
              >
                Clear
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Tail:</label>
            <select
              value={tailLines}
              onChange={(e) => setTailLines(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-border/50 rounded-xl bg-background/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={5000}>5000</option>
            </select>
          </div>

          {/* Container selector - only show if pod has multiple containers */}
          {containers && containers.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Container:</label>
              <select
                value={selectedContainer || ""}
                onChange={(e) => setSelectedContainer(e.target.value)}
                className="px-3 py-1.5 text-sm border border-border/50 rounded-xl bg-background/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              >
                {containers.map((container) => (
                  <option key={container} value={container}>
                    {container}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant={autoScroll ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
          >
            {autoScroll ? (
              <PlayCircle className="w-4 h-4 mr-2" />
            ) : (
              <PauseCircle className="w-4 h-4 mr-2" />
            )}
            Auto-scroll
          </Button>

          <Button
            variant={wrapLines ? "default" : "outline"}
            size="sm"
            onClick={() => setWrapLines(!wrapLines)}
            title="Toggle line wrapping"
          >
            <WrapText className="w-4 h-4 mr-2" />
            Wrap
          </Button>
        </div>

        {/* Logs */}
        <div
          ref={logsContainerRef}
          className="flex-1 overflow-auto p-4 font-mono text-sm bg-black/90 text-green-400"
        >
          {/* Error notifications */}
          {hasErrors && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-semibold">
                  Failed to fetch logs from some pods
                </span>
              </div>
              <div className="text-xs text-red-300 space-y-1">
                {errorPods.map((pod) => (
                  <div key={pod}>- {pod}</div>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          )}

          {!isLoading && (!filteredLogs || filteredLogs.length === 0) && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {searchTerm
                ? "No logs match your search"
                : "No logs available"}
            </div>
          )}

          {!isLoading && filteredLogs && filteredLogs.length > 0 && (
            <div className="space-y-0.5">
              {filteredLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`hover:bg-white/5 px-2 py-0.5 rounded ${
                    wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-nowrap"
                  }`}
                >
                  {isMultiPodMode && log.pod_name && (
                    <span className={`${log.podColor || "text-gray-400"} mr-3 font-semibold`}>
                      [{log.pod_name}]
                    </span>
                  )}
                  {log.timestamp && (
                    <span className="text-blue-400 mr-3">{log.timestamp}</span>
                  )}
                  <span
                    className={
                      log.message.toLowerCase().includes("error")
                        ? "text-red-400"
                        : log.message.toLowerCase().includes("warn")
                        ? "text-yellow-400"
                        : "text-green-400"
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border/50 bg-gradient-to-r from-background/50 to-background/30 text-sm text-muted-foreground">
          <div>
            {filteredLogs?.length || 0} lines
            {searchTerm && ` (filtered from ${logs?.length || 0})`}
          </div>
          <div>Press Esc to close</div>
        </div>
      </div>
    </div>
  );
}
