import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useContexts() {
  return useQuery({
    queryKey: ["contexts"],
    queryFn: () => api.getContexts(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useClusters() {
  return useQuery({
    queryKey: ["clusters"],
    queryFn: () => api.getClusters(),
    refetchInterval: 30000,
  });
}

export function useNamespaces() {
  return useQuery({
    queryKey: ["namespaces"],
    queryFn: () => api.getNamespaces(),
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

export function usePods(namespace: string) {
  return useQuery({
    queryKey: ["pods", namespace],
    queryFn: () => api.getPods(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });
}

export function useDeployments(namespace: string) {
  return useQuery({
    queryKey: ["deployments", namespace],
    queryFn: () => api.getDeployments(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 5000,
  });
}

export function useServices(namespace: string) {
  return useQuery({
    queryKey: ["services", namespace],
    queryFn: () => api.getServices(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 10000,
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      serviceName,
    }: {
      namespace: string;
      serviceName: string;
    }) => api.deleteService(namespace, serviceName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["services", variables.namespace],
      });
    },
    onError: (error) => {
      console.error("Failed to delete service:", error);
      alert(`Failed to delete service: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

export function usePodLogs(
  namespace: string,
  podName: string,
  container?: string,
  tailLines?: number
) {
  return useQuery({
    queryKey: ["logs", namespace, podName, container, tailLines],
    queryFn: () => api.getPodLogs(namespace, podName, container, tailLines),
    enabled: namespace !== undefined && !!podName,
    refetchInterval: 2000, // Refetch logs every 2 seconds
  });
}

export function useDeletePod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      podName,
    }: {
      namespace: string;
      podName: string;
    }) => {
      console.log("useDeletePod mutationFn called with:", { namespace, podName });
      return api.deletePod(namespace, podName);
    },
    onSuccess: (_, variables) => {
      console.log("Delete pod successful, invalidating queries");
      queryClient.invalidateQueries({ queryKey: ["pods", variables.namespace] });
    },
    onError: (error) => {
      console.error("Failed to delete pod:", error);
      alert(`Failed to delete pod: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

export function useScaleDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      deploymentName,
      replicas,
    }: {
      namespace: string;
      deploymentName: string;
      replicas: number;
    }) => api.scaleDeployment(namespace, deploymentName, replicas),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["deployments", variables.namespace],
      });
      queryClient.invalidateQueries({ queryKey: ["pods", variables.namespace] });
    },
  });
}

export function useDeleteDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      deploymentName,
    }: {
      namespace: string;
      deploymentName: string;
    }) => {
      console.log("useDeleteDeployment mutationFn called with:", { namespace, deploymentName });
      return api.deleteDeployment(namespace, deploymentName);
    },
    onSuccess: (_, variables) => {
      console.log("Delete deployment successful, invalidating queries");
      queryClient.invalidateQueries({
        queryKey: ["deployments", variables.namespace],
      });
      queryClient.invalidateQueries({ queryKey: ["pods", variables.namespace] });
    },
    onError: (error) => {
      console.error("Failed to delete deployment:", error);
      alert(`Failed to delete deployment: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

export function useIngresses(namespace: string) {
  return useQuery({
    queryKey: ["ingresses", namespace],
    queryFn: () => api.getIngresses(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 10000,
  });
}

export function useIstioVirtualServices(namespace: string) {
  return useQuery({
    queryKey: ["istio-vs", namespace],
    queryFn: () => api.getIstioVirtualServices(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 10000,
  });
}

export function useIstioGateways(namespace: string) {
  return useQuery({
    queryKey: ["istio-gateways", namespace],
    queryFn: () => api.getIstioGateways(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 10000,
  });
}

export function useConfigMaps(namespace: string) {
  return useQuery({
    queryKey: ["configmaps", namespace],
    queryFn: () => api.getConfigMaps(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 10000,
  });
}

export function useDeleteConfigMap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      configmapName,
    }: {
      namespace: string;
      configmapName: string;
    }) => api.deleteConfigMap(namespace, configmapName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["configmaps", variables.namespace],
      });
    },
    onError: (error) => {
      console.error("Failed to delete configmap:", error);
      alert(`Failed to delete configmap: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

export function useSecrets(namespace: string) {
  return useQuery({
    queryKey: ["secrets", namespace],
    queryFn: () => api.getSecrets(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 10000,
  });
}

export function useDeleteSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      secretName,
    }: {
      namespace: string;
      secretName: string;
    }) => api.deleteSecret(namespace, secretName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["secrets", variables.namespace],
      });
    },
    onError: (error) => {
      console.error("Failed to delete secret:", error);
      alert(`Failed to delete secret: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

export function useStatefulSets(namespace: string) {
  return useQuery({
    queryKey: ["statefulsets", namespace],
    queryFn: () => api.getStatefulSets(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 5000,
  });
}

export function useScaleStatefulSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      statefulsetName,
      replicas,
    }: {
      namespace: string;
      statefulsetName: string;
      replicas: number;
    }) => api.scaleStatefulSet(namespace, statefulsetName, replicas),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["statefulsets", variables.namespace],
      });
      queryClient.invalidateQueries({ queryKey: ["pods", variables.namespace] });
    },
  });
}

export function useRestartStatefulSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      statefulsetName,
    }: {
      namespace: string;
      statefulsetName: string;
    }) => api.restartStatefulSet(namespace, statefulsetName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["statefulsets", variables.namespace],
      });
      queryClient.invalidateQueries({ queryKey: ["pods", variables.namespace] });
    },
  });
}

export function useDeleteStatefulSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      statefulsetName,
    }: {
      namespace: string;
      statefulsetName: string;
    }) => {
      console.log("useDeleteStatefulSet mutationFn called with:", { namespace, statefulsetName });
      return api.deleteStatefulSet(namespace, statefulsetName);
    },
    onSuccess: (_, variables) => {
      console.log("Delete statefulset successful, invalidating queries");
      queryClient.invalidateQueries({
        queryKey: ["statefulsets", variables.namespace],
      });
      queryClient.invalidateQueries({ queryKey: ["pods", variables.namespace] });
    },
    onError: (error) => {
      console.error("Failed to delete statefulset:", error);
      alert(`Failed to delete statefulset: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

export function useDaemonSets(namespace: string) {
  return useQuery({
    queryKey: ["daemonsets", namespace],
    queryFn: () => api.getDaemonSets(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 5000,
  });
}

export function useRestartDaemonSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      daemonsetName,
    }: {
      namespace: string;
      daemonsetName: string;
    }) => api.restartDaemonSet(namespace, daemonsetName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["daemonsets", variables.namespace],
      });
      queryClient.invalidateQueries({ queryKey: ["pods", variables.namespace] });
    },
    onError: (error) => {
      console.error("Failed to restart daemonset:", error);
      alert(`Failed to restart daemonset: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

export function useDeleteDaemonSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      daemonsetName,
    }: {
      namespace: string;
      daemonsetName: string;
    }) => {
      console.log("useDeleteDaemonSet mutationFn called with:", { namespace, daemonsetName });
      return api.deleteDaemonSet(namespace, daemonsetName);
    },
    onSuccess: (_, variables) => {
      console.log("Delete daemonset successful, invalidating queries");
      queryClient.invalidateQueries({
        queryKey: ["daemonsets", variables.namespace],
      });
      queryClient.invalidateQueries({ queryKey: ["pods", variables.namespace] });
    },
    onError: (error) => {
      console.error("Failed to delete daemonset:", error);
      alert(`Failed to delete daemonset: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

export function useJobs(namespace: string) {
  return useQuery({
    queryKey: ["jobs", namespace],
    queryFn: () => api.getJobs(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 5000,
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      jobName,
    }: {
      namespace: string;
      jobName: string;
    }) => {
      console.log("useDeleteJob mutationFn called with:", { namespace, jobName });
      return api.deleteJob(namespace, jobName);
    },
    onSuccess: (_, variables) => {
      console.log("Delete job successful, invalidating queries");
      queryClient.invalidateQueries({
        queryKey: ["jobs", variables.namespace],
      });
    },
    onError: (error) => {
      console.error("Failed to delete job:", error);
      alert(`Failed to delete job: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

export function useCronJobs(namespace: string) {
  return useQuery({
    queryKey: ["cronjobs", namespace],
    queryFn: () => api.getCronJobs(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 10000,
  });
}

export function useSuspendCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      cronjobName,
    }: {
      namespace: string;
      cronjobName: string;
    }) => {
      console.log("useSuspendCronJob mutationFn called with:", { namespace, cronjobName });
      return api.suspendCronJob(namespace, cronjobName);
    },
    onSuccess: (_, variables) => {
      console.log("Suspend cronjob successful, invalidating queries");
      queryClient.invalidateQueries({
        queryKey: ["cronjobs", variables.namespace],
      });
    },
    onError: (error) => {
      console.error("Failed to suspend cronjob:", error);
      alert(`Failed to suspend cronjob: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

export function useResumeCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      cronjobName,
    }: {
      namespace: string;
      cronjobName: string;
    }) => {
      console.log("useResumeCronJob mutationFn called with:", { namespace, cronjobName });
      return api.resumeCronJob(namespace, cronjobName);
    },
    onSuccess: (_, variables) => {
      console.log("Resume cronjob successful, invalidating queries");
      queryClient.invalidateQueries({
        queryKey: ["cronjobs", variables.namespace],
      });
    },
    onError: (error) => {
      console.error("Failed to resume cronjob:", error);
      alert(`Failed to resume cronjob: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

export function useDeleteCronJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      namespace,
      cronjobName,
    }: {
      namespace: string;
      cronjobName: string;
    }) => {
      console.log("useDeleteCronJob mutationFn called with:", { namespace, cronjobName });
      return api.deleteCronJob(namespace, cronjobName);
    },
    onSuccess: (_, variables) => {
      console.log("Delete cronjob successful, invalidating queries");
      queryClient.invalidateQueries({
        queryKey: ["cronjobs", variables.namespace],
      });
    },
    onError: (error) => {
      console.error("Failed to delete cronjob:", error);
      alert(`Failed to delete cronjob: ${error instanceof Error ? error.message : String(error)}`);
    },
  });
}

export function useNodes() {
  return useQuery({
    queryKey: ["nodes"],
    queryFn: () => api.getNodes(),
    refetchInterval: 10000,
  });
}

export function useEvents(namespace: string) {
  return useQuery({
    queryKey: ["events", namespace],
    queryFn: () => api.getEvents(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 5000, // Events change frequently
  });
}

export function usePersistentVolumes() {
  return useQuery({
    queryKey: ["persistent-volumes"],
    queryFn: () => api.getPersistentVolumes(),
    refetchInterval: 10000,
  });
}

export function usePersistentVolumeClaims(namespace: string) {
  return useQuery({
    queryKey: ["persistent-volume-claims", namespace],
    queryFn: () => api.getPersistentVolumeClaims(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 10000,
  });
}

// RBAC Hooks
export function useRoles(namespace: string) {
  return useQuery({
    queryKey: ["roles", namespace],
    queryFn: () => api.getRoles(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 10000,
  });
}

export function useRoleBindings(namespace: string) {
  return useQuery({
    queryKey: ["role-bindings", namespace],
    queryFn: () => api.getRoleBindings(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 10000,
  });
}

export function useClusterRoles() {
  return useQuery({
    queryKey: ["cluster-roles"],
    queryFn: () => api.getClusterRoles(),
    refetchInterval: 10000,
  });
}

export function useClusterRoleBindings() {
  return useQuery({
    queryKey: ["cluster-role-bindings"],
    queryFn: () => api.getClusterRoleBindings(),
    refetchInterval: 10000,
  });
}

export function useServiceAccounts(namespace: string) {
  return useQuery({
    queryKey: ["service-accounts", namespace],
    queryFn: () => api.getServiceAccounts(namespace),
    enabled: namespace !== undefined,
    refetchInterval: 10000,
  });
}
