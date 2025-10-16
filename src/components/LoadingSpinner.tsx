interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ message = "Loading...", size = "md" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-14 h-14",
  };

  const dotSizeClasses = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  };

  return (
    <div className="flex items-center justify-center h-64 animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        {/* Modern spinning ring with gradient */}
        <div className="relative">
          {/* Background ring */}
          <div className={`${sizeClasses[size]} rounded-full border-2 border-muted/30`}></div>

          {/* Animated gradient ring */}
          <div className="absolute inset-0">
            <div
              className={`${sizeClasses[size]} rounded-full animate-spin`}
              style={{
                background: 'conic-gradient(from 0deg, transparent 0%, transparent 70%, hsl(var(--foreground) / 0.7) 100%)',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), white calc(100% - 2px))',
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), white calc(100% - 2px))',
              }}
            ></div>
          </div>

          {/* Pulsing center dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`${dotSizeClasses[size]} rounded-full bg-foreground/40 animate-pulse`}></div>
          </div>
        </div>

        {message && (
          <p className="text-sm text-muted-foreground font-medium animate-pulse">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
