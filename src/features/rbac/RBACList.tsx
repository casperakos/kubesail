import { useState, useMemo } from "react";
import {
  useRoles,
  useRoleBindings,
  useClusterRoles,
  useClusterRoleBindings,
  useServiceAccounts,
} from "../../hooks/useKube";
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
import { RefreshCw, Search, X, Code, FileText } from "lucide-react";
import { YamlViewer } from "../../components/YamlViewer";
import { ResourceDescribeViewer } from "../../components/ResourceDescribeViewer";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import type {
  RoleInfo,
  RoleBindingInfo,
  ClusterRoleInfo,
  ClusterRoleBindingInfo,
  ServiceAccountInfo,
  SubjectInfo,
} from "../../types";

type RBACType = "roles" | "rolebindings" | "clusterroles" | "clusterrolebindings" | "serviceaccounts";

export function RBACList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const [activeTab, setActiveTab] = useState<RBACType>("roles");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<{name: string; namespace?: string} | null>(null);
  const [selectedResourceForDescribe, setSelectedResourceForDescribe] = useState<{name: string; namespace?: string} | null>(null);

  const { data: roles, isLoading: rolesLoading, error: rolesError, refetch: rolesRefetch } =
    useRoles(currentNamespace);
  const { data: roleBindings, isLoading: roleBindingsLoading, error: roleBindingsError, refetch: roleBindingsRefetch } =
    useRoleBindings(currentNamespace);
  const { data: clusterRoles, isLoading: clusterRolesLoading, error: clusterRolesError, refetch: clusterRolesRefetch } =
    useClusterRoles();
  const { data: clusterRoleBindings, isLoading: clusterRoleBindingsLoading, error: clusterRoleBindingsError, refetch: clusterRoleBindingsRefetch } =
    useClusterRoleBindings();
  const { data: serviceAccounts, isLoading: serviceAccountsLoading, error: serviceAccountsError, refetch: serviceAccountsRefetch } =
    useServiceAccounts(currentNamespace);

  // Filter roles based on search query
  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    if (!searchQuery) return roles;
    const query = searchQuery.toLowerCase();
    return roles.filter(role =>
      role.name.toLowerCase().includes(query) ||
      role.namespace.toLowerCase().includes(query)
    );
  }, [roles, searchQuery]);

  // Filter role bindings based on search query
  const filteredRoleBindings = useMemo(() => {
    if (!roleBindings) return [];
    if (!searchQuery) return roleBindings;
    const query = searchQuery.toLowerCase();
    return roleBindings.filter(rb =>
      rb.name.toLowerCase().includes(query) ||
      rb.role.toLowerCase().includes(query) ||
      rb.subjects.some(s => s.name.toLowerCase().includes(query))
    );
  }, [roleBindings, searchQuery]);

  // Filter cluster roles based on search query
  const filteredClusterRoles = useMemo(() => {
    if (!clusterRoles) return [];
    if (!searchQuery) return clusterRoles;
    const query = searchQuery.toLowerCase();
    return clusterRoles.filter(cr =>
      cr.name.toLowerCase().includes(query)
    );
  }, [clusterRoles, searchQuery]);

  // Filter cluster role bindings based on search query
  const filteredClusterRoleBindings = useMemo(() => {
    if (!clusterRoleBindings) return [];
    if (!searchQuery) return clusterRoleBindings;
    const query = searchQuery.toLowerCase();
    return clusterRoleBindings.filter(crb =>
      crb.name.toLowerCase().includes(query) ||
      crb.role.toLowerCase().includes(query) ||
      crb.subjects.some(s => s.name.toLowerCase().includes(query))
    );
  }, [clusterRoleBindings, searchQuery]);

  // Filter service accounts based on search query
  const filteredServiceAccounts = useMemo(() => {
    if (!serviceAccounts) return [];
    if (!searchQuery) return serviceAccounts;
    const query = searchQuery.toLowerCase();
    return serviceAccounts.filter(sa =>
      sa.name.toLowerCase().includes(query) ||
      sa.namespace.toLowerCase().includes(query)
    );
  }, [serviceAccounts, searchQuery]);

  const tabs: { value: RBACType; label: string; count: number; filteredCount: number }[] = [
    { value: "roles", label: "Roles", count: roles?.length || 0, filteredCount: filteredRoles?.length || 0 },
    { value: "rolebindings", label: "RoleBindings", count: roleBindings?.length || 0, filteredCount: filteredRoleBindings?.length || 0 },
    { value: "clusterroles", label: "ClusterRoles", count: clusterRoles?.length || 0, filteredCount: filteredClusterRoles?.length || 0 },
    { value: "clusterrolebindings", label: "ClusterRoleBindings", count: clusterRoleBindings?.length || 0, filteredCount: filteredClusterRoleBindings?.length || 0 },
    { value: "serviceaccounts", label: "ServiceAccounts", count: serviceAccounts?.length || 0, filteredCount: filteredServiceAccounts?.length || 0 },
  ];

  const handleRefresh = () => {
    switch (activeTab) {
      case "roles":
        rolesRefetch();
        break;
      case "rolebindings":
        roleBindingsRefetch();
        break;
      case "clusterroles":
        clusterRolesRefetch();
        break;
      case "clusterrolebindings":
        clusterRoleBindingsRefetch();
        break;
      case "serviceaccounts":
        serviceAccountsRefetch();
        break;
    }
  };

  const isLoading = rolesLoading || roleBindingsLoading || clusterRolesLoading ||
                    clusterRoleBindingsLoading || serviceAccountsLoading;

  const getResourceType = () => {
    switch (activeTab) {
      case "roles":
        return "role";
      case "rolebindings":
        return "rolebinding";
      case "clusterroles":
        return "clusterrole";
      case "clusterrolebindings":
        return "clusterrolebinding";
      case "serviceaccounts":
        return "serviceaccount";
    }
  };

  const isClusterScoped = activeTab === "clusterroles" || activeTab === "clusterrolebindings";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-slate-500 to-zinc-500 rounded-full"></div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              RBAC
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="flex space-x-1 border-b border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.value
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <Badge variant="secondary" className="ml-2">
                {searchQuery ? `${tab.filteredCount} of ${tab.count}` : tab.count}
              </Badge>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, role, or subject..."
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

      {activeTab === "roles" && (
        <RolesTable
          data={filteredRoles}
          isLoading={rolesLoading}
          error={rolesError}
          searchQuery={searchQuery}
          onViewYaml={setSelectedResource}
          onDescribe={setSelectedResourceForDescribe}
        />
      )}
      {activeTab === "rolebindings" && (
        <RoleBindingsTable
          data={filteredRoleBindings}
          isLoading={roleBindingsLoading}
          error={roleBindingsError}
          searchQuery={searchQuery}
          onViewYaml={setSelectedResource}
          onDescribe={setSelectedResourceForDescribe}
        />
      )}
      {activeTab === "clusterroles" && (
        <ClusterRolesTable
          data={filteredClusterRoles}
          isLoading={clusterRolesLoading}
          error={clusterRolesError}
          searchQuery={searchQuery}
          onViewYaml={setSelectedResource}
          onDescribe={setSelectedResourceForDescribe}
        />
      )}
      {activeTab === "clusterrolebindings" && (
        <ClusterRoleBindingsTable
          data={filteredClusterRoleBindings}
          isLoading={clusterRoleBindingsLoading}
          error={clusterRoleBindingsError}
          searchQuery={searchQuery}
          onViewYaml={setSelectedResource}
          onDescribe={setSelectedResourceForDescribe}
        />
      )}
      {activeTab === "serviceaccounts" && (
        <ServiceAccountsTable
          data={filteredServiceAccounts}
          isLoading={serviceAccountsLoading}
          error={serviceAccountsError}
          searchQuery={searchQuery}
          onViewYaml={setSelectedResource}
          onDescribe={setSelectedResourceForDescribe}
        />
      )}

      {selectedResource && (
        <YamlViewer
          resourceType={getResourceType()}
          resourceName={selectedResource.name}
          namespace={selectedResource.namespace}
          onClose={() => setSelectedResource(null)}
        />
      )}

      {selectedResourceForDescribe && (
        <ResourceDescribeViewer
          resourceType={getResourceType()}
          name={selectedResourceForDescribe.name}
          namespace={selectedResourceForDescribe.namespace}
          onClose={() => setSelectedResourceForDescribe(null)}
        />
      )}
    </div>
  );
}

function RolesTable({ data, isLoading, error, searchQuery, onViewYaml, onDescribe }: { data: RoleInfo[]; isLoading: boolean; error: any; searchQuery: string; onViewYaml: (name: string) => void; onDescribe: (name: string) => void }) {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;

  if (isLoading) {
    return <LoadingSpinner message="Loading roles..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading roles: {error.message}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          {showNamespaceColumn && <TableHead>Namespace</TableHead>}
          <TableHead>Rules</TableHead>
          <TableHead>Age</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!data || data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? `No roles found matching "${searchQuery}"`
                : `No roles found in namespace "${currentNamespace}"`}
            </TableCell>
          </TableRow>
        ) : (
          data.map((role) => (
            <TableRow key={`${role.namespace}-${role.name}`}>
              <TableCell className="font-medium">{role.name}</TableCell>
              {showNamespaceColumn && <TableCell>{role.namespace}</TableCell>}
              <TableCell>
                <Badge variant="secondary">{role.rules_count}</Badge>
              </TableCell>
              <TableCell>{role.age}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewYaml({name: role.name, namespace: role.namespace})}
                    title="View YAML"
                  >
                    <Code className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDescribe({name: role.name, namespace: role.namespace})}
                    title="Describe"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function RoleBindingsTable({ data, isLoading, error, searchQuery, onViewYaml, onDescribe }: { data: RoleBindingInfo[]; isLoading: boolean; error: any; searchQuery: string; onViewYaml: (name: string) => void; onDescribe: (name: string) => void }) {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;

  if (isLoading) {
    return <LoadingSpinner message="Loading role bindings..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading role bindings: {error.message}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          {showNamespaceColumn && <TableHead>Namespace</TableHead>}
          <TableHead>Role</TableHead>
          <TableHead>Subjects</TableHead>
          <TableHead>Age</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!data || data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? `No role bindings found matching "${searchQuery}"`
                : `No role bindings found in namespace "${currentNamespace}"`}
            </TableCell>
          </TableRow>
        ) : (
          data.map((rb) => (
            <TableRow key={`${rb.namespace}-${rb.name}`}>
              <TableCell className="font-medium">{rb.name}</TableCell>
              {showNamespaceColumn && <TableCell>{rb.namespace}</TableCell>}
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{rb.role_kind}</Badge>
                  <span className="text-sm">{rb.role}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {rb.subjects.map((subject: SubjectInfo, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {subject.kind}: {subject.name}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{rb.age}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewYaml({name: rb.name, namespace: rb.namespace})}
                    title="View YAML"
                  >
                    <Code className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDescribe({name: rb.name, namespace: rb.namespace})}
                    title="Describe"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function ClusterRolesTable({ data, isLoading, error, searchQuery, onViewYaml, onDescribe }: { data: ClusterRoleInfo[]; isLoading: boolean; error: any; searchQuery: string; onViewYaml: (name: string) => void; onDescribe: (name: string) => void }) {
  if (isLoading) {
    return <LoadingSpinner message="Loading cluster roles..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading cluster roles: {error.message}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Rules</TableHead>
          <TableHead>Age</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!data || data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
              {searchQuery ? `No cluster roles found matching "${searchQuery}"` : "No cluster roles found"}
            </TableCell>
          </TableRow>
        ) : (
          data.map((cr) => (
            <TableRow key={cr.name}>
              <TableCell className="font-medium">{cr.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{cr.rules_count}</Badge>
              </TableCell>
              <TableCell>{cr.age}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewYaml({name: cr.name})}
                    title="View YAML"
                  >
                    <Code className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDescribe({name: cr.name})}
                    title="Describe"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function ClusterRoleBindingsTable({ data, isLoading, error, searchQuery, onViewYaml, onDescribe }: { data: ClusterRoleBindingInfo[]; isLoading: boolean; error: any; searchQuery: string; onViewYaml: (name: string) => void; onDescribe: (name: string) => void }) {
  if (isLoading) {
    return <LoadingSpinner message="Loading cluster role bindings..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading cluster role bindings: {error.message}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Subjects</TableHead>
          <TableHead>Age</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!data || data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
              {searchQuery ? `No cluster role bindings found matching "${searchQuery}"` : "No cluster role bindings found"}
            </TableCell>
          </TableRow>
        ) : (
          data.map((crb) => (
            <TableRow key={crb.name}>
              <TableCell className="font-medium">{crb.name}</TableCell>
              <TableCell>
                <span className="text-sm">{crb.role}</span>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {crb.subjects.map((subject: SubjectInfo, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {subject.kind}: {subject.name}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{crb.age}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewYaml({name: crb.name})}
                    title="View YAML"
                  >
                    <Code className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDescribe({name: crb.name})}
                    title="Describe"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function ServiceAccountsTable({ data, isLoading, error, searchQuery, onViewYaml, onDescribe }: { data: ServiceAccountInfo[]; isLoading: boolean; error: any; searchQuery: string; onViewYaml: (name: string) => void; onDescribe: (name: string) => void }) {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;

  if (isLoading) {
    return <LoadingSpinner message="Loading service accounts..." />;
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        Error loading service accounts: {error.message}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          {showNamespaceColumn && <TableHead>Namespace</TableHead>}
          <TableHead>Secrets</TableHead>
          <TableHead>Age</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!data || data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? `No service accounts found matching "${searchQuery}"`
                : `No service accounts found in namespace "${currentNamespace}"`}
            </TableCell>
          </TableRow>
        ) : (
          data.map((sa) => (
            <TableRow key={`${sa.namespace}-${sa.name}`}>
              <TableCell className="font-medium">{sa.name}</TableCell>
              {showNamespaceColumn && <TableCell>{sa.namespace}</TableCell>}
              <TableCell>
                <Badge variant="secondary">{sa.secrets}</Badge>
              </TableCell>
              <TableCell>{sa.age}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewYaml({name: sa.name, namespace: sa.namespace})}
                    title="View YAML"
                  >
                    <Code className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDescribe({name: sa.name, namespace: sa.namespace})}
                    title="Describe"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
