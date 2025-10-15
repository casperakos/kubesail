import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { CheckCircle2, XCircle, Loader2, Clock, HelpCircle } from "lucide-react";

interface WorkflowNodeData {
  label: string;
  phase: string;
  type: string;
  message?: string;
  startTime?: string;
  finishTime?: string;
}

function WorkflowNodeComponentBase({ data }: { data: WorkflowNodeData }) {
  const getPhaseStyles = (phase: string) => {
    switch (phase?.toLowerCase()) {
      case "succeeded":
        return {
          bg: "bg-green-50 dark:bg-green-950",
          border: "border-green-500",
          text: "text-green-700 dark:text-green-300",
          icon: <CheckCircle2 className="w-4 h-4" />,
        };
      case "failed":
      case "error":
        return {
          bg: "bg-red-50 dark:bg-red-950",
          border: "border-red-500",
          text: "text-red-700 dark:text-red-300",
          icon: <XCircle className="w-4 h-4" />,
        };
      case "running":
        return {
          bg: "bg-blue-50 dark:bg-blue-950",
          border: "border-blue-500",
          text: "text-blue-700 dark:text-blue-300",
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
        };
      case "pending":
        return {
          bg: "bg-yellow-50 dark:bg-yellow-950",
          border: "border-yellow-500",
          text: "text-yellow-700 dark:text-yellow-300",
          icon: <Clock className="w-4 h-4" />,
        };
      default:
        return {
          bg: "bg-gray-50 dark:bg-gray-950",
          border: "border-gray-500",
          text: "text-gray-700 dark:text-gray-300",
          icon: <HelpCircle className="w-4 h-4" />,
        };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case "container":
        return "📦";
      case "dag":
        return "🔀";
      case "steps":
        return "📋";
      case "pod":
        return "🎯";
      default:
        return "•";
    }
  };

  const styles = getPhaseStyles(data.phase);

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-primary border-2 border-background"
      />

      <div
        className={`
          min-w-[200px] max-w-[280px] px-4 py-3 rounded-lg border-2 shadow-lg
          ${styles.bg} ${styles.border}
          ${data.phase === "Running" ? "animate-pulse" : ""}
          transition-all hover:shadow-xl hover:scale-105
        `}
      >
        {/* Header with icon and phase */}
        <div className="flex items-center justify-between mb-2">
          <div className={`flex items-center gap-2 ${styles.text}`}>
            {styles.icon}
            <span className="text-xs font-bold uppercase">{data.phase}</span>
          </div>
          <span className="text-lg">{getTypeIcon(data.type)}</span>
        </div>

        {/* Node name */}
        <div className="mb-1">
          <div className="font-semibold text-sm text-foreground truncate" title={data.label}>
            {data.label}
          </div>
        </div>

        {/* Type */}
        <div className="text-xs text-muted-foreground mb-2">{data.type}</div>

        {/* Message if exists */}
        {data.message && (
          <div className="text-xs text-muted-foreground italic truncate mt-2 pt-2 border-t border-border">
            {data.message}
          </div>
        )}

        {/* Duration indicator */}
        {(data.startTime || data.finishTime) && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {data.startTime && !data.finishTime && <span>Running...</span>}
              {data.finishTime && <span>Completed</span>}
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-primary border-2 border-background"
      />
    </div>
  );
}

export const WorkflowNodeComponent = memo(WorkflowNodeComponentBase);
