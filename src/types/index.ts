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

export type ResourceType = "pods" | "deployments" | "services" | "namespaces" | "ingresses" | "istio";

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
