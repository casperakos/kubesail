import { invoke } from "@tauri-apps/api/core";
import type {
  ClusterInfo,
  ContextInfo,
  DeploymentInfo,
  LogEntry,
  NamespaceInfo,
  PodInfo,
  ServiceInfo,
  ConfigMapInfo,
  SecretInfo,
  StatefulSetInfo,
  DaemonSetInfo,
  JobInfo,
  CronJobInfo,
  NodeInfo,
  EventInfo,
  PersistentVolumeInfo,
  PersistentVolumeClaimInfo,
  RoleInfo,
  RoleBindingInfo,
  ClusterRoleInfo,
  ClusterRoleBindingInfo,
  ServiceAccountInfo,
} from "../types";

export const api = {
  // Cluster & Context operations
  async getContexts(): Promise<ContextInfo[]> {
    return await invoke("get_kubeconfig_contexts");
  },

  async getClusters(): Promise<ClusterInfo[]> {
    return await invoke("get_clusters");
  },

  async reinitClient(): Promise<void> {
    return await invoke("reinit_kube_client");
  },

  // Namespace operations
  async getNamespaces(): Promise<NamespaceInfo[]> {
    return await invoke("get_namespaces");
  },

  // Pod operations
  async getPods(namespace: string): Promise<PodInfo[]> {
    return await invoke("get_pods", { namespace });
  },

  async deletePod(namespace: string, podName: string): Promise<void> {
    return await invoke("delete_pod", { namespace, podName });
  },

  async getPodLogs(
    namespace: string,
    podName: string,
    container?: string,
    tailLines?: number
  ): Promise<LogEntry[]> {
    return await invoke("get_pod_logs", {
      namespace,
      podName,
      container,
      tailLines,
    });
  },

  // Deployment operations
  async getDeployments(namespace: string): Promise<DeploymentInfo[]> {
    return await invoke("get_deployments", { namespace });
  },

  async scaleDeployment(
    namespace: string,
    deploymentName: string,
    replicas: number
  ): Promise<void> {
    return await invoke("scale_deployment", {
      namespace,
      deploymentName,
      replicas,
    });
  },

  // Service operations
  async getServices(namespace: string): Promise<ServiceInfo[]> {
    return await invoke("get_services", { namespace });
  },

  // Ingress operations
  async getIngresses(namespace: string): Promise<any[]> {
    return await invoke("get_ingresses", { namespace });
  },

  // Istio operations
  async getIstioVirtualServices(namespace: string): Promise<any[]> {
    return await invoke("get_istio_virtual_services", { namespace });
  },

  async getIstioGateways(namespace: string): Promise<any[]> {
    return await invoke("get_istio_gateways", { namespace });
  },

  // YAML operations
  async getResourceYaml(
    resourceType: string,
    namespace: string,
    name: string
  ): Promise<string> {
    return await invoke("get_resource_yaml", {
      resourceType,
      namespace,
      name,
    });
  },

  // ConfigMap operations
  async getConfigMaps(namespace: string): Promise<ConfigMapInfo[]> {
    return await invoke("get_configmaps", { namespace });
  },

  // Secret operations
  async getSecrets(namespace: string): Promise<SecretInfo[]> {
    return await invoke("get_secrets", { namespace });
  },

  // StatefulSet operations
  async getStatefulSets(namespace: string): Promise<StatefulSetInfo[]> {
    return await invoke("get_statefulsets", { namespace });
  },

  // DaemonSet operations
  async getDaemonSets(namespace: string): Promise<DaemonSetInfo[]> {
    return await invoke("get_daemonsets", { namespace });
  },

  // Job operations
  async getJobs(namespace: string): Promise<JobInfo[]> {
    return await invoke("get_jobs", { namespace });
  },

  // CronJob operations
  async getCronJobs(namespace: string): Promise<CronJobInfo[]> {
    return await invoke("get_cronjobs", { namespace });
  },

  // Node operations
  async getNodes(): Promise<NodeInfo[]> {
    return await invoke("get_nodes");
  },

  // Event operations
  async getEvents(namespace: string): Promise<EventInfo[]> {
    return await invoke("get_events", { namespace });
  },

  // PersistentVolume operations
  async getPersistentVolumes(): Promise<PersistentVolumeInfo[]> {
    return await invoke("get_persistent_volumes");
  },

  // PersistentVolumeClaim operations
  async getPersistentVolumeClaims(
    namespace: string
  ): Promise<PersistentVolumeClaimInfo[]> {
    return await invoke("get_persistent_volume_claims", { namespace });
  },

  // RBAC operations
  async getRoles(namespace: string): Promise<RoleInfo[]> {
    return await invoke("get_roles", { namespace });
  },

  async getRoleBindings(namespace: string): Promise<RoleBindingInfo[]> {
    return await invoke("get_role_bindings", { namespace });
  },

  async getClusterRoles(): Promise<ClusterRoleInfo[]> {
    return await invoke("get_cluster_roles");
  },

  async getClusterRoleBindings(): Promise<ClusterRoleBindingInfo[]> {
    return await invoke("get_cluster_role_bindings");
  },

  async getServiceAccounts(namespace: string): Promise<ServiceAccountInfo[]> {
    return await invoke("get_service_accounts", { namespace });
  },

  async applyResourceYaml(
    resourceType: string,
    namespace: string,
    yamlContent: string
  ): Promise<void> {
    return await invoke("apply_resource_yaml", {
      resourceType,
      namespace,
      yamlContent,
    });
  },
};
