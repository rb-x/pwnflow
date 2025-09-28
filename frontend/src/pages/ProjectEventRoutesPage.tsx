import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit, RefreshCw, Trash } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ProjectEventRoutesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const isUnavailable = true;

  if (!projectId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">Project not specified.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {isUnavailable ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-6 text-center backdrop-blur-sm">
          <p className="text-sm font-medium text-white">Event routing is currently disabled.</p>
        </div>
      ) : null}
      <div
        className={cn(
          "mx-auto flex max-w-3xl flex-col gap-8 py-12",
          isUnavailable && "pointer-events-none opacity-40"
        )}
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1 text-left">
            <h1 className="text-2xl font-semibold text-white">Event routing for this project</h1>
            <p className="text-sm text-white/60">
              Receive notifications when activity happens in this project.
            </p>
          </div>
        </div>

        <Card className="border border-white/10 bg-[#101010]">
          <CardHeader>
            <CardTitle className="text-white">Add Event Route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-white/70">
            <div className="space-y-2">
              <p className="font-medium text-white/80">Destination URL</p>
              <p className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/60">
                https://example.com/hooks/pwnflow
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-white/80">Signing Secret (optional)</p>
              <p className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white/60">
                ****************
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-white/80">Events</p>
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
            <Button className="w-full" disabled>
              <Edit className="mr-2 h-4 w-4" />
              Add Route
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-[#101010]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Existing routes</CardTitle>
              <Button variant="ghost" size="icon">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-white/70">
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/40 p-6 text-center">
              No routes configured yet.
            </div>
            <div className="grid gap-2 text-xs text-white/60">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                <span>https://example.com/hooks/pwnflow</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Trash className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
