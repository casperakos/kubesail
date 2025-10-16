import { useState } from "react";
import { useAppStore } from "../../lib/store";
import { useGatewayDetection } from "../../hooks/useGatewayDetection";
import {
  useIngresses,
  useIstioVirtualServices,
  useIstioGateways,
} from "../../hooks/useKube";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { RefreshCw, Globe, Shield, Network, AlertCircle } from "lucide-react";
import { IngressesList } from "../ingresses/IngressesList";
import { IstioResourcesList } from "../ingresses/IstioResourcesList";
import { LoadingSpinner } from "../../components/LoadingSpinner";

type TabType = "nginx" | "traefik" | "standard" | "istio";

export function GatewaysPage() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const { data: operators, isLoading: detectingOperators, refetch: refetchDetection } = useGatewayDetection(currentNamespace);

  // Set initial tab to first detected operator
  const [activeTab, setActiveTab] = useState<TabType | null>(null);

  // Set active tab when operators are detected
  if (operators && operators.length > 0 && !activeTab) {
    setActiveTab(operators[0].type);
  }

  const {data: ingresses, refetch: refetchIngresses} = useIngresses(currentNamespace);
  const {refetch: refetchIstioVS} = useIstioVirtualServices(currentNamespace);
  const {refetch: refetchIstioGW} = useIstioGateways(currentNamespace);

  const handleRefresh = () => {
    refetchDetection();
    refetchIngresses();
    refetchIstioVS();
    refetchIstioGW();
  };

  const getOperatorIcon = (type: TabType) => {
    switch (type) {
      case "nginx":
      case "traefik":
      case "standard":
        return Globe;
      case "istio":
        return Network;
      default:
        return Shield;
    }
  };

  const getIngressesByClass = (className: string) => {
    if (!ingresses) return [];
    return ingresses.filter(ing =>
      ing.class?.toLowerCase().includes(className.toLowerCase())
    );
  };

  if (detectingOperators) {
    return <LoadingSpinner message="Detecting gateways..." />;
  }

  if (!operators || operators.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-500/10 to-zinc-500/10 flex items-center justify-center">
            <Globe className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">
              No Gateway or Ingress Controllers Detected
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Install an ingress controller (NGINX, Traefik) or service mesh (Istio) to manage external access to your services.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Detection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gateways & Routing</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage ingress controllers and service mesh routing
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Detection Info */}
      <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-xl border border-border/50">
        <AlertCircle className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Detected {operators.length} gateway operator{operators.length > 1 ? 's' : ''}:
        </span>
        {operators.map((op) => (
          <Badge key={op.type} variant="secondary">
            {op.name}
          </Badge>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/50">
        {operators.map((operator) => {
          const Icon = getOperatorIcon(operator.type);
          const isActive = activeTab === operator.type;

          return (
            <button
              key={operator.type}
              onClick={() => setActiveTab(operator.type)}
              className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-all duration-200 border-b-2 ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="w-4 h-4" />
              {operator.name}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "istio" && <IstioResourcesList />}
        {(activeTab === "nginx" || activeTab === "traefik" || activeTab === "standard") && (
          <IngressesList />
        )}
      </div>
    </div>
  );
}
