import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateDisplay, formatDateTime } from "./date-utils";
import { formatExportValue } from "@shared/date-format";
import type { ChangeReportRow } from "@shared/schema";

export const CHANGE_REPORT_EXPORT_FIELDS = [
  { key: "changeNumber", label: "Change #", width: 14 },
  { key: "title", label: "Title", width: 30 },
  { key: "type", label: "Type", width: 12 },
  { key: "status", label: "Status", width: 14 },
  { key: "priority", label: "Priority", width: 12 },
  { key: "risk", label: "Risk", width: 12 },
  { key: "requestedBy", label: "Requested By", width: 20 },
  { key: "assignedTo", label: "Assigned To", width: 20 },
  { key: "affectedServices", label: "Affected Services", width: 32 },
  { key: "affectedAssets", label: "Affected Assets", width: 36 },
  { key: "approvals", label: "Approvals", width: 24 },
  { key: "scheduledStart", label: "Scheduled Start", width: 16 },
  { key: "scheduledEnd", label: "Scheduled End", width: 16 },
  { key: "createdAt", label: "Created", width: 14 },
] as const;

export type ChangeReportExportFieldKey = typeof CHANGE_REPORT_EXPORT_FIELDS[number]["key"];

export interface ChangeReportFilter {
  label: string;
  value: string;
}

export interface ChangeReportFilters {
  search: string;
  status: string;
  type: string;
  risk: string;
  scheduledStartFrom: string;
  scheduledStartTo: string;
}

export const CHANGE_REPORT_EXPORT_PRESETS: Record<string, ChangeReportExportFieldKey[]> = {
  Excel: [
    "changeNumber", "title", "type", "status", "priority", "risk", "requestedBy",
    "assignedTo", "affectedServices", "affectedAssets", "scheduledStart", "scheduledEnd", "createdAt",
  ],
  PDF: [
    "changeNumber", "title", "type", "status", "risk", "requestedBy",
    "affectedServices", "affectedAssets", "createdAt",
  ],
  Print: [
    "changeNumber", "title", "type", "status", "priority", "risk", "affectedServices",
    "affectedAssets", "approvals", "requestedBy", "scheduledStart", "createdAt",
  ],
};

const statusFilterLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const typeFilterLabels: Record<string, string> = {
  standard: "Standard",
  normal: "Normal",
  emergency: "Emergency",
};

const riskFilterLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function getChangeReportActiveFilters(filters: ChangeReportFilters): ChangeReportFilter[] {
  const activeFilters: ChangeReportFilter[] = [];
  const search = filters.search.trim();
  if (search) activeFilters.push({ label: "Search change #, title...", value: search });
  if (filters.status !== "all") {
    activeFilters.push({ label: "Status", value: statusFilterLabels[filters.status] ?? filters.status });
  }
  if (filters.type !== "all") {
    activeFilters.push({ label: "Type", value: typeFilterLabels[filters.type] ?? filters.type });
  }
  if (filters.risk !== "all") {
    activeFilters.push({ label: "Risk", value: riskFilterLabels[filters.risk] ?? filters.risk });
  }
  if (filters.scheduledStartFrom) {
    activeFilters.push({
      label: "Scheduled start from",
      value: formatDate(filters.scheduledStartFrom),
    });
  }
  if (filters.scheduledStartTo) {
    activeFilters.push({
      label: "Scheduled start through",
      value: formatDate(filters.scheduledStartTo),
    });
  }
  return activeFilters;
}

export function getChangeReportExportField(key: ChangeReportExportFieldKey) {
  return CHANGE_REPORT_EXPORT_FIELDS.find(field => field.key === key)!;
}

export function getChangeReportExportValue(
  change: ChangeReportRow,
  key: ChangeReportExportFieldKey,
): string {
  switch (key) {
    case "changeNumber": return change.changeNumber;
    case "title": return change.title;
    case "type": return change.type;
    case "status": return change.status.replace("_", " ");
    case "priority": return change.priority;
    case "risk": return change.risk || "low";
    case "requestedBy": return change.requestedByLabel ?? "N/A";
    case "assignedTo": return change.assignedToLabel ?? "Unassigned";
    case "affectedServices": return change.impactSummary?.services.join(", ") || "None";
    case "affectedAssets": return change.impactSummary?.assets.join(", ") || "None";
    case "approvals": return change.activeApprovalCount > 0
      ? `${change.approvedCount} approved, ${change.pendingCount} pending`
      : "None";
    case "scheduledStart": return change.scheduledStart ? formatDate(change.scheduledStart) : "N/A";
    case "scheduledEnd": return change.scheduledEnd ? formatDate(change.scheduledEnd) : "N/A";
    case "createdAt": return change.createdAt ? formatDate(change.createdAt) : "N/A";
  }
}

// Excel Export Utility
export async function exportToExcel(
  data: any[],
  columns: { header: string; key: string; width?: number }[],
  filename: string,
  filters: ChangeReportFilter[] = [],
) {
  const response = await fetch("/api/report-exports/xlsx", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: data.map(item => Object.fromEntries(columns.map(column => [
        column.key,
        formatExportValue(item[column.key]),
      ]))),
      columns,
      filename,
      ...(filters.length ? { filters } : {}),
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "Failed to generate Excel report");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// PDF Export Utility
export function exportToPDF(
  data: any[][],
  columns: string[],
  title: string,
  filename: string,
  orientation: "portrait" | "landscape" = "portrait",
  filters: ChangeReportFilter[] = [],
) {
  const doc = new jsPDF({ orientation });
  
  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  
  // Add date
  doc.setFontSize(10);
  doc.text(`Generated: ${formatDateTime(new Date())}`, 14, 22);

  let tableStartY = 30;
  if (filters.length) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Applied filters", 14, 30);
    doc.setFont("helvetica", "normal");
    const filterLines = doc.splitTextToSize(
      filters.map(filter => `${filter.label}: ${filter.value}`).join(" | "),
      doc.internal.pageSize.getWidth() - 28,
    );
    doc.text(filterLines, 14, 36);
    tableStartY = 42 + filterLines.length * 5;
  }

  // Add table
  autoTable(doc, {
    head: [columns],
    body: data.map(row => row.map(value => formatExportValue(value))),
    startY: tableStartY,
    theme: 'striped',
    headStyles: { fillColor: [74, 85, 104] },
    styles: { fontSize: 8 },
  });

  doc.save(`${filename}.pdf`);
}

// Format date for display
export function formatDate(date: string | Date): string {
  return formatDateDisplay(date);
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}
