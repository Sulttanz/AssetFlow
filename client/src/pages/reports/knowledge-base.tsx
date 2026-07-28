import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Download, FileSpreadsheet, Printer, BookOpen, Search, Eye, ThumbsUp, ThumbsDown, FileText,
} from "lucide-react";
import { exportToExcel, exportToPDF, formatDate } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import Header from "@/components/layout/header";
import type { KbArticle } from "@shared/schema";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-amber-100 text-amber-800",
};

export default function KnowledgeBaseReport() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: articles, isLoading } = useQuery<KbArticle[]>({
    queryKey: ["/api/reports/kb-articles"],
  });

  const handlePrint = useReactToPrint({ contentRef: printRef });
  const records = articles || [];

  const categories = useMemo(() => {
    const cats = Array.from(new Set(records.map((a) => a.category))).sort();
    return cats;
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          (a.tags || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, statusFilter, categoryFilter, search]);

  const summary = useMemo(() => {
    const published = records.filter((a) => a.status === "published").length;
    const draft = records.filter((a) => a.status === "draft").length;
    const archived = records.filter((a) => a.status === "archived").length;
    const totalViews = records.reduce((sum, a) => sum + (a.views || 0), 0);
    const totalHelpful = records.reduce((sum, a) => sum + (a.helpfulCount || 0), 0);
    const totalNotHelpful = records.reduce((sum, a) => sum + (a.notHelpfulCount || 0), 0);
    const helpfulPct = totalHelpful + totalNotHelpful > 0
      ? Math.round((totalHelpful / (totalHelpful + totalNotHelpful)) * 100)
      : null;
    return { total: records.length, published, draft, archived, totalViews, totalHelpful, totalNotHelpful, helpfulPct };
  }, [records]);

  const handleExportExcel = async () => {
    if (!filtered.length) return;
    await exportToExcel(
      filtered.map((a) => ({
        title: a.title,
        category: a.category,
        status: a.status,
        views: a.views || 0,
        helpfulVotes: a.helpfulCount || 0,
        notHelpfulVotes: a.notHelpfulCount || 0,
        tags: a.tags || "N/A",
        createdAt: a.createdAt ? formatDate(a.createdAt as any) : "N/A",
        updatedAt: a.updatedAt ? formatDate(a.updatedAt as any) : "N/A",
      })),
      [
        { header: "Title", key: "title", width: 35 },
        { header: "Category", key: "category", width: 16 },
        { header: "Status", key: "status", width: 12 },
        { header: "Views", key: "views", width: 10 },
        { header: "Helpful", key: "helpfulVotes", width: 10 },
        { header: "Not Helpful", key: "notHelpfulVotes", width: 12 },
        { header: "Tags", key: "tags", width: 20 },
        { header: "Created", key: "createdAt", width: 14 },
        { header: "Updated", key: "updatedAt", width: 14 },
      ],
      "kb-report"
    );
  };

  const handleExportPDF = () => {
    if (!filtered.length) return;
    exportToPDF(
      filtered.map((a) => [
        a.title,
        a.category,
        a.status,
        String(a.views || 0),
        String(a.helpfulCount || 0),
        a.createdAt ? formatDate(a.createdAt as any) : "N/A",
      ]),
      ["Title", "Category", "Status", "Views", "Helpful", "Created"],
      "Knowledge Base Report",
      "kb-report"
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Knowledge Base Report" description="Article usage, engagement, and content analytics" />
      <main className="flex-1 p-6 space-y-6">
        <div ref={printRef}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Knowledge Base Report</h1>
                <p className="text-sm text-muted-foreground">Article usage, engagement, and content analytics</p>
              </div>
            </div>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!filtered.length}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={!filtered.length}>
                <Download className="mr-2 h-4 w-4" />PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />Print
              </Button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            {[
              { label: "Total Articles", value: summary.total, icon: FileText, color: "text-foreground" },
              { label: "Published", value: summary.published, icon: BookOpen, color: "text-green-600" },
              { label: "Draft", value: summary.draft, icon: FileText, color: "text-gray-600" },
              { label: "Archived", value: summary.archived, icon: FileText, color: "text-amber-600" },
              { label: "Total Views", value: summary.totalViews, icon: Eye, color: "text-blue-600" },
              { label: "Helpful Votes", value: summary.totalHelpful, icon: ThumbsUp, color: "text-teal-600" },
              {
                label: "Helpful Rate",
                value: summary.helpfulPct !== null ? `${summary.helpfulPct}%` : "N/A",
                icon: ThumbsUp,
                color: summary.helpfulPct !== null && summary.helpfulPct >= 70 ? "text-green-600" : "text-amber-600",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Icon className="h-3 w-3" /> {label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${color}`}>{isLoading ? "—" : value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4 print:hidden">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search title, category, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || statusFilter !== "all" || categoryFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); }}>
                Clear filters
              </Button>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            Showing <span className="font-medium">{filtered.length}</span> of{" "}
            <span className="font-medium">{records.length}</span> articles
          </p>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">Loading KB report...</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <BookOpen className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No articles match your filters.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">👍</TableHead>
                      <TableHead className="text-right">👎</TableHead>
                      <TableHead className="text-right">Helpful %</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => {
                      const total = (a.helpfulCount || 0) + (a.notHelpfulCount || 0);
                      const pct = total > 0 ? Math.round(((a.helpfulCount || 0) / total) * 100) : null;
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium max-w-[260px] truncate">{a.title}</TableCell>
                          <TableCell>{a.category}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[a.status]}>{a.status}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate text-sm text-muted-foreground">{a.tags || "—"}</TableCell>
                          <TableCell className="text-right font-medium">{a.views || 0}</TableCell>
                          <TableCell className="text-right text-green-600">{a.helpfulCount || 0}</TableCell>
                          <TableCell className="text-right text-red-500">{a.notHelpfulCount || 0}</TableCell>
                          <TableCell className="text-right">
                            {pct !== null ? (
                              <span className={pct >= 70 ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                                {pct}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{a.createdAt ? formatDate(a.createdAt as any) : "—"}</TableCell>
                          <TableCell className="text-sm">{a.updatedAt ? formatDate(a.updatedAt as any) : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
