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
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  FileText,
  Target,
  AlertTriangle,
  Shield,
  Zap,
  Search,
  Filter,
  ExternalLink,
} from "lucide-react";
import { findingsApi } from "@/services/api/findings";
import { format, formatDistanceToNow, isToday, isYesterday, startOfDay, isWithinInterval } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useNavigateToNode } from "@/hooks/useNavigateToNode";
import { toast } from "sonner";

interface TimelineEvent {
  finding_id?: string;
  node_id?: string;
  node_title?: string;
  content?: string;
  date: string; // User-specified date for findings
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  
  // Legacy fields for backwards compatibility
  id?: string;
  type?: "finding" | "scope_change" | "status_update" | "import";
  title?: string;
  description?: string;
  severity?: "critical" | "high" | "medium" | "low" | "info";
  status?: "exploitable" | "vulnerable" | "clean" | "testing" | "not_tested";
  nodeId?: string;
  metadata?: Record<string, any>;
}

interface TimelineDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function TimelineDrawer({ open, onOpenChange, projectId }: TimelineDrawerProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "high" | "medium" | "low" | "info">("all");
  const navigateToNode = useNavigateToNode();

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

  // Detect severity from finding content
  type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

  const detectSeverity = (content: string): SeverityLevel => {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('critical') || lowerContent.includes('exploit') || lowerContent.includes('rce')) {
      return 'critical';
    }
    if (lowerContent.includes('high') || lowerContent.includes('sql injection') || lowerContent.includes('xss')) {
      return 'high';
    }
    if (lowerContent.includes('medium') || lowerContent.includes('csrf') || lowerContent.includes('authentication')) {
      return 'medium';
    }
    if (lowerContent.includes('low') || lowerContent.includes('disclosure') || lowerContent.includes('enum')) {
      return 'low';
    }
    return 'info';
  };

  const getEventSeverity = (event: TimelineEvent): SeverityLevel | null => {
    if (event.severity) return event.severity as SeverityLevel;
    if (event.metadata?.severity) return event.metadata.severity as SeverityLevel;
    if (event.content) return detectSeverity(event.content);
    return null;
  };

  const getEventIcon = (event: TimelineEvent) => {
    // For now, all timeline events are findings, so show finding icon
    if (event.finding_id || event.type === "finding") {
      return <FileText className="h-4 w-4 text-blue-500" />;
    }
    
    // Legacy logic for other event types
    switch (event.type) {
      case "scope_change":
        return <Target className="h-4 w-4 text-blue-500" />;
      case "status_update":
        return getStatusIcon(event.status);
      case "import":
        return <Search className="h-4 w-4 text-green-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-600 fill-red-600" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "low":
        return <Shield className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "exploitable":
        return <Zap className="h-4 w-4 text-black fill-black" />;
      case "vulnerable":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "clean":
        return <Shield className="h-4 w-4 text-green-500" />;
      case "testing":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityBadge = (severity?: string) => {
    const styles = {
      critical: "bg-red-600 text-white",
      high: "bg-red-500 text-white",
      medium: "bg-orange-500 text-white",
      low: "bg-yellow-500 text-black",
      info: "bg-blue-500 text-white",
    };

    if (!severity) return null;

    return (
      <Badge className={styles[severity as keyof typeof styles] || "bg-gray-500 text-white"}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const formatEventDate = (date: string) => {
    const eventDate = new Date(date);
    const now = new Date();

    if (isToday(eventDate)) {
      return `Today at ${format(eventDate, "HH:mm")}`;
    }
    
    if (isYesterday(eventDate)) {
      return `Yesterday at ${format(eventDate, "HH:mm")}`;
    }

    return format(eventDate, "MMM d, yyyy 'at' HH:mm");
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
    
    // Date range filtering with time precision
    if (dateRange?.from && dateRange?.to) {
      // Include all times on the end date
      const endOfToDate = new Date(dateRange.to);
      endOfToDate.setHours(23, 59, 59, 999);
      
      if (!isWithinInterval(eventDate, { start: dateRange.from, end: endOfToDate })) {
        return false;
      }
    } else if (dateRange?.from) {
      // Start from beginning of fromDate
      const startOfFromDate = new Date(dateRange.from);
      startOfFromDate.setHours(0, 0, 0, 0);
      
      if (eventDate < startOfFromDate) {
        return false;
      }
    }

    // Severity filtering
    if (severityFilter !== "all") {
      const detectedSeverity = getEventSeverity(event);
      if (!detectedSeverity || detectedSeverity !== severityFilter) {
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
        <div className="flex flex-col h-full">
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
          <div className="border-b border-border/60 bg-card/40 px-5 py-4">
            <div className="space-y-4 rounded-xl border border-border/70 bg-background/70 p-4 shadow-sm">
              <div className="grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  Date Range
                </label>
                <DateRangePicker
                  onUpdate={(values) => setDateRange(values.range)}
                  align="start"
                  showCompare={false}
                  className="w-full"
                />
              </div>
              <div className="grid gap-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  Severity
                </label>
                <Select
                  value={severityFilter}
                  onValueChange={(value: any) => setSeverityFilter(value)}
                >
                  <SelectTrigger className="h-9 w-full rounded-lg border-border/70 bg-background/80 text-sm">
                    <SelectValue placeholder="Filter by severity" />
                  </SelectTrigger>
                  <SelectContent className="w-[220px]">
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        Critical
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-400" />
                        High
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-400" />
                        Medium
                      </div>
                    </SelectItem>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-yellow-400" />
                        Low
                      </div>
                    </SelectItem>
                    <SelectItem value="info">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-400" />
                        Info
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Timeline Content */}
          <ScrollArea className="flex-1 px-5 py-5">
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
                  {dateRange?.from || dateRange?.to || severityFilter !== "all"
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
                                  {/* Severity Badge */}
                                  {(() => {
                                    const severity = getEventSeverity(event);
                                    if (!severity) return null;
                                    if (severity === "info") return null;
                                    return (
                                    <Badge
                                      className={cn(
                                        "text-[10px] font-semibold tracking-[0.08em] uppercase px-2 py-0.5 leading-tight",
                                        {
                                          "border border-red-500/40 bg-red-500/10 text-red-200": severity === "critical",
                                          "border border-red-400/40 bg-red-400/10 text-red-200": severity === "high",
                                          "border border-orange-400/40 bg-orange-400/10 text-orange-200": severity === "medium",
                                          "border border-yellow-400/40 bg-yellow-400/10 text-yellow-100": severity === "low",
                                        }
                                      )}
                                    >
                                      {severity.toUpperCase()}
                                    </Badge>
                                    );
                                  })()}

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
