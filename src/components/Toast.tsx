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
  const config = {
    success: {
      icon: <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />,
      bgClass: "bg-green-50 dark:bg-green-950/90",
      borderClass: "border-green-200 dark:border-green-800",
      textClass: "text-green-900 dark:text-green-100",
    },
    error: {
      icon: <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
      bgClass: "bg-red-50 dark:bg-red-950/90",
      borderClass: "border-red-200 dark:border-red-800",
      textClass: "text-red-900 dark:text-red-100",
    },
    info: {
      icon: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      bgClass: "bg-blue-50 dark:bg-blue-950/90",
      borderClass: "border-blue-200 dark:border-blue-800",
      textClass: "text-blue-900 dark:text-blue-100",
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />,
      bgClass: "bg-yellow-50 dark:bg-yellow-950/90",
      borderClass: "border-yellow-200 dark:border-yellow-800",
      textClass: "text-yellow-900 dark:text-yellow-100",
    },
  };

  const { icon, bgClass, borderClass, textClass } = config[type];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-lg animate-in slide-in-from-right-5 duration-300 min-w-[300px] max-w-md",
        bgClass,
        borderClass
      )}
    >
      <div className="flex-shrink-0">{icon}</div>
      <p className={cn("flex-1 text-sm font-medium", textClass)}>{message}</p>
      <button
        onClick={onClose}
        className={cn("flex-shrink-0 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors", textClass)}
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
