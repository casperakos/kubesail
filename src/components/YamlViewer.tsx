import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { X, Download, Copy, Check, RefreshCw, Edit3, Save } from "lucide-react";
import { useAppStore } from "../lib/store";

interface YamlViewerProps {
  resourceType: string;
  resourceName: string;
  namespace?: string;
  onClose: () => void;
}

export function YamlViewer({
  resourceType,
  resourceName,
  namespace,
  onClose,
}: YamlViewerProps) {
  const theme = useAppStore((state) => state.theme);
  const [yaml, setYaml] = useState<string>("");
  const [editedYaml, setEditedYaml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const editorRef = useRef<any>(null);
  const isEditModeRef = useRef(isEditMode);
  const applyingRef = useRef(applying);
  const editedYamlRef = useRef(editedYaml);
  const yamlRef = useRef(yaml);

  // Keep refs in sync with state
  useEffect(() => {
    isEditModeRef.current = isEditMode;
  }, [isEditMode]);

  useEffect(() => {
    applyingRef.current = applying;
  }, [applying]);

  useEffect(() => {
    editedYamlRef.current = editedYaml;
  }, [editedYaml]);

  useEffect(() => {
    yamlRef.current = yaml;
  }, [yaml]);

  const fetchYaml = async () => {
    setLoading(true);
    setError(null);
    setApplyError(null);
    setApplySuccess(false);
    try {
      const yamlContent = await api.getResourceYaml(
        resourceType,
        namespace,
        resourceName
      );
      setYaml(yamlContent);
      setEditedYaml(yamlContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch YAML");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setApplyError(null);
    setApplySuccess(false);
    try {
      await api.applyResourceYaml(resourceType, namespace, editedYaml);
      setApplySuccess(true);
      setYaml(editedYaml);
      setIsEditMode(false);
      setTimeout(() => setApplySuccess(false), 3000);
      // Refresh the YAML to get the latest from server
      await fetchYaml();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Failed to apply changes");
    } finally {
      setApplying(false);
    }
  };

  const toggleEditMode = () => {
    if (isEditMode) {
      // Cancel edit - reset to original yaml
      setEditedYaml(yaml);
      setApplyError(null);
    }
    setIsEditMode(!isEditMode);
  };

  useEffect(() => {
    fetchYaml();
  }, [resourceType, resourceName, namespace]);

  useEffect(() => {
    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isEditModeRef.current) {
          toggleEditMode();
        } else {
          onClose();
        }
      }
      // Cmd/Ctrl+S to apply changes
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && isEditModeRef.current) {
        e.preventDefault();
        if (!applyingRef.current && editedYamlRef.current !== yamlRef.current) {
          handleApply();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(editedYaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const downloadYaml = () => {
    const blob = new Blob([editedYaml], { type: "text/yaml" });
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
              {namespace && (
                <>
                  <span className="text-sm text-muted-foreground">/</span>
                  <span className="text-sm font-mono">{namespace}</span>
                </>
              )}
              <span className="text-sm text-muted-foreground">/</span>
              <span className="text-sm font-mono">{resourceName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditMode && (
              <>
                <Button variant="ghost" size="sm" onClick={fetchYaml} disabled={loading}>
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
              </>
            )}
            {isEditMode ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleApply}
                  disabled={applying || editedYaml === yaml}
                >
                  {applying ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Applying...
                    </>
                  ) : applySuccess ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Applied!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Apply
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={toggleEditMode}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={toggleEditMode} disabled={loading || !!error}>
                <Edit3 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gradient-to-br from-muted/30 to-muted/20">
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

          {applyError && (
            <div className="p-4 bg-destructive/10 border-b border-destructive/50">
              <p className="text-destructive text-sm">
                <strong>Error applying changes:</strong> {applyError}
              </p>
            </div>
          )}

          {!loading && !error && yaml && (
            isEditMode ? (
              <Editor
                key="edit-mode"
                height="100%"
                defaultLanguage="yaml"
                theme={theme === "dark" ? "vs-dark" : "light"}
                value={editedYaml}
                onChange={(value) => setEditedYaml(value || "")}
                options={{
                  readOnly: false,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  wordWrap: "on",
                  automaticLayout: true,
                  tabSize: 2,
                  insertSpaces: true,
                  quickSuggestions: false,
                  suggestOnTriggerCharacters: false,
                  acceptSuggestionOnEnter: "off",
                  tabCompletion: "off",
                  wordBasedSuggestions: false,
                  parameterHints: { enabled: false },
                  hover: { enabled: false },
                }}
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
              />
            ) : (
              <Editor
                key="view-mode"
                height="100%"
                defaultLanguage="yaml"
                theme={theme === "dark" ? "vs-dark" : "light"}
                value={editedYaml}
                options={{
                  readOnly: true,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  wordWrap: "on",
                  automaticLayout: true,
                  tabSize: 2,
                  insertSpaces: true,
                }}
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
              />
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border/50 bg-gradient-to-r from-background/50 to-background/30 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>{editedYaml.split("\n").length} lines</span>
            {isEditMode && editedYaml !== yaml && (
              <Badge variant="warning" className="text-xs">Modified</Badge>
            )}
            {applySuccess && (
              <Badge variant="success" className="text-xs">Applied successfully</Badge>
            )}
          </div>
          <div>
            {isEditMode ? "Cmd/Ctrl+S to apply • Esc to cancel" : "Press Esc to close"}
          </div>
        </div>
      </div>
    </div>
  );
}
