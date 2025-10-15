import { useState, useMemo } from "react";
import { useSecrets, useDeleteSecret } from "../../hooks/useKube";
import { useAppStore } from "../../lib/store";
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
import { RefreshCw, Eye, EyeOff, Search, X, FileText, Trash2 } from "lucide-react";
import { SecretInfo } from "../../types";
import { YamlViewer } from "../../components/YamlViewer";

export function SecretsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const { data: secrets, isLoading, error, refetch } = useSecrets(currentNamespace);
  const deleteSecret = useDeleteSecret();
  const [selectedSecret, setSelectedSecret] = useState<SecretInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<{name: string; namespace: string} | null>(null);
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
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
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
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
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
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                {searchQuery ? `No secrets found matching "${searchQuery}"` : "No secrets found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredSecrets.map((secret) => (
            <TableRow key={secret.name}>
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
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedResource({name: secret.name, namespace: secret.namespace})}
                    title="View YAML"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedSecret(secret)}
                    title="View secret data"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(secret.name)}
                    disabled={deleteSecret.isPending}
                    title="Delete secret"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            ))
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

  const toggleReveal = (key: string) => {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const maskValue = (value: string) => {
    return "•".repeat(Math.min(value.length, 20));
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-lg w-[90%] h-[80%] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-xl font-bold">{secret.name}</h2>
            <p className="text-sm text-muted-foreground">
              {secret.secret_type} • {secret.keys} keys • {secret.age}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close (ESC)
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-500 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ <strong>Warning:</strong> Secret data is sensitive. Be careful when revealing or copying values.
            </p>
          </div>

          <div className="space-y-4">
            {Object.entries(secret.data).map(([key, value]) => (
              <div key={key} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{key}</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleReveal(key)}
                    >
                      {revealed[key] ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-2" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          Reveal
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(value);
                      }}
                      disabled={!revealed[key]}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
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
