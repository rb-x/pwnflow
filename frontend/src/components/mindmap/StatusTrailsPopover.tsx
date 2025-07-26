import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CircleDashed,
  PlayCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  GitBranch,
} from "lucide-react";

interface StatusTrailsPopoverProps {
  children: React.ReactNode;
  onStatusSelect: (status: string | null) => void;
  activeStatus: string | null;
}

const statusOptions = [
  {
    value: "NOT_STARTED",
    label: "Not Started",
    icon: CircleDashed,
    color: "text-blue-500",
  },
  {
    value: "IN_PROGRESS",
    label: "In Progress",
    icon: PlayCircle,
    color: "text-yellow-500",
  },
  {
    value: "SUCCESS",
    label: "Success",
    icon: CheckCircle2,
    color: "text-green-500",
  },
  {
    value: "FAILED",
    label: "Failed",
    icon: XCircle,
    color: "text-red-500",
  },
  {
    value: "NOT_APPLICABLE",
    label: "Not Applicable",
    icon: HelpCircle,
    color: "text-muted-foreground",
  },
];

export function StatusTrailsPopover({
  children,
  onStatusSelect,
  activeStatus,
}: StatusTrailsPopoverProps) {
  const [open, setOpen] = useState(false);

  const handleStatusClick = (status: string) => {
    if (activeStatus === status) {
      // Toggle off if clicking the same status
      onStatusSelect(null);
    } else {
      onStatusSelect(status);
    }
  };

  const handleClearAll = () => {
    onStatusSelect(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3 mr-2 bg-background/95 backdrop-blur-sm shadow-xl"
        side="top"
        align="center"
        sideOffset={15}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Status Trails
            </h4>
            {activeStatus && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                onMouseEnter={handleClearAll}
                className="h-6 px-2 text-xs"
              >
                Clear
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            Highlight all paths to nodes with selected status
          </p>

          <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
            Press{" "}
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded border">
              ESC
            </kbd>{" "}
            to clear
          </p>

          <div className="space-y-1">
            {statusOptions.map((status) => {
              const Icon = status.icon;
              const isActive = activeStatus === status.value;

              return (
                <button
                  key={status.value}
                  onClick={() => handleStatusClick(status.value)}
                  onMouseEnter={() => onStatusSelect(status.value)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                    isActive ? "bg-accent font-medium" : "hover:bg-accent"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${status.color}`} />
                  {status.label}
                  {isActive && (
                    <Badge
                      variant="secondary"
                      className="ml-auto text-xs px-1.5 py-0"
                    >
                      Active
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
