import { HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "secondary";
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-sm hover:shadow-md",
          {
            "border border-primary/20 bg-gradient-to-r from-primary/90 to-primary/80 text-primary-foreground":
              variant === "default",
            "border border-green-500/20 bg-gradient-to-r from-green-500/90 to-green-600/90 text-white": variant === "success",
            "border border-yellow-500/20 bg-gradient-to-r from-yellow-500/90 to-yellow-600/90 text-white": variant === "warning",
            "border border-destructive/20 bg-gradient-to-r from-destructive/90 to-destructive/80 text-destructive-foreground":
              variant === "destructive",
            "border border-secondary/20 bg-gradient-to-r from-secondary/90 to-secondary/80 text-secondary-foreground":
              variant === "secondary",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
