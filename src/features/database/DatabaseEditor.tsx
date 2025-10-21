import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { DbConnectionInfo, DbSchema, DbTable, DbColumn, QueryResult, CNPGConnectionDetails } from "../../types";
import { Button } from "../../components/ui/Button";
import { Database, Table as TableIcon, Play, X, RefreshCw } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { useAppStore } from "../../lib/store";

export function DatabaseEditor() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const queryClient = useQueryClient();

  // State
  const [selectedCluster, setSelectedCluster] = useState("");
  const [connectionDetails, setConnectionDetails] = useState<CNPGConnectionDetails | null>(null);
  const [activeConnection, setActiveConnection] = useState<DbConnectionInfo | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<DbTable | null>(null);
  const [sqlQuery, setSqlQuery] = useState("");
  const [queryResults, setQueryResults] = useState<QueryResult | null>(null);

  // Fetch CNPG clusters (from custom resources)
  const { data: cnpgClusters = [], isLoading: clustersLoading } = useQuery({
    queryKey: ["cnpg-clusters", currentNamespace],
    queryFn: async () => {
      return await api.getCustomResources(
        "postgresql.cnpg.io",
        "v1",
        "clusters",
        currentNamespace || undefined
      );
    },
    enabled: !!currentNamespace,
  });

  // Fetch connection details for selected cluster
  const { data: fetchedDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ["cnpg-connection", selectedCluster, currentNamespace],
    queryFn: async () => {
      if (!selectedCluster || !currentNamespace) return null;
      return await api.getCNPGClusterConnection(selectedCluster, currentNamespace);
    },
    enabled: !!selectedCluster && !!currentNamespace,
  });

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

  // Fetch columns for selected table
  const { data: columns = [] } = useQuery({
    queryKey: ["db-columns", activeConnection?.connection_id, selectedTable?.schema, selectedTable?.name],
    queryFn: async () => {
      if (!activeConnection || !selectedTable) return [];
      return await api.dbGetTableColumns(
        activeConnection.connection_id,
        selectedTable.schema,
        selectedTable.name
      );
    },
    enabled: !!activeConnection && !!selectedTable,
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
    } catch (error) {
      console.error("Failed to load table data:", error);
    }
  };

  const handleConnect = () => {
    if (fetchedDetails) {
      setConnectionDetails(fetchedDetails);
      connectMutation.mutate(fetchedDetails);
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

  if (clustersLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-700 p-4">
        <h1 className="text-xl font-semibold flex items-center gap-2 text-gray-100">
          <Database className="w-5 h-5" />
          Database Editor
        </h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-700 flex flex-col bg-gray-850">
          {/* Connection Panel */}
          <div className="p-4 border-b border-gray-700">
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              Select Cluster
            </label>
            <select
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-sm text-gray-100"
              value={selectedCluster}
              onChange={(e) => setSelectedCluster(e.target.value)}
              disabled={!!activeConnection}
            >
              <option value="">Select a cluster...</option>
              {cnpgClusters.map((cluster: any) => (
                <option key={cluster.name} value={cluster.name}>
                  {cluster.name}
                </option>
              ))}
            </select>

            {fetchedDetails && !activeConnection && (
              <Button
                onClick={handleConnect}
                className="w-full mt-3"
                disabled={connectMutation.isPending}
              >
                {connectMutation.isPending ? "Connecting..." : "Connect"}
              </Button>
            )}

            {activeConnection && (
              <div className="mt-3 space-y-2">
                <div className="text-xs text-gray-400">
                  Connected to: <br />
                  <span className="text-green-400 font-mono">
                    {activeConnection.cluster_name}/{activeConnection.database}
                  </span>
                </div>
                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  size="sm"
                  className="w-full"
                >
                  <X className="w-4 h-4 mr-1" />
                  Disconnect
                </Button>
              </div>
            )}
          </div>

          {/* Schemas & Tables */}
          {activeConnection && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Schemas</h3>
                <div className="space-y-1">
                  {schemas.map((schema) => (
                    <button
                      key={schema.name}
                      onClick={() => {
                        setSelectedSchema(schema.name);
                        setSelectedTable(null);
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${
                        selectedSchema === schema.name
                          ? "bg-blue-600 text-white"
                          : "text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      {schema.name}
                    </button>
                  ))}
                </div>
              </div>

              {selectedSchema && (
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-2">Tables</h3>
                  <div className="space-y-1">
                    {tables.map((table) => (
                      <button
                        key={`${table.schema}.${table.name}`}
                        onClick={() => {
                          setSelectedTable(table);
                          loadTableData(table);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 ${
                          selectedTable?.name === table.name
                            ? "bg-blue-600 text-white"
                            : "text-gray-300 hover:bg-gray-700"
                        }`}
                      >
                        <TableIcon className="w-4 h-4" />
                        <span className="flex-1 truncate">{table.name}</span>
                        {table.row_count !== null && (
                          <span className="text-xs opacity-70">
                            {table.row_count}
                          </span>
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
        <div className="flex-1 flex flex-col">
          {/* SQL Query Editor */}
          <div className="border-b border-gray-700 p-4">
            <div className="flex items-start gap-2">
              <textarea
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-sm font-mono text-gray-100"
                rows={4}
                placeholder="Enter SQL query..."
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                disabled={!activeConnection}
              />
              <Button
                onClick={handleExecuteQuery}
                disabled={!activeConnection || !sqlQuery.trim() || executeQueryMutation.isPending}
              >
                <Play className="w-4 h-4 mr-1" />
                Execute
              </Button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-auto p-4">
            {queryResults && (
              <div>
                <div className="mb-2 text-sm text-gray-400">
                  {queryResults.row_count} rows returned in {queryResults.execution_time_ms}ms
                </div>

                <div className="overflow-x-auto border border-gray-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800 border-b border-gray-700">
                      <tr>
                        {queryResults.columns.map((col) => (
                          <th
                            key={col.name}
                            className="px-4 py-2 text-left font-medium text-gray-300"
                          >
                            <div className="flex items-center gap-2">
                              {col.name}
                              <span className="text-xs text-gray-500">
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
                          className="border-b border-gray-700 hover:bg-gray-800"
                        >
                          {queryResults.columns.map((col) => (
                            <td key={col.name} className="px-4 py-2 text-gray-300">
                              <div className="font-mono text-xs max-w-xs truncate">
                                {row[col.name] === null
                                  ? <span className="text-gray-500 italic">NULL</span>
                                  : typeof row[col.name] === "object"
                                  ? JSON.stringify(row[col.name])
                                  : String(row[col.name])}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!queryResults && activeConnection && (
              <div className="text-center text-gray-500 mt-12">
                Select a table or execute a SQL query to see results
              </div>
            )}

            {!activeConnection && (
              <div className="text-center text-gray-500 mt-12">
                Connect to a database to get started
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
