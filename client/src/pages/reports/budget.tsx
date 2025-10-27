import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import ReportFilters from "@/components/report-filters";
import { exportToExcel, exportToPDF, formatCurrency } from "@/lib/report-utils";
import { useReactToPrint } from "react-to-print";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

export default function BudgetReport() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const { data: budget, isLoading } = useQuery<any>({
    queryKey: ['/api/reports/budget'],
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const handleExportExcel = async () => {
    if (!budget?.budgetDetails) return;
    await exportToExcel(
      budget.budgetDetails.map((b: any) => ({
        department: b.departmentName,
        budgetAmount: formatCurrency(b.budgetAmount),
        spent: formatCurrency(b.spent),
        remaining: formatCurrency(b.remaining),
        utilization: `${b.utilization.toFixed(1)}%`,
      })),
      [
        { header: 'Department', key: 'department', width: 20 },
        { header: 'Budget Amount', key: 'budgetAmount', width: 15 },
        { header: 'Spent', key: 'spent', width: 15 },
        { header: 'Remaining', key: 'remaining', width: 15 },
        { header: 'Utilization', key: 'utilization', width: 12 },
      ],
      'budget-analysis-report'
    );
  };

  const handleExportPDF = () => {
    if (!budget?.budgetDetails) return;
    const data = budget.budgetDetails.map((b: any) => [
      b.departmentName,
      formatCurrency(b.budgetAmount),
      formatCurrency(b.spent),
      formatCurrency(b.remaining),
      `${b.utilization.toFixed(1)}%`,
    ]);
    exportToPDF(
      data,
      ['Department', 'Budget Amount', 'Spent', 'Remaining', 'Utilization'],
      'Budget Analysis Report',
      'budget-analysis-report'
    );
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Budget Analysis Report</h1>
          <p className="text-muted-foreground mt-1">Department budgets and spending trends</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportExcel} variant="outline" data-testid="button-export-excel">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button onClick={handleExportPDF} variant="outline" data-testid="button-export-pdf">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button onClick={handlePrint} variant="outline" data-testid="button-print">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <ReportFilters
        filters={[
          {
            key: 'department',
            label: 'Department',
            type: 'text',
          }
        ]}
        values={filters}
        onChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
        onClear={() => setFilters({})}
      />

      <div ref={printRef} className="space-y-6 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(budget?.totalBudget || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(budget?.totalSpent || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(budget?.totalRemaining || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{budget?.averageUtilization?.toFixed(1) || 0}%</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Budget Details by Department</CardTitle>
            <CardDescription>Budget allocation and utilization across departments</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Budget Amount</TableHead>
                  <TableHead>Spent</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Utilization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budget?.budgetDetails?.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.departmentName}</TableCell>
                    <TableCell>{formatCurrency(item.budgetAmount)}</TableCell>
                    <TableCell>{formatCurrency(item.spent)}</TableCell>
                    <TableCell>{formatCurrency(item.remaining)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={item.utilization} className="w-20" />
                        <span className="text-sm">{item.utilization.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
