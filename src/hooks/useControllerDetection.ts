import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface ControllerInfo {
  id: string;
  name: string;
  icon: string;
  detected: boolean;
  crdPatterns: string[];
  description: string;
  category: "gitops" | "secrets" | "certificates" | "infrastructure" | "workflows";
}

const KNOWN_CONTROLLERS: Omit<ControllerInfo, "detected">[] = [
  {
    id: "argocd",
    name: "ArgoCD",
    icon: "GitBranch",
    crdPatterns: ["applications.argoproj.io", "applicationsets.argoproj.io"],
    description: "GitOps continuous delivery",
    category: "gitops",
  },
  {
    id: "flux",
    name: "Flux CD",
    icon: "GitMerge",
    crdPatterns: ["gitrepositories.source.toolkit.fluxcd.io", "kustomizations.kustomize.toolkit.fluxcd.io"],
    description: "GitOps toolkit",
    category: "gitops",
  },
  {
    id: "external-secrets",
    name: "External Secrets",
    icon: "Key",
    crdPatterns: ["externalsecrets.external-secrets.io", "secretstores.external-secrets.io"],
    description: "External secrets management",
    category: "secrets",
  },
  {
    id: "sealed-secrets",
    name: "Sealed Secrets",
    icon: "Lock",
    crdPatterns: ["sealedsecrets.bitnami.com"],
    description: "Encrypted secrets",
    category: "secrets",
  },
  {
    id: "cert-manager",
    name: "Cert-Manager",
    icon: "FileText",
    crdPatterns: ["certificates.cert-manager.io", "issuers.cert-manager.io"],
    description: "Certificate management",
    category: "certificates",
  },
  {
    id: "crossplane",
    name: "Crossplane",
    icon: "Boxes",
    crdPatterns: ["compositeresourcedefinitions.apiextensions.crossplane.io"],
    description: "Infrastructure as code",
    category: "infrastructure",
  },
  {
    id: "argo-workflows",
    name: "Argo Workflows",
    icon: "Workflow",
    crdPatterns: ["workflows.argoproj.io", "workflowtemplates.argoproj.io", "cronworkflows.argoproj.io"],
    description: "Workflow orchestration engine",
    category: "workflows",
  },
  {
    id: "argo-events",
    name: "Argo Events",
    icon: "Zap",
    crdPatterns: ["eventsources.argoproj.io", "sensors.argoproj.io"],
    description: "Event-driven workflow automation",
    category: "workflows",
  },
];

export function useControllerDetection() {
  return useQuery({
    queryKey: ["controller-detection"],
    queryFn: async (): Promise<ControllerInfo[]> => {
      try {
        // Fetch all CRDs from the cluster
        const crds = await api.getCRDs();
        const crdNames = new Set(crds.map((crd) => crd.name.toLowerCase()));

        // Check each controller against installed CRDs
        const detectedControllers: ControllerInfo[] = KNOWN_CONTROLLERS.map(
          (controller) => {
            const detected = controller.crdPatterns.some((pattern) => {
              const patternLower = pattern.toLowerCase();
              return [...crdNames].some((crdName) =>
                crdName.includes(patternLower)
              );
            });

            return {
              ...controller,
              detected,
            };
          }
        );

        // Return only detected controllers
        return detectedControllers.filter((c) => c.detected);
      } catch (error) {
        console.error("Error detecting controllers:", error);
        // Re-throw the error so React Query can handle it properly
        throw error;
      }
    },
    refetchInterval: 60000, // Refresh every 60 seconds
    staleTime: 30000, // Consider data stale after 30 seconds
    retry: 2, // Retry twice on failure
    retryDelay: 1000, // Wait 1s between retries
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });
}

export function useController(controllerId: string) {
  const { data: controllers } = useControllerDetection();
  return controllers?.find((c) => c.id === controllerId);
}
