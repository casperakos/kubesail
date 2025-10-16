import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, FileText, Settings, Code, History, Download, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import Editor from "@monaco-editor/react";
import { api } from "../../lib/api";
import { useAppStore } from "../../lib/store";
import type { HelmRelease } from "../../types";

interface HelmReleaseDetailsModalProps {
  release: HelmRelease;
  onClose: () => void;
}

type Tab = "info" | "values" | "manifest" | "history";

export function HelmReleaseDetailsModal({ release, onClose }: HelmReleaseDetailsModalProps) {
  const theme = useAppStore((state) => state.theme);
  const [activeTab, setActiveTab] = useState<Tab>("info");

  // Fetch release details
  const { data: releaseDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ["helm-release-details", release.namespace, release.name],
    queryFn: () => api.helmGetRelease(release.name, release.namespace),
    enabled: activeTab === "info",
  });

  // Fetch values
  const { data: values, isLoading: loadingValues } = useQuery({
    queryKey: ["helm-values", release.namespace, release.name],
    queryFn: () => api.helmGetValues(release.name, release.namespace),
    enabled: activeTab === "values",
  });

  // Fetch manifest
  const { data: manifest, isLoading: loadingManifest } = useQuery({
    queryKey: ["helm-manifest", release.namespace, release.name],
    queryFn: () => api.helmGetManifest(release.name, release.namespace),
    enabled: activeTab === "manifest",
  });

  // Fetch history
  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ["helm-history", release.namespace, release.name],
    queryFn: () => api.helmGetHistory(release.name, release.namespace),
    enabled: activeTab === "history",
  });

  const tabs: Array<{ id: Tab; label: string; icon: any }> = [
    { id: "info", label: "Information", icon: FileText },
    { id: "values", label: "Values", icon: Settings },
    { id: "manifest", label: "Manifest", icon: Code },
    { id: "history", label: "History", icon: History },
  ];

  const downloadContent = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-card/95 to-card/90 border border-border/50 rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col backdrop-blur-xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 bg-gradient-to-r from-background/50 to-background/30">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {release.name}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">{release.namespace}</Badge>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{release.chart}</span>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">Revision {release.revision}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 border-b border-border/50">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all flex items-center gap-2 ${
                activeTab === id
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          {activeTab === "info" && (
            <div className="h-full overflow-auto space-y-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : releaseDetails ? (
                <>
                  {/* Release Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-border/50 bg-muted/30">
                      <div className="text-sm text-muted-foreground mb-1">Status</div>
                      <div className="text-lg font-semibold">{releaseDetails.info.status}</div>
                    </div>
                    <div className="p-4 rounded-xl border border-border/50 bg-muted/30">
                      <div className="text-sm text-muted-foreground mb-1">Description</div>
                      <div className="text-lg font-semibold">{releaseDetails.info.description}</div>
                    </div>
                    <div className="p-4 rounded-xl border border-border/50 bg-muted/30">
                      <div className="text-sm text-muted-foreground mb-1">First Deployed</div>
                      <div className="text-sm">{releaseDetails.info.first_deployed}</div>
                    </div>
                    <div className="p-4 rounded-xl border border-border/50 bg-muted/30">
                      <div className="text-sm text-muted-foreground mb-1">Last Deployed</div>
                      <div className="text-sm">{releaseDetails.info.last_deployed}</div>
                    </div>
                  </div>

                  {/* Chart Info */}
                  <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-br from-primary/5 to-primary/10">
                    <h3 className="text-lg font-semibold mb-4">Chart Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Name</div>
                        <div className="font-medium">{releaseDetails.chart.metadata.name}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Version</div>
                        <div className="font-medium">{releaseDetails.chart.metadata.version}</div>
                      </div>
                      {releaseDetails.chart.metadata.app_version && (
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">App Version</div>
                          <div className="font-medium">{releaseDetails.chart.metadata.app_version}</div>
                        </div>
                      )}
                      {releaseDetails.chart.metadata.description && (
                        <div className="col-span-2">
                          <div className="text-sm text-muted-foreground mb-1">Description</div>
                          <div className="text-sm">{releaseDetails.chart.metadata.description}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {releaseDetails.info.notes && (
                    <div className="p-6 rounded-xl border border-border/50 bg-muted/20">
                      <h3 className="text-lg font-semibold mb-3">Release Notes</h3>
                      <pre className="text-sm font-mono whitespace-pre-wrap text-muted-foreground">
                        {releaseDetails.info.notes}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-muted-foreground">No details available</div>
              )}
            </div>
          )}

          {activeTab === "values" && (
            <div className="h-full flex flex-col">
              {loadingValues ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : values ? (
                <>
                  <div className="flex justify-end mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadContent(values, `${release.name}-values.yaml`)}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                  <div className="flex-1 rounded-xl overflow-hidden border border-border/50">
                    <Editor
                      height="100%"
                      defaultLanguage="yaml"
                      value={values}
                      theme={theme === "dark" ? "vs-dark" : "light"}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground">No values available</div>
              )}
            </div>
          )}

          {activeTab === "manifest" && (
            <div className="h-full flex flex-col">
              {loadingManifest ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : manifest ? (
                <>
                  <div className="flex justify-end mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadContent(manifest, `${release.name}-manifest.yaml`)}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                  <div className="flex-1 rounded-xl overflow-hidden border border-border/50">
                    <Editor
                      height="100%"
                      defaultLanguage="yaml"
                      value={manifest}
                      theme={theme === "dark" ? "vs-dark" : "light"}
                      options={{
                        readOnly: true,
                        minimap: { enabled: true },
                        fontSize: 13,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground">No manifest available</div>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="h-full overflow-auto">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : history && history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="font-mono">
                              Revision {item.revision}
                            </Badge>
                            <Badge variant={item.status === "deployed" ? "success" : "secondary"}>
                              {item.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {item.updated || item.chart}
                          </div>
                          {item.description && (
                            <div className="text-sm mt-1">{item.description}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground">No history available</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
