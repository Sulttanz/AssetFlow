import { useState, useMemo, useEffect } from "react";
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
import AssetQRModal from "@/components/assets/asset-qr-modal";
import { Eye, Edit, Trash2, Package, Shield, AlertTriangle, CheckCircle, QrCode } from "lucide-react";
import type { AssetWithAssignment, Asset } from "@shared/schema";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

export default function Assets() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [classificationFilter, setClassificationFilter] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState("all");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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

  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case "public":
        return <Badge className="bg-green-100 text-green-800"><Shield className="h-3 w-3 mr-1" />Public</Badge>;
      case "internal":
        return <Badge className="bg-blue-100 text-blue-800"><Shield className="h-3 w-3 mr-1" />Internal</Badge>;
      case "confidential":
        return <Badge className="bg-orange-100 text-orange-800"><Shield className="h-3 w-3 mr-1" />Confidential</Badge>;
      case "restricted":
        return <Badge className="bg-red-100 text-red-800"><Shield className="h-3 w-3 mr-1" />Restricted</Badge>;
      default:
        return <Badge variant="secondary"><Shield className="h-3 w-3 mr-1" />Not Set</Badge>;
    }
  };

  const getComplianceBadge = (status: string) => {
    switch (status) {
      case "compliant":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Compliant</Badge>;
      case "non-compliant":
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Non-Compliant</Badge>;
      case "under-review":
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" />Under Review</Badge>;
      case "not-assessed":
        return <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" />Not Assessed</Badge>;
      default:
        return <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" />Unknown</Badge>;
    }
  };

  const getRiskBadge = (riskScore: string) => {
    switch (riskScore) {
      case "low":
        return <Badge className="bg-green-100 text-green-800">Low Risk</Badge>;
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-800">Medium Risk</Badge>;
      case "high":
        return <Badge className="bg-orange-100 text-orange-800">High Risk</Badge>;
      case "critical":
        return <Badge className="bg-red-100 text-red-800">Critical Risk</Badge>;
      default:
        return <Badge variant="secondary">Not Assessed</Badge>;
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
    const tag = ((asset as any).assetTag || "").toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
                         asset.name.toLowerCase().includes(q) ||
                         tag.includes(q) ||
                         asset.id.toLowerCase().includes(q) ||
                         asset.type.toLowerCase().includes(q) ||
                         ((asset as any).serialNumber || "").toLowerCase().includes(q) ||
                         ((asset as any).model || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || asset.status === statusFilter;
    const matchesType = typeFilter === "all" || asset.type === typeFilter;
    const matchesClassification = classificationFilter === "all" || (asset as any).informationClassification === classificationFilter;
    const matchesCompliance = complianceFilter === "all" || (asset as any).complianceStatus === complianceFilter;
    
    return matchesSearch && matchesStatus && matchesType && matchesClassification && matchesCompliance;
  });

  // Pagination calculations
  const totalPages = useMemo(() => {
    return Math.ceil((filteredAssets?.length || 0) / ITEMS_PER_PAGE);
  }, [filteredAssets]);

  const paginatedAssets = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAssets?.slice(startIndex, endIndex) || [];
  }, [filteredAssets, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, classificationFilter, complianceFilter]);

  // Clamp currentPage to valid range when total pages changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleAddAsset = () => {
    setSelectedAsset(null);
    setIsFormOpen(true);
  };

  const handleEditAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsFormOpen(true);
  };

  const handleShowQR = (asset: Asset) => {
    setQrAsset(asset);
    setIsQRModalOpen(true);
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
        searchPlaceholder="Search by name, asset tag, model, serial..."
        onSearch={setSearchQuery}
      />

      <main className="p-6" data-testid="assets-content">
        <Card>
          <CardContent className="p-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="status-filter">
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
                <SelectTrigger data-testid="type-filter">
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

              <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                <SelectTrigger data-testid="classification-filter">
                  <SelectValue placeholder="Filter by classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classifications</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="confidential">Confidential</SelectItem>
                  <SelectItem value="restricted">Restricted</SelectItem>
                </SelectContent>
              </Select>

              <Select value={complianceFilter} onValueChange={setComplianceFilter}>
                <SelectTrigger data-testid="compliance-filter">
                  <SelectValue placeholder="Filter by compliance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Compliance Status</SelectItem>
                  <SelectItem value="compliant">Compliant</SelectItem>
                  <SelectItem value="non-compliant">Non-Compliant</SelectItem>
                  <SelectItem value="under-review">Under Review</SelectItem>
                  <SelectItem value="not-assessed">Not Assessed</SelectItem>
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
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Asset Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Classification</TableHead>
                      <TableHead>Compliance</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAssets?.map((asset) => (
                      <TableRow key={asset.id} data-testid={`asset-row-${asset.id}`}>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                            {(asset as any).assetTag || asset.id.slice(0, 8).toUpperCase()}
                          </code>
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
                          {getClassificationBadge((asset as any).informationClassification || "")}
                        </TableCell>
                        <TableCell>
                          {getComplianceBadge((asset as any).complianceStatus || "")}
                        </TableCell>
                        <TableCell>
                          {getRiskBadge((asset as any).riskAssessmentScore || "")}
                        </TableCell>
                        <TableCell>
                          {asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleShowQR(asset)}
                              title="Show QR Code"
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEditAsset(asset)}
                              data-testid={`view-asset-${asset.id}`}
                            >
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

            {/* Pagination */}
            {!isLoading && filteredAssets && filteredAssets.length > 0 && (
              <div className="flex items-center justify-between px-2 py-4 border-t mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing <span className="font-medium">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> to{" "}
                  <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredAssets.length)}</span> of{" "}
                  <span className="font-medium">{filteredAssets.length}</span> assets
                </div>
                
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    
                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      // Show first page, last page, current page, and pages around current
                      if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <PaginationItem key={page}><span className="px-2">...</span></PaginationItem>;
                      }
                      return null;
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
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

        <AssetQRModal 
          asset={qrAsset}
          open={isQRModalOpen}
          onOpenChange={setIsQRModalOpen}
        />
      </main>
    </div>
  );
}
