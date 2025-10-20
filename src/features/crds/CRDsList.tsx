import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table";
import { Button } from "../../components/ui/Button";
import { Loader2, Search, Database, ArrowLeft, Eye, FileText, Trash2, X } from "lucide-react";
import { useAppStore } from "../../lib/store";
import { CustomResourceDescribeViewer } from "../../components/CustomResourceDescribeViewer";
import { CustomResourceYamlViewer } from "../../components/CustomResourceYamlViewer";
import { LoadingSpinner } from "../../components/LoadingSpinner";

interface CRD {
  name: string;
  group: string;
  version: string;
  kind: string;
  plural: string;
  singular: string;
  scope: string;
  age: string;
  categories: string[];
}

interface CustomResource {
  name: string;
  namespace: string | null;
  kind: string;
  api_version: string;
  age: string;
  metadata: any;
}

export function CRDsList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const [crds, setCrds] = useState<CRD[]>([]);
  const [filteredCrds, setFilteredCrds] = useState<CRD[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // For viewing custom resources
  const [selectedCRD, setSelectedCRD] = useState<CRD | null>(null);
  const [resources, setResources] = useState<CustomResource[]>([]);
  const [filteredResources, setFilteredResources] = useState<CustomResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [resourceSearchQuery, setResourceSearchQuery] = useState("");

  // For modals
  const [describeResource, setDescribeResource] = useState<CustomResource | null>(null);
  const [yamlResource, setYamlResource] = useState<CustomResource | null>(null);

  useEffect(() => {
    loadCRDs();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCrds(crds);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCrds(
        crds.filter(
          (crd) =>
            crd.name.toLowerCase().includes(query) ||
            crd.kind.toLowerCase().includes(query) ||
            crd.group.toLowerCase().includes(query) ||
            crd.plural.toLowerCase().includes(query) ||
            crd.categories.some((cat) => cat.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, crds]);

  useEffect(() => {
    if (resourceSearchQuery.trim() === "") {
      setFilteredResources(resources);
    } else {
      const query = resourceSearchQuery.toLowerCase();
      setFilteredResources(
        resources.filter(
          (resource) =>
            resource.name.toLowerCase().includes(query) ||
            (resource.namespace && resource.namespace.toLowerCase().includes(query))
        )
      );
    }
  }, [resourceSearchQuery, resources]);

  // Reload resources when namespace changes
  useEffect(() => {
    if (selectedCRD) {
      loadCustomResources(selectedCRD);
    }
  }, [currentNamespace]);

  async function loadCRDs() {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<CRD[]>("get_crds");
      setCrds(result);
      setFilteredCrds(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomResources(crd: CRD) {
    setSelectedCRD(crd);
    setResourcesLoading(true);
    setResourcesError(null);
    setResourceSearchQuery("");

    try {
      const ns =
        crd.scope === "Namespaced" && currentNamespace !== "all"
          ? currentNamespace
          : null;

      const result = await invoke<CustomResource[]>("get_custom_resources", {
        group: crd.group,
        version: crd.version,
        plural: crd.plural,
        namespace: ns,
      });
      setResources(result);
      setFilteredResources(result);
    } catch (err) {
      setResourcesError(String(err));
    } finally {
      setResourcesLoading(false);
    }
  }

  async function handleDeleteResource(resource: CustomResource) {
    if (!selectedCRD) return;

    if (!confirm(`Are you sure you want to delete ${resource.kind} "${resource.name}"?`)) {
      return;
    }

    try {
      await invoke("delete_custom_resource", {
        group: selectedCRD.group,
        version: selectedCRD.version,
        plural: selectedCRD.plural,
        name: resource.name,
        namespace: resource.namespace,
      });
      loadCustomResources(selectedCRD);
    } catch (err) {
      alert(`Failed to delete resource: ${err}`);
    }
  }

  function handleBack() {
    setSelectedCRD(null);
    setResources([]);
    setFilteredResources([]);
    setResourceSearchQuery("");
  }

  // Show custom resources view
  if (selectedCRD) {
    if (resourcesLoading) {
      return <LoadingSpinner message={`Loading ${selectedCRD.kind} resources...`} />;
    }

    if (resourcesError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-destructive">Error loading resources: {resourcesError}</p>
          <Button onClick={() => loadCustomResources(selectedCRD)}>Retry</Button>
          <Button onClick={handleBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to CRDs
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button onClick={handleBack} variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h2 className="text-2xl font-bold">{selectedCRD.kind}</h2>
              <p className="text-sm text-muted-foreground">
                {selectedCRD.group && `${selectedCRD.group}/`}{selectedCRD.version}
                {` • ${selectedCRD.scope}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search resources..."
                value={resourceSearchQuery}
                onChange={(e) => setResourceSearchQuery(e.target.value)}
                className="w-[300px] pl-10 pr-10 py-2.5 text-sm bg-background/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
              />
              {resourceSearchQuery && (
                <button
                  onClick={() => setResourceSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button onClick={() => loadCustomResources(selectedCRD)} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </div>

        {filteredResources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <FileText className="w-16 h-16 text-muted-foreground" />
            <p className="text-muted-foreground">
              {resourceSearchQuery ? "No resources found matching your search" : `No ${selectedCRD.kind} resources found`}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {selectedCRD.scope === "Namespaced" && <TableHead>Namespace</TableHead>}
                  <TableHead>Age</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResources.map((resource) => (
                  <TableRow key={`${resource.namespace || "cluster"}-${resource.name}`}>
                    <TableCell className="font-mono text-sm">{resource.name}</TableCell>
                    {selectedCRD.scope === "Namespaced" && (
                      <TableCell>{resource.namespace || "-"}</TableCell>
                    )}
                    <TableCell>{resource.age}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          onClick={() => setDescribeResource(resource)}
                          variant="ghost"
                          size="sm"
                          title="Describe"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => setYamlResource(resource)}
                          variant="ghost"
                          size="sm"
                          title="View YAML"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteResource(resource)}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 text-sm text-muted-foreground">
          Showing {filteredResources.length} of {resources.length} resources
          {selectedCRD.scope === "Namespaced" && (
            currentNamespace && currentNamespace !== "all"
              ? ` in namespace "${currentNamespace}"`
              : ` across all namespaces`
          )}
        </div>

        {/* Describe Modal */}
        {describeResource && (
          <CustomResourceDescribeViewer
            group={selectedCRD.group}
            version={selectedCRD.version}
            plural={selectedCRD.plural}
            name={describeResource.name}
            namespace={describeResource.namespace || undefined}
            onClose={() => setDescribeResource(null)}
          />
        )}

        {/* YAML Viewer Modal */}
        {yamlResource && (
          <CustomResourceYamlViewer
            group={selectedCRD.group}
            version={selectedCRD.version}
            plural={selectedCRD.plural}
            resourceName={yamlResource.name}
            namespace={yamlResource.namespace || undefined}
            onClose={() => setYamlResource(null)}
          />
        )}
      </div>
    );
  }

  // Show CRDs list
  if (loading) {
    return <LoadingSpinner message="Loading CRDs..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive">Error loading CRDs: {error}</p>
        <Button onClick={loadCRDs}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-2xl font-bold">Custom Resource Definitions</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search CRDs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[300px] pl-10 pr-10 py-2.5 text-sm bg-background/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
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
          <Button onClick={loadCRDs} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {filteredCrds.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Database className="w-16 h-16 text-muted-foreground" />
          <p className="text-muted-foreground">
            {searchQuery ? "No CRDs found matching your search" : "No Custom Resource Definitions found"}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCrds.map((crd) => (
                <TableRow key={crd.name}>
                  <TableCell className="font-mono text-sm">{crd.name}</TableCell>
                  <TableCell>{crd.group || "<none>"}</TableCell>
                  <TableCell>{crd.version}</TableCell>
                  <TableCell className="font-semibold">{crd.kind}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        crd.scope === "Namespaced"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      }`}
                    >
                      {crd.scope}
                    </span>
                  </TableCell>
                  <TableCell>{crd.age}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      onClick={() => loadCustomResources(crd)}
                      variant="ghost"
                      size="sm"
                    >
                      View Resources
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="mt-4 text-sm text-muted-foreground">
        Showing {filteredCrds.length} of {crds.length} CRDs
      </div>
    </div>
  );
}
