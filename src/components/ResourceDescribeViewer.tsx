import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api";
import { useAppStore } from "../store";

interface ResourceDescribeViewerProps {
  resourceType: string;
  namespace?: string;
  name: string;
  onClose: () => void;
}

export function ResourceDescribeViewer({
  resourceType,
  namespace,
  name,
  onClose,
}: ResourceDescribeViewerProps) {
  const theme = useAppStore((state) => state.theme);
  const [description, setDescription] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDescription = async () => {
      setLoading(true);
      setError(null);
      try {
        const desc = await api.describeResource(resourceType, namespace, name);
        setDescription(desc);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch resource description"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDescription();

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [resourceType, namespace, name, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className={`w-full max-w-5xl max-h-[90vh] rounded-lg shadow-xl flex flex-col ${
          theme === "dark" ? "bg-gray-800" : "bg-white"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 border-b ${
            theme === "dark" ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <h2
            className={`text-xl font-semibold ${
              theme === "dark" ? "text-white" : "text-gray-900"
            }`}
          >
            Describe: {name}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-opacity-10 ${
              theme === "dark"
                ? "hover:bg-white text-gray-400 hover:text-white"
                : "hover:bg-black text-gray-600 hover:text-gray-900"
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div
              className={`text-center py-8 ${
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Loading description...
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {!loading && !error && (
            <pre
              className={`text-sm font-mono whitespace-pre-wrap break-words ${
                theme === "dark" ? "text-gray-300" : "text-gray-800"
              }`}
            >
              {description}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div
          className={`p-4 border-t ${
            theme === "dark" ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg ${
              theme === "dark"
                ? "bg-gray-700 text-white hover:bg-gray-600"
                : "bg-gray-200 text-gray-900 hover:bg-gray-300"
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
