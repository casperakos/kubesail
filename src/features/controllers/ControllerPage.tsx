import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useToastStore } from "../../lib/toastStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  Loader2,
  Search,
  AlertCircle,
  Eye,
  FileText,
  Trash2,
  X,
  RefreshCw,
  RotateCw,
  GitBranch,
  GitCommit,
  Zap,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Filter,
  Download,
  Copy,
  Hash,
  ChevronDown,
  ChevronRight,
  MoreVertical
} from "lucide-react";
import { ContextMenu, ContextMenuItem, ContextMenuTrigger } from "../../components/ui/ContextMenu";
import { useAppStore } from "../../lib/store";
import { useController } from "../../hooks/useControllerDetection";
import { CustomResourceDescribeViewer } from "../../components/CustomResourceDescribeViewer";
import { CustomResourceYamlViewer } from "../../components/CustomResourceYamlViewer";
import { WorkflowDAGViewer } from "../../components/WorkflowDAGViewer";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { ClusterConnectionDetails } from "../cloudnativepg/ClusterConnectionDetails";

interface CRD {
  name: string;
  group: string;
  version: string;
  kind: string;
  plural: string;
  singular: string;
  scope: string;
  age: string;
  categories: string[];
}

interface CustomResource {
  name: string;
  namespace: string | null;
  kind: string;
  api_version: string;
  age: string;
  metadata: any;
  status?: any;
  spec?: any;
}

interface ControllerPageProps {
  controllerId: string;
  defaultCRDKind?: string;
}

// Helper function to extract status information
function getResourceStatus(resource: CustomResource): { status: string; color: string } {
  // The status is nested inside metadata
  const status = resource.metadata?.status;
  const kind = resource.kind;

  if (!status) {
    return { status: "Unknown", color: "text-gray-600" };
  }

  // Special handling for ApplicationSets
  if (kind === "ApplicationSet") {
    const conditions = status.conditions;
    if (conditions && Array.isArray(conditions)) {
      // Check for ErrorOccurred condition
      const errorCondition = conditions.find((c: any) => c.type === "ErrorOccurred");
      if (errorCondition && errorCondition.status === "True") {
        return { status: "Error", color: "text-red-600" };
      }

      // Check for ResourcesUpToDate condition
      const upToDateCondition = conditions.find((c: any) => c.type === "ResourcesUpToDate");
      if (upToDateCondition) {
        if (upToDateCondition.status === "True") {
          return { status: "Up to Date", color: "text-green-600" };
        } else {
          return { status: "Out of Date", color: "text-yellow-600" };
        }
      }

      // Check for ParametersGenerated condition
      const paramsCondition = conditions.find((c: any) => c.type === "ParametersGenerated");
      if (paramsCondition && paramsCondition.status === "True") {
        return { status: "Active", color: "text-green-600" };
      }
    }
    return { status: "Unknown", color: "text-gray-600" };
  }

  // Special handling for Workflows
  if (kind === "Workflow") {
    const phase = status.phase;
    if (!phase) return { status: "Unknown", color: "text-gray-600" };

    const phaseLower = phase.toLowerCase();
    if (phaseLower === "succeeded") return { status: "Succeeded", color: "text-green-600" };
    if (phaseLower === "failed") return { status: "Failed", color: "text-red-600" };
    if (phaseLower === "error") return { status: "Error", color: "text-red-600" };
    if (phaseLower === "running") return { status: "Running", color: "text-blue-600" };
    if (phaseLower === "pending") return { status: "Pending", color: "text-yellow-600" };
    return { status: phase, color: "text-foreground" };
  }

  // Special handling for EventSources
  if (kind === "EventSource") {
    return getEventSourceStatus(resource);
  }

  // Special handling for Sensors
  if (kind === "Sensor") {
    return getSensorStatus(resource);
  }

  // Special handling for CloudNativePG Clusters
  if (kind === "Cluster" && resource.api_version.includes("postgresql.cnpg.io")) {
    return getCNPGClusterStatus(resource);
  }

  // Special handling for CloudNativePG Backups
  if (kind === "Backup" && resource.api_version.includes("postgresql.cnpg.io")) {
    return getCNPGBackupStatus(resource);
  }

  // Check for common status patterns
  if (status.health?.status) {
    const health = status.health.status.toLowerCase();
    if (health === "healthy") return { status: "Healthy", color: "text-green-600" };
    if (health === "degraded") return { status: "Degraded", color: "text-yellow-600" };
    if (health === "progressing") return { status: "Progressing", color: "text-blue-600" };
    if (health === "suspended") return { status: "Suspended", color: "text-gray-600" };
    return { status: status.health.status, color: "text-foreground" };
  }

  if (status.sync?.status) {
    const sync = status.sync.status.toLowerCase();
    if (sync === "synced") return { status: "Synced", color: "text-green-600" };
    if (sync === "outofsync") return { status: "OutOfSync", color: "text-yellow-600" };
    return { status: status.sync.status, color: "text-foreground" };
  }

  if (status.phase) {
    const phase = status.phase.toLowerCase();
    if (phase === "running" || phase === "active" || phase === "ready") {
      return { status: status.phase, color: "text-green-600" };
    }
    if (phase === "pending" || phase === "progressing") {
      return { status: status.phase, color: "text-blue-600" };
    }
    if (phase === "failed" || phase === "error") {
      return { status: status.phase, color: "text-red-600" };
    }
    return { status: status.phase, color: "text-foreground" };
  }

  if (status.conditions && Array.isArray(status.conditions)) {
    const readyCondition = status.conditions.find(
      (c: any) => c.type === "Ready" || c.type === "Available"
    );
    if (readyCondition) {
      const condStatus = readyCondition.status === "True" ? "Ready" : "Not Ready";
      const color = readyCondition.status === "True" ? "text-green-600" : "text-yellow-600";
      return { status: condStatus, color };
    }
  }

  return { status: "Unknown", color: "text-gray-600" };
}

// Helper function to get sync status for ArgoCD apps
function getSyncStatus(resource: CustomResource): string | null {
  const status = resource.metadata?.status;
  if (status?.sync?.status) {
    return status.sync.status;
  }
  return null;
}

// Helper function to get last synced time for ArgoCD apps
function getLastSynced(resource: CustomResource): string {
  const status = resource.metadata?.status;
  const reconciledAt = status?.reconciledAt;

  if (!reconciledAt) return "-";

  const date = new Date(reconciledAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return `${diffSecs}s ago`;
}

// Helper function to get git revision for ArgoCD apps
function getRevision(resource: CustomResource): string | null {
  const status = resource.metadata?.status;
  const revision = status?.sync?.revision;

  if (!revision) return null;

  // Return short hash (first 8 chars)
  return revision.substring(0, 8);
}

// Helper function to get repository for ArgoCD apps
function getRepository(resource: CustomResource): string | null {
  const spec = resource.metadata?.spec;
  return spec?.source?.repoURL || null;
}

// Helper function to get target revision for ArgoCD apps
function getTargetRevision(resource: CustomResource): string | null {
  const spec = resource.metadata?.spec;
  return spec?.source?.targetRevision || null;
}

// Helper function to check if sync is automated for ArgoCD apps
function getSyncPolicy(resource: CustomResource): { automated: boolean; prune: boolean; selfHeal: boolean } {
  const spec = resource.metadata?.spec;
  const syncPolicy = spec?.syncPolicy;

  return {
    automated: !!syncPolicy?.automated,
    prune: !!syncPolicy?.automated?.prune,
    selfHeal: !!syncPolicy?.automated?.selfHeal,
  };
}

// Helper function to format relative time
function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return `${diffSecs}s ago`;
}

// Helper function to get generator type for ApplicationSets
function getGeneratorType(resource: CustomResource): string {
  const spec = resource.metadata?.spec;
  if (!spec?.generators || spec.generators.length === 0) return "-";

  const firstGenerator = spec.generators[0];
  if (firstGenerator.list) return "List";
  if (firstGenerator.git) return "Git";
  if (firstGenerator.cluster) return "Cluster";
  if (firstGenerator.pullRequest) return "Pull Request";
  if (firstGenerator.matrix) return "Matrix";
  if (firstGenerator.merge) return "Merge";
  return "Other";
}

// Helper function to get managed apps count for ApplicationSets
function getManagedAppsCount(resource: CustomResource): number {
  const status = resource.metadata?.status;
  return status?.resources?.length || 0;
}

// Helper function to get health summary for ApplicationSets
function getHealthSummary(resource: CustomResource): { healthy: number; degraded: number; missing: number; total: number } {
  const status = resource.metadata?.status;
  const resources = status?.resources || [];

  let healthy = 0;
  let degraded = 0;
  let missing = 0;

  resources.forEach((app: any) => {
    const healthStatus = app.health?.status?.toLowerCase();
    if (healthStatus === "healthy") healthy++;
    else if (healthStatus === "degraded") degraded++;
    else if (healthStatus === "missing") missing++;
  });

  return { healthy, degraded, missing, total: resources.length };
}

// Helper function to get template repository for ApplicationSets
function getTemplateRepository(resource: CustomResource): string | null {
  const spec = resource.metadata?.spec;
  return spec?.template?.spec?.source?.repoURL || null;
}

// Helper function to get template target revision for ApplicationSets
function getTemplateTargetRevision(resource: CustomResource): string | null {
  const spec = resource.metadata?.spec;
  return spec?.template?.spec?.source?.targetRevision || null;
}

// ============ ARGO WORKFLOWS HELPERS ============

// Helper function to get workflow phase
function getWorkflowPhase(resource: CustomResource): string {
  return resource.metadata?.status?.phase || "Unknown";
}

// Helper function to get workflow progress
function getWorkflowProgress(resource: CustomResource): string {
  return resource.metadata?.status?.progress || "-";
}

// Helper function to calculate workflow duration
function getWorkflowDuration(resource: CustomResource): string {
  const status = resource.metadata?.status;
  if (!status?.startedAt) return "-";

  const start = new Date(status.startedAt).getTime();
  const end = status.finishedAt ? new Date(status.finishedAt).getTime() : Date.now();
  const durationMs = end - start;

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Helper function to get workflow start time
function getWorkflowStartTime(resource: CustomResource): string {
  const startedAt = resource.metadata?.status?.startedAt;
  if (!startedAt) return "-";
  return formatRelativeTime(startedAt);
}

// Helper function to get workflow template entry point
function getWorkflowTemplateEntryPoint(resource: CustomResource): string {
  return resource.metadata?.spec?.entrypoint || "-";
}

// Helper function to count workflow templates
function getWorkflowTemplateCount(resource: CustomResource): number {
  return resource.metadata?.spec?.templates?.length || 0;
}

// Helper function to get cron schedule
function getCronSchedule(resource: CustomResource): string {
  return resource.metadata?.spec?.schedule || "-";
}

// Helper function to get workflow resource usage
function getWorkflowResourceUsage(resource: CustomResource): { cpu: string; memory: string } {
  const resourcesDuration = resource.metadata?.status?.resourcesDuration;
  if (!resourcesDuration) return { cpu: "-", memory: "-" };

  const cpuSeconds = resourcesDuration.cpu || 0;
  const memorySeconds = resourcesDuration.memory || 0;

  return {
    cpu: cpuSeconds > 0 ? `${cpuSeconds}s` : "-",
    memory: memorySeconds > 0 ? `${memorySeconds}s` : "-"
  };
}

// Helper function to get workflow template reference
function getWorkflowTemplateRef(resource: CustomResource): string {
  return resource.metadata?.spec?.workflowTemplateRef?.name || "-";
}

// Helper function to parse base64 workflow parameters
function parseWorkflowInputParameters(resource: CustomResource): {
  patient_id?: string;
  upload_session_id?: string;
  study_instance_uid?: string;
  scan_id?: string;
  series_instance_uid?: string;
  namespace?: string;
} | null {
  try {
    const params = resource.metadata?.spec?.arguments?.parameters;
    if (!params || params.length === 0) return null;

    // Find the base64 encoded parameter
    const base64Param = params.find((p: any) =>
      p.name?.includes("dicom-extract") || p.name?.includes("base64") || p.name?.includes("msg-bytes")
    );

    if (base64Param?.value) {
      // Decode base64
      const decoded = atob(base64Param.value);

      // Extract fields using regex patterns
      // Upload session ID: UUID at the start
      const uploadSessionMatch = decoded.match(/"?\$?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);

      // Patient ID: format like "54123478_demo" or "demo_54123478"
      const patientIdMatch = decoded.match(/\n\r?([a-zA-Z0-9_-]+(?:_[a-zA-Z0-9_-]+)?)\x12/);

      // Study Instance UID: format like "568.1567"
      const studyUidMatch = decoded.match(/\x12\x08([0-9.]+)\x1a/);

      // Scan ID: format like "568.1567_1.567.105"
      const scanIdMatch = decoded.match(/\x1a\x12([0-9._]+)\x22/);

      // Series Instance UID: format like "1.567.105"
      const seriesUidMatch = decoded.match(/\x22\t([0-9.]+)\*/);

      // Namespace: last field before end
      const namespaceMatch = decoded.match(/\*\x04([a-zA-Z0-9-]+)\s*$/);

      return {
        patient_id: patientIdMatch?.[1],
        upload_session_id: uploadSessionMatch?.[1],
        study_instance_uid: studyUidMatch?.[1],
        scan_id: scanIdMatch?.[1],
        series_instance_uid: seriesUidMatch?.[1],
        namespace: namespaceMatch?.[1]
      };
    }
  } catch (e) {
    console.error("Error parsing workflow input parameters:", e);
  }

  return null;
}

// Helper function to extract pipeline execution data from workflow nodes
function getPipelineExecutionData(resource: CustomResource): Array<{
  patient_id?: string;
  pipeline_id?: string;
  pipeline_run_id?: string;
  triggering_scan_id?: string;
  triggering_study_instance_uid?: string;
  triggering_upload_session_id?: string;
}> {
  const results: any[] = [];

  try {
    // First, try to get data from scan-filter node outputs
    if (resource.metadata?.status?.nodes) {
      const nodes = Object.values(resource.metadata.status.nodes) as any[];
      const scanFilterNode = nodes.find((node: any) =>
        (node.displayName === "scan-filter" || node.displayName === "scan-filter(0)") &&
        node.outputs?.parameters
      );

      if (scanFilterNode) {
        const selectedPipelinesParam = scanFilterNode.outputs.parameters.find(
          (p: any) => p.name === "selected-pipelines"
        );

        if (selectedPipelinesParam?.value) {
          const pipelines = JSON.parse(selectedPipelinesParam.value);
          const pipelineArray = Array.isArray(pipelines) ? pipelines : [pipelines];
          results.push(...pipelineArray);
        }
      }
    }

    // If no pipeline data from scan-filter, fall back to input parameters
    if (results.length === 0) {
      const inputData = parseWorkflowInputParameters(resource);
      if (inputData && (inputData.patient_id || inputData.upload_session_id)) {
        results.push({
          patient_id: inputData.patient_id,
          triggering_scan_id: inputData.scan_id,
          triggering_study_instance_uid: inputData.study_instance_uid,
          triggering_upload_session_id: inputData.upload_session_id
        });
      }
    } else {
      // Enrich pipeline data with patient_id from input parameters
      const inputData = parseWorkflowInputParameters(resource);
      if (inputData?.patient_id) {
        results.forEach(pipeline => {
          if (!pipeline.patient_id) {
            pipeline.patient_id = inputData.patient_id;
          }
        });
      }
    }
  } catch (e) {
    console.error("Error parsing pipeline execution data:", e);
  }

  return results;
}

// Helper function to check if cron is suspended
function isCronSuspended(resource: CustomResource): boolean {
  return resource.metadata?.spec?.suspend === true;
}

// Helper function to extract pipeline names from workflow
function getWorkflowPipelineNames(resource: CustomResource): string[] {
  const pipelineData = getPipelineExecutionData(resource);
  const pipelineNames: string[] = [];

  for (const pipeline of pipelineData) {
    if (pipeline.pipeline_id) {
      // Remove "PIPELINE_ID_" prefix and "PIPELINE_" prefix variants
      const name = pipeline.pipeline_id
        .replace(/^PIPELINE_ID_/i, '')
        .replace(/^PIPELINE_/i, '');
      if (name && !pipelineNames.includes(name)) {
        pipelineNames.push(name);
      }
    }
  }

  return pipelineNames;
}

// ============ ARGO EVENTS HELPERS ============

// Helper function to get event source type
function getEventSourceType(resource: CustomResource): string {
  const spec = resource.metadata?.spec;
  if (!spec) return "Unknown";

  // Check for different event source types
  if (spec.webhook) return "Webhook";
  if (spec.nats) return "NATS";
  if (spec.kafka) return "Kafka";
  if (spec.amqp) return "AMQP";
  if (spec.mqtt) return "MQTT";
  if (spec.redis) return "Redis";
  if (spec.github) return "GitHub";
  if (spec.gitlab) return "GitLab";
  if (spec.sns) return "SNS";
  if (spec.sqs) return "SQS";
  if (spec.pubSub) return "PubSub";
  if (spec.calendar) return "Calendar";
  if (spec.resource) return "Resource";
  if (spec.file) return "File";
  if (spec.slack) return "Slack";
  if (spec.generic) return "Generic";

  return "Other";
}

// Helper function to get event source status
function getEventSourceStatus(resource: CustomResource): { status: string; color: string } {
  const conditions = resource.metadata?.status?.conditions;
  if (!conditions || conditions.length === 0) {
    return { status: "Unknown", color: "text-gray-600" };
  }

  const deployed = conditions.find((c: any) => c.type === "Deployed");
  const sourcesProvided = conditions.find((c: any) => c.type === "SourcesProvided");

  if (deployed?.status === "True" && sourcesProvided?.status === "True") {
    return { status: "Running", color: "text-green-600" };
  }
  if (deployed?.status === "False") {
    return { status: "Not Deployed", color: "text-red-600" };
  }
  if (sourcesProvided?.status === "False") {
    return { status: "Not Configured", color: "text-yellow-600" };
  }

  return { status: "Unknown", color: "text-gray-600" };
}

// Helper function to count sensor dependencies
function getSensorDependenciesCount(resource: CustomResource): number {
  return resource.metadata?.spec?.dependencies?.length || 0;
}

// Helper function to count sensor triggers
function getSensorTriggersCount(resource: CustomResource): number {
  return resource.metadata?.spec?.triggers?.length || 0;
}

// Helper function to get sensor status
function getSensorStatus(resource: CustomResource): { status: string; color: string } {
  const conditions = resource.metadata?.status?.conditions;
  if (!conditions || conditions.length === 0) {
    return { status: "Unknown", color: "text-gray-600" };
  }

  const deployed = conditions.find((c: any) => c.type === "Deployed");
  const depsProvided = conditions.find((c: any) => c.type === "DependenciesProvided");
  const triggersProvided = conditions.find((c: any) => c.type === "TriggersProvided");

  if (deployed?.status === "True" && depsProvided?.status === "True" && triggersProvided?.status === "True") {
    return { status: "Active", color: "text-green-600" };
  }
  if (deployed?.status === "False") {
    return { status: "Not Deployed", color: "text-red-600" };
  }
  if (depsProvided?.status === "False" || triggersProvided?.status === "False") {
    return { status: "Not Configured", color: "text-yellow-600" };
  }

  return { status: "Unknown", color: "text-gray-600" };
}

// Helper function to get CloudNativePG Cluster status
function getCNPGClusterStatus(resource: CustomResource): { status: string; color: string } {
  const status = resource.metadata?.status;

  if (!status) {
    return { status: "Unknown", color: "text-gray-600" };
  }

  // Check phase first
  const phase = status.phase;
  if (phase) {
    const phaseLower = phase.toLowerCase();

    // Healthy states
    if (phaseLower.includes("healthy") || phaseLower === "cluster in healthy state") {
      return { status: "Healthy", color: "text-green-600" };
    }

    // Initializing/Setup states
    if (phaseLower.includes("setting up") || phaseLower.includes("initializing") || phaseLower.includes("waiting for")) {
      return { status: "Initializing", color: "text-blue-600" };
    }

    // Upgrading states
    if (phaseLower.includes("upgrade")) {
      return { status: "Upgrading", color: "text-yellow-600" };
    }

    // Failed/Error states
    if (phaseLower.includes("failed") || phaseLower.includes("error")) {
      return { status: "Failed", color: "text-red-600" };
    }
  }

  // Check conditions
  const conditions = status.conditions;
  if (conditions && Array.isArray(conditions)) {
    const readyCondition = conditions.find((c: any) => c.type === "Ready");
    if (readyCondition) {
      if (readyCondition.status === "True") {
        return { status: "Ready", color: "text-green-600" };
      } else {
        // Check reason for more specific status
        if (readyCondition.reason === "ClusterIsNotReady") {
          return { status: "Not Ready", color: "text-yellow-600" };
        }
        return { status: readyCondition.reason || "Not Ready", color: "text-yellow-600" };
      }
    }
  }

  return { status: phase || "Unknown", color: "text-gray-600" };
}

// Helper function to get CloudNativePG Backup status
function getCNPGBackupStatus(resource: CustomResource): { status: string; color: string } {
  const status = resource.metadata?.status;

  if (!status) {
    return { status: "Unknown", color: "text-gray-600" };
  }

  const phase = status.phase;
  if (phase) {
    const phaseLower = phase.toLowerCase();

    if (phaseLower === "completed") {
      return { status: "Completed", color: "text-green-600" };
    }
    if (phaseLower === "running") {
      return { status: "Running", color: "text-blue-600" };
    }
    if (phaseLower === "failed") {
      return { status: "Failed", color: "text-red-600" };
    }
    if (phaseLower === "pending") {
      return { status: "Pending", color: "text-yellow-600" };
    }
  }

  return { status: phase || "Unknown", color: "text-gray-600" };
}

export function ControllerPage({ controllerId, defaultCRDKind }: ControllerPageProps) {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const controller = useController(controllerId);
  const addToast = useToastStore((state) => state.addToast);

  const [relatedCRDs, setRelatedCRDs] = useState<CRD[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For viewing resources of a specific CRD
  const [selectedCRD, setSelectedCRD] = useState<CRD | null>(null);
  const [resources, setResources] = useState<CustomResource[]>([]);
  const [filteredResources, setFilteredResources] = useState<CustomResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [resourceSearchQuery, setResourceSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // For sorting and filtering
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>("desc"); // Default to newest first
  const [dateFilterStart, setDateFilterStart] = useState<string>("");
  const [dateFilterEnd, setDateFilterEnd] = useState<string>("");
  const [showDateFilter, setShowDateFilter] = useState(false);

  // For modals
  const [describeResource, setDescribeResource] = useState<CustomResource | null>(null);
  const [yamlResource, setYamlResource] = useState<CustomResource | null>(null);
  const [detailsResource, setDetailsResource] = useState<CustomResource | null>(null);
  const [workflowViewMode, setWorkflowViewMode] = useState<"details" | "dag" | "all-logs">("details");

  // For tracking syncing operations
  const [syncingResources, setSyncingResources] = useState<Set<string>>(new Set());
  const [hardRefreshingResources, setHardRefreshingResources] = useState<Set<string>>(new Set());

  // For delete confirmation
  const [resourceToDelete, setResourceToDelete] = useState<CustomResource | null>(null);

  // ESC key handler to close modals
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (resourceToDelete) {
          setResourceToDelete(null);
        } else if (detailsResource) {
          setDetailsResource(null);
          setWorkflowViewMode("details");
        } else if (describeResource) {
          setDescribeResource(null);
        } else if (yamlResource) {
          setYamlResource(null);
        }
      }
    };

    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [resourceToDelete, detailsResource, describeResource, yamlResource]);

  useEffect(() => {
    if (controller) {
      loadRelatedCRDs();
    }
  }, [controller]);

  // Auto-select CRD if defaultCRDKind is provided
  useEffect(() => {
    if (defaultCRDKind && relatedCRDs.length > 0 && !selectedCRD) {
      const crd = relatedCRDs.find((c) => c.kind === defaultCRDKind);
      if (crd) {
        setSelectedCRD(crd);
        loadCustomResources(crd);
      }
    }
  }, [defaultCRDKind, relatedCRDs, selectedCRD]);

  useEffect(() => {
    let filtered = [...resources];

    // Apply search filter
    if (resourceSearchQuery.trim() !== "") {
      const query = resourceSearchQuery.toLowerCase();
      filtered = filtered.filter((resource) => {
        // Search in name and namespace
        if (resource.name.toLowerCase().includes(query)) return true;
        if (resource.namespace && resource.namespace.toLowerCase().includes(query)) return true;

        // For workflows, also search in pipeline execution data
        if (resource.kind === "Workflow") {
          const pipelineData = getPipelineExecutionData(resource);
          const pipelineNames = getWorkflowPipelineNames(resource);

          // Search in pipeline names
          if (pipelineNames.some(name => name.toLowerCase().includes(query))) {
            return true;
          }

          // Search in pipeline execution data
          for (const pipeline of pipelineData) {
            if (
              pipeline.patient_id?.toLowerCase().includes(query) ||
              pipeline.pipeline_id?.toLowerCase().includes(query) ||
              pipeline.pipeline_run_id?.toLowerCase().includes(query) ||
              pipeline.triggering_scan_id?.toLowerCase().includes(query) ||
              pipeline.triggering_study_instance_uid?.toLowerCase().includes(query) ||
              pipeline.triggering_upload_session_id?.toLowerCase().includes(query)
            ) {
              return true;
            }
          }
        }

        return false;
      });
    }

    // Apply date filter
    if (dateFilterStart || dateFilterEnd) {
      filtered = filtered.filter((resource) => {
        // Parse the age string to get a timestamp
        const ageTimestamp = parseAgeToTimestamp(resource.age);
        if (!ageTimestamp) return true; // Keep if we can't parse

        const resourceDate = new Date(ageTimestamp);

        if (dateFilterStart && !dateFilterEnd) {
          return resourceDate >= new Date(dateFilterStart);
        } else if (!dateFilterStart && dateFilterEnd) {
          return resourceDate <= new Date(dateFilterEnd + 'T23:59:59');
        } else if (dateFilterStart && dateFilterEnd) {
          return (
            resourceDate >= new Date(dateFilterStart) &&
            resourceDate <= new Date(dateFilterEnd + 'T23:59:59')
          );
        }
        return true;
      });
    }

    // Apply sorting by age
    if (sortOrder) {
      filtered.sort((a, b) => {
        const aTime = parseAgeToTimestamp(a.age);
        const bTime = parseAgeToTimestamp(b.age);

        if (!aTime || !bTime) return 0;

        if (sortOrder === "asc") {
          return aTime - bTime; // Oldest first
        } else {
          return bTime - aTime; // Newest first
        }
      });
    }

    setFilteredResources(filtered);
  }, [resourceSearchQuery, resources, sortOrder, dateFilterStart, dateFilterEnd]);

  // Helper function to parse age string to timestamp
  function parseAgeToTimestamp(age: string): number | null {
    if (!age) return null;

    const now = Date.now();
    const parts = age.match(/(\d+)([smhd])/g);

    if (!parts) return null;

    let totalMs = 0;
    for (const part of parts) {
      const value = parseInt(part);
      const unit = part.slice(-1);

      switch (unit) {
        case 's':
          totalMs += value * 1000;
          break;
        case 'm':
          totalMs += value * 60 * 1000;
          break;
        case 'h':
          totalMs += value * 60 * 60 * 1000;
          break;
        case 'd':
          totalMs += value * 24 * 60 * 60 * 1000;
          break;
      }
    }

    return now - totalMs;
  }

  // Reload resources when namespace changes
  useEffect(() => {
    if (selectedCRD) {
      loadCustomResources(selectedCRD);
    }
  }, [currentNamespace]);

  async function loadRelatedCRDs() {
    if (!controller) return;

    setLoading(true);
    setError(null);
    try {
      const allCRDs = await invoke<CRD[]>("get_crds");

      // Filter CRDs that match the controller's patterns
      const related = allCRDs.filter((crd) =>
        controller.crdPatterns.some((pattern) =>
          crd.name.toLowerCase().includes(pattern.toLowerCase())
        )
      );

      setRelatedCRDs(related);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomResources(crd: CRD) {
    setSelectedCRD(crd);
    setResourcesLoading(true);
    setResourcesError(null);
    setResourceSearchQuery("");

    try {
      const ns =
        crd.scope === "Namespaced" && currentNamespace !== "all"
          ? currentNamespace
          : null;

      const result = await invoke<CustomResource[]>("get_custom_resources", {
        group: crd.group,
        version: crd.version,
        plural: crd.plural,
        namespace: ns,
      });

      // Debug: log the first resource to see its structure
      if (result.length > 0) {
        console.log("Sample resource structure:", result[0]);
        console.log("Resource keys:", Object.keys(result[0]));
      }

      setResources(result);
      setFilteredResources(result);
    } catch (err) {
      setResourcesError(String(err));
    } finally {
      setResourcesLoading(false);
    }
  }

  async function handleSyncArgoApp(resource: CustomResource) {
    if (!selectedCRD) return;

    const resourceKey = `${resource.namespace}-${resource.name}`;
    setSyncingResources((prev) => new Set(prev).add(resourceKey));

    try {
      await invoke("sync_argocd_app", {
        name: resource.name,
        namespace: resource.namespace,
      });

      // Wait a bit then reload to show updated status
      setTimeout(() => {
        loadCustomResources(selectedCRD);
        setSyncingResources((prev) => {
          const next = new Set(prev);
          next.delete(resourceKey);
          return next;
        });
      }, 2000);
    } catch (err) {
      alert(`Failed to sync application: ${err}`);
      setSyncingResources((prev) => {
        const next = new Set(prev);
        next.delete(resourceKey);
        return next;
      });
    }
  }

  async function handleHardRefreshArgoApp(resource: CustomResource) {
    if (!selectedCRD) return;

    if (!confirm(`Hard refresh will force sync with prune. Continue?`)) {
      return;
    }

    const resourceKey = `${resource.namespace}-${resource.name}`;
    setHardRefreshingResources((prev) => new Set(prev).add(resourceKey));

    try {
      // For now, we'll use the same sync endpoint
      // In the future, we could add a separate endpoint with prune option
      await invoke("sync_argocd_app", {
        name: resource.name,
        namespace: resource.namespace,
      });

      setTimeout(() => {
        loadCustomResources(selectedCRD);
        setHardRefreshingResources((prev) => {
          const next = new Set(prev);
          next.delete(resourceKey);
          return next;
        });
      }, 2000);
    } catch (err) {
      alert(`Failed to hard refresh application: ${err}`);
      setHardRefreshingResources((prev) => {
        const next = new Set(prev);
        next.delete(resourceKey);
        return next;
      });
    }
  }

  function handleDeleteResource(resource: CustomResource) {
    setResourceToDelete(resource);
  }

  async function confirmDeleteResource(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();

    if (!resourceToDelete || !selectedCRD) return;

    const resourceName = resourceToDelete.name;
    const resourceKind = resourceToDelete.kind;

    try {
      await invoke("delete_custom_resource", {
        group: selectedCRD.group,
        version: selectedCRD.version,
        plural: selectedCRD.plural,
        name: resourceToDelete.name,
        namespace: resourceToDelete.namespace,
      });

      setResourceToDelete(null);
      addToast(`${resourceKind} "${resourceName}" has been deleted`, "success");
      loadCustomResources(selectedCRD);
    } catch (err) {
      setResourceToDelete(null);
      addToast(`Failed to delete ${resourceKind}: ${err}`, "error");
    }
  }

  function cancelDeleteResource() {
    setResourceToDelete(null);
  }

  function handleBack() {
    setSelectedCRD(null);
    setResources([]);
    setFilteredResources([]);
    setResourceSearchQuery("");
    setSortOrder("desc"); // Reset to default
    setDateFilterStart("");
    setDateFilterEnd("");
    setShowDateFilter(false);
  }

  function toggleSort() {
    if (sortOrder === "desc") {
      setSortOrder("asc"); // Oldest first
    } else if (sortOrder === "asc") {
      setSortOrder(null); // No sorting
    } else {
      setSortOrder("desc"); // Newest first (default)
    }
  }

  function clearDateFilter() {
    setDateFilterStart("");
    setDateFilterEnd("");
  }

  if (!controller) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-16 h-16 text-muted-foreground" />
        <p className="text-muted-foreground">Controller not found or not detected in cluster</p>
      </div>
    );
  }

  // Show resources view for selected CRD
  if (selectedCRD) {
    if (resourcesLoading) {
      return <LoadingSpinner message={`Loading ${selectedCRD.kind} resources...`} />;
    }

    if (resourcesError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-destructive">Error loading resources: {resourcesError}</p>
          <div className="flex gap-2">
            <Button onClick={() => loadCustomResources(selectedCRD)}>Retry</Button>
            {!defaultCRDKind && (
              <Button onClick={handleBack} variant="outline">
                Back to {controller.name}
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {!defaultCRDKind && (
              <Button onClick={handleBack} variant="ghost" size="sm">
                ← Back
              </Button>
            )}
            <div>
              <h2 className="text-2xl font-bold">{selectedCRD.kind}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedCRD.group && `${selectedCRD.group}/`}{selectedCRD.version}
                {` • ${selectedCRD.scope}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search resources..."
                value={resourceSearchQuery}
                onChange={(e) => setResourceSearchQuery(e.target.value)}
                className="w-[300px] pl-10 pr-10 py-2.5 text-sm bg-background/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
              />
              {resourceSearchQuery && (
                <button
                  onClick={() => setResourceSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              onClick={() => setShowDateFilter(!showDateFilter)}
              variant={dateFilterStart || dateFilterEnd ? "default" : "outline"}
              size="sm"
              title="Filter by date"
            >
              <Filter className="w-4 h-4" />
            </Button>
            <Button onClick={() => loadCustomResources(selectedCRD)} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Date Filter */}
        {showDateFilter && (
          <div className="mb-4 p-4 bg-muted/30 rounded-xl border border-border/50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground">From:</label>
                <input
                  type="date"
                  value={dateFilterStart}
                  onChange={(e) => setDateFilterStart(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground">To:</label>
                <input
                  type="date"
                  value={dateFilterEnd}
                  onChange={(e) => setDateFilterEnd(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              {(dateFilterStart || dateFilterEnd) && (
                <Button onClick={clearDateFilter} variant="ghost" size="sm">
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
              <div className="ml-auto text-xs text-muted-foreground">
                Filter workflows by creation date
              </div>
            </div>
          </div>
        )}

        {filteredResources.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 p-12 rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10">
            <FileText className="w-16 h-16 text-muted-foreground" />
            <p className="text-muted-foreground">
              {resourceSearchQuery
                ? "No resources found matching your search"
                : `No ${selectedCRD.kind} resources found`}
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto border rounded-xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    {selectedCRD.scope === "Namespaced" && <TableHead>Namespace</TableHead>}
                    {!(controllerId === "argo-workflows" && selectedCRD.kind === "Workflow") && <TableHead>Status</TableHead>}
                    {controllerId === "argocd" && selectedCRD.kind === "Application" && (
                      <>
                        <TableHead>Sync</TableHead>
                        <TableHead>Policy</TableHead>
                        <TableHead>Revision</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Last Synced</TableHead>
                      </>
                    )}
                    {controllerId === "argocd" && selectedCRD.kind === "ApplicationSet" && (
                      <>
                        <TableHead>Generator</TableHead>
                        <TableHead>Apps</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead>Repository</TableHead>
                        <TableHead>Branch</TableHead>
                      </>
                    )}
                    {controllerId === "argo-workflows" && selectedCRD.kind === "Workflow" && (
                      <>
                        <TableHead>Phase</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Pipeline</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Finished</TableHead>
                      </>
                    )}
                    {controllerId === "argo-workflows" && selectedCRD.kind === "WorkflowTemplate" && (
                      <>
                        <TableHead>Entrypoint</TableHead>
                        <TableHead>Templates</TableHead>
                      </>
                    )}
                    {controllerId === "argo-workflows" && selectedCRD.kind === "CronWorkflow" && (
                      <>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Suspended</TableHead>
                      </>
                    )}
                    {controllerId === "argo-events" && selectedCRD.kind === "EventSource" && (
                      <>
                        <TableHead>Type</TableHead>
                      </>
                    )}
                    {controllerId === "argo-events" && selectedCRD.kind === "Sensor" && (
                      <>
                        <TableHead>Dependencies</TableHead>
                        <TableHead>Triggers</TableHead>
                      </>
                    )}
                    <TableHead>
                      <button
                        onClick={toggleSort}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        title="Click to sort by age"
                      >
                        Age
                        {sortOrder === null && <ArrowUpDown className="w-4 h-4 text-muted-foreground" />}
                        {sortOrder === "asc" && <ArrowUp className="w-4 h-4" />}
                        {sortOrder === "desc" && <ArrowDown className="w-4 h-4" />}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResources.map((resource) => {
                    const { status, color } = getResourceStatus(resource);
                    const isApplication = resource.kind === "Application";
                    const isApplicationSet = resource.kind === "ApplicationSet";

                    // Application-specific data
                    const syncStatus = isApplication ? getSyncStatus(resource) : null;
                    const syncPolicy = isApplication ? getSyncPolicy(resource) : null;
                    const revision = isApplication ? getRevision(resource) : null;
                    const targetRevision = isApplication ? getTargetRevision(resource) : null;
                    const lastSynced = isApplication ? getLastSynced(resource) : null;

                    // ApplicationSet-specific data
                    const generatorType = isApplicationSet ? getGeneratorType(resource) : null;
                    const appsCount = isApplicationSet ? getManagedAppsCount(resource) : null;
                    const healthSummary = isApplicationSet ? getHealthSummary(resource) : null;
                    const templateRepo = isApplicationSet ? getTemplateRepository(resource) : null;
                    const templateBranch = isApplicationSet ? getTemplateTargetRevision(resource) : null;

                    // Workflow-specific data
                    const isWorkflow = resource.kind === "Workflow";
                    const isWorkflowTemplate = resource.kind === "WorkflowTemplate";
                    const isCronWorkflow = resource.kind === "CronWorkflow";
                    const workflowPhase = isWorkflow ? getWorkflowPhase(resource) : null;
                    const workflowTemplate = isWorkflow ? (resource.spec?.workflowTemplateRef?.name || resource.spec?.workflowSpec?.templateRef?.name || "-") : null;
                    const workflowPipelineNames = isWorkflow ? getWorkflowPipelineNames(resource) : [];
                    const workflowProgress = isWorkflow ? getWorkflowProgress(resource) : null;
                    const workflowDuration = isWorkflow ? getWorkflowDuration(resource) : null;
                    const workflowFinished = isWorkflow ? (resource.metadata?.status?.finishedAt ? new Date(resource.metadata.status.finishedAt).toLocaleString() : "-") : null;
                    const templateEntrypoint = isWorkflowTemplate ? getWorkflowTemplateEntryPoint(resource) : null;
                    const templateCount = isWorkflowTemplate ? getWorkflowTemplateCount(resource) : null;
                    const cronSchedule = isCronWorkflow ? getCronSchedule(resource) : null;
                    const cronSuspended = isCronWorkflow ? isCronSuspended(resource) : null;

                    // EventSource and Sensor-specific data
                    const isEventSource = resource.kind === "EventSource";
                    const isSensor = resource.kind === "Sensor";
                    const eventSourceType = isEventSource ? getEventSourceType(resource) : null;
                    const sensorDepsCount = isSensor ? getSensorDependenciesCount(resource) : null;
                    const sensorTriggersCount = isSensor ? getSensorTriggersCount(resource) : null;

                    const rowId = `${resource.namespace || "cluster"}-${resource.name}`;
                    const isExpanded = expandedRows.has(rowId);
                    const pipelineData = isWorkflow ? getPipelineExecutionData(resource) : [];
                    const hasPipelineData = pipelineData.length > 0;

                    // Check if this is a CNPG Cluster
                    const isCNPGCluster = resource.kind === "Cluster" && resource.api_version.includes("postgresql.cnpg.io");
                    const canExpand = hasPipelineData || isCNPGCluster;

                    // Build context menu items
                    const menuItems: ContextMenuItem[] = [
                      // View Details (for ArgoCD, Argo Workflows, Argo Events)
                      ...((controllerId === "argocd" || controllerId === "argo-workflows" || controllerId === "argo-events") ? [{
                        label: "View Details",
                        icon: <Info className="w-4 h-4" />,
                        onClick: () => {
                          if (resource.kind === "Workflow") {
                            setWorkflowViewMode("dag");
                          }
                          setDetailsResource(resource);
                        }
                      }] : []),
                      // Sync Application (ArgoCD only)
                      ...(controllerId === "argocd" && isApplication ? [{
                        label: "Sync Application",
                        icon: syncingResources.has(`${resource.namespace}-${resource.name}`) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCw className="w-4 h-4" />
                        ),
                        onClick: () => handleSyncArgoApp(resource),
                        disabled: syncingResources.has(`${resource.namespace}-${resource.name}`)
                      }] : []),
                      // Hard Refresh (ArgoCD only)
                      ...(controllerId === "argocd" && isApplication ? [{
                        label: "Hard Refresh",
                        icon: hardRefreshingResources.has(`${resource.namespace}-${resource.name}`) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        ),
                        onClick: () => handleHardRefreshArgoApp(resource),
                        disabled: hardRefreshingResources.has(`${resource.namespace}-${resource.name}`)
                      }] : []),
                      // Separator before common actions
                      ...((controllerId === "argocd" && isApplication) || controllerId === "argo-workflows" || controllerId === "argo-events" ? [{ separator: true }] : []),
                      // Describe
                      {
                        label: "Describe",
                        icon: <Eye className="w-4 h-4" />,
                        onClick: () => setDescribeResource(resource)
                      },
                      // View YAML
                      {
                        label: "View YAML",
                        icon: <FileText className="w-4 h-4" />,
                        onClick: () => setYamlResource(resource)
                      },
                      // Separator before delete
                      { separator: true },
                      // Delete
                      {
                        label: "Delete",
                        icon: <Trash2 className="w-4 h-4" />,
                        onClick: () => handleDeleteResource(resource),
                        variant: "danger" as const
                      }
                    ];

                    return (
                      <>
                        <ContextMenuTrigger key={rowId} items={menuItems}>
                          <TableRow>
                          <TableCell className="font-mono text-sm">
                            <div className="flex items-center gap-2">
                              {canExpand && (
                                <button
                                  onClick={() => {
                                    const newExpanded = new Set(expandedRows);
                                    if (isExpanded) {
                                      newExpanded.delete(rowId);
                                    } else {
                                      newExpanded.add(rowId);
                                    }
                                    setExpandedRows(newExpanded);
                                  }}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              {resource.kind === "Workflow" ? (
                                <button
                                  onClick={() => {
                                    setWorkflowViewMode("dag");
                                    setDetailsResource(resource);
                                  }}
                                  className="text-primary hover:underline cursor-pointer text-left"
                                >
                                  {resource.name}
                                </button>
                              ) : (
                                resource.name
                              )}
                            </div>
                          </TableCell>
                        {selectedCRD.scope === "Namespaced" && (
                          <TableCell>{resource.namespace || "-"}</TableCell>
                        )}
                        {!isWorkflow && (
                          <TableCell>
                            <span className={`font-medium ${color}`}>{status}</span>
                          </TableCell>
                        )}
                        {controllerId === "argocd" && isApplication && (
                          <>
                            <TableCell>
                              {syncStatus ? (
                                <Badge
                                  variant={syncStatus === "Synced" ? "default" : "secondary"}
                                  className={
                                    syncStatus === "Synced"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                  }
                                >
                                  {syncStatus}
                                </Badge>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {syncPolicy?.automated ? (
                                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                                    <Zap className="w-3 h-3" />
                                    Auto
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    Manual
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {revision ? (
                                <span className="font-mono text-xs flex items-center gap-1" title={revision}>
                                  <GitCommit className="w-3 h-3" />
                                  {revision}
                                </span>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {targetRevision ? (
                                <span className="text-xs flex items-center gap-1">
                                  <GitBranch className="w-3 h-3" />
                                  {targetRevision}
                                </span>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">{lastSynced}</span>
                            </TableCell>
                          </>
                        )}
                        {controllerId === "argocd" && isApplicationSet && (
                          <>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {generatorType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{appsCount} apps</Badge>
                            </TableCell>
                            <TableCell>
                              {healthSummary && healthSummary.total > 0 ? (
                                <div className="flex items-center gap-2 text-xs">
                                  {healthSummary.healthy > 0 && (
                                    <span className="text-green-600">{healthSummary.healthy} ✓</span>
                                  )}
                                  {healthSummary.degraded > 0 && (
                                    <span className="text-yellow-600">{healthSummary.degraded} ⚠</span>
                                  )}
                                  {healthSummary.missing > 0 && (
                                    <span className="text-red-600">{healthSummary.missing} ✗</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-mono truncate max-w-xs block" title={templateRepo || ""}>
                                {templateRepo ? templateRepo.split("/").pop() : "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {templateBranch ? (
                                <span className="text-xs flex items-center gap-1">
                                  <GitBranch className="w-3 h-3" />
                                  {templateBranch}
                                </span>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </TableCell>
                          </>
                        )}
                        {controllerId === "argo-workflows" && isWorkflow && (
                          <>
                            <TableCell>
                              <Badge
                                className={
                                  workflowPhase === "Succeeded"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                    : workflowPhase === "Failed" || workflowPhase === "Error"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                    : workflowPhase === "Running"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                    : workflowPhase === "Pending"
                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                    : ""
                                }
                              >
                                {workflowPhase}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-mono text-muted-foreground">{workflowTemplate}</span>
                            </TableCell>
                            <TableCell>
                              {workflowPipelineNames.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {workflowPipelineNames.map((name, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-mono">{workflowProgress}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs">{workflowDuration}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">{workflowFinished}</span>
                            </TableCell>
                          </>
                        )}
                        {controllerId === "argo-workflows" && isWorkflowTemplate && (
                          <>
                            <TableCell>
                              <span className="text-xs font-mono">{templateEntrypoint}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{templateCount} templates</Badge>
                            </TableCell>
                          </>
                        )}
                        {controllerId === "argo-workflows" && isCronWorkflow && (
                          <>
                            <TableCell>
                              <span className="text-xs font-mono">{cronSchedule}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={cronSuspended ? "secondary" : "default"}>
                                {cronSuspended ? "Yes" : "No"}
                              </Badge>
                            </TableCell>
                          </>
                        )}
                        {controllerId === "argo-events" && isEventSource && (
                          <>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {eventSourceType}
                              </Badge>
                            </TableCell>
                          </>
                        )}
                        {controllerId === "argo-events" && isSensor && (
                          <>
                            <TableCell>
                              <Badge variant="secondary">{sensorDepsCount} dependencies</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{sensorTriggersCount} triggers</Badge>
                            </TableCell>
                          </>
                        )}
                        <TableCell>{resource.age}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end">
                            <ContextMenu items={menuItems}>
                              <MoreVertical className="w-4 h-4" />
                            </ContextMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                        </ContextMenuTrigger>

                      {/* Expanded Row for Pipeline Execution Details */}
                      {isExpanded && hasPipelineData && (
                        <TableRow key={`${rowId}-expanded`} className="bg-muted/30">
                          <TableCell colSpan={selectedCRD.scope === "Namespaced" ? 10 : 9} className="p-4">
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold text-foreground">Pipeline Execution Details</h4>
                              {pipelineData.map((pipeline, idx) => (
                                <div key={idx} className="grid grid-cols-2 gap-3 p-3 bg-background rounded-lg border border-border">
                                  {pipeline.patient_id && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Patient ID</p>
                                      <p className="text-sm font-mono font-semibold">{pipeline.patient_id}</p>
                                    </div>
                                  )}
                                  {pipeline.pipeline_id && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Pipeline ID</p>
                                      <p className="text-sm font-mono">{pipeline.pipeline_id}</p>
                                    </div>
                                  )}
                                  {pipeline.pipeline_run_id && (
                                    <div className="col-span-2">
                                      <p className="text-xs text-muted-foreground mb-1">Pipeline Run ID</p>
                                      <p className="text-sm font-mono text-xs break-all">{pipeline.pipeline_run_id}</p>
                                    </div>
                                  )}
                                  {pipeline.triggering_scan_id && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Scan ID</p>
                                      <p className="text-sm font-mono">{pipeline.triggering_scan_id}</p>
                                    </div>
                                  )}
                                  {pipeline.triggering_study_instance_uid && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Study Instance UID</p>
                                      <p className="text-sm font-mono">{pipeline.triggering_study_instance_uid}</p>
                                    </div>
                                  )}
                                  {pipeline.triggering_upload_session_id && (
                                    <div className="col-span-2">
                                      <p className="text-xs text-muted-foreground mb-1">Upload Session ID</p>
                                      <p className="text-sm font-mono text-xs break-all">{pipeline.triggering_upload_session_id}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Expanded Row for CNPG Connection Details */}
                      {isExpanded && isCNPGCluster && (
                        <TableRow key={`${rowId}-cnpg-expanded`} className="bg-muted/30">
                          <TableCell colSpan={selectedCRD.scope === "Namespaced" ? 10 : 9} className="p-4">
                            <ClusterConnectionDetails
                              clusterName={resource.name}
                              namespace={resource.namespace || ""}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredResources.length} of {resources.length} resources
              {selectedCRD.scope === "Namespaced" &&
                currentNamespace !== "all" &&
                ` in namespace "${currentNamespace}"`}
            </div>
          </>
        )}

        {/* Describe Modal */}
        {describeResource && (
          <CustomResourceDescribeViewer
            group={selectedCRD.group}
            version={selectedCRD.version}
            plural={selectedCRD.plural}
            name={describeResource.name}
            namespace={describeResource.namespace || undefined}
            onClose={() => setDescribeResource(null)}
          />
        )}

        {/* YAML Viewer Modal */}
        {yamlResource && (
          <CustomResourceYamlViewer
            group={selectedCRD.group}
            version={selectedCRD.version}
            plural={selectedCRD.plural}
            resourceName={yamlResource.name}
            namespace={yamlResource.namespace || undefined}
            onClose={() => setYamlResource(null)}
          />
        )}

        {/* Delete Confirmation Modal */}
        {resourceToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Deletion</h3>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to delete {resourceToDelete.kind} <span className="font-mono text-foreground">"{resourceToDelete.name}"</span>
                {resourceToDelete.namespace && <span> in namespace <span className="font-mono text-foreground">{resourceToDelete.namespace}</span></span>}? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={(e) => { e.preventDefault(); cancelDeleteResource(); }}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={(e) => confirmDeleteResource(e)}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal for ArgoCD Apps and ApplicationSets */}
        {detailsResource && controllerId === "argocd" && detailsResource.kind === "Application" && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl border border-border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h3 className="text-xl font-bold">{detailsResource.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">Application Details</p>
                </div>
                <Button
                  onClick={() => setDetailsResource(null)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Source Information */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Source</h4>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Repository</p>
                      <p className="text-sm font-mono break-all">
                        {getRepository(detailsResource) || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Path</p>
                      <p className="text-sm font-mono">
                        {detailsResource.metadata?.spec?.source?.path || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Target Revision</p>
                      <p className="text-sm flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        {getTargetRevision(detailsResource) || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Current Revision</p>
                      <p className="text-sm flex items-center gap-2 font-mono">
                        <GitCommit className="w-4 h-4" />
                        {detailsResource.metadata?.status?.sync?.revision?.substring(0, 12) || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Destination */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Destination</h4>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Server</p>
                      <p className="text-sm font-mono">
                        {detailsResource.metadata?.spec?.destination?.server || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Namespace</p>
                      <p className="text-sm font-mono">
                        {detailsResource.metadata?.spec?.destination?.namespace || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sync Policy */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sync Policy</h4>
                  <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Automated:</span>
                        <Badge variant={getSyncPolicy(detailsResource).automated ? "default" : "secondary"}>
                          {getSyncPolicy(detailsResource).automated ? "Yes" : "No"}
                        </Badge>
                      </div>
                      {getSyncPolicy(detailsResource).automated && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Prune:</span>
                            <Badge variant={getSyncPolicy(detailsResource).prune ? "default" : "secondary"}>
                              {getSyncPolicy(detailsResource).prune ? "Yes" : "No"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Self Heal:</span>
                            <Badge variant={getSyncPolicy(detailsResource).selfHeal ? "default" : "secondary"}>
                              {getSyncPolicy(detailsResource).selfHeal ? "Yes" : "No"}
                            </Badge>
                          </div>
                        </>
                      )}
                    </div>
                    {detailsResource.metadata?.spec?.syncPolicy?.syncOptions && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Sync Options:</p>
                        <div className="flex flex-wrap gap-2">
                          {detailsResource.metadata.spec.syncPolicy.syncOptions.map((option: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {option}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operation State */}
                {detailsResource.metadata?.status?.operationState && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Last Operation</h4>
                    <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Phase:</span>
                        <Badge>{detailsResource.metadata.status.operationState.phase}</Badge>
                      </div>
                      {detailsResource.metadata.status.operationState.message && (
                        <div>
                          <span className="text-sm text-muted-foreground">Message:</span>
                          <p className="text-sm mt-1">{detailsResource.metadata.status.operationState.message}</p>
                        </div>
                      )}
                      {detailsResource.metadata.status.operationState.startedAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Started:</span>
                          <span className="text-sm">
                            {formatRelativeTime(detailsResource.metadata.status.operationState.startedAt)}
                          </span>
                        </div>
                      )}
                      {detailsResource.metadata.status.operationState.finishedAt && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Finished:</span>
                          <span className="text-sm">
                            {formatRelativeTime(detailsResource.metadata.status.operationState.finishedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Health Status */}
                {detailsResource.metadata?.status?.health && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Health</h4>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge
                          className={
                            detailsResource.metadata.status.health.status === "Healthy"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : detailsResource.metadata.status.health.status === "Degraded"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              : ""
                          }
                        >
                          {detailsResource.metadata.status.health.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
                <Button onClick={() => setDetailsResource(null)} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal for Workflows */}
        {detailsResource && controllerId === "argo-workflows" && detailsResource.kind === "Workflow" && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl border border-border shadow-2xl max-w-[95vw] w-full max-h-[95vh] overflow-hidden flex flex-col">
              {/* Header with tabs */}
              <div className="border-b border-border">
                <div className="flex items-center justify-between px-6 pt-4">
                  <div>
                    <h3 className="text-xl font-bold">{detailsResource.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">Workflow</p>
                  </div>
                  <Button
                    onClick={() => {
                      setDetailsResource(null);
                      setWorkflowViewMode("details");
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6 pt-4">
                  <button
                    onClick={() => setWorkflowViewMode("details")}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      workflowViewMode === "details"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setWorkflowViewMode("dag")}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      workflowViewMode === "dag"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Workflow DAG
                  </button>
                  <button
                    onClick={() => setWorkflowViewMode("all-logs")}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      workflowViewMode === "all-logs"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All Logs
                  </button>
                </div>
              </div>

              {/* Content */}
              {workflowViewMode === "details" ? (
                <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Status Information */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Execution Status</h4>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Phase</p>
                      <Badge
                        className={
                          getWorkflowPhase(detailsResource) === "Succeeded"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : getWorkflowPhase(detailsResource) === "Failed" || getWorkflowPhase(detailsResource) === "Error"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : getWorkflowPhase(detailsResource) === "Running"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : ""
                        }
                      >
                        {getWorkflowPhase(detailsResource)}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Progress</p>
                      <p className="text-sm font-mono">{getWorkflowProgress(detailsResource)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Duration</p>
                      <p className="text-sm">{getWorkflowDuration(detailsResource)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Started</p>
                      <p className="text-sm">{getWorkflowStartTime(detailsResource)}</p>
                    </div>
                  </div>
                </div>

                {/* Resource Usage */}
                {(() => {
                  const resources = getWorkflowResourceUsage(detailsResource);
                  if (resources.cpu !== "-" || resources.memory !== "-") {
                    return (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Resource Usage</h4>
                        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">CPU Duration</p>
                            <p className="text-sm font-mono">{resources.cpu}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Memory Duration</p>
                            <p className="text-sm font-mono">{resources.memory}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Workflow Spec */}
                {detailsResource.metadata?.spec && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Specification</h4>
                    <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                      {getWorkflowTemplateRef(detailsResource) !== "-" && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Workflow Template:</span>
                          <Badge variant="secondary" className="font-mono">{getWorkflowTemplateRef(detailsResource)}</Badge>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Entrypoint:</span>
                        <span className="text-sm font-mono">{detailsResource.metadata.spec.entrypoint || "-"}</span>
                      </div>
                      {detailsResource.metadata.spec.serviceAccountName && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Service Account:</span>
                          <span className="text-sm font-mono">{detailsResource.metadata.spec.serviceAccountName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Workflow Labels */}
                {detailsResource.metadata?.labels && Object.keys(detailsResource.metadata.labels).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Labels & Triggers</h4>
                    <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                      {detailsResource.metadata.labels['events.argoproj.io/sensor'] && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Event Sensor:</span>
                          <Badge variant="outline" className="font-mono">{detailsResource.metadata.labels['events.argoproj.io/sensor']}</Badge>
                        </div>
                      )}
                      {detailsResource.metadata.labels['events.argoproj.io/trigger'] && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Trigger:</span>
                          <Badge variant="outline" className="font-mono">{detailsResource.metadata.labels['events.argoproj.io/trigger']}</Badge>
                        </div>
                      )}
                      {detailsResource.metadata.labels['workflows.argoproj.io/creator'] && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Created By:</span>
                          <span className="text-xs font-mono">{detailsResource.metadata.labels['workflows.argoproj.io/creator']}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Workflow Parameters */}
                {detailsResource.metadata?.spec?.arguments?.parameters && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Parameters</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {detailsResource.metadata.spec.arguments.parameters.map((param: any, idx: number) => (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium font-mono">{param.name}</span>
                          </div>
                          {param.value && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{param.value}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Node Status */}
                {detailsResource.metadata?.status?.nodes && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Node Status ({Object.keys(detailsResource.metadata.status.nodes).length} nodes)
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {Object.entries(detailsResource.metadata.status.nodes).map(([nodeId, node]: [string, any]) => (
                        <div key={nodeId} className="p-3 bg-muted/30 rounded-lg space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{node.displayName || node.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{node.type}</Badge>
                              <Badge
                                variant="outline"
                                className={
                                  node.phase === "Succeeded"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs"
                                    : node.phase === "Failed" || node.phase === "Error"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs"
                                    : node.phase === "Running"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs"
                                    : "text-xs"
                                }
                              >
                                {node.phase}
                              </Badge>
                            </div>
                          </div>
                          {node.outputs?.exitCode && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Exit Code:</span>
                              <Badge variant={node.outputs.exitCode === "0" ? "secondary" : "destructive"} className="text-xs">
                                {node.outputs.exitCode}
                              </Badge>
                            </div>
                          )}
                          {node.message && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{node.message}</p>
                          )}
                          {node.resourcesDuration && (node.resourcesDuration.cpu > 0 || node.resourcesDuration.memory > 0) && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              {node.resourcesDuration.cpu > 0 && <span>CPU: {node.resourcesDuration.cpu}s</span>}
                              {node.resourcesDuration.memory > 0 && <span>Memory: {node.resourcesDuration.memory}s</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              ) : (
                <div className="flex-1 overflow-hidden" style={{ height: '75vh', width: '100%' }}>
                  <WorkflowDAGViewer
                    nodes={detailsResource.metadata?.status?.nodes || {}}
                    namespace={detailsResource.namespace}
                    workflowName={detailsResource.name}
                    viewMode={workflowViewMode === "dag" ? "dag" : "all-logs"}
                  />
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
                <Button onClick={() => {
                  setDetailsResource(null);
                  setWorkflowViewMode("details");
                }} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal for WorkflowTemplates */}
        {detailsResource && controllerId === "argo-workflows" && detailsResource.kind === "WorkflowTemplate" && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl border border-border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h3 className="text-xl font-bold">{detailsResource.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">WorkflowTemplate Details</p>
                </div>
                <Button
                  onClick={() => setDetailsResource(null)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Template Information */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Template Information</h4>
                  <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Entrypoint:</span>
                      <span className="text-sm font-mono">{getWorkflowTemplateEntryPoint(detailsResource)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Templates:</span>
                      <Badge variant="secondary">{getWorkflowTemplateCount(detailsResource)} templates</Badge>
                    </div>
                    {detailsResource.metadata?.spec?.serviceAccountName && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Service Account:</span>
                        <span className="text-sm font-mono">{detailsResource.metadata.spec.serviceAccountName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Templates */}
                {detailsResource.metadata?.spec?.templates && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Templates</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {detailsResource.metadata.spec.templates.map((template: any, idx: number) => (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium font-mono">{template.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {template.dag ? "DAG" : template.container ? "Container" : template.steps ? "Steps" : "Other"}
                            </Badge>
                          </div>
                          {template.container && (
                            <div className="text-xs text-muted-foreground">
                              <p>Image: {template.container.image}</p>
                              {template.container.command && (
                                <p className="mt-1 font-mono">Command: {template.container.command.join(" ")}</p>
                              )}
                            </div>
                          )}
                          {template.dag && (
                            <p className="text-xs text-muted-foreground">
                              DAG with {template.dag.tasks?.length || 0} tasks
                            </p>
                          )}
                          {template.steps && (
                            <p className="text-xs text-muted-foreground">
                              Steps workflow with {template.steps.length} step groups
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
                <Button onClick={() => setDetailsResource(null)} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal for CronWorkflows */}
        {detailsResource && controllerId === "argo-workflows" && detailsResource.kind === "CronWorkflow" && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl border border-border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h3 className="text-xl font-bold">{detailsResource.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">CronWorkflow Details</p>
                </div>
                <Button
                  onClick={() => setDetailsResource(null)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Schedule Information */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Schedule</h4>
                  <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Schedule:</span>
                      <span className="text-sm font-mono">{getCronSchedule(detailsResource)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Suspended:</span>
                      <Badge variant={isCronSuspended(detailsResource) ? "secondary" : "default"}>
                        {isCronSuspended(detailsResource) ? "Yes" : "No"}
                      </Badge>
                    </div>
                    {detailsResource.metadata?.spec?.timezone && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Timezone:</span>
                        <span className="text-sm">{detailsResource.metadata.spec.timezone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Workflow Template */}
                {detailsResource.metadata?.spec?.workflowSpec && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Workflow Template</h4>
                    <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Entrypoint:</span>
                        <span className="text-sm font-mono">{detailsResource.metadata.spec.workflowSpec.entrypoint || "-"}</span>
                      </div>
                      {detailsResource.metadata.spec.workflowSpec.templates && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Templates:</span>
                          <Badge variant="secondary">{detailsResource.metadata.spec.workflowSpec.templates.length} templates</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Concurrency Policy */}
                {detailsResource.metadata?.spec?.concurrencyPolicy && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Concurrency</h4>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Policy:</span>
                        <Badge>{detailsResource.metadata.spec.concurrencyPolicy}</Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
                <Button onClick={() => setDetailsResource(null)} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal for EventSources */}
        {detailsResource && controllerId === "argo-events" && detailsResource.kind === "EventSource" && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl border border-border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h3 className="text-xl font-bold">{detailsResource.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">EventSource Details</p>
                </div>
                <Button
                  onClick={() => setDetailsResource(null)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Source Information */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Source Information</h4>
                  <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Type:</span>
                      <Badge variant="outline">{getEventSourceType(detailsResource)}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge
                        className={
                          getEventSourceStatus(detailsResource).status === "Running"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : getEventSourceStatus(detailsResource).status === "Not Deployed"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : ""
                        }
                      >
                        {getEventSourceStatus(detailsResource).status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Source Configuration */}
                {detailsResource.metadata?.spec && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Configuration</h4>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <pre className="text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap">
                        {JSON.stringify(detailsResource.metadata.spec, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Conditions */}
                {detailsResource.metadata?.status?.conditions && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Conditions</h4>
                    <div className="space-y-2">
                      {detailsResource.metadata.status.conditions.map((condition: any, idx: number) => (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{condition.type}</span>
                            <Badge variant={condition.status === "True" ? "default" : "secondary"}>
                              {condition.status}
                            </Badge>
                          </div>
                          {condition.message && (
                            <p className="text-xs text-muted-foreground mt-1">{condition.message}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
                <Button onClick={() => setDetailsResource(null)} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal for Sensors */}
        {detailsResource && controllerId === "argo-events" && detailsResource.kind === "Sensor" && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl border border-border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h3 className="text-xl font-bold">{detailsResource.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">Sensor Details</p>
                </div>
                <Button
                  onClick={() => setDetailsResource(null)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Sensor Information */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sensor Information</h4>
                  <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge
                        className={
                          getSensorStatus(detailsResource).status === "Active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : getSensorStatus(detailsResource).status === "Not Deployed"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : ""
                        }
                      >
                        {getSensorStatus(detailsResource).status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Dependencies:</span>
                      <Badge variant="secondary">{getSensorDependenciesCount(detailsResource)} dependencies</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Triggers:</span>
                      <Badge variant="secondary">{getSensorTriggersCount(detailsResource)} triggers</Badge>
                    </div>
                  </div>
                </div>

                {/* Dependencies */}
                {detailsResource.metadata?.spec?.dependencies && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dependencies</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {detailsResource.metadata.spec.dependencies.map((dep: any, idx: number) => (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{dep.name}</span>
                            <Badge variant="outline" className="text-xs">{dep.eventSourceName}</Badge>
                          </div>
                          {dep.eventName && (
                            <p className="text-xs text-muted-foreground">Event: {dep.eventName}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Triggers */}
                {detailsResource.metadata?.spec?.triggers && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Triggers</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {detailsResource.metadata.spec.triggers.map((trigger: any, idx: number) => (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{trigger.template?.name || `Trigger ${idx + 1}`}</span>
                            {trigger.template?.k8s && (
                              <Badge variant="outline" className="text-xs">K8s</Badge>
                            )}
                            {trigger.template?.argoWorkflow && (
                              <Badge variant="outline" className="text-xs">Workflow</Badge>
                            )}
                          </div>
                          {trigger.template?.argoWorkflow && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {trigger.template.argoWorkflow.operation === "submit" && (
                                <p>Submit workflow from source</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conditions */}
                {detailsResource.metadata?.status?.conditions && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Conditions</h4>
                    <div className="space-y-2">
                      {detailsResource.metadata.status.conditions.map((condition: any, idx: number) => (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{condition.type}</span>
                            <Badge variant={condition.status === "True" ? "default" : "secondary"}>
                              {condition.status}
                            </Badge>
                          </div>
                          {condition.message && (
                            <p className="text-xs text-muted-foreground mt-1">{condition.message}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
                <Button onClick={() => setDetailsResource(null)} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal for ApplicationSets */}
        {detailsResource && controllerId === "argocd" && detailsResource.kind === "ApplicationSet" && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-xl border border-border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h3 className="text-xl font-bold">{detailsResource.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">ApplicationSet Details</p>
                </div>
                <Button
                  onClick={() => setDetailsResource(null)}
                  variant="ghost"
                  size="sm"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6 space-y-6">
                {/* Generator Configuration */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Generator</h4>
                  <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Type:</span>
                      <Badge>{getGeneratorType(detailsResource)}</Badge>
                    </div>
                    {getGeneratorType(detailsResource) === "List" && detailsResource.metadata?.spec?.generators?.[0]?.list?.elements && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Elements:</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {detailsResource.metadata.spec.generators[0].list.elements.map((element: any, idx: number) => (
                            <div key={idx} className="text-xs p-2 bg-background/50 rounded border border-border/30">
                              <span className="font-mono">{element.name || `Element ${idx + 1}`}</span>
                              {element.namespace && <span className="text-muted-foreground ml-2">→ {element.namespace}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Template Source */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Template Source</h4>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Repository</p>
                      <p className="text-sm font-mono break-all">
                        {getTemplateRepository(detailsResource) || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Target Revision</p>
                      <p className="text-sm flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        {getTemplateTargetRevision(detailsResource) || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Path Template</p>
                      <p className="text-sm font-mono">
                        {detailsResource.metadata?.spec?.template?.spec?.source?.path || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Destination Template</p>
                      <p className="text-sm font-mono">
                        {detailsResource.metadata?.spec?.template?.spec?.destination?.namespace || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Template Sync Policy */}
                {detailsResource.metadata?.spec?.template?.spec?.syncPolicy && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Template Sync Policy</h4>
                    <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Automated:</span>
                          <Badge variant={detailsResource.metadata.spec.template.spec.syncPolicy.automated ? "default" : "secondary"}>
                            {detailsResource.metadata.spec.template.spec.syncPolicy.automated ? "Yes" : "No"}
                          </Badge>
                        </div>
                        {detailsResource.metadata.spec.template.spec.syncPolicy.automated && (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Prune:</span>
                              <Badge variant={detailsResource.metadata.spec.template.spec.syncPolicy.automated.prune ? "default" : "secondary"}>
                                {detailsResource.metadata.spec.template.spec.syncPolicy.automated.prune ? "Yes" : "No"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Self Heal:</span>
                              <Badge variant={detailsResource.metadata.spec.template.spec.syncPolicy.automated.selfHeal ? "default" : "secondary"}>
                                {detailsResource.metadata.spec.template.spec.syncPolicy.automated.selfHeal ? "Yes" : "No"}
                              </Badge>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Managed Applications */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Managed Applications</h4>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total: {getManagedAppsCount(detailsResource)} applications</span>
                      {(() => {
                        const summary = getHealthSummary(detailsResource);
                        return (
                          <div className="flex items-center gap-3 text-xs">
                            {summary.healthy > 0 && <span className="text-green-600">{summary.healthy} Healthy</span>}
                            {summary.degraded > 0 && <span className="text-yellow-600">{summary.degraded} Degraded</span>}
                            {summary.missing > 0 && <span className="text-red-600">{summary.missing} Missing</span>}
                          </div>
                        );
                      })()}
                    </div>
                    {detailsResource.metadata?.status?.resources && detailsResource.metadata.status.resources.length > 0 && (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {detailsResource.metadata.status.resources.map((app: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/30">
                            <span className="text-sm font-mono">{app.name}</span>
                            <div className="flex items-center gap-3">
                              <Badge
                                variant="outline"
                                className={
                                  app.health?.status === "Healthy"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs"
                                    : app.health?.status === "Degraded"
                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs"
                                    : app.health?.status === "Missing"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs"
                                    : "text-xs"
                                }
                              >
                                {app.health?.status || "Unknown"}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={
                                  app.status === "Synced"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs"
                                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs"
                                }
                              >
                                {app.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Conditions */}
                {detailsResource.metadata?.status?.conditions && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Conditions</h4>
                    <div className="space-y-2">
                      {detailsResource.metadata.status.conditions.map((condition: any, idx: number) => (
                        <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{condition.type}</span>
                            <Badge variant={condition.status === "True" ? "default" : "secondary"}>
                              {condition.status}
                            </Badge>
                          </div>
                          {condition.message && (
                            <p className="text-xs text-muted-foreground mt-1">{condition.message}</p>
                          )}
                          {condition.lastTransitionTime && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last transition: {formatRelativeTime(condition.lastTransitionTime)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
                <Button onClick={() => setDetailsResource(null)} variant="outline">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show CRD types for this controller
  if (loading) {
    return <LoadingSpinner message={`Loading ${controller.name}...`} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive">Error loading controller resources: {error}</p>
        <Button onClick={loadRelatedCRDs}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            {controller.name}
            <Badge variant="secondary" className="text-xs">
              {controller.category}
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {controller.description}
          </p>
        </div>
        <Button onClick={loadRelatedCRDs} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-slate-500/10 to-zinc-500/10 rounded-xl border border-border/50">
        <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium mb-1">Controller Detected</p>
          <p className="text-sm text-muted-foreground">
            Found {relatedCRDs.length} resource type{relatedCRDs.length !== 1 ? 's' : ''} managed by {controller.name}
          </p>
        </div>
      </div>

      {/* Resource Types */}
      {relatedCRDs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10">
          <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No custom resources found for this controller</p>
          <p className="text-sm text-muted-foreground mt-2">
            The controller may not be fully installed or configured
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {relatedCRDs.map((crd) => (
            <button
              key={crd.name}
              onClick={() => loadCustomResources(crd)}
              className="group p-6 rounded-xl border border-border/50 bg-gradient-to-br from-background/50 to-background/30 hover:shadow-md hover:border-primary/30 transition-all duration-200 text-left"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                      {crd.kind}
                    </h3>
                    <Badge variant="outline" className="text-xs">
                      {crd.scope}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">
                    {crd.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {crd.group && `${crd.group}/`}{crd.version}
                  </p>
                </div>
                <div className="text-muted-foreground group-hover:text-primary transition-colors">
                  →
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
