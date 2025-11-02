import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/layout/header";
import { 
  Server, 
  CheckCircle, 
  Package, 
  Wrench, 
  ArrowUp, 
  AlertTriangle 
} from "lucide-react";

interface DashboardStats {
  totalAssets: number;
  assignedAssets: number;
  availableAssets: number;
  maintenanceAssets: number;
  retiredAssets: number;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Dashboard"
        description="Asset overview and system status"
        showAddButton={false}
        searchPlaceholder="Search assets, employees..."
      />

      <main className="p-6" data-testid="dashboard-content">
        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card data-testid="stats-total-assets">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Assets</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">{stats?.totalAssets || 0}</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Server className="text-primary" />
                </div>
              </div>
              <p className="text-xs text-green-600 mt-2">
                <ArrowUp className="inline w-3 h-3 mr-1" />
                System operational
              </p>
            </CardContent>
          </Card>
          
          <Card data-testid="stats-assigned-assets">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Assigned</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">{stats?.assignedAssets || 0}</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="text-green-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {stats ? `${((stats.assignedAssets / stats.totalAssets) * 100).toFixed(1)}% utilization rate` : "Loading..."}
              </p>
            </CardContent>
          </Card>
          
          <Card data-testid="stats-available-assets">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Available</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">{stats?.availableAssets || 0}</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Ready for assignment</p>
            </CardContent>
          </Card>
          
          <Card data-testid="stats-maintenance-assets">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Maintenance</p>
                  {statsLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">{stats?.maintenanceAssets || 0}</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Wrench className="text-amber-600" />
                </div>
              </div>
              <p className="text-xs text-red-600 mt-2">
                <AlertTriangle className="inline w-3 h-3 mr-1" />
                Action required
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
