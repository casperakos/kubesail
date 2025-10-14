import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { X, Download, Copy, Check, RefreshCw } from "lucide-react";

interface YamlViewerProps {
  resourceType: string;
  resourceName: string;
  namespace: string;
  onClose: () => void;
}

export function YamlViewer({
  resourceType,
  resourceName,
  namespace,
  onClose,
}: YamlViewerProps) {
  const [yaml, setYaml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchYaml = async () => {
    setLoading(true);
    setError(null);
    try {
      const yamlContent = await api.getResourceYaml(
        resourceType,
        namespace,
        resourceName
      );
      setYaml(yamlContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch YAML");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYaml();
    // Handle ESC key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [resourceType, resourceName, namespace, onClose]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-card/95 to-card/90 border border-border/50 rounded-xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col backdrop-blur-xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-gradient-to-r from-background/50 to-background/30">
          <div>
            <h2 className="text-lg font-semibold">Resource YAML</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{resourceType}</Badge>
              <span className="text-sm text-muted-foreground">/</span>
              <span className="text-sm font-mono">{namespace}</span>
              <span className="text-sm text-muted-foreground">/</span>
              <span className="text-sm font-mono">{resourceName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchYaml}>
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
            <Button variant="ghost" size="sm" onClick={copyToClipboard}>
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadYaml}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-gradient-to-br from-muted/30 to-muted/20 custom-scrollbar">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-destructive text-center">
                <p className="font-semibold mb-2">Error loading YAML</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && yaml && (
            <pre className="font-mono text-sm bg-black/90 text-green-400 p-4 rounded-lg overflow-x-auto whitespace-pre">
              {yaml}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border/50 bg-gradient-to-r from-background/50 to-background/30 text-sm text-muted-foreground">
          <div>{yaml.split("\n").length} lines</div>
          <div>Press Esc to close</div>
        </div>
      </div>
    </div>
  );
}
