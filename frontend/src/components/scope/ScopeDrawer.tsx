import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
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
      <SheetContent className="w-full md:w-[60%] min-w-0 md:min-w-[1100px] md:max-w-[1200px] p-0 bg-background" side="right">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Scope Management</h2>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ServicesTab projectId={projectId} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}