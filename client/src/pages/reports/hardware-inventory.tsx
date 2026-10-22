import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Printer, Search, ShieldCheck, ClipboardCheck } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDateDisplay } from "@/lib/date-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { exportToExcel, exportToPDF } from "@/lib/report-utils";

type ComponentRow = {
  id: string;
  componentId: string;
  componentType: string;
  category: string;
  componentName: string;
  identifier: string;
  inventoryStatus: string;
  searchText: string;
  locationPurpose: string;
  baselineStandard: string;
  complianceStatus: "compliant" | "non_compliant" | "pending_review";
  lastReviewedAt: string | Date | null;
  reviewFrequency: string;
  findings: string;
  remediationNotes: string;
};

type ReviewForm = {
  baselineStandard: string;
  complianceStatus: ComponentRow["complianceStatus"];
  reviewFrequency: "monthly" | "quarterly" | "annual";
  findings: string;
  remediationNotes: string;
};

const statusLabel: Record<ComponentRow["complianceStatus"], string> = {
  compliant: "Compliant",
  non_compliant: "Non-Compliant",
  pending_review: "Pending Review",
};

const statusStyle: Record<ComponentRow["complianceStatus"], string> = {
  compliant: "border-green-200 bg-green-50 text-green-800",
  non_compliant: "border-red-200 bg-red-50 text-red-800",
  pending_review: "border-amber-200 bg-amber-50 text-amber-800",
};

const displayDate = (value: ComponentRow["lastReviewedAt"]) =>
  value ? formatDateDisplay(value) : "Not reviewed";

const exportColumns = [
  { header: "Component Name", key: "componentName", width: 32 },
  { header: "Component Type", key: "category", width: 22 },
  { header: "Identifier", key: "identifier", width: 30 },
  { header: "Inventory Status", key: "inventoryStatus", width: 18 },
  { header: "Assigned Location / Purpose", key: "locationPurpose", width: 36 },
  { header: "Baseline Standard", key: "baselineStandard", width: 24 },
  { header: "Compliance Status", key: "complianceStatus", width: 20 },
  { header: "Last Reviewed Date", key: "lastReviewedAt", width: 20 },
  { header: "Review Frequency", key: "reviewFrequency", width: 18 },
  { header: "Findings", key: "findings", width: 40 },
  { header: "Remediation Notes", key: "remediationNotes", width: 40 },
];

export default function HardwareInventoryReport() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewing, setReviewing] = useState<ComponentRow | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewForm>({
    baselineStandard: "",
    complianceStatus: "pending_review",
    reviewFrequency: "quarterly",
    findings: "",
    remediationNotes: "",
  });
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const canManageReviews = Boolean(user?.permissions?.includes("asset_update") || user?.permissions?.includes("system_admin"));

  const { data: components = [], isLoading, isError } = useQuery<ComponentRow[]>({
    queryKey: ["/api/reports/it-components-compliance"],
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    pageStyle: "@page { size: landscape; margin: 12mm; }",
  });

  const locationOptions = useMemo(() => Array.from(new Set(
    components.map(row => row.locationPurpose.split(" · ")[0]?.trim()).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b)), [components]);

  const filteredComponents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return components.filter(row => {
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (statusFilter !== "all" && row.complianceStatus !== statusFilter) return false;
      if (locationFilter !== "all" && !row.locationPurpose.startsWith(locationFilter)) return false;
      if (term && !`${row.componentName} ${row.identifier} ${row.locationPurpose} ${row.searchText} ${row.baselineStandard} ${row.findings} ${row.remediationNotes}`.toLocaleLowerCase().includes(term)) return false;
      return true;
    });
  }, [components, categoryFilter, locationFilter, search, statusFilter]);

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewing) throw new Error("Select a component to review.");
      const response = await apiRequest(
        "PUT",
        `/api/reports/it-components-compliance/${encodeURIComponent(reviewing.componentType)}/${encodeURIComponent(reviewing.componentId)}/review`,
        {
          ...reviewForm,
          findings: reviewForm.findings || null,
          remediationNotes: reviewForm.remediationNotes || null,
        },
      );
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/reports/it-components-compliance"] });
      setReviewing(null);
      toast({ title: "Compliance review saved", description: "The report now reflects the latest review." });
    },
    onError: (error: Error) => {
      toast({ title: "Review was not saved", description: error.message, variant: "destructive" });
    },
  });

  const openReview = (row: ComponentRow) => {
    setReviewing(row);
    setReviewForm({
      baselineStandard: row.baselineStandard === "Not recorded" ? "" : row.baselineStandard,
      complianceStatus: row.complianceStatus,
      reviewFrequency: (["monthly", "quarterly", "annual"].includes(row.reviewFrequency.toLowerCase())
        ? row.reviewFrequency.toLowerCase()
        : "quarterly") as ReviewForm["reviewFrequency"],
      findings: row.findings ?? "",
      remediationNotes: row.remediationNotes ?? "",
    });
  };

  const handleExportExcel = async () => {
    try {
      await exportToExcel(filteredComponents.map(row => ({
        ...row,
        complianceStatus: statusLabel[row.complianceStatus],
        lastReviewedAt: displayDate(row.lastReviewedAt),
      })), exportColumns, "it-components-configuration-compliance");
    } catch (error) {
      toast({ title: "Excel export failed", description: error instanceof Error ? error.message : "Unable to create the report.", variant: "destructive" });
    }
  };

  const handleExportPDF = () => {
    exportToPDF(
      filteredComponents.map(row => [
        row.componentName,
        row.category,
        row.identifier,
        row.inventoryStatus,
        row.locationPurpose,
        row.baselineStandard,
        statusLabel[row.complianceStatus],
        displayDate(row.lastReviewedAt),
        row.reviewFrequency,
        row.findings || "—",
        row.remediationNotes || "—",
      ]),
      exportColumns.map(column => column.header),
      "IT Components & Configuration Compliance Report",
      "it-components-configuration-compliance",
      "landscape",
    );
  };

  const compliantCount = components.filter(row => row.complianceStatus === "compliant").length;
  const nonCompliantCount = components.filter(row => row.complianceStatus === "non_compliant").length;
  const pendingCount = components.filter(row => row.complianceStatus === "pending_review").length;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">IT Components &amp; Configuration Compliance Report</h1>
          <p className="mt-1 text-muted-foreground">Unified audit view of infrastructure, endpoints, endpoint protection, software, and license inventory.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExportExcel} variant="outline" data-testid="button-export-excel">
            <FileSpreadsheet className="mr-2 h-4 w-4" />Export Excel
          </Button>
          <Button onClick={handleExportPDF} variant="outline" data-testid="button-export-pdf">
            <Download className="mr-2 h-4 w-4" />Export PDF
          </Button>
          <Button onClick={() => handlePrint()} variant="outline" data-testid="button-print">
            <Printer className="mr-2 h-4 w-4" />Print
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><ShieldCheck className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" /><div><p className="text-sm text-muted-foreground">Compliant</p><p className="text-2xl font-semibold">{compliantCount}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><ClipboardCheck className="h-10 w-10 shrink-0 rounded-xl bg-rose-50 p-2 text-rose-600 dark:bg-rose-950 dark:text-rose-400" /><div><p className="text-sm text-muted-foreground">Non-Compliant</p><p className="text-2xl font-semibold">{nonCompliantCount}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><ClipboardCheck className="h-10 w-10 shrink-0 rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950 dark:text-amber-400" /><div><p className="text-sm text-muted-foreground">Pending Review</p><p className="text-2xl font-semibold">{pendingCount}</p></div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" aria-label="Search components" placeholder="Search name, serial, IP, or version" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger aria-label="Filter by component category"><SelectValue placeholder="Component type / category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All component types</SelectItem>
              <SelectItem value="Hardware">Hardware / Infrastructure</SelectItem>
              <SelectItem value="Endpoint Devices">Endpoint Devices</SelectItem>
              <SelectItem value="Endpoint Protection">Endpoint Protection</SelectItem>
              <SelectItem value="Software">Software</SelectItem>
              <SelectItem value="License">License</SelectItem>
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger aria-label="Filter by location"><SelectValue placeholder="Location / data center" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locationOptions.map(location => <SelectItem key={location} value={location}>{location}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filter by compliance status"><SelectValue placeholder="Compliance status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All compliance statuses</SelectItem>
              <SelectItem value="compliant">Compliant</SelectItem>
              <SelectItem value="non_compliant">Non-Compliant</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div ref={printRef} className="space-y-4 bg-white p-1 print:p-0">
        <Card>
          <CardHeader>
            <CardTitle>IT Components &amp; Configuration Compliance</CardTitle>
            <CardDescription>
              {filteredComponents.length} of {components.length} components shown. Review fields are recorded per component and included in exports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="py-8 text-center text-muted-foreground">Loading component compliance data…</p> : null}
            {isError ? <p className="py-8 text-center text-destructive">Unable to load the component compliance report.</p> : null}
            {!isLoading && !isError && filteredComponents.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No components match the selected filters.</p>
            ) : null}
            {!isLoading && !isError && filteredComponents.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-48">Component Name &amp; Type</TableHead>
                      <TableHead className="min-w-52">Identifier</TableHead>
                      <TableHead className="min-w-48">Assigned Location / Purpose</TableHead>
                      <TableHead className="min-w-48">Baseline / Status</TableHead>
                      <TableHead className="min-w-40">Last Reviewed / Frequency</TableHead>
                      <TableHead className="min-w-64">Findings / Remediation</TableHead>
                      {canManageReviews ? <TableHead className="min-w-28 print:hidden">Action</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredComponents.map(row => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.componentName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{row.category} · Inventory: {row.inventoryStatus}</div>
                        </TableCell>
                        <TableCell className="max-w-64 break-words text-sm">{row.identifier || "Not recorded"}</TableCell>
                        <TableCell className="text-sm">{row.locationPurpose || "Not recorded"}</TableCell>
                        <TableCell>
                          <div className="mb-1 text-sm">{row.baselineStandard}</div>
                          <Badge variant="outline" className={statusStyle[row.complianceStatus]}>{statusLabel[row.complianceStatus]}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{displayDate(row.lastReviewedAt)}</div>
                          <div className="mt-1 text-xs capitalize text-muted-foreground">{row.reviewFrequency.replaceAll("_", " ")}</div>
                        </TableCell>
                        <TableCell className="max-w-80 text-sm">
                          <div title={row.findings} className="max-w-80 truncate">{row.findings || "No findings recorded"}</div>
                          <div title={row.remediationNotes} className="mt-1 max-w-80 truncate text-xs text-muted-foreground">{row.remediationNotes || "No remediation note"}</div>
                        </TableCell>
                        {canManageReviews ? <TableCell className="print:hidden">
                          <Button size="sm" variant="outline" onClick={() => openReview(row)}>Record Review</Button>
                        </TableCell> : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {canManageReviews ? <Dialog open={Boolean(reviewing)} onOpenChange={open => !open && setReviewing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Record Configuration Review</DialogTitle>
            <DialogDescription>{reviewing?.componentName} — the review date is recorded automatically when you save.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review-baseline">Baseline standard</Label>
              <Input id="review-baseline" maxLength={160} placeholder="e.g. ISO-Baseline v2.1" value={reviewForm.baselineStandard} onChange={event => setReviewForm(current => ({ ...current, baselineStandard: event.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Compliance status</Label>
                <Select value={reviewForm.complianceStatus} onValueChange={value => setReviewForm(current => ({ ...current, complianceStatus: value as ReviewForm["complianceStatus"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compliant">Compliant</SelectItem>
                    <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Review frequency</Label>
                <Select value={reviewForm.reviewFrequency} onValueChange={value => setReviewForm(current => ({ ...current, reviewFrequency: value as ReviewForm["reviewFrequency"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-findings">Findings</Label>
              <Textarea id="review-findings" maxLength={5000} value={reviewForm.findings} onChange={event => setReviewForm(current => ({ ...current, findings: event.target.value }))} placeholder="Record deviations, missing controls, or vulnerabilities." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-remediation">Remediation notes</Label>
              <Textarea id="review-remediation" maxLength={5000} value={reviewForm.remediationNotes} onChange={event => setReviewForm(current => ({ ...current, remediationNotes: event.target.value }))} placeholder="Document owner actions or remediation plan." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>Cancel</Button>
            <Button disabled={!reviewForm.baselineStandard.trim() || reviewMutation.isPending} onClick={() => reviewMutation.mutate()}>
              {reviewMutation.isPending ? "Saving…" : "Save Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog> : null}
    </div>
  );
}
