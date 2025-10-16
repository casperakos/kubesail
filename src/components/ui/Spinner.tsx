import { cn } from "../../lib/utils";

interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    xs: "w-3 h-3 border",
    sm: "w-4 h-4 border",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-2",
  };

  return (
    <div className="inline-flex items-center justify-center">
      <div
        className={cn(
          "rounded-full animate-spin",
          sizeClasses[size],
          className
        )}
        style={{
          background: 'conic-gradient(from 0deg, transparent 0%, transparent 70%, hsl(var(--foreground) / 0.6) 100%)',
          mask: 'radial-gradient(farthest-side, transparent calc(100% - 1.5px), white calc(100% - 1.5px))',
          WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 1.5px), white calc(100% - 1.5px))',
        }}
      />
    </div>
  );
}
