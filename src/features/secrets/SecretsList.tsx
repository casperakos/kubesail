import { useState } from "react";
import { useSecrets } from "../../hooks/useKube";
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
import { RefreshCw, Eye, EyeOff } from "lucide-react";
import { SecretInfo } from "../../types";

export function SecretsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const { data: secrets, isLoading, error, refetch } = useSecrets(currentNamespace);
  const [selectedSecret, setSelectedSecret] = useState<SecretInfo | null>(null);

  const getTypeVariant = (type: string) => {
    if (type.includes("tls")) return "success";
    if (type.includes("token")) return "warning";
    return "secondary";
  };

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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Secrets</h2>
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Keys</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {secrets.map((secret) => (
            <TableRow key={secret.name}>
              <TableCell className="font-medium">{secret.name}</TableCell>
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedSecret(secret)}
                  title="View secret data"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedSecret && (
        <SecretViewer
          secret={selectedSecret}
          onClose={() => setSelectedSecret(null)}
        />
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
