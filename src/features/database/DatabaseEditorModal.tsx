import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { DbConnectionInfo, DbSchema, DbTable, QueryResult, CNPGConnectionDetails } from "../../types";
import { Button } from "../../components/ui/Button";
import { Database, Table as TableIcon, Play, X, Loader2, FileText, CheckCircle2, Copy, Download } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { Badge } from "../../components/ui/Badge";

interface DatabaseEditorModalProps {
  clusterName: string;
  namespace: string;
  onClose: () => void;
}

export function DatabaseEditorModal({
  clusterName,
  namespace,
  onClose,
}: DatabaseEditorModalProps) {
  const queryClient = useQueryClient();

  // State
  const [connectionDetails, setConnectionDetails] = useState<CNPGConnectionDetails | null>(null);
  const [activeConnection, setActiveConnection] = useState<DbConnectionInfo | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<DbTable | null>(null);
  const [sqlQuery, setSqlQuery] = useState("");
  const [queryResults, setQueryResults] = useState<QueryResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch connection details for selected cluster
  const { data: fetchedDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["cnpg-connection", clusterName, namespace],
    queryFn: async () => {
      return await api.getCNPGClusterConnection(clusterName, namespace);
    },
    enabled: !!clusterName && !!namespace,
  });

  // Auto-connect when details are fetched
  useEffect(() => {
    if (fetchedDetails && !activeConnection && !connectionDetails) {
      setConnectionDetails(fetchedDetails);
      connectMutation.mutate(fetchedDetails);
    }
  }, [fetchedDetails]);

  // Fetch schemas
  const { data: schemas = [] } = useQuery({
    queryKey: ["db-schemas", activeConnection?.connection_id],
    queryFn: async () => {
      if (!activeConnection) return [];
      return await api.dbListSchemas(activeConnection.connection_id);
    },
    enabled: !!activeConnection,
  });

  // Fetch tables for selected schema
  const { data: tables = [] } = useQuery({
    queryKey: ["db-tables", activeConnection?.connection_id, selectedSchema],
    queryFn: async () => {
      if (!activeConnection || !selectedSchema) return [];
      return await api.dbListTables(activeConnection.connection_id, selectedSchema);
    },
    enabled: !!activeConnection && !!selectedSchema,
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async (details: CNPGConnectionDetails) => {
      return await api.dbConnect(
        details.cluster_name,
        details.namespace,
        details.database,
        details.username,
        details.password
      );
    },
    onSuccess: (data) => {
      setActiveConnection(data);
      queryClient.invalidateQueries({ queryKey: ["db-schemas"] });
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return await api.dbDisconnect(connectionId);
    },
    onSuccess: () => {
      setActiveConnection(null);
      setSelectedSchema(null);
      setSelectedTable(null);
      setQueryResults(null);
      onClose();
    },
  });

  // Execute query mutation
  const executeQueryMutation = useMutation({
    mutationFn: async (query: string) => {
      if (!activeConnection) throw new Error("No active connection");
      return await api.dbExecuteQuery({
        connection_id: activeConnection.connection_id,
        query,
      });
    },
    onSuccess: (data) => {
      setQueryResults(data);
    },
  });

  // Load table data
  const loadTableData = async (table: DbTable) => {
    if (!activeConnection) return;

    try {
      const result = await api.dbGetTableData({
        connection_id: activeConnection.connection_id,
        schema: table.schema,
        table: table.name,
        limit: 100,
        offset: 0,
      });
      setQueryResults(result);
      setSqlQuery(`SELECT * FROM ${table.schema}.${table.name} LIMIT 100;`);
    } catch (error) {
      console.error("Failed to load table data:", error);
    }
  };

  const handleDisconnect = () => {
    if (activeConnection) {
      disconnectMutation.mutate(activeConnection.connection_id);
    }
  };

  const handleExecuteQuery = () => {
    if (sqlQuery.trim()) {
      executeQueryMutation.mutate(sqlQuery);
    }
  };

  const copyQueryResults = () => {
    if (!queryResults) return;

    const tsv = [
      queryResults.columns.map(c => c.name).join('\t'),
      ...queryResults.rows.map(row =>
        queryResults.columns.map(col => row[col.name] ?? 'NULL').join('\t')
      )
    ].join('\n');

    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQueryResults = () => {
    if (!queryResults) return;

    const csv = [
      queryResults.columns.map(c => c.name).join(','),
      ...queryResults.rows.map(row =>
        queryResults.columns.map(col => {
          const val = row[col.name];
          if (val === null) return 'NULL';
          if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
          return val;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Cleanup connection on unmount
  useEffect(() => {
    return () => {
      if (activeConnection) {
        api.dbDisconnect(activeConnection.connection_id).catch(console.error);
      }
    };
  }, [activeConnection]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col border border-border/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50 bg-gradient-to-r from-primary/5 via-background to-background">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <Database className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Database Editor
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground">
                  {clusterName}
                </p>
                <span className="text-muted-foreground/50">•</span>
                <Badge variant="outline" className="text-xs">
                  {namespace}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeConnection && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-500">Connected</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-accent/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {detailsLoading || connectMutation.isPending ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Connecting to database...</p>
            </div>
          ) : (
            <>
              {/* Sidebar */}
              <div className="w-72 flex-shrink-0 border-r border-border/50 flex flex-col bg-card/30 overflow-hidden">
                {/* Connection Info */}
                {activeConnection && (
                  <div className="p-4 border-b border-border/50 bg-card/50">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Database className="w-3.5 h-3.5" />
                        <span className="font-mono">{activeConnection.database}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Port: {activeConnection.local_port}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Schemas & Tables */}
                {activeConnection && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                          Schemas
                        </h3>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {schemas.length}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {schemas.map((schema) => (
                          <button
                            key={schema.name}
                            onClick={() => {
                              setSelectedSchema(schema.name);
                              setSelectedTable(null);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                              selectedSchema === schema.name
                                ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 opacity-60" />
                              <span className="flex-1 truncate">{schema.name}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedSchema && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                            Tables
                          </h3>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {tables.length}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {tables.map((table) => (
                            <button
                              key={`${table.schema}.${table.name}`}
                              onClick={() => {
                                setSelectedTable(table);
                                loadTableData(table);
                              }}
                              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200 ${
                                selectedTable?.name === table.name
                                  ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground border border-transparent"
                              }`}
                            >
                              <TableIcon className="w-4 h-4 flex-shrink-0 opacity-60" />
                              <span className="flex-1 truncate">{table.name}</span>
                              {table.row_count !== null && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  {table.row_count.toLocaleString()}
                                </Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Main Content */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* SQL Query Editor */}
                <div className="border-b border-border/50 p-4 bg-card/30 flex-shrink-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                        SQL Query
                      </label>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleExecuteQuery}
                          disabled={!activeConnection || !sqlQuery.trim() || executeQueryMutation.isPending}
                          size="sm"
                          className="gap-2"
                        >
                          {executeQueryMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          Execute
                        </Button>
                      </div>
                    </div>
                    <textarea
                      className="w-full px-4 py-3 bg-background border border-border/50 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none"
                      rows={5}
                      placeholder="SELECT * FROM schema.table WHERE ..."
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      disabled={!activeConnection}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                          e.preventDefault();
                          handleExecuteQuery();
                        }
                      }}
                    />
                    {activeConnection && (
                      <p className="text-xs text-muted-foreground">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">⌘</kbd>+
                        <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd> to execute
                      </p>
                    )}
                  </div>
                </div>

                {/* Results */}
                <div className="flex-1 flex flex-col p-4 bg-card/10 overflow-hidden">
                  {queryResults && (
                    <div className="flex flex-col h-full space-y-4">
                      <div className="flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs">
                            {queryResults.row_count.toLocaleString()} {queryResults.row_count === 1 ? 'row' : 'rows'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            in {queryResults.execution_time_ms}ms
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={copyQueryResults}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            {copied ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={downloadQueryResults}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            <Download className="w-3.5 h-3.5" />
                            CSV
                          </Button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-auto border border-border/50 rounded-lg custom-scrollbar">
                        <div className="inline-block min-w-full">
                          <table className="text-sm w-full">
                            <thead className="bg-card/80 border-b border-border/50 sticky top-0">
                              <tr>
                                {queryResults.columns.map((col) => (
                                  <th
                                    key={col.name}
                                    className="px-4 py-3 text-left font-semibold text-foreground/90 whitespace-nowrap"
                                  >
                                  <div className="flex flex-col gap-1">
                                    <span>{col.name}</span>
                                    <span className="text-[10px] font-normal text-muted-foreground uppercase">
                                      {col.data_type}
                                    </span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {queryResults.rows.map((row, idx) => (
                              <tr
                                key={idx}
                                className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                              >
                                {queryResults.columns.map((col) => (
                                  <td key={col.name} className="px-4 py-3 text-foreground/80 whitespace-nowrap">
                                    <div className="font-mono text-xs" title={String(row[col.name] ?? 'NULL')}>
                                      {row[col.name] === null ? (
                                        <span className="text-muted-foreground/60 italic font-sans">NULL</span>
                                      ) : typeof row[col.name] === "object" ? (
                                        <span className="text-blue-500">{JSON.stringify(row[col.name])}</span>
                                      ) : typeof row[col.name] === "boolean" ? (
                                        <span className={row[col.name] ? "text-green-500" : "text-red-500"}>
                                          {String(row[col.name])}
                                        </span>
                                      ) : typeof row[col.name] === "number" ? (
                                        <span className="text-purple-500">{String(row[col.name])}</span>
                                      ) : (
                                        String(row[col.name])
                                      )}
                                    </div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {!queryResults && activeConnection && (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                      <div className="p-4 rounded-full bg-primary/10">
                        <Database className="w-8 h-8 text-primary/60" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">
                          Ready to Query
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          Select a table from the sidebar or write a SQL query to get started
                        </p>
                      </div>
                    </div>
                  )}

                  {!activeConnection && (
                    <div className="flex flex-col items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-muted-foreground mt-4">Connecting to database...</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
