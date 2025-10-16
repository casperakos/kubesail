import { useState, useMemo, useEffect } from "react";
import { useSecrets, useDeleteSecret } from "../../hooks/useKube";
import { useAppStore } from "../../lib/store";
import { useToastStore } from "../../lib/toastStore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { RefreshCw, Eye, EyeOff, Search, X, Code, Trash2, FileText, AlertTriangle, MoreVertical } from "lucide-react";
import { ContextMenu, ContextMenuItem, ContextMenuTrigger } from "../../components/ui/ContextMenu";
import { SecretInfo } from "../../types";
import { YamlViewer } from "../../components/YamlViewer";
import { ResourceDescribeViewer } from "../../components/ResourceDescribeViewer";
import { LoadingSpinner } from "../../components/LoadingSpinner";

export function SecretsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const { data: secrets, isLoading, error, refetch } = useSecrets(currentNamespace);
  const deleteSecret = useDeleteSecret();
  const [selectedSecret, setSelectedSecret] = useState<SecretInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<{name: string; namespace: string} | null>(null);
  const [selectedSecretForDescribe, setSelectedSecretForDescribe] = useState<{name: string; namespace: string} | null>(null);
  const [secretToDelete, setSecretToDelete] = useState<string | null>(null);

  const handleDelete = (secretName: string) => {
    setSecretToDelete(secretName);
  };

  const confirmDelete = () => {
    if (secretToDelete) {
      const secret = secrets?.find(s => s.name === secretToDelete);
      if (secret) {
        deleteSecret.mutate({
          namespace: secret.namespace,
          secretName: secretToDelete,
        });
      }
      setSecretToDelete(null);
    }
  };

  const cancelDelete = () => {
    setSecretToDelete(null);
  };

  const getTypeVariant = (type: string) => {
    if (type.includes("tls")) return "success";
    if (type.includes("token")) return "warning";
    return "secondary";
  };

  // Filter secrets based on search query
  const filteredSecrets = useMemo(() => {
    if (!secrets) return [];
    if (!searchQuery) return secrets;

    const query = searchQuery.toLowerCase();
    return secrets.filter(secret =>
      secret.name.toLowerCase().includes(query) ||
      secret.secret_type.toLowerCase().includes(query) ||
      Object.keys(secret.data).some(key => key.toLowerCase().includes(query))
    );
  }, [secrets, searchQuery]);

  if (isLoading) {
    return <LoadingSpinner message="Loading secrets..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading secrets: {error.message}
      </div>
    );
  }

  if (!secrets || secrets.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No secrets found in namespace "{currentNamespace}"
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-slate-500 to-zinc-500 rounded-full"></div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Secrets
            </h2>
            <Badge variant="secondary" className="ml-2">
              {filteredSecrets?.length || 0} {searchQuery && `of ${secrets?.length || 0}`}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, type, or key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-background/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {showNamespaceColumn && <TableHead>Namespace</TableHead>}
            <TableHead>Type</TableHead>
            <TableHead>Keys</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSecrets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5 + (showNamespaceColumn ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                {searchQuery ? `No secrets found matching "${searchQuery}"` : "No secrets found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredSecrets.map((secret) => {
              const menuItems: ContextMenuItem[] = [
                {
                  label: "View YAML",
                  icon: <Code className="w-4 h-4" />,
                  onClick: () => setSelectedResource({name: secret.name, namespace: secret.namespace})
                },
                {
                  label: "Describe",
                  icon: <FileText className="w-4 h-4" />,
                  onClick: () => setSelectedSecretForDescribe({name: secret.name, namespace: secret.namespace})
                },
                {
                  label: "View Secret Data",
                  icon: <Eye className="w-4 h-4" />,
                  onClick: () => setSelectedSecret(secret)
                },
                { separator: true },
                {
                  label: "Delete",
                  icon: <Trash2 className="w-4 h-4" />,
                  onClick: () => handleDelete(secret.name),
                  variant: "danger" as const,
                  disabled: deleteSecret.isPending
                }
              ];

              return (
                <ContextMenuTrigger key={secret.name} items={menuItems}>
                  <TableRow>
                    <TableCell className="font-medium">{secret.name}</TableCell>
                    {showNamespaceColumn && <TableCell>{secret.namespace}</TableCell>}
                    <TableCell>
                      <Badge variant={getTypeVariant(secret.secret_type)}>
                        {secret.secret_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{secret.keys} keys</Badge>
                    </TableCell>
                    <TableCell>{secret.age}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <ContextMenu items={menuItems}>
                          <MoreVertical className="w-4 h-4" />
                        </ContextMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                </ContextMenuTrigger>
              );
            })
          )}
        </TableBody>
      </Table>

      {selectedResource && (
        <YamlViewer
          resourceType="secret"
          resourceName={selectedResource.name}
          namespace={selectedResource.namespace}
          onClose={() => setSelectedResource(null)}
        />
      )}

      {selectedSecretForDescribe && (
        <ResourceDescribeViewer
          resourceType="secret"
          name={selectedSecretForDescribe.name}
          namespace={selectedSecretForDescribe.namespace}
          onClose={() => setSelectedSecretForDescribe(null)}
        />
      )}

      {selectedSecret && (
        <SecretViewer
          secret={selectedSecret}
          onClose={() => setSelectedSecret(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {secretToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2 text-foreground">Confirm Deletion</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete secret <span className="font-mono text-foreground">"{secretToDelete}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelDelete}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteSecret.isPending}
              >
                {deleteSecret.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SecretViewerProps {
  secret: SecretInfo;
  onClose: () => void;
}

function SecretViewer({ secret, onClose }: SecretViewerProps) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const addToast = useToastStore((state) => state.addToast);

  const allRevealed = Object.keys(secret.data).every(key => revealed[key]);
  const someRevealed = Object.keys(secret.data).some(key => revealed[key]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const toggleReveal = (key: string) => {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleRevealAll = () => {
    if (allRevealed) {
      // Hide all
      setRevealed({});
    } else {
      // Reveal all
      const newRevealed: Record<string, boolean> = {};
      Object.keys(secret.data).forEach(key => {
        newRevealed[key] = true;
      });
      setRevealed(newRevealed);
    }
  };

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    addToast(`Copied "${key}" to clipboard`, "success");
  };

  const maskValue = (value: string) => {
    return "•".repeat(Math.min(value.length, 32));
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-r from-background to-muted/20">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center">
              <Eye className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{secret.name}</h2>
              <p className="text-sm text-muted-foreground">
                {secret.secret_type} • {secret.keys} {secret.keys === 1 ? 'key' : 'keys'} • {secret.age}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {secret.keys > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleRevealAll}
                className="gap-2"
              >
                {allRevealed ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Hide All
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Reveal All
                  </>
                )}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="gap-2">
              <X className="w-4 h-4" />
              Close
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Warning Banner */}
          <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                Sensitive Data
              </p>
              <p className="text-xs text-yellow-800 dark:text-yellow-200/80 mt-1">
                Secret values are hidden by default. Be careful when revealing or copying values.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(secret.data).map(([key, value]) => (
              <div key={key} className="border border-border/50 rounded-xl p-5 bg-gradient-to-br from-background to-muted/10 hover:border-primary/30 transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${revealed[key] ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    {key}
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleReveal(key)}
                      className="gap-2"
                    >
                      {revealed[key] ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          Reveal
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(key, value)}
                      disabled={!revealed[key]}
                      className="gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Copy
                    </Button>
                  </div>
                </div>
                <pre className={`p-4 rounded-lg text-sm overflow-x-auto font-mono border border-border/50 transition-all ${
                  revealed[key]
                    ? 'bg-muted/50'
                    : 'bg-yellow-500/5 blur-[2px] select-none'
                }`}>
                  {revealed[key] ? value : maskValue(value)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
