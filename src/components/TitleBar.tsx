import { useState, useEffect, useMemo, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { cn } from "../lib/utils";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  // Memoize the window reference to prevent re-creation
  const appWindow = useMemo(() => getCurrentWindow(), []);

  useEffect(() => {
    let mounted = true;

    // Check initial maximized state
    const checkMaximized = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        if (mounted) {
          setIsMaximized(maximized);
        }
      } catch (error) {
        console.error("Failed to check maximize state:", error);
      }
    };

    checkMaximized();

    // No need for resize listener - we update on button click
    return () => {
      mounted = false;
    };
  }, [appWindow]);

  const handleMinimize = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await appWindow.minimize();
    } catch (error) {
      console.error("Failed to minimize:", error);
    }
  }, [appWindow]);

  const handleMaximize = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (isMaximized) {
        await appWindow.unmaximize();
        setIsMaximized(false);
      } else {
        await appWindow.maximize();
        setIsMaximized(true);
      }
    } catch (error) {
      console.error("Failed to maximize/unmaximize:", error);
    }
  }, [appWindow, isMaximized]);

  const handleClose = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await appWindow.close();
    } catch (error) {
      console.error("Failed to close:", error);
    }
  }, [appWindow]);

  return (
    <div
      data-tauri-drag-region
      className="h-8 bg-background flex items-center justify-between px-3 select-none"
    >
      {/* Left side - Drag region */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 flex-1"
      >
      </div>

      {/* Right side - Window controls */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleMinimize}
          className={cn(
            "h-7 w-7 rounded-md flex items-center justify-center",
            "hover:bg-accent transition-colors cursor-pointer",
            "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Minimize"
          tabIndex={0}
        >
          <Minus className="w-4 h-4 pointer-events-none" />
        </button>

        <button
          type="button"
          onClick={handleMaximize}
          className={cn(
            "h-7 w-7 rounded-md flex items-center justify-center",
            "hover:bg-accent transition-colors cursor-pointer",
            "text-muted-foreground hover:text-foreground"
          )}
          aria-label={isMaximized ? "Restore" : "Maximize"}
          tabIndex={0}
        >
          {isMaximized ? (
            <Square className="w-3.5 h-3.5 pointer-events-none" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5 pointer-events-none" />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className={cn(
            "h-7 w-7 rounded-md flex items-center justify-center",
            "hover:bg-destructive hover:text-destructive-foreground transition-colors cursor-pointer",
            "text-muted-foreground"
          )}
          aria-label="Close"
          tabIndex={0}
        >
          <X className="w-4 h-4 pointer-events-none" />
        </button>
      </div>
    </div>
  );
}
