export interface ClusterInfo {
  name: string;
  server: string;
  current: boolean;
}

export interface ContextInfo {
  name: string;
  cluster: string;
  namespace?: string;
  user: string;
  current: boolean;
}

export interface NamespaceInfo {
  name: string;
  status: string;
  age: string;
}

export interface PodInfo {
  name: string;
  namespace: string;
  status: string;
  ready: string;
  restarts: number;
  age: string;
  node?: string;
  ip?: string;
  ports: number[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface DeploymentInfo {
  name: string;
  namespace: string;
  ready: string;
  up_to_date: number;
  available: number;
  age: string;
}

export interface ServiceInfo {
  name: string;
  namespace: string;
  service_type: string;
  cluster_ip: string;
  external_ip?: string;
  ports: string;
  selector?: Record<string, string>;
  age: string;
}

export interface LogEntry {
  timestamp?: string;
  message: string;
  pod_name: string;
}

export interface IngressInfo {
  name: string;
  namespace: string;
  class?: string;
  hosts: string[];
  addresses: string[];
  age: string;
  tls: boolean;
  rules: IngressRule[];
}

export interface IngressRule {
  host: string;
  paths: IngressPath[];
}

export interface IngressPath {
  path: string;
  path_type: string;
  service: string;
  port: string;
}

export interface IstioVirtualServiceInfo {
  name: string;
  namespace: string;
  hosts: string[];
  gateways: string[];
  age: string;
  routes: VirtualServiceRoute[];
}

export interface VirtualServiceRoute {
  match_conditions: RouteMatch[];
  destination_host: string;
  destination_port?: number;
  weight?: number;
}

export interface RouteMatch {
  uri_prefix?: string;
  uri_exact?: string;
  uri_regex?: string;
  headers: string[];
}

export interface IstioGatewayInfo {
  name: string;
  namespace: string;
  servers: GatewayServer[];
  age: string;
}

export interface GatewayServer {
  port: number;
  protocol: string;
  hosts: string[];
}

export interface ConfigMapInfo {
  name: string;
  namespace: string;
  data: Record<string, string>;
  age: string;
  keys: number;
}

export interface SecretInfo {
  name: string;
  namespace: string;
  secret_type: string;
  data: Record<string, string>;
  age: string;
  keys: number;
}

export interface StatefulSetInfo {
  name: string;
  namespace: string;
  ready: string;
  replicas: number;
  age: string;
}

export interface DaemonSetInfo {
  name: string;
  namespace: string;
  desired: number;
  current: number;
  ready: number;
  up_to_date: number;
  available: number;
  age: string;
}

export interface JobInfo {
  name: string;
  namespace: string;
  completions: string;
  duration: string;
  age: string;
  active: number;
  succeeded: number;
  failed: number;
}

export interface CronJobInfo {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  active: number;
  last_schedule?: string;
  age: string;
}

export interface NodeInfo {
  name: string;
  status: string;
  roles: string[];
  age: string;
  version: string;
  internal_ip: string;
  external_ip?: string;
  os_image: string;
  kernel_version: string;
  container_runtime: string;
  cpu_capacity: string;
  cpu_allocatable: string;
  memory_capacity: string;
  memory_allocatable: string;
  pods_capacity: string;
  pods_allocatable: string;
  gpu_capacity?: string;
}

export interface EventInfo {
  event_type: string;
  reason: string;
  object: string;
  message: string;
  source: string;
  first_seen: string;
  last_seen: string;
  count: number;
}

export interface PersistentVolumeInfo {
  name: string;
  capacity: string;
  access_modes: string[];
  reclaim_policy: string;
  status: string;
  claim?: string;
  storage_class?: string;
  age: string;
}

export interface PersistentVolumeClaimInfo {
  name: string;
  namespace: string;
  status: string;
  volume?: string;
  capacity?: string;
  access_modes: string[];
  storage_class?: string;
  age: string;
}

export type ResourceType =
  | "dashboard"
  | "pods"
  | "deployments"
  | "services"
  | "namespaces"
  | "gateways"
  | "configmaps"
  | "secrets"
  | "statefulsets"
  | "daemonsets"
  | "jobs"
  | "cronjobs"
  | "nodes"
  | "events"
  | "storage"
  | "rbac"
  | "portforwards"
  | "crds"
  | "helm"
  | "argocd"
  | "argocd-applications"
  | "flux"
  | "external-secrets"
  | "sealed-secrets"
  | "cert-manager"
  | "crossplane"
  | "argo-workflows"
  | "argo-workflows-workflows"
  | "argo-events"
  | "settings";

// RBAC Types
export interface SubjectInfo {
  kind: string;
  name: string;
  namespace?: string;
}

export interface RoleInfo {
  name: string;
  namespace: string;
  age: string;
  rules_count: number;
}

export interface RoleBindingInfo {
  name: string;
  namespace: string;
  role: string;
  role_kind: string;
  subjects: SubjectInfo[];
  age: string;
}

export interface ClusterRoleInfo {
  name: string;
  age: string;
  rules_count: number;
}

export interface ClusterRoleBindingInfo {
  name: string;
  role: string;
  subjects: SubjectInfo[];
  age: string;
}

export interface ServiceAccountInfo {
  name: string;
  namespace: string;
  secrets: number;
  age: string;
}

export interface ClusterMetrics {
  total_nodes: number;
  ready_nodes: number;
  total_pods: number;
  running_pods: number;
  total_namespaces: number;
  total_deployments: number;
  total_services: number;
  cpu_usage_percent?: number;
  memory_usage_percent?: number;
}

export interface PortForwardInfo {
  id: string;
  resource_type: string;
  resource_name: string;
  namespace: string;
  local_port: number;
  remote_port: number;
  status: string;
}

export interface AppState {
  currentContext?: string;
  currentNamespace: string;
  currentView: ResourceType;
  theme: "light" | "dark";
  podSearchFilter?: string;
  deploymentSearchFilter?: string;
  serviceSearchFilter?: string;
  setCurrentContext: (context?: string) => void;
  setCurrentNamespace: (namespace: string) => void;
  setCurrentView: (view: ResourceType) => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  setPodSearchFilter: (filter?: string) => void;
  setDeploymentSearchFilter: (filter?: string) => void;
  setServiceSearchFilter: (filter?: string) => void;
}

// Helm types
export interface HelmRelease {
  name: string;
  namespace: string;
  revision: string;
  updated: string;
  status: string;
  chart: string;
  app_version: string;
}

export interface HelmReleaseDetail {
  name: string;
  info: HelmReleaseInfo;
  chart: HelmChart;
  config: Record<string, any>;
}

export interface HelmReleaseInfo {
  first_deployed: string;
  last_deployed: string;
  deleted: string;
  description: string;
  status: string;
  notes: string;
}

export interface HelmChart {
  metadata: HelmChartMetadata;
}

export interface HelmChartMetadata {
  name: string;
  version: string;
  description?: string;
  api_version: string;
  app_version?: string;
  keywords?: string[];
  home?: string;
  sources?: string[];
}

// Advanced Metrics types
export interface MetricsSource {
  name: string;
  available: boolean;
  endpoint?: string;
}

export interface MetricsCapabilities {
  metrics_server: boolean;
  prometheus: boolean;
  sources: MetricsSource[];
}

export interface NodeMetrics {
  name: string;
  cpu_usage: string;
  cpu_usage_cores: number;
  memory_usage: string;
  memory_usage_bytes: number;
}

export interface PodMetrics {
  name: string;
  namespace: string;
  cpu_usage: string;
  cpu_usage_cores: number;
  memory_usage: string;
  memory_usage_bytes: number;
}

export interface ClusterMetricsData {
  total_cpu_capacity: number;
  total_cpu_allocatable: number;
  total_cpu_usage: number;
  cpu_usage_percent: number;
  total_memory_capacity: number;
  total_memory_allocatable: number;
  total_memory_usage: number;
  memory_usage_percent: number;
  node_metrics: NodeMetrics[];
  top_pods_by_cpu: PodMetrics[];
  top_pods_by_memory: PodMetrics[];
}

// Settings types
export interface UserSettings {
  // Data refresh settings
  refreshIntervals: {
    pods: number;
    deployments: number;
    services: number;
    nodes: number;
    metrics: number;
    cluster: number;
  };

  // Metrics settings
  metrics: {
    enabled: boolean;
    autoRefresh: boolean;
  };

  // Display preferences
  display: {
    itemsPerPage: number;
    compactMode: boolean;
    showNamespaceColumn: boolean;
  };

  // Performance settings
  performance: {
    enableAutoRefresh: boolean;
    requestTimeout: number;
    cacheStaleTime: number;
    maxRetryAttempts: number;
  };

  // Advanced settings
  advanced: {
    enableAnimations: boolean;
  };
}

export interface SettingsState extends UserSettings {
  updateRefreshInterval: (key: keyof UserSettings['refreshIntervals'], value: number) => void;
  updateMetricsSetting: (key: keyof UserSettings['metrics'], value: boolean) => void;
  updateDisplaySetting: (key: keyof UserSettings['display'], value: any) => void;
  updatePerformanceSetting: (key: keyof UserSettings['performance'], value: any) => void;
  updateAdvancedSetting: (key: keyof UserSettings['advanced'], value: any) => void;
  resetToDefaults: () => void;
}
