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
    enabled: !!namespace,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });
}

export function useDeployments(namespace: string) {
  return useQuery({
    queryKey: ["deployments", namespace],
    queryFn: () => api.getDeployments(namespace),
    enabled: !!namespace,
    refetchInterval: 5000,
  });
}

export function useServices(namespace: string) {
  return useQuery({
    queryKey: ["services", namespace],
    queryFn: () => api.getServices(namespace),
    enabled: !!namespace,
    refetchInterval: 10000,
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
    enabled: !!namespace && !!podName,
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
    }) => api.deletePod(namespace, podName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pods", variables.namespace] });
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

export function useIngresses(namespace: string) {
  return useQuery({
    queryKey: ["ingresses", namespace],
    queryFn: () => api.getIngresses(namespace),
    enabled: !!namespace,
    refetchInterval: 10000,
  });
}

export function useIstioVirtualServices(namespace: string) {
  return useQuery({
    queryKey: ["istio-vs", namespace],
    queryFn: () => api.getIstioVirtualServices(namespace),
    enabled: !!namespace,
    refetchInterval: 10000,
  });
}

export function useIstioGateways(namespace: string) {
  return useQuery({
    queryKey: ["istio-gateways", namespace],
    queryFn: () => api.getIstioGateways(namespace),
    enabled: !!namespace,
    refetchInterval: 10000,
  });
}
