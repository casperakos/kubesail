import { useEffect } from "react";
import { useToastStore } from "../lib/toastStore";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "../lib/utils";

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

interface ToastProps {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
  };

  const styles = {
    success: "bg-green-500/10 border-green-500/50 text-green-500",
    error: "bg-red-500/10 border-red-500/50 text-red-500",
    info: "bg-blue-500/10 border-blue-500/50 text-blue-500",
    warning: "bg-yellow-500/10 border-yellow-500/50 text-yellow-500",
  };

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-lg animate-in slide-in-from-right-5 duration-300 min-w-[300px] max-w-md",
        styles[type]
      )}
    >
      <div className="flex-shrink-0">{icons[type]}</div>
      <p className="flex-1 text-sm font-medium text-foreground">{message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 hover:bg-background/20 rounded-lg transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
