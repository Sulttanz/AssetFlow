import ExcelJS from 'exceljs';
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
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  // Add columns
  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || 15,
  }));

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4A5568' }
  };
  worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

  // Add data rows
  data.forEach(item => {
    worksheet.addRow(Object.fromEntries(Object.entries(item).map(([key, value]) => [key, formatExportValue(value)])));
  });

  // Auto-filter
  worksheet.autoFilter = {
    from: 'A1',
    to: String.fromCharCode(64 + columns.length) + '1'
  };

  // Generate file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
