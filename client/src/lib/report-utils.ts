import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateDisplay, formatDateTime } from "./date-utils";
import { formatExportValue } from "@shared/date-format";

// Excel Export Utility
export async function exportToExcel(
  data: any[],
  columns: { header: string; key: string; width?: number }[],
  filename: string
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
  filename: string
) {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  
  // Add date
  doc.setFontSize(10);
  doc.text(`Generated: ${formatDateTime(new Date())}`, 14, 22);

  // Add table
  autoTable(doc, {
    head: [columns],
    body: data.map(row => row.map(value => formatExportValue(value))),
    startY: 30,
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
