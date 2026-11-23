import { formatDateDisplay } from "@/lib/date-utils";
import { personName, scores, type MatrixMode, type RiskRecord } from "./risk-types";

export async function exportRisks(rows: RiskRecord[], mode: MatrixMode, format: "csv" | "pdf") {
  const today = new Date().toISOString().slice(0, 10);
  const date = (value?: string | null) => value ? formatDateDisplay(value) : "—";
  const header = ["Risk ID", "Title", "Category", "Owner", "Status", "Inherent", "Residual", "Target", "Treatment", "Next Review", "Acceptance Expiry", "Controls", "Mitigation"];
  const body = rows.map(risk => [
    risk.riskNumber, risk.title, risk.category, personName(risk.owner), risk.status,
    String(risk.likelihood * risk.impact),
    String((risk.residualLikelihood ?? risk.likelihood) * (risk.residualImpact ?? risk.impact)),
    risk.targetLikelihood && risk.targetImpact ? String(risk.targetLikelihood * risk.targetImpact) : "—",
    risk.treatmentStrategy, date(risk.nextReviewDate), date(risk.acceptanceExpiresAt), risk.existingControls ?? "", risk.mitigation ?? "",
  ]);
  const matrix = [5, 4, 3, 2, 1].map(impact => [String(impact), ...[1, 2, 3, 4, 5].map(likelihood =>
    String(rows.filter(risk => { const pair = scores(risk, mode); return pair.impact === impact && pair.likelihood === likelihood; }).length))]);
  const overdue = rows.flatMap(risk => risk.mitigationActions.filter(action =>
    action.status !== "Completed" && !!action.dueDate && action.dueDate < today,
  ).map(action => [risk.riskNumber, action.title, action.ownerUserId ?? "Unassigned", date(action.dueDate), action.evidenceNotes ?? ""]));
  if (format === "csv") {
    const escape = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
    const data = [
      ["Internal IT Risk Register", `Exported ${date(today)}`, `${rows.length} filtered risks`],
      header, ...body, [], [`${mode} matrix · risk counts`], ["Impact / Likelihood", "1", "2", "3", "4", "5"], ...matrix,
      [], ["Overdue mitigation actions"], ["Risk ID", "Action", "Owner ID", "Due Date", "Evidence"], ...overdue,
    ].map(row => row.map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", data], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = `IT-Risk-Register-${today}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(18); doc.text("Executive IT Risk Report", 14, 18);
  doc.setFontSize(10); doc.text(`${rows.length} filtered risks | Generated ${date(today)} | Internal IT department only`, 14, 26);
  autoTable(doc, { startY: 32, head: [header], body, styles: { fontSize: 7, cellWidth: "wrap" }, columnStyles: { 1: { cellWidth: 30 }, 11: { cellWidth: 27 }, 12: { cellWidth: 27 } }, headStyles: { fillColor: [15, 23, 42] } });
  doc.addPage(); doc.setFontSize(15); doc.text(`${mode} Risk Matrix — filtered dataset`, 14, 18);
  autoTable(doc, { startY: 25, head: [["Impact / Likelihood", "1", "2", "3", "4", "5"]], body: matrix, headStyles: { fillColor: [37, 99, 235] } });
  doc.setFontSize(15); doc.text("Overdue mitigation actions", 14, 110);
  autoTable(doc, { startY: 117, head: [["Risk ID", "Action", "Owner ID", "Due Date", "Evidence"]], body: overdue.length ? overdue : [["—", "No overdue actions in filtered risks", "—", "—", "—"]], styles: { fontSize: 9 } });
  doc.save(`Executive-IT-Risk-Report-${today}.pdf`);
}
