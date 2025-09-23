import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ServicesTab } from "./ServicesTab";
import { Target, Server } from "lucide-react";

interface ScopeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ScopeDrawer({ open, onOpenChange, projectId }: ScopeDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full md:w-[60%] min-w-0 md:min-w-[1100px] md:max-w-[1200px] border-none p-0 bg-background/90 backdrop-blur"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border/60 bg-card/70 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Target className="h-4 w-4" />
              </div>
              <div className="text-left">
                <SheetTitle className="text-base font-semibold text-foreground">
                  Scope Management
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground/80">
                  Track assets, services, and discoveries for this project
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-hidden bg-card/40">
            <ServicesTab projectId={projectId} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
