import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import AssetForm from "@/components/assets/asset-form";
import { Eye, Edit, Trash2, Package } from "lucide-react";
import type { AssetWithAssignment, Asset } from "@shared/schema";

export default function Assets() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  const { data: assets, isLoading } = useQuery<AssetWithAssignment[]>({
    queryKey: ["/api/assets"],
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      await apiRequest("DELETE", `/api/assets/${assetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Asset deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete asset",
        variant: "destructive",
      });
    },
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

  const filteredAssets = assets?.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         asset.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         asset.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || asset.status === statusFilter;
    const matchesType = typeFilter === "all" || asset.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleAddAsset = () => {
    setSelectedAsset(null);
    setIsFormOpen(true);
  };

  const handleEditAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsFormOpen(true);
  };

  const handleDeleteAsset = (assetId: string) => {
    if (confirm("Are you sure you want to delete this asset?")) {
      deleteAssetMutation.mutate(assetId);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setSelectedAsset(null);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Header
        title="Assets"
        description="Manage hardware and software assets"
        onAddClick={handleAddAsset}
        addButtonText="Add Asset"
        searchPlaceholder="Search assets..."
        onSearch={setSearchQuery}
      />

      <main className="p-6" data-testid="assets-content">
        <Card>
          <CardContent className="p-6">
            {/* Filters */}
            <div className="flex items-center space-x-4 mb-6">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48" data-testid="status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48" data-testid="type-filter">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                  <SelectItem value="monitor">Monitor</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="software">Software</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assets Table */}
            {isLoading ? (
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
                    {filteredAssets?.map((asset) => (
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
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditAsset(asset)}
                              data-testid={`edit-asset-${asset.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteAsset(asset.id)}
                              data-testid={`delete-asset-${asset.id}`}
                            >
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
          </CardContent>
        </Card>

        {/* Asset Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl" data-testid="asset-form-dialog">
            <DialogHeader>
              <DialogTitle>
                {selectedAsset ? "Edit Asset" : "Add New Asset"}
              </DialogTitle>
            </DialogHeader>
            <AssetForm
              asset={selectedAsset}
              onSuccess={handleFormSuccess}
              onCancel={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
