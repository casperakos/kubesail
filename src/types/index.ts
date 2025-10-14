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
}

export interface IstioVirtualServiceInfo {
  name: string;
  namespace: string;
  hosts: string[];
  gateways: string[];
  age: string;
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
  os_image: string;
  kernel_version: string;
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
  | "ingresses"
  | "istio"
  | "configmaps"
  | "secrets"
  | "statefulsets"
  | "daemonsets"
  | "jobs"
  | "cronjobs"
  | "nodes"
  | "events"
  | "storage"
  | "rbac";

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

export interface AppState {
  currentContext?: string;
  currentNamespace: string;
  currentView: ResourceType;
  theme: "light" | "dark";
  setCurrentContext: (context?: string) => void;
  setCurrentNamespace: (namespace: string) => void;
  setCurrentView: (view: ResourceType) => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
}
