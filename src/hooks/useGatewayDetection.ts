import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface GatewayOperator {
  type: "nginx" | "traefik" | "istio" | "standard";
  name: string;
  detected: boolean;
  hasResources: boolean;
}

export function useGatewayDetection(namespace?: string) {
  return useQuery({
    queryKey: ["gateway-detection", namespace],
    queryFn: async (): Promise<GatewayOperator[]> => {
      try {
        // Fetch all available resources to detect what's installed
        const [ingresses, istioVS, istioGW] = await Promise.allSettled([
          api.getIngresses(namespace),
          api.getIstioVirtualServices(namespace),
          api.getIstioGateways(namespace),
        ]);

        const operators: GatewayOperator[] = [];

        // Check standard Ingress (Nginx, Traefik, etc.)
        if (ingresses.status === "fulfilled" && ingresses.value.length > 0) {
          const ingressClasses = new Set(
            ingresses.value
              .map((ing) => ing.class?.toLowerCase())
              .filter(Boolean)
          );

          if ([...ingressClasses].some((c) => c?.includes("nginx"))) {
            operators.push({
              type: "nginx",
              name: "NGINX Ingress",
              detected: true,
              hasResources: true,
            });
          }

          if ([...ingressClasses].some((c) => c?.includes("traefik"))) {
            operators.push({
              type: "traefik",
              name: "Traefik",
              detected: true,
              hasResources: true,
            });
          }

          // Standard ingress (others)
          if (
            ingresses.value.some(
              (ing) =>
                !ing.class?.toLowerCase().includes("nginx") &&
                !ing.class?.toLowerCase().includes("traefik") &&
                !ing.class?.toLowerCase().includes("istio")
            )
          ) {
            operators.push({
              type: "standard",
              name: "Standard Ingress",
              detected: true,
              hasResources: true,
            });
          }
        }

        // Check Istio
        const hasIstioResources =
          (istioVS.status === "fulfilled" && istioVS.value.length > 0) ||
          (istioGW.status === "fulfilled" && istioGW.value.length > 0);

        if (hasIstioResources) {
          operators.push({
            type: "istio",
            name: "Istio Service Mesh",
            detected: true,
            hasResources: true,
          });
        }

        return operators;
      } catch (error) {
        console.error("Error detecting gateway operators:", error);
        return [];
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
