import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "./ui/Button";
import { X, Download, Copy, Check, RefreshCw } from "lucide-react";
import { useAppStore } from "../lib/store";

interface CustomResourceYamlViewerProps {
  group: string;
  version: string;
  plural: string;
  resourceName: string;
  namespace?: string;
  onClose: () => void;
}

export function CustomResourceYamlViewer({
  group,
  version,
  plural,
  resourceName,
  namespace,
  onClose,
}: CustomResourceYamlViewerProps) {
  const theme = useAppStore((state) => state.theme);
  const [yaml, setYaml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchYaml = async () => {
    setLoading(true);
    setError(null);
    try {
      const yamlContent = await invoke<string>("get_custom_resource_yaml", {
        group,
        version,
        plural,
        name: resourceName,
        namespace: namespace || null,
      });
      setYaml(yamlContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch YAML");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYaml();
  }, []);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadYaml = () => {
    const blob = new Blob([yaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resourceName}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 bg-gradient-to-r from-background/95 to-background/80">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-400 to-zinc-400 bg-clip-text text-transparent">
              YAML Viewer
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {resourceName}
              {namespace && ` (${namespace})`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!loading && !error && (
              <>
                <Button onClick={fetchYaml} variant="ghost" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button onClick={copyToClipboard} variant="ghost" size="sm">
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
                <Button onClick={downloadYaml} variant="ghost" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </>
            )}
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-4 text-muted-foreground">Loading YAML...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-destructive font-semibold">Error loading YAML</p>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
                <Button onClick={fetchYaml} className="mt-4">
                  Retry
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="h-full rounded-xl overflow-hidden border border-border/50 shadow-inner">
              <Editor
                height="100%"
                defaultLanguage="yaml"
                value={yaml}
                theme={theme === "dark" ? "vs-dark" : "light"}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
