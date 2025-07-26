import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
  Ban,
  TrendingUp,
  Target,
  Activity,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectNodes } from "@/hooks/api/useNodes";

interface ProjectProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

interface ProgressStats {
  total: number;
  notStarted: number;
  inProgress: number;
  success: number;
  failed: number;
  notApplicable: number;
  completionRate: number;
  successRate: number;
}

const statusConfig = {
  NOT_STARTED: {
    label: "Not Started",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    icon: Circle,
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
    icon: Clock,
  },
  SUCCESS: {
    label: "Completed",
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    icon: CheckCircle2,
  },
  FAILED: {
    label: "Failed",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    icon: XCircle,
  },
  NOT_APPLICABLE: {
    label: "Not Applicable",
    color: "text-muted-foreground",
    bgColor: "bg-muted/30",
    icon: Ban,
  },
};

export function ProjectProgressModal({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ProjectProgressModalProps) {
  const { data: nodesData, isLoading } = useProjectNodes(projectId);
  const [stats, setStats] = useState<ProgressStats>({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    success: 0,
    failed: 0,
    notApplicable: 0,
    completionRate: 0,
    successRate: 0,
  });

  useEffect(() => {
    if (nodesData?.nodes) {
      const nodes = nodesData.nodes;
      const newStats: ProgressStats = {
        total: nodes.length,
        notStarted: 0,
        inProgress: 0,
        success: 0,
        failed: 0,
        notApplicable: 0,
        completionRate: 0,
        successRate: 0,
      };

      nodes.forEach((node) => {
        switch (node.status) {
          case "NOT_STARTED":
            newStats.notStarted++;
            break;
          case "IN_PROGRESS":
            newStats.inProgress++;
            break;
          case "SUCCESS":
            newStats.success++;
            break;
          case "FAILED":
            newStats.failed++;
            break;
          case "NOT_APPLICABLE":
            newStats.notApplicable++;
            break;
        }
      });

      // Calculate completion rate (excluding not applicable)
      const applicableNodes = newStats.total - newStats.notApplicable;
      const completedNodes = newStats.success + newStats.failed;
      newStats.completionRate =
        applicableNodes > 0
          ? Math.round((completedNodes / applicableNodes) * 100)
          : 0;

      // Calculate success rate (success / (success + failed))
      const attemptedNodes = newStats.success + newStats.failed;
      newStats.successRate =
        attemptedNodes > 0
          ? Math.round((newStats.success / attemptedNodes) * 100)
          : 0;

      setStats(newStats);
    }
  }, [nodesData]);

  const getProgressSegments = () => {
    if (stats.total === 0) return [];

    return [
      { status: "SUCCESS", percentage: (stats.success / stats.total) * 100 },
      { status: "FAILED", percentage: (stats.failed / stats.total) * 100 },
      {
        status: "IN_PROGRESS",
        percentage: (stats.inProgress / stats.total) * 100,
      },
      {
        status: "NOT_APPLICABLE",
        percentage: (stats.notApplicable / stats.total) * 100,
      },
      {
        status: "NOT_STARTED",
        percentage: (stats.notStarted / stats.total) * 100,
      },
    ];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Progress Overview: {projectName}
          </DialogTitle>
          <DialogDescription>
            Track your testing progress and methodology coverage
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Overall Completion</span>
                <span className="text-muted-foreground">
                  {stats.completionRate}% Complete
                </span>
              </div>
              <div className="h-4 bg-secondary rounded-full overflow-hidden flex">
                {getProgressSegments().map((segment, index) => {
                  const config =
                    statusConfig[segment.status as keyof typeof statusConfig];
                  return (
                    <div
                      key={index}
                      style={{ width: `${segment.percentage}%` }}
                      className={cn(
                        "h-full transition-all duration-500",
                        config.bgColor
                      )}
                    />
                  );
                })}
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Total Nodes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-chart-3" />
                    Success Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.successRate}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-chart-1" />
                    Completion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.completionRate}%
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(statusConfig).map(([status, config]) => {
                  // Map status keys to stats object keys
                  const statusMap: Record<string, keyof ProgressStats> = {
                    NOT_STARTED: "notStarted",
                    IN_PROGRESS: "inProgress",
                    SUCCESS: "success",
                    FAILED: "failed",
                    NOT_APPLICABLE: "notApplicable",
                  };
                  const count = (stats[statusMap[status]] as number) || 0;
                  const percentage =
                    stats.total > 0
                      ? Math.round((count / stats.total) * 100)
                      : 0;
                  const Icon = config.icon;

                  return (
                    <div
                      key={status}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", config.bgColor)}>
                          <Icon className={cn("h-4 w-4", config.color)} />
                        </div>
                        <div>
                          <p className="font-medium">{config.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {count} {count === 1 ? "node" : "nodes"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={percentage} className="w-24" />
                        <Badge
                          variant="secondary"
                          className="min-w-[3rem] justify-center"
                        >
                          {percentage}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Progress Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Progress Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {stats.inProgress > 0 && (
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-chart-1" />
                      <span>
                        <strong>{stats.inProgress}</strong>{" "}
                        {stats.inProgress === 1 ? "node is" : "nodes are"}{" "}
                        currently in progress
                      </span>
                    </p>
                  )}
                  {stats.notStarted > 0 && (
                    <p className="flex items-center gap-2">
                      <Circle className="h-4 w-4 text-neutral-500" />
                      <span>
                        <strong>{stats.notStarted}</strong>{" "}
                        {stats.notStarted === 1
                          ? "node hasn't"
                          : "nodes haven't"}{" "}
                        been started yet
                      </span>
                    </p>
                  )}
                  {stats.successRate === 100 &&
                    stats.completionRate === 100 && (
                      <p className="flex items-center gap-2 text-chart-3">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>
                          <strong>Excellent!</strong> All applicable nodes
                          completed successfully
                        </span>
                      </p>
                    )}
                  {stats.failed > 0 && (
                    <p className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-4 w-4" />
                      <span>
                        <strong>{stats.failed}</strong>{" "}
                        {stats.failed === 1 ? "node" : "nodes"} failed and may
                        need attention
                      </span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
