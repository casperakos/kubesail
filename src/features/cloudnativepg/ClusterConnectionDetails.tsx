import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Copy, Eye, EyeOff, Database, Key, Globe, Terminal } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { useToastStore } from "../../lib/toastStore";

interface ClusterConnectionDetailsProps {
  clusterName: string;
  namespace: string;
}

export function ClusterConnectionDetails({ clusterName, namespace }: ClusterConnectionDetailsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const addToast = useToastStore((state) => state.addToast);

  const { data: connectionDetails, isLoading, error } = useQuery({
    queryKey: ["cnpg-connection", clusterName, namespace],
    queryFn: () => api.getCNPGClusterConnection(clusterName, namespace),
    retry: 1,
  });

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      addToast(`${fieldName} copied to clipboard`, "success");
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      addToast("Failed to copy to clipboard", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card/50 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !connectionDetails) {
    return (
      <div className="bg-card/50 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
        <div className="text-sm text-muted-foreground">
          Unable to load connection details. Make sure the cluster secret exists.
        </div>
      </div>
    );
  }

  const ConnectionField = ({
    label,
    value,
    icon: Icon,
    secret = false,
    mono = true
  }: {
    label: string;
    value: string;
    icon: typeof Database;
    secret?: boolean;
    mono?: boolean;
  }) => (
    <div className="group relative bg-background/50 rounded-xl border border-border/50 p-4 hover:border-primary/30 transition-all duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </span>
          </div>
          <div className={`text-sm text-foreground break-all ${mono ? "font-mono" : ""}`}>
            {secret && !showPassword ? "••••••••••••••••" : value}
          </div>
        </div>
        <button
          onClick={() => copyToClipboard(value, label)}
          className="shrink-0 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          title={`Copy ${label}`}
        >
          <Copy className={`w-4 h-4 ${copiedField === label ? "text-green-500" : "text-muted-foreground"}`} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-card/50 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Connection Details</h3>
              <p className="text-sm text-muted-foreground">
                Database credentials and connection strings
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 transition-all duration-200"
          >
            {showPassword ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span className="text-sm">Hide Password</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span className="text-sm">Show Password</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ConnectionField label="Database" value={connectionDetails.database} icon={Database} />
          <ConnectionField label="Username" value={connectionDetails.username} icon={Key} />
          <ConnectionField label="Password" value={connectionDetails.password} icon={Key} secret />
          <ConnectionField label="Host" value={connectionDetails.host} icon={Globe} />
          <ConnectionField label="Port" value={connectionDetails.port} icon={Globe} />
        </div>
      </div>

      <div className="bg-card/50 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Terminal className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Connection Strings</h3>
            <p className="text-sm text-muted-foreground">
              Ready-to-use connection URIs
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <ConnectionField label="PostgreSQL URI" value={connectionDetails.uri} icon={Terminal} />
          <ConnectionField label="PostgreSQL FQDN URI" value={connectionDetails.fqdn_uri} icon={Terminal} />
          <ConnectionField label="JDBC URI" value={connectionDetails.jdbc_uri} icon={Terminal} />
          <ConnectionField label="JDBC FQDN URI" value={connectionDetails.fqdn_jdbc_uri} icon={Terminal} />
          <ConnectionField label="pgpass Format" value={connectionDetails.pgpass} icon={Terminal} />
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex gap-3">
          <div className="shrink-0">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
              Info
            </Badge>
          </div>
          <div className="text-sm text-foreground/80 space-y-1">
            <p className="font-medium">Connection Security</p>
            <p>
              These connection details are retrieved from the Kubernetes secret <code className="px-1 py-0.5 bg-background/50 rounded text-xs">{clusterName}-app</code>.
              Use the FQDN URIs for connections from outside the cluster.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
