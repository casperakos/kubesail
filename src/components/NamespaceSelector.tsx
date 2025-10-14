import { useNamespaces } from "../hooks/useKube";
import { useAppStore } from "../lib/store";

export function NamespaceSelector() {
  const { data: namespaces, isLoading } = useNamespaces();
  const currentNamespace = useAppStore((state) => state.currentNamespace);
  const setCurrentNamespace = useAppStore((state) => state.setCurrentNamespace);

  if (isLoading) {
    return (
      <select className="w-48 h-9 px-3 rounded-md border border-input bg-background text-sm">
        <option>Loading...</option>
      </select>
    );
  }

  return (
    <select
      value={currentNamespace}
      onChange={(e) => setCurrentNamespace(e.target.value)}
      className="w-48 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
    >
      {namespaces?.map((ns) => (
        <option key={ns.name} value={ns.name}>
          {ns.name}
        </option>
      ))}
    </select>
  );
}
