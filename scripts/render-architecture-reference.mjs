// Create an offline Arabic reference from the reviewed Markdown documents.
import fs from "node:fs";
import path from "node:path";

const dir = "generated-artifacts/architecture-reference";
fs.mkdirSync(dir, { recursive: true });
const escape = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const chapters = [
  ["main", "المرجع الرئيسي والنتائج", "docs/MASTER_SYSTEM_ARCHITECTURE_AR.md"],
  ["screens", "الشاشات والنوافذ والحقول", "docs/architecture-reference-ar/screens.md"],
  ["database", "قاموس الجداول والعلاقات", "docs/architecture-reference-ar/database.md"],
  ["apis", "واجهات API والحواجز", "docs/architecture-reference-ar/apis.md"],
  ["configuration-and-validation", "التنقل والتحقق والاستيراد", "docs/architecture-reference-ar/configuration-and-validation.md"],
];
const links = new Map(chapters.map(([id, , file]) => [path.basename(file), id]));
function inline(raw) {
  const tokens = [];
  const token = html => `\u0001${tokens.push(html) - 1}\u0002`;
  const input = raw
    .replace(/`([^`]+)`/g, (_, value) => token(`<code dir="ltr">${escape(value)}</code>`))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, title, target) => {
      const id = links.get(path.basename(target));
      return token(id ? `<a href="#${id}">${escape(title)}</a>` : escape(title));
    });
  return escape(input).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\u0001(\d+)\u0002/g, (_, index) => tokens[Number(index)]);
}
// Split tables without treating escaped pipes or pipes inside inline code as separators.
function cells(line) {
  const values = [];
  let current = "", inCode = false, escaped = false;
  for (const char of line.trim().replace(/^\|/, "").replace(/\|$/, "")) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === "`") inCode = !inCode;
    if (char === "|" && !inCode) { values.push(current.trim()); current = ""; }
    else current += char;
  }
  values.push(current.trim());
  return values;
}
function render(md, id) {
  const lines = md.split("\n");
  const html = [];
  let fence = false, codeLines = [], list = false, table = false, paragraph = [];
  const flush = () => { if (paragraph.length) html.push(`<p>${inline(paragraph.join(" "))}</p>`); paragraph = []; };
  const closeList = () => { if (list) html.push("</ul>"); list = false; };
  const closeTable = () => { if (table) html.push("</tbody></table></div>"); table = false; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush(); closeList(); closeTable();
      if (fence) html.push(`<pre dir="ltr"><code>${escape(codeLines.join("\n"))}</code></pre>`);
      fence = !fence; codeLines = []; continue;
    }
    if (fence) { codeLines.push(line); continue; }
    if (/^\|/.test(line)) {
      flush(); closeList();
      if (!table) {
        html.push(`<div class="table-wrap"><table><thead><tr>${cells(line).map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>`);
        table = true;
      } else if (!/^\|[\s:|-]+\|$/.test(line)) {
        html.push(`<tr>${cells(line).map(c => `<td>${inline(c)}</td>`).join("")}</tr>`);
      }
      continue;
    }
    closeTable();
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flush(); closeList();
      const level = Math.min(heading[1].length + 1, 6);
      html.push(`<h${level} id="${id}-line-${i}">${inline(heading[2])}</h${level}>`); continue;
    }
    if (line.startsWith("<details>")) { flush(); closeList(); html.push(line); continue; }
    if (line === "</details>") { flush(); closeList(); html.push("</details>"); continue; }
    if (/^[-*]\s|^\d+\.\s/.test(line)) {
      flush();
      if (!list) { html.push("<ul>"); list = true; }
      html.push(`<li>${inline(line.replace(/^[-*]\s|^\d+\.\s/, ""))}</li>`); continue;
    }
    closeList();
    if (line.startsWith(">")) { flush(); html.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`); continue; }
    if (!line.trim()) flush();
    else paragraph.push(line);
  }
  flush(); closeList(); closeTable();
  return html.join("\n");
}
const stats = JSON.parse(fs.readFileSync("docs/architecture-reference-ar/inventory.json", "utf8"));
const nav = chapters.map(([id, title]) => `<a href="#${id}">${escape(title)}</a>`).join("");
const contents = chapters.map(([id, title, file]) => `<section id="${id}" aria-labelledby="${id}-title"><h1 id="${id}-title">${escape(title)}</h1>${render(fs.readFileSync(file, "utf8"), id)}</section>`).join("\n");
const css = `
:root{font-family:Tahoma,Arial,sans-serif;color:#0f172a;background:#f8fafc;line-height:1.9}
*{box-sizing:border-box}body{margin:0}header{background:#0f172a;color:white;padding:42px 6vw}
header p{color:#cbd5e1;max-width:1000px}header h1{font-size:30px;margin:0}a{color:#2563eb;text-decoration:none}
.shell{display:grid;grid-template-columns:260px minmax(0,1fr);direction:rtl;max-width:1700px;margin:auto}
nav{padding:24px 14px;position:sticky;top:0;height:100vh;overflow:auto;align-self:start;border-left:1px solid #e2e8f0}
nav a{display:block;padding:12px;border-radius:8px;margin:3px 0}nav a:hover{background:#eff6ff}
main{min-width:0;padding:20px 32px 80px}section{scroll-margin-top:16px;margin-bottom:50px;background:white;padding:28px;border:1px solid #e2e8f0;border-radius:12px}
h1,h2,h3,h4{line-height:1.6;overflow-wrap:anywhere}h1{font-size:26px}h2{font-size:22px;border-bottom:1px solid #e2e8f0;padding-bottom:10px}
h3{font-size:18px;margin-top:30px}h4{font-size:16px;color:#334155}p,li,td{overflow-wrap:anywhere}
code{font-family:Consolas,monospace;font-size:12px;background:#f1f5f9;border-radius:4px;padding:2px 5px;unicode-bidi:embed}
pre{overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#0f172a;color:#e2e8f0;padding:18px;border-radius:8px;text-align:left;line-height:1.6}
pre code{background:none;color:inherit;padding:0}.table-wrap{width:100%;overflow:auto;margin:18px 0}
table{border-collapse:collapse;width:100%;font-size:13px}th{background:#eff6ff;text-align:right}th,td{padding:10px;border:1px solid #e2e8f0;vertical-align:top}
tr:nth-child(even){background:#f8fafc}blockquote{border-right:4px solid #d97706;background:#fffbeb;margin:16px 0;padding:14px}
summary{cursor:pointer;color:#2563eb;padding:10px}.stats{display:flex;flex-wrap:wrap;gap:12px;font-size:13px}.stats span{background:#1e293b;padding:8px 14px;border-radius:8px}
button{font:inherit;border:1px solid #cbd5e1;background:white;border-radius:8px;padding:9px 15px;cursor:pointer;min-height:44px}.print{margin-top:18px}
@media(max-width:768px){.shell{display:block}nav{position:static;height:auto;display:flex;flex-wrap:wrap;gap:3px;border:0}nav a{font-size:12px;padding:8px}main{padding:8px}section{padding:14px}header{padding:24px 18px}header h1{font-size:24px}}
@media print{nav,.print{display:none}.shell{display:block}main{padding:0}header{background:white;color:black;padding:0}header p{color:#334155}section{border:0;padding:0;break-before:page}pre{background:#f8fafc;color:black}.table-wrap{overflow:visible}table{font-size:9px}}
`;
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>المرجع الرئيسي لهندسة النظام والوظائف</title><style>${css}</style></head><body>
<header><h1>المرجع الرئيسي لهندسة النظام والوظائف</h1><p>مرجع عربي معماري وتشغيلي مستند إلى الشيفرة — تاريخ المراجعة 14-11-2026. يتضمن النتائج وحدود الجاهزية وملاحق الشاشات والبيانات والواجهات.</p>
<div class="stats"><span>${stats.schemaTables} جدولًا</span><span>${stats.pageRegistrations} تسجيل صفحة بما فيها البدائل</span><span>${stats.scannedSourceFiles} ملف مصدر مفحوص للحصر</span></div>
<button class="print" onclick="window.print()">طباعة / حفظ PDF</button></header>
<div class="shell"><nav aria-label="فهرس المرجع">${nav}<p>للبحث داخل الملف استخدم Ctrl+F أو بحث المتصفح. محتوى التعريفات القابل للفتح يظهر بالنقر على عنوانه.</p></nav><main>${contents}</main></div></body></html>`;
fs.writeFileSync(`${dir}/master-system-reference-ar.html`, html);
console.log(JSON.stringify({ file: `${dir}/master-system-reference-ar.html`, bytes: Buffer.byteLength(html) }));
