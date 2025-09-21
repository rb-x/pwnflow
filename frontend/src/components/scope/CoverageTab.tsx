import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Target, 
  Server, 
  Globe, 
  CheckCircle, 
  Clock, 
  Circle,
  Users,
  Calendar
} from "lucide-react";
import { useScopeStore } from "@/store/scopeStore";

interface CoverageTabProps {
  projectId: string;
}

export function CoverageTab({ projectId }: CoverageTabProps) {
  const { getAssetsStats, getAssetsByType } = useScopeStore();
  
  const assetsStats = getAssetsStats();
  const assetsByType = getAssetsByType();

  // Mock data for team activity and recent activity - these would come from real APIs
  const mockTeamData = {
    recentActivity: [
      { service: "10.1.1.100:443", tester: "Alice", date: "2025-01-18 14:30", status: "clean" },
      { service: "api.example.com:443", tester: "Bob", date: "2025-01-18 11:15", status: "testing" },
      { service: "10.1.1.101:8080", tester: "Alice", date: "2025-01-17 16:45", status: "vulnerable" },
      { service: "10.1.1.100:80", tester: "Charlie", date: "2025-01-17 09:20", status: "exploitable" },
      { service: "10.1.1.100:22", tester: "Bob", date: "2025-01-16 13:10", status: "clean" },
    ],
    teamActivity: [
      { member: "Alice", assigned: 6, completed: 4 },
      { member: "Bob", assigned: 4, completed: 3 },
      { member: "Charlie", assigned: 2, completed: 1 },
    ]
  };


  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-8 p-6">
          {/* Overview Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-50">
                    <Target className="h-4 w-4 text-blue-600" />
                  </div>
                  Assets Coverage
                </CardTitle>
                <Badge variant="outline" className="text-sm font-medium">
                  {assetsStats.completionPercentage}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Progress 
                    value={assetsStats.completionPercentage} 
                    className="h-3 rounded-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    {assetsStats.completedCount} of {assetsStats.total} completed
                  </p>
                </div>
                
                <div className="grid grid-cols-5 gap-3 pt-2">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Circle className="h-3 w-3 text-gray-500" />
                    </div>
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="text-sm font-medium">{assetsStats.not_tested}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Clock className="h-3 w-3 text-yellow-500" />
                    </div>
                    <p className="text-xs text-muted-foreground">Testing</p>
                    <p className="text-sm font-medium">{assetsStats.testing}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    </div>
                    <p className="text-xs text-muted-foreground">Clean</p>
                    <p className="text-sm font-medium">{assetsStats.clean}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Circle className="h-3 w-3 text-red-800 fill-red-800" />
                    </div>
                    <p className="text-xs text-muted-foreground">Vulnerable</p>
                    <p className="text-sm font-medium">{assetsStats.vulnerable}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <Circle className="h-3 w-3 text-black fill-black" />
                    </div>
                    <p className="text-xs text-muted-foreground">Exploitable</p>
                    <p className="text-sm font-medium">{assetsStats.exploitable}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Asset Type Breakdown */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-50">
                  <Target className="h-4 w-4 text-purple-600" />
                </div>
                Coverage by Asset Type
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-6">
                {assetsByType.map((assetTypeGroup) => {
                  return (
                    <div key={assetTypeGroup.type} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">{assetTypeGroup.type}</h4>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-muted-foreground">
                            {assetTypeGroup.stats.completedCount}/{assetTypeGroup.stats.total}
                          </span>
                          <Badge variant="outline" className="text-xs font-medium">
                            {assetTypeGroup.stats.completionPercentage}%
                          </Badge>
                        </div>
                      </div>
                      <Progress 
                        value={assetTypeGroup.stats.completionPercentage} 
                        className="h-2 rounded-full" 
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Team Activity & Recent Testing */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Activity */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-orange-50">
                    <Users className="h-4 w-4 text-orange-600" />
                  </div>
                  Team Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {mockTeamData.teamActivity.map((member) => {
                    const percentage = Math.round((member.completed / member.assigned) * 100);
                    return (
                      <div key={member.member} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {member.member[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{member.member}</p>
                            <p className="text-xs text-muted-foreground">
                              {member.completed} of {member.assigned} completed
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="font-medium">
                          {percentage}%
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Testing Activity */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-50">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                  </div>
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {mockTeamData.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center">
                          <span className="text-xs font-medium text-white">
                            {activity.tester[0]}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium font-mono truncate">{activity.service}</p>
                          <p className="text-xs text-muted-foreground">
                            by {activity.tester} • {new Date(activity.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {activity.status === "clean" ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : activity.status === "testing" ? (
                          <Clock className="h-5 w-5 text-yellow-500" />
                        ) : activity.status === "vulnerable" ? (
                          <Circle className="h-5 w-5 text-red-800 fill-red-800" />
                        ) : activity.status === "exploitable" ? (
                          <Circle className="h-5 w-5 text-black fill-black" />
                        ) : (
                          <Circle className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Summary Stats */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-slate-100">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Project Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500 mb-3">
                    <CheckCircle className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-3xl font-bold text-green-600 mb-1">
                    {assetsStats.completedCount}
                  </p>
                  <p className="text-sm text-muted-foreground font-medium">Completed</p>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-500 mb-3">
                    <Clock className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-3xl font-bold text-slate-600 mb-1">
                    {assetsStats.testing + assetsStats.not_tested}
                  </p>
                  <p className="text-sm text-muted-foreground font-medium">Remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}