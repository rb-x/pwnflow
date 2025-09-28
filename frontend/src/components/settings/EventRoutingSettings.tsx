import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RefreshCw, Shield } from "lucide-react";

export function EventRoutingSettings() {
  const isUnavailable = true;

  return (
    <Card className="relative overflow-hidden border border-white/10 bg-[#0f0f0f]">
      {isUnavailable ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-6 text-center backdrop-blur-sm">
          <p className="text-sm font-medium text-white">Event routing is currently disabled.</p>
        </div>
      ) : null}
      <div
        className={cn(
          "transition-opacity duration-200",
          isUnavailable && "pointer-events-none opacity-40"
        )}
      >
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-white">Event Routing</CardTitle>
              <CardDescription>
                Configure how project events are delivered to external systems.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button>
                <Shield className="mr-2 h-4 w-4" />
                Add route
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border border-dashed border-white/20 bg-black/40 p-8 text-center text-sm text-white/60">
            No routes configured yet. Create a route to deliver notifications.
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-white/80">Events</h4>
            <div className="flex flex-wrap gap-2">
              {[
                "Project Created",
                "Project Deleted",
                "Node Created",
                "Node Updated",
                "Node Deleted",
                "Finding Created",
                "Command Triggered",
              ].map((evt) => (
                <Badge key={evt} variant="secondary" className="bg-white/10 text-white/80">
                  {evt}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
