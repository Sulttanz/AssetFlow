import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Header from "@/components/layout/header";
import { 
  Server, 
  CheckCircle, 
  Package, 
  Wrench, 
  Eye, 
  Edit, 
  Trash2, 
  ArrowUp, 
  AlertTriangle 
} from "lucide-react";
import type { AssetWithAssignment } from "@shared/schema";

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

  const { data: assets, isLoading: assetsLoading } = useQuery<AssetWithAssignment[]>({
    queryKey: ["/api/assets"],
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "assigned":
        return <Badge className="bg-green-100 text-green-800">Assigned</Badge>;
      case "available":
        return <Badge className="bg-blue-100 text-blue-800">Available</Badge>;
      case "maintenance":
        return <Badge className="bg-amber-100 text-amber-800">Maintenance</Badge>;
      case "retired":
        return <Badge className="bg-red-100 text-red-800">Retired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "laptop":
        return "💻";
      case "desktop":
        return "🖥️";
      case "monitor":
        return "📺";
      case "phone":
        return "📱";
      case "software":
        return "💿";
      default:
        return "📦";
    }
  };

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

        {/* Recent Assets Table */}
        <Card data-testid="recent-assets-table">
          <div className="border-b border-border">
            <nav className="flex space-x-8 px-6">
              <a href="#" className="border-b-2 border-primary text-primary py-4 text-sm font-medium">
                Recent Assets
              </a>
            </nav>
          </div>

          <div className="p-6">
            {assetsLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset ID</TableHead>
                      <TableHead>Asset Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Purchase Date</TableHead>
                      <TableHead>Warranty</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets?.slice(0, 10).map((asset) => (
                      <TableRow key={asset.id} data-testid={`asset-row-${asset.id}`}>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-xs">{asset.id.slice(0, 8)}</code>
                        </TableCell>
                        <TableCell className="font-medium">{asset.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span>{getTypeIcon(asset.type)}</span>
                            <span className="capitalize">{asset.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(asset.status)}</TableCell>
                        <TableCell>
                          {asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {asset.purchaseDate || "-"}
                        </TableCell>
                        <TableCell>
                          {asset.warrantyExpiry ? (
                            <span className={new Date(asset.warrantyExpiry) > new Date() ? "text-green-600" : "text-red-600"}>
                              {new Date(asset.warrantyExpiry) > new Date() ? "Valid until" : "Expired"} {asset.warrantyExpiry}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm" data-testid={`view-asset-${asset.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" data-testid={`edit-asset-${asset.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" data-testid={`delete-asset-${asset.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) || (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="text-muted-foreground">
                            <Package className="mx-auto h-12 w-12 mb-4" />
                            <p>No assets found</p>
                            <p className="text-sm">Add your first asset to get started</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
