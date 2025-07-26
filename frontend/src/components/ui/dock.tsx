import * as React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DockProps {
  className?: string;
  items?: {
    icon: LucideIcon;
    label: string;
    onClick?: () => void;
    shortcut?: string;
  }[];
  children?: React.ReactNode;
}

interface DockIconButtonProps {
  icon?: LucideIcon;
  label?: string;
  onClick?: () => void;
  shortcut?: string;
  className?: string;
  children?: React.ReactNode;
  "aria-label"?: string;
  isActive?: boolean;
}

const DockIconButton = React.forwardRef<HTMLButtonElement, DockIconButtonProps>(
  (
    {
      icon: Icon,
      label,
      onClick,
      shortcut,
      className,
      children,
      "aria-label": ariaLabel,
      isActive,
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.1, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        aria-label={ariaLabel}
        className={cn(
          "relative group p-3 rounded-lg",
          "hover:bg-muted/80 transition-colors",
          isActive && "bg-muted/60",
          className
        )}
      >
        {Icon && (
          <Icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
        {children}
        {label && (
          <span
            className={cn(
              "absolute -top-10 left-1/2 -translate-x-1/2",
              "px-3 py-2.5 rounded text-xs",
              "bg-popover text-popover-foreground border border-border",
              "opacity-0 group-hover:opacity-100",
              "transition-opacity whitespace-nowrap pointer-events-none",
              "shadow-lg"
            )}
          >
            {label}
            {shortcut && (
              <kbd className="ml-2 px-1.5 py-0.5 text-xs font-mono bg-muted/50 rounded border border-border">
                {shortcut}
              </kbd>
            )}
          </span>
        )}
      </motion.button>
    );
  }
);
DockIconButton.displayName = "DockIconButton";

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  ({ items, children, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
          className
        )}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "flex items-center gap-1 p-2 rounded-2xl",
            "backdrop-blur-xl border border-border bg-card shadow-2xl",
            "hover:shadow-2xl hover:shadow-foreground/20 transition-shadow duration-300"
          )}
        >
          {items?.map((item) => (
            <DockIconButton key={item.label} {...item} />
          ))}
          {children}
        </motion.div>
      </div>
    );
  }
);
Dock.displayName = "Dock";

export { Dock, DockIconButton as DockIcon };
