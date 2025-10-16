import { useState, useEffect } from "react";
import { X, Package, Search, Sparkles, Download, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { useAppStore } from "../../lib/store";
import { useNamespaces } from "../../hooks/useKube";
import { api } from "../../lib/api";
import Editor from "@monaco-editor/react";

interface HelmInstallModalProps {
  onClose: () => void;
  onInstall: (config: InstallConfig) => void;
  isInstalling: boolean;
}

export interface InstallConfig {
  releaseName: string;
  chart: string;
  namespace: string;
  version?: string;
  values?: string;
  createNamespace: boolean;
}

// Popular Helm charts
const POPULAR_CHARTS = [
  {
    name: "nginx",
    repo: "bitnami/nginx",
    description: "NGINX Open Source is a web server that can be also used as a reverse proxy",
    category: "Web Servers",
  },
  {
    name: "postgresql",
    repo: "bitnami/postgresql",
    description: "PostgreSQL is a powerful, open source object-relational database",
    category: "Databases",
  },
  {
    name: "mysql",
    repo: "bitnami/mysql",
    description: "MySQL is a fast, reliable, scalable, and easy to use open source database",
    category: "Databases",
  },
  {
    name: "redis",
    repo: "bitnami/redis",
    description: "Redis is an open source, advanced key-value store",
    category: "Databases",
  },
  {
    name: "mongodb",
    repo: "bitnami/mongodb",
    description: "MongoDB is a NoSQL database that uses JSON-like documents",
    category: "Databases",
  },
  {
    name: "prometheus",
    repo: "prometheus-community/prometheus",
    description: "Prometheus is a systems and service monitoring system",
    category: "Monitoring",
  },
  {
    name: "grafana",
    repo: "grafana/grafana",
    description: "Grafana is an open source metric analytics & visualization suite",
    category: "Monitoring",
  },
  {
    name: "cert-manager",
    repo: "jetstack/cert-manager",
    description: "cert-manager is a Kubernetes add-on to automate the management of TLS certificates",
    category: "Security",
  },
  {
    name: "ingress-nginx",
    repo: "ingress-nginx/ingress-nginx",
    description: "Ingress controller for Kubernetes using NGINX as a reverse proxy",
    category: "Networking",
  },
  {
    name: "traefik",
    repo: "traefik/traefik",
    description: "Traefik is a modern HTTP reverse proxy and load balancer",
    category: "Networking",
  },
];

const DEFAULT_VALUES = `# Add your custom values here
# Example:
# replicaCount: 2
# service:
#   type: LoadBalancer
#   port: 80
`;

export function HelmInstallModal({ onClose, onInstall, isInstalling }: HelmInstallModalProps) {
  const theme = useAppStore((state) => state.theme);
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const { data: namespaces } = useNamespaces();

  const [releaseName, setReleaseName] = useState("");
  const [chart, setChart] = useState("");
  const [version, setVersion] = useState("");
  const [namespace, setNamespace] = useState(currentNamespace || "default");
  const [values, setValues] = useState(DEFAULT_VALUES);
  const [createNamespace, setCreateNamespace] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [loadingValues, setLoadingValues] = useState(false);
  const [valuesError, setValuesError] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isInstalling) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, isInstalling]);

  const categories = ["All", ...Array.from(new Set(POPULAR_CHARTS.map(c => c.category)))];

  const filteredCharts = POPULAR_CHARTS.filter(c => {
    const matchesSearch = searchQuery === "" ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelectChart = async (chartRepo: string, chartName: string) => {
    setChart(chartRepo);
    setValuesError(null);
    if (!releaseName) {
      setReleaseName(chartName);
    }

    // Auto-load default values when selecting a chart
    setLoadingValues(true);
    try {
      const chartValues = await api.helmGetChartValues(chartRepo);
      if (chartValues && chartValues.trim()) {
        setValues(chartValues);
        setValuesError(null);
      }
    } catch (err: any) {
      console.error("Failed to load chart values:", err);
      setValuesError(err.message || "Failed to load chart values. The chart repository may not be added.");
      // Keep the current values on error
    } finally {
      setLoadingValues(false);
    }
  };

  const loadChartValues = async () => {
    if (!chart) return;

    setLoadingValues(true);
    setValuesError(null);
    try {
      const chartValues = await api.helmGetChartValues(chart);
      if (chartValues && chartValues.trim()) {
        setValues(chartValues);
        setValuesError(null);
      }
    } catch (err: any) {
      console.error("Failed to load chart values:", err);
      setValuesError(err.message || "Failed to load chart values. The chart repository may not be added.");
      // Keep the current values on error
    } finally {
      setLoadingValues(false);
    }
  };

  const handleInstall = () => {
    if (!releaseName || !chart || !namespace) {
      return;
    }

    onInstall({
      releaseName,
      chart,
      namespace,
      version: version || undefined,
      values: values === DEFAULT_VALUES ? undefined : values,
      createNamespace,
    });
  };

  const isValid = releaseName && chart && namespace;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border/50 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-500" />
              </div>
              Install Helm Chart
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Install a new Helm chart or select from popular charts
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isInstalling}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Chart Selection */}
          <div className="w-1/2 border-r border-border/50 flex flex-col">
            <div className="p-6 space-y-4">
              {/* Manual Chart Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Chart Name</label>
                <input
                  type="text"
                  placeholder="e.g., bitnami/nginx or my-repo/my-chart"
                  value={chart}
                  onChange={(e) => setChart(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-muted-foreground">
                  Format: repository/chart-name
                </p>
              </div>

              {/* Search Popular Charts */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <label className="text-sm font-medium">Popular Charts</label>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search charts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>

                {/* Category Filters */}
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedCategory === cat
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Charts List */}
            <div className="flex-1 overflow-auto px-6 pb-6">
              <div className="space-y-2">
                {filteredCharts.map((chartItem) => (
                  <button
                    key={chartItem.repo}
                    onClick={() => handleSelectChart(chartItem.repo, chartItem.name)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      chart === chartItem.repo
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm">{chartItem.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {chartItem.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {chartItem.description}
                        </p>
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {chartItem.repo}
                        </code>
                      </div>
                      {chart === chartItem.repo && (
                        <Download className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Configuration */}
          <div className="w-1/2 flex flex-col">
            <div className="p-6 space-y-4">
              {/* Release Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Release Name</label>
                <input
                  type="text"
                  placeholder="my-release"
                  value={releaseName}
                  onChange={(e) => setReleaseName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Version */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Version (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., 1.2.3"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to install the latest version
                </p>
              </div>

              {/* Namespace Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Namespace</label>
                <input
                  type="text"
                  list="namespace-list"
                  placeholder="Select or type namespace name"
                  value={namespace}
                  onChange={(e) => {
                    setNamespace(e.target.value);
                    // Auto-check create namespace if it's not in the list
                    const exists = namespaces?.some(ns => ns.name === e.target.value);
                    setCreateNamespace(!exists && !!e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <datalist id="namespace-list">
                  {namespaces?.map((ns) => (
                    <option key={ns.name} value={ns.name} />
                  ))}
                </datalist>
                {createNamespace && !namespaces?.some(ns => ns.name === namespace) && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    This namespace will be created during installation
                  </p>
                )}
              </div>
            </div>

            {/* Values Editor */}
            <div className="flex-1 flex flex-col px-6 pb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Values (YAML)</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadChartValues}
                  disabled={!chart || loadingValues}
                  className="h-7 text-xs gap-1.5"
                >
                  {loadingValues ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Load Default Values
                    </>
                  )}
                </Button>
              </div>
              {valuesError && (
                <div className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {valuesError}
                  </p>
                </div>
              )}
              <div className="flex-1 border border-border rounded-lg overflow-hidden">
                <Editor
                  height="100%"
                  defaultLanguage="yaml"
                  theme={theme === "dark" ? "vs-dark" : "light"}
                  value={values}
                  onChange={(value) => setValues(value || "")}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 12,
                    lineNumbers: "on",
                    wordWrap: "on",
                    automaticLayout: true,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border/50 bg-muted/20">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>Make sure the Helm repository is added before installing the chart</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={isInstalling}>
              Cancel
            </Button>
            <Button
              onClick={handleInstall}
              disabled={!isValid || isInstalling}
              className="gap-2"
            >
              {isInstalling ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Install Chart
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
