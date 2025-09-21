import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const detectSeverity = (content: string): "critical" | "high" | "medium" | "low" | "info" => {
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
    if (severityFilter !== "all" && event.content) {
      const detectedSeverity = detectSeverity(event.content);
      if (detectedSeverity !== severityFilter) {
        return false;
      }
    }
    
    return true;
  });

  const eventGroups = groupEventsByDate(filteredEvents);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <SheetTitle>Findings Timeline</SheetTitle>
            </div>
            <SheetDescription>
              Chronological view of findings and activities
            </SheetDescription>
          </SheetHeader>

          {/* Filters */}
          <div className="p-4 border-b bg-muted/20 space-y-3">
            {/* Date Range Filter */}
            <div>
              <div className="text-xs font-medium text-foreground mb-2">Date Range</div>
              <DateRangePicker
                onUpdate={(values) => setDateRange(values.range)}
                align="start"
                showCompare={false}
                className="w-full"
              />
            </div>

            {/* Severity Filter */}
            <div>
              <div className="text-xs font-medium text-foreground mb-2">Severity</div>
              <Select value={severityFilter} onValueChange={(value: any) => setSeverityFilter(value)}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Filter by severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-600"></div>
                      Critical
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      High
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      Medium
                    </div>
                  </SelectItem>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      Low
                    </div>
                  </SelectItem>
                  <SelectItem value="info">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      Info
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Timeline Content */}
          <ScrollArea className="flex-1 p-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-muted-foreground">Loading timeline...</div>
              </div>
            ) : eventGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground mb-2" />
                <div className="text-sm text-muted-foreground">No timeline events found</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {(dateRange?.from || dateRange?.to || severityFilter !== "all") ? "Try adjusting your filters" : "Start by creating findings"}
                </div>
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
                          <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
                          <div className="absolute left-0 top-6 w-2 h-2 rounded-full bg-background border-2 border-border" />
                          
                          {/* Event content */}
                          <div className="ml-6 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group-hover:bg-muted/30">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">{getEventIcon(event)}</div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="font-medium text-sm leading-5">
                                    {event.node_title || event.title || "Untitled Finding"}
                                  </div>
                                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                                    {format(new Date(event.date), "HH:mm")}
                                  </div>
                                </div>
                                
                                <div className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                  {event.content || event.description || "No description available"}
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Severity Badge */}
                                  {event.content && (
                                    <Badge className={cn(
                                      "text-xs px-2 py-0.5",
                                      {
                                        "bg-red-600 text-white": detectSeverity(event.content) === "critical",
                                        "bg-red-500 text-white": detectSeverity(event.content) === "high", 
                                        "bg-orange-500 text-white": detectSeverity(event.content) === "medium",
                                        "bg-yellow-500 text-black": detectSeverity(event.content) === "low",
                                        "bg-blue-500 text-white": detectSeverity(event.content) === "info",
                                      }
                                    )}>
                                      {detectSeverity(event.content).toUpperCase()}
                                    </Badge>
                                  )}

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
                                        // TODO: Navigate to node or open node details
                                        console.log('Navigate to node:', event.node_id || event.nodeId);
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