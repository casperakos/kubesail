import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => {
    return (
      <button
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none shadow-sm hover:shadow-md",
          {
            "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:from-primary/90 hover:to-primary/80":
              variant === "default",
            "bg-gradient-to-r from-destructive to-destructive/90 text-destructive-foreground hover:from-destructive/90 hover:to-destructive/80":
              variant === "destructive",
            "border border-border/50 bg-background/50 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground hover:border-primary/30":
              variant === "outline",
            "hover:bg-accent/50 hover:text-accent-foreground": variant === "ghost",
          },
          {
            "h-10 py-2 px-4": size === "default",
            "h-9 px-3 rounded-xl": size === "sm",
            "h-11 px-8 rounded-xl": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
