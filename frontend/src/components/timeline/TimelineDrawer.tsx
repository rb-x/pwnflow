import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  FileText,
  ExternalLink,
} from "lucide-react";
import { findingsApi } from "@/services/api/findings";
import { format, startOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigateToNode } from "@/hooks/useNavigateToNode";
import { toast } from "sonner";

interface TimelineEvent {
  finding_id?: string;
  node_id?: string;
  node_title?: string;
  content?: string;
  date: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  // Legacy fields
  id?: string;
  title?: string;
  description?: string;
  nodeId?: string;
}

interface TimelineDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

type DatePreset = "all" | "today" | "yesterday" | "week" | "month";

export function TimelineDrawer({ open, onOpenChange, projectId }: TimelineDrawerProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const navigateToNode = useNavigateToNode();

  const hasActiveFilters = datePreset !== "all";

  const clearFilters = () => {
    setDatePreset("all");
  };

  const getDateRangeFromPreset = (preset: DatePreset): { from: Date; to: Date } | null => {
    const now = new Date();
    const today = startOfDay(now);

    switch (preset) {
      case "today":
        return { from: today, to: now };
      case "yesterday":
        const yesterday = subDays(today, 1);
        return { from: yesterday, to: today };
      case "week":
        return { from: startOfWeek(now), to: now };
      case "month":
        return { from: startOfMonth(now), to: now };
      default:
        return null;
    }
  };

  useEffect(() => {
    if (open && projectId) {
      fetchTimelineEvents();
    }
  }, [open, projectId]);

  const fetchTimelineEvents = async () => {
    setLoading(true);
    try {
      const timeline = await findingsApi.getProjectTimeline(projectId);
      setEvents(timeline || []);
    } catch (error) {
      console.error("Failed to fetch timeline:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = () => {
    return <FileText className="h-4 w-4 text-blue-500" />;
  };


  const groupEventsByDate = (events: TimelineEvent[]) => {
    const groups: Record<string, TimelineEvent[]> = {};
    
    events.forEach(event => {
      const dateKey = format(startOfDay(new Date(event.date)), "yyyy-MM-dd");
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([date, events]) => ({
        date,
        events: events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }));
  };

  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.date);

    // Date preset filtering
    const dateRange = getDateRangeFromPreset(datePreset);
    if (dateRange) {
      if (eventDate < dateRange.from || eventDate > dateRange.to) {
        return false;
      }
    }

    return true;
  });

  const eventGroups = groupEventsByDate(filteredEvents);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] max-w-[92vw] border-none p-0 bg-background/95 backdrop-blur"
      >
        <div className="flex flex-col h-full min-h-0">
          <SheetHeader className="space-y-2 border-b border-border/60 bg-card/60 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="text-left">
                <SheetTitle className="text-base font-semibold text-foreground">
                  Findings Timeline
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground/80">
                  Chronological view of findings, updates, and activities
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Filters */}
          <div className="border-b border-border/60 bg-card/40 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Date Presets */}
              <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/70 p-1">
                {[
                  { value: "all", label: "All" },
                  { value: "today", label: "Today" },
                  { value: "yesterday", label: "Yesterday" },
                  { value: "week", label: "This Week" },
                  { value: "month", label: "This Month" },
                ].map(({ value, label }) => (
                  <Button
                    key={value}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 px-2.5 text-xs",
                      datePreset === value && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    )}
                    onClick={() => setDatePreset(value as DatePreset)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {/* Results count */}
              <span className="ml-auto text-xs text-muted-foreground">
                {filteredEvents.length} {filteredEvents.length === 1 ? "finding" : "findings"}
              </span>
            </div>
          </div>

          {/* Timeline Content */}
          <ScrollArea className="flex-1 min-h-0 px-5 py-5">
            {loading ? (
              <div className="flex h-32 items-center justify-center rounded-xl border border-border/60 bg-card/40 text-sm text-muted-foreground shadow-inner">
                Loading timeline…
              </div>
            ) : eventGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/40 px-6 py-12 text-center shadow-inner">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/50 bg-background/70">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-4 text-sm font-medium text-foreground/90">
                  No timeline events yet
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {hasActiveFilters
                    ? "Try adjusting your filters"
                    : "Findings will appear here as you document them"}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 h-7 px-3 text-xs"
                  onClick={() => onOpenChange(false)}
                >
                  Create your first finding
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {eventGroups.map(({ date, events }) => (
                  <motion.div
                    key={date}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    {/* Date Header */}
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold text-foreground">
                        {format(new Date(date), "EEEE, MMMM d, yyyy")}
                      </div>
                      <div className="flex-1 h-px bg-border" />
                      <Badge variant="outline" className="text-xs">
                        {events.length} {events.length === 1 ? "event" : "events"}
                      </Badge>
                    </div>

                    {/* Events for this date */}
                    <div className="space-y-3 ml-4">
                      {events.map((event, index) => (
                        <motion.div
                          key={event.finding_id || event.id || `event-${index}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="relative group"
                        >
                          {/* Timeline connector */}
                          <div className="absolute left-0 top-0 bottom-0 w-px bg-border/70" />
                          <div className="absolute left-0 top-6 h-2 w-2 -translate-x-[3px] rounded-full border-2 border-primary/50 bg-background" />
                          
                          {/* Event content */}
                          <div className="ml-6 overflow-hidden rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm transition-colors hover:border-primary/40 hover:bg-card">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                {getEventIcon(event)}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="font-medium text-sm leading-5">
                                    {event.node_title || event.title || "Untitled Finding"}
                                  </div>
                                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                                    {format(new Date(event.date), "HH:mm")}
                                  </div>
                                </div>
                                
                                <div className="text-xs text-muted-foreground mb-2 line-clamp-3">
                                  {event.content || event.description || "No description available"}
                                </div>

                                <div className="flex items-center gap-2">
                                  {event.created_by && (
                                    <div className="text-xs text-muted-foreground">
                                      by {event.created_by}
                                    </div>
                                  )}

                                  {(event.node_id || event.nodeId) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-primary/10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const targetNodeId = event.node_id || event.nodeId;
                                        if (!targetNodeId) return;

                                        const navigated = navigateToNode(targetNodeId, {
                                          onNotFound: () =>
                                            toast.error("Node not found in current mind map"),
                                        });

                                        if (navigated) {
                                          onOpenChange(false);
                                        }
                                      }}
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      View Node
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
