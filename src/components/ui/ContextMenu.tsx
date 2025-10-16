import React, { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children?: React.ReactNode;
  align?: "left" | "right";
}

export function ContextMenu({ items, children, align = "right" }: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.disabled) return;
    item.onClick();
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={handleTriggerClick}
        className="p-2 hover:bg-muted rounded-lg transition-colors"
        title="More actions"
      >
        {children || (
          <svg
            className="w-4 h-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={cn(
            "absolute z-50 mt-1 min-w-[180px] rounded-xl border border-border/50 bg-background shadow-lg animate-in fade-in-0 zoom-in-95",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          <div className="py-1">
            {items.map((item, index) => {
              if (item.separator) {
                return <div key={index} className="my-1 h-px bg-border/50" />;
              }

              return (
                <button
                  key={index}
                  onClick={() => handleItemClick(item)}
                  disabled={item.disabled}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                    item.disabled
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-muted cursor-pointer",
                    item.variant === "danger"
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-foreground"
                  )}
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  <span className="flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface ContextMenuTriggerProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
}

export function ContextMenuTrigger({ items, children }: ContextMenuTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    const element = triggerRef.current;
    if (!element) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const x = e.clientX;
      const y = e.clientY;

      setPosition({ x, y });
      setIsOpen(true);
    };

    element.addEventListener("contextmenu", handleContextMenu);

    return () => {
      element.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.disabled) return;
    item.onClick();
    setIsOpen(false);
  };

  // Clone the child element and attach the ref and context menu handler
  const childElement = React.Children.only(children) as React.ReactElement;
  const clonedChild = React.cloneElement(childElement, {
    ref: triggerRef,
    style: { ...childElement.props.style, cursor: 'context-menu' }
  } as any);

  return (
    <>
      {clonedChild}

      {isOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] rounded-xl border border-border/50 bg-background shadow-lg animate-in fade-in-0 zoom-in-95"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          <div className="py-1">
            {items.map((item, index) => {
              if (item.separator) {
                return <div key={index} className="my-1 h-px bg-border/50" />;
              }

              return (
                <button
                  key={index}
                  onClick={() => handleItemClick(item)}
                  disabled={item.disabled}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                    item.disabled
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-muted cursor-pointer",
                    item.variant === "danger"
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-foreground"
                  )}
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  <span className="flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
