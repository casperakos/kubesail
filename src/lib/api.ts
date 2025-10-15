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
  PortForwardInfo,
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

  async restartDeployment(
    namespace: string,
    deploymentName: string
  ): Promise<void> {
    return await invoke("restart_deployment", {
      namespace,
      deploymentName,
    });
  },

  async deleteDeployment(
    namespace: string,
    deploymentName: string
  ): Promise<void> {
    return await invoke("delete_deployment", {
      namespace,
      deploymentName,
    });
  },

  // Service operations
  async getServices(namespace: string): Promise<ServiceInfo[]> {
    return await invoke("get_services", { namespace });
  },

  async deleteService(
    namespace: string,
    serviceName: string
  ): Promise<void> {
    return await invoke("delete_service", {
      namespace,
      serviceName,
    });
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
    namespace: string | undefined,
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

  async deleteConfigMap(
    namespace: string,
    configmapName: string
  ): Promise<void> {
    return await invoke("delete_configmap", {
      namespace,
      configmapName,
    });
  },

  // Secret operations
  async getSecrets(namespace: string): Promise<SecretInfo[]> {
    return await invoke("get_secrets", { namespace });
  },

  async deleteSecret(
    namespace: string,
    secretName: string
  ): Promise<void> {
    return await invoke("delete_secret", {
      namespace,
      secretName,
    });
  },

  // StatefulSet operations
  async getStatefulSets(namespace: string): Promise<StatefulSetInfo[]> {
    return await invoke("get_statefulsets", { namespace });
  },

  async scaleStatefulSet(
    namespace: string,
    statefulsetName: string,
    replicas: number
  ): Promise<void> {
    return await invoke("scale_statefulset", {
      namespace,
      statefulsetName,
      replicas,
    });
  },

  async restartStatefulSet(
    namespace: string,
    statefulsetName: string
  ): Promise<void> {
    return await invoke("restart_statefulset", {
      namespace,
      statefulsetName,
    });
  },

  async deleteStatefulSet(
    namespace: string,
    statefulsetName: string
  ): Promise<void> {
    return await invoke("delete_statefulset", {
      namespace,
      statefulsetName,
    });
  },

  // DaemonSet operations
  async getDaemonSets(namespace: string): Promise<DaemonSetInfo[]> {
    return await invoke("get_daemonsets", { namespace });
  },

  async restartDaemonSet(
    namespace: string,
    daemonsetName: string
  ): Promise<void> {
    return await invoke("restart_daemonset", {
      namespace,
      daemonsetName,
    });
  },

  async deleteDaemonSet(
    namespace: string,
    daemonsetName: string
  ): Promise<void> {
    return await invoke("delete_daemonset", {
      namespace,
      daemonsetName,
    });
  },

  // Job operations
  async getJobs(namespace: string): Promise<JobInfo[]> {
    return await invoke("get_jobs", { namespace });
  },

  async deleteJob(
    namespace: string,
    jobName: string
  ): Promise<void> {
    return await invoke("delete_job", {
      namespace,
      jobName,
    });
  },

  // CronJob operations
  async getCronJobs(namespace: string): Promise<CronJobInfo[]> {
    return await invoke("get_cronjobs", { namespace });
  },

  async suspendCronJob(
    namespace: string,
    cronjobName: string
  ): Promise<void> {
    return await invoke("suspend_cronjob", {
      namespace,
      cronjobName,
    });
  },

  async resumeCronJob(
    namespace: string,
    cronjobName: string
  ): Promise<void> {
    return await invoke("resume_cronjob", {
      namespace,
      cronjobName,
    });
  },

  async deleteCronJob(
    namespace: string,
    cronjobName: string
  ): Promise<void> {
    return await invoke("delete_cronjob", {
      namespace,
      cronjobName,
    });
  },

  async getPodsForResource(
    resourceType: string,
    resourceName: string,
    namespace: string
  ): Promise<PodInfo[]> {
    return await invoke("get_pods_for_resource", {
      resourceType,
      resourceName,
      namespace,
    });
  },

  // Node operations
  async getNodes(): Promise<NodeInfo[]> {
    return await invoke("get_nodes");
  },

  async cordonNode(nodeName: string): Promise<void> {
    return await invoke("cordon_node", { nodeName });
  },

  async uncordonNode(nodeName: string): Promise<void> {
    return await invoke("uncordon_node", { nodeName });
  },

  async drainNode(nodeName: string): Promise<void> {
    return await invoke("drain_node", { nodeName });
  },

  async deleteNode(nodeName: string): Promise<void> {
    return await invoke("delete_node", { nodeName });
  },

  async describeNode(nodeName: string): Promise<string> {
    return await invoke("describe_node", { nodeName });
  },

  async describeResource(
    resourceType: string,
    namespace: string | undefined,
    name: string
  ): Promise<string> {
    return await invoke("describe_resource", {
      resourceType,
      namespace,
      name,
    });
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
    namespace: string | undefined,
    yamlContent: string
  ): Promise<void> {
    return await invoke("apply_resource_yaml", {
      resourceType,
      namespace,
      yamlContent,
    });
  },

  // Port Forward operations
  async startPortForward(
    resourceType: string,
    resourceName: string,
    namespace: string,
    localPort: number,
    remotePort: number
  ): Promise<PortForwardInfo> {
    return await invoke("start_port_forward", {
      resourceType,
      resourceName,
      namespace,
      localPort,
      remotePort,
    });
  },

  async stopPortForward(id: string): Promise<void> {
    return await invoke("stop_port_forward", { id });
  },

  async listPortForwards(): Promise<PortForwardInfo[]> {
    return await invoke("list_port_forwards");
  },
};
