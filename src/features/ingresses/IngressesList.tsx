import { useIngresses } from "../../hooks/useKube";
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
import { RefreshCw, Shield, Globe, Search, X, Code, ChevronDown, ChevronRight, MoreVertical } from "lucide-react";
import { IngressInfo } from "../../types";
import { useState, useMemo } from "react";
import { YamlViewer } from "../../components/YamlViewer";
import { ContextMenu, ContextMenuTrigger, type ContextMenuItem } from "../../components/ui/ContextMenu";

export function IngressesList() {
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const showNamespaceColumn = !currentNamespace;
  const { data: ingresses, isLoading, error, refetch } = useIngresses(currentNamespace);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<{name: string; namespace: string} | null>(null);
  const [expandedIngresses, setExpandedIngresses] = useState<Set<string>>(new Set());

  const toggleIngressExpand = (ingressName: string) => {
    const newExpanded = new Set(expandedIngresses);
    if (newExpanded.has(ingressName)) {
      newExpanded.delete(ingressName);
    } else {
      newExpanded.add(ingressName);
    }
    setExpandedIngresses(newExpanded);
  };

  const getIngressClassVariant = (className?: string) => {
    if (!className) return "secondary";
    if (className.includes("nginx")) return "default";
    if (className.includes("istio")) return "success";
    if (className.includes("traefik")) return "warning";
    return "secondary";
  };

  // Filter ingresses based on search query
  const filteredIngresses = useMemo(() => {
    if (!ingresses) return [];
    if (!searchQuery) return ingresses;

    const query = searchQuery.toLowerCase();
    return ingresses.filter(ingress =>
      ingress.name.toLowerCase().includes(query) ||
      ingress.class?.toLowerCase().includes(query) ||
      ingress.hosts.some(host => host.toLowerCase().includes(query)) ||
      ingress.addresses.some(addr => addr.toLowerCase().includes(query))
    );
  }, [ingresses, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
            <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-purple-500 animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading ingresses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 rounded-xl border border-destructive/50 bg-gradient-to-br from-destructive/10 to-destructive/5 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-destructive mb-1">Error loading ingresses</h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!ingresses || ingresses.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 backdrop-blur-sm animate-fade-in">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <Globe className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">No ingresses found</h3>
            <p className="text-sm text-muted-foreground">
              No ingresses found in namespace "{currentNamespace}"
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with glassmorphism */}
      <div className="p-6 rounded-xl border border-border/50 bg-gradient-to-r from-background/95 to-background/80 backdrop-blur-xl shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1 h-12 bg-gradient-to-b from-slate-500 to-zinc-500 rounded-full"></div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                  Ingress Resources
                </h2>
                <Badge variant="secondary">
                  {filteredIngresses?.length || 0} {searchQuery && `of ${ingresses?.length || 0}`}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Nginx, Istio, Traefik, and other ingress controllers
              </p>
            </div>
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

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, class, host, or address..."
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
            <TableHead className="w-10"></TableHead>
            <TableHead>Name</TableHead>
            {showNamespaceColumn && <TableHead>Namespace</TableHead>}
            <TableHead>Class</TableHead>
            <TableHead>Hosts</TableHead>
            <TableHead>Addresses</TableHead>
            <TableHead>TLS</TableHead>
            <TableHead>Routes</TableHead>
            <TableHead>Age</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredIngresses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9 + (showNamespaceColumn ? 1 : 0)} className="text-center py-8 text-muted-foreground">
                {searchQuery ? `No ingresses found matching "${searchQuery}"` : "No ingresses found"}
              </TableCell>
            </TableRow>
          ) : (
            filteredIngresses.flatMap((ingress: IngressInfo) => {
              const isExpanded = expandedIngresses.has(ingress.name);
              const colSpan = showNamespaceColumn ? 10 : 9;
              const hasRules = ingress.rules && ingress.rules.length > 0;

              // Build context menu items for this ingress
              const menuItems: ContextMenuItem[] = [
                {
                  label: "View YAML",
                  icon: <Code className="w-4 h-4" />,
                  onClick: () => setSelectedResource({name: ingress.name, namespace: ingress.namespace})
                }
              ];

              return [
                // Main ingress row
                <ContextMenuTrigger key={ingress.name} items={menuItems}>
                  <TableRow>
                    <TableCell>
                      {hasRules && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleIngressExpand(ingress.name)}
                          className="h-6 w-6"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{ingress.name}</TableCell>
                    {showNamespaceColumn && <TableCell>{ingress.namespace}</TableCell>}
                    <TableCell>
                      {ingress.class ? (
                        <Badge variant={getIngressClassVariant(ingress.class)}>
                          {ingress.class}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ingress.hosts.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {ingress.hosts.map((host, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-sm">
                              <Globe className="w-3 h-3" />
                              <span className="font-mono">{host}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">*</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ingress.addresses.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {ingress.addresses.map((addr, idx) => (
                            <span key={idx} className="font-mono text-sm">
                              {addr}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Pending...</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ingress.tls ? (
                        <div className="flex items-center gap-1 text-green-500">
                          <Shield className="w-4 h-4" />
                          <span className="text-sm">Enabled</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={hasRules ? "default" : "secondary"}>
                        {hasRules ? `${ingress.rules.length} ${ingress.rules.length === 1 ? "rule" : "rules"}` : "No rules"}
                      </Badge>
                    </TableCell>
                    <TableCell>{ingress.age}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <ContextMenu items={menuItems}>
                          <MoreVertical className="w-4 h-4" />
                        </ContextMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                </ContextMenuTrigger>,
                // Expandable row for routing rules
                ...(isExpanded && hasRules
                  ? [
                      <TableRow key={`${ingress.name}-rules`} className="bg-muted/20">
                        <TableCell colSpan={colSpan}>
                          <div className="px-4 py-2">
                            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
                              Routing Rules ({ingress.rules.length})
                            </h4>
                            <div className="grid gap-3">
                              {ingress.rules.map((rule, ruleIdx) => (
                                <div
                                  key={ruleIdx}
                                  className="p-3 rounded-lg bg-background/50 border border-border/50"
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <Globe className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-mono text-sm font-medium">
                                      {rule.host}
                                    </span>
                                  </div>
                                  <div className="ml-6 space-y-2">
                                    {rule.paths.map((path, pathIdx) => (
                                      <div
                                        key={pathIdx}
                                        className="flex items-center gap-3 text-sm"
                                      >
                                        <span className="font-mono text-muted-foreground">
                                          {path.path}
                                        </span>
                                        <span className="text-muted-foreground">→</span>
                                        <Badge variant="secondary">
                                          {path.service}:{path.port}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                          {path.path_type}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>,
                    ]
                  : []),
              ];
            })
          )}
        </TableBody>
      </Table>

      {selectedResource && (
        <YamlViewer
          resourceType="ingress"
          resourceName={selectedResource.name}
          namespace={selectedResource.namespace}
          onClose={() => setSelectedResource(null)}
        />
      )}
    </div>
  );
}
