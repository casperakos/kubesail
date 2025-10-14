import { invoke } from "@tauri-apps/api/core";
import {
  ClusterInfo,
  ContextInfo,
  DeploymentInfo,
  LogEntry,
  NamespaceInfo,
  PodInfo,
  ServiceInfo,
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
};
