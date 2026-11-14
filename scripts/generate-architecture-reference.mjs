// Read-only source inventory. Writes documentation only; never connects to a database.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const out = path.join(root, "docs/architecture-reference-ar");
fs.mkdirSync(out, { recursive: true });
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const files = [...walk("client/src"), ...walk("server"), ...walk("shared")]
  .filter(f => /\.(tsx?|mjs)$/.test(f) && !/\.(test|spec)\./.test(f));
const sources = new Map(files.map(f => [f, ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true,
  f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS)]));
const visit = (n, fn) => { fn(n); ts.forEachChild(n, c => visit(c, fn)); };
const text = (n, s) => n?.getText(s) ?? "";
const line = (n, s) => s.getLineAndCharacterOfPosition(n.getStart(s)).line + 1;
const esc = s => String(s).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
const code = s => `\`${esc(s).replace(/`/g, "'")}\``;
const unique = a => [...new Set(a.filter(Boolean))];
const header = title => `# ${title}\n\nهذا جرد ساكن للشيفرة، وليس اختبار تشغيل أو شهادة جاهزية. المسارات الديناميكية تبقى كقوالب صريحة، والمراجع المباشرة لا تعني حصر كل الاعتمادات غير المباشرة.\n\n`;
const write = (name, body) => fs.writeFileSync(path.join(out, name), body);
const schema = sources.get("shared/schema.ts");
const tables = [];
visit(schema, n => {
  if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer)
      && text(n.initializer.expression, schema) === "pgTable") {
    const call = n.initializer;
    const table = { symbol: text(n.name, schema), name: call.arguments[0]?.text,
      line: line(n, schema), definition: text(n, schema), fields: [] };
    const fields = call.arguments[1];
    if (fields && ts.isObjectLiteralExpression(fields)) {
      for (const p of fields.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        const expr = text(p.initializer, schema);
        table.fields.push({ name: text(p.name, schema), definition: expr,
          references: [...expr.matchAll(/references\(\(\)\s*=>\s*(\w+)\.(\w+)([^)]*)/g)].map(m => m[0]) });
      }
    }
    tables.push(table);
  }
});
const symbols = new Map(tables.map(t => [t.symbol, t.name]));
const tableRefs = node => {
  const refs = [];
  visit(node, n => { if (ts.isIdentifier(n) && symbols.has(n.text)) refs.push(symbols.get(n.text)); });
  return unique(refs).sort();
};
let db = header("قاموس قاعدة البيانات والعلاقات — الحصر الكامل");
db += `عدد جداول Drizzle: **${tables.length}**. لكل جدول التعريف الحرفي للحقول، بما فيه القيم الافتراضية وNULL والمراجع وonDelete والفهارس/القيود المحلية.\n\n`;
for (const t of tables) {
  db += `## ${t.name}\n\nالمتغير: ${code(t.symbol)}؛ المصدر: shared/schema.ts:${t.line}.\n\n`;
  db += "| الحقل في TypeScript | تعريف Drizzle: النوع والقيود والقيم الافتراضية |\n|---|---|\n";
  db += t.fields.map(f => `| ${code(f.name)} | ${code(f.definition)} |`).join("\n") + "\n\n";
  db += "<details><summary>تعريف الجدول والفهارس والقيود كما في المصدر</summary>\n\n```typescript\n";
  db += t.definition + "\n```\n\n</details>\n\n";
}
write("database.md", db);

const routes = [];
for (const [file, src] of sources) {
  if (!file.startsWith("server/")) continue;
  visit(src, n => {
    if (!ts.isCallExpression(n) ||
        !(ts.isPropertyAccessExpression(n.expression) || ts.isElementAccessExpression(n.expression))) return;
    const dynamicMethod = ts.isElementAccessExpression(n.expression);
    const method = dynamicMethod ? `DYNAMIC[${text(n.expression.argumentExpression, src)}]` : n.expression.name.text.toUpperCase();
    if (!dynamicMethod && !["GET", "POST", "PUT", "PATCH", "DELETE", "ALL", "USE"].includes(method)) return;
    const receiver = text(n.expression.expression, src);
    if (!/^(app|router)$/.test(receiver)) return;
    const first = n.arguments[0];
    if (!first || !(ts.isStringLiteralLike(first) || ts.isTemplateExpression(first) || (dynamicMethod && ts.isConditionalExpression(first)))) return;
    const endpoint = ts.isStringLiteralLike(first) ? first.text : text(first, src);
    if (!endpoint.includes("/")) return;
    const args = n.arguments.slice(1);
    const guards = args.map(a => ts.isArrowFunction(a) || ts.isFunctionExpression(a)
      ? "inline handler" : text(a, src).slice(0, 300));
    const calls = [];
    visit(n, c => { if (ts.isCallExpression(c)) calls.push(text(c.expression, src)); });
    routes.push({ file, line: line(n, src), method, endpoint, guards,
      tables: tableRefs(n), calls: unique(calls).filter(c => !/^(app|router)\./.test(c)) });
  });
}
routes.sort((a, b) => a.endpoint.localeCompare(b.endpoint) || a.method.localeCompare(b.method));
let api = header("سجل واجهات الخادم والوسطاء — جميع ملفات server");
api += `تم العثور على **${routes.length} تسجيلًا صريحًا**، تشمل USE والقوالب الديناميكية. هذا عدد registrations وليس عدد URLs الفريدة بعد توسيع الحلقات؛ قد ينشئ loop عدة endpoints من تسجيل واحد.\n\n`;
api += "الوسطاء أدناه كما في التسجيل. بعض الصلاحيات يتم فحصها داخل handler أو wrapper؛ عدم ظهور requirePermission هنا لا يثبت أن المسار عام. مراجع الجداول المباشرة لا تشمل كل ما ينفذه storage أو service آخر.\n\n";
for (const r of routes) {
  api += `## ${r.method} ${code(r.endpoint)}\n\n- المصدر: ${r.file}:${r.line}\n- سلسلة الوسطاء/المعالج: ${r.guards.map(code).join(" → ")}\n`;
  api += `- جداول مشار إليها مباشرة: ${r.tables.length ? r.tables.map(code).join("، ") : "لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة."}\n`;
  api += `- الاستدعاءات الظاهرة: ${r.calls.map(code).join("، ")}\n\n`;
}
write("apis.md", api);

const ui = new Map();
const fileApis = new Map();
for (const [file, src] of sources) {
  if (!file.startsWith("client/")) continue;
  const paths = [];
  visit(src, n => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateExpression(n)) {
      const raw = ts.isStringLiteralLike(n) ? n.text : text(n, src);
      if (/\/api\//.test(raw)) paths.push({ value: raw, line: line(n, src) });
    }
  });
  fileApis.set(file, paths);
}
for (const [file, src] of sources) {
  if (!file.startsWith("client/") || !file.endsWith(".tsx")) continue;
  const item = { file, lines: src.text.split("\n").length, imports: [], apis: [], dialogs: [], actions: [], fields: [], labels: [], functions: [] };
  visit(src, n => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) item.imports.push(n.moduleSpecifier.text);
    if (ts.isStringLiteralLike(n) || ts.isTemplateExpression(n)) {
      const raw = ts.isStringLiteralLike(n) ? n.text : text(n, src);
      if (/\/api\//.test(raw)) item.apis.push({ value: raw, line: line(n, src) });
    }
    if (ts.isFunctionDeclaration(n) && n.name) item.functions.push(n.name.text);
    if (!(ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n))) return;
    const tag = text(n.tagName, src);
    const parent = ts.isJsxOpeningElement(n) ? n.parent : n;
    const record = { tag, line: line(n, src), attributes: text(n.attributes, src),
      body: text(parent, src).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 450) };
    if (/^(Dialog|AlertDialog|Sheet|Popover|Drawer)(Content|Title|Description)?$/.test(tag)) item.dialogs.push(record);
    if (/^(Button|button|DialogClose|AlertDialogCancel|DropdownMenuItem|CommandItem)$/.test(tag)) item.actions.push(record);
    if (/^(Input|input|Textarea|textarea|Select|select|Checkbox|Switch|SearchablePicker|DateInput|FormField|RadioGroup|Combobox)$/.test(tag)) item.fields.push(record);
    if (/^(Label|label|FormLabel|TableHead|TabsTrigger|CardTitle)$/.test(tag)) item.labels.push(record);
  });
  ui.set(file, item);
}
const resolveImport = (file, spec) => {
  let base = spec.startsWith("@/") ? `client/src/${spec.slice(2)}`
    : spec.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)) : "";
  return [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`].find(f => sources.has(f));
};
const reach = file => {
  const found = new Set();
  const next = f => {
    if (!f || found.has(f)) return;
    found.add(f);
    const src = sources.get(f);
    if (!src) return;
    visit(src, n => {
      if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
        const target = resolveImport(f, n.moduleSpecifier.text);
        if (target && !target.includes("/ui/")) next(target);
      }
    });
  };
  next(file);
  return [...found];
};
const app = sources.get("client/src/App.tsx");
const componentFiles = new Map();
visit(app, n => {
  if (ts.isImportDeclaration(n) && n.importClause && ts.isStringLiteral(n.moduleSpecifier)) {
    if (n.importClause.name) componentFiles.set(n.importClause.name.text, resolveImport("client/src/App.tsx", n.moduleSpecifier.text));
  }
  if (ts.isVariableDeclaration(n) && n.initializer) {
    let spec;
    visit(n.initializer, c => { if (ts.isStringLiteral(c) && c.text.startsWith("@/")) spec = c.text; });
    if (spec) componentFiles.set(text(n.name, app), resolveImport("client/src/App.tsx", spec));
  }
});
const pages = [];
visit(app, n => {
  if (!(ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n))) return;
  if (!["Route", "ProtectedRoute"].includes(text(n.tagName, app))) return;
  const attrs = Object.fromEntries(n.attributes.properties.filter(ts.isJsxAttribute).map(a =>
    [text(a.name, app), a.initializer && ts.isStringLiteral(a.initializer) ? a.initializer.text : text(a.initializer, app)]));
  if (!attrs.path) return;
  const component = (attrs.component ?? "").replace(/^{|}$/g, "");
  pages.push({ route: attrs.path, component, file: componentFiles.get(component), attrs, line: line(n, app) });
});
let screens = header("الشاشات ومكونات الواجهة والنوافذ والحقول والإجراءات");
screens += `عدد تسجيلات الصفحات الصريحة: **${pages.length}** شاملاً صفحات الدخول والتهيئة والـaliases. لكل شاشة: الملف والحارس، وواجهات API المباشرة وفي المكونات المستوردة. حقول وhandlers ديناميكية موثقة كتعابير المصدر وليست أسماء مترجمة مفترضة.\n\n`;
screens += "## فهرس الشاشات\n\n| المسار | المكوّن | الملف | حراس المسار |\n|---|---|---|---|\n";
screens += pages.map(p => `| ${code(p.route)} | ${code(p.component)} | ${code(p.file ?? "redirect/inline")} | ${code(JSON.stringify(p.attrs))} |`).join("\n") + "\n\n";
const used = new Set();
for (const p of pages) {
  const reachable = p.file ? reach(p.file) : [];
  reachable.forEach(f => used.add(f));
  const components = reachable.filter(f => ui.has(f));
  const apis = reachable.flatMap(f => (fileApis.get(f) ?? []).map(a => `${a.value} — ${f}:${a.line}`));
  screens += `## الشاشة ${code(p.route)} — ${p.component}\n\n`;
  screens += `- نقطة الدخول: ${p.file ?? "إعادة توجيه أو مكوّن داخلي"}؛ تعريف المسار: client/src/App.tsx:${p.line}.\n`;
  screens += `- الحارس: ${code(JSON.stringify(p.attrs))}\n`;
  screens += `- ملفات الواجهة المرتبطة بالاستيراد: ${components.map(code).join("، ") || "لا يوجد ملف مستقل."}\n`;
  screens += `- واجهات API في الشاشة وتبعياتها المحلية: ${unique(apis).map(code).join("؛ ") || "لا يوجد مسار نصّي مباشر؛ افحص hooks/الخدمات أو إعادة التوجيه."}\n\n`;
}
screens += "## قاموس ملفات الواجهة: جميع الصفحات والمكونات\n\nقائمة الملفات غير المرتبطة بصفحة فعالة ليست دليلًا على توفرها للمستخدم؛ قد تكون مكونات قديمة أو تستخدم ديناميكيًا. روابط الاستيراد تشمل shared components، ولا تثبت أن كل زر يظهر في كل حالة أو لكل دور.\n\n";
for (const [file, item] of ui) {
  if (!file.includes("/pages/") && !file.includes("/components/")) continue;
  screens += `### ${file}\n\n- عدد الأسطر: ${item.lines}.\n- ضمن شجرة استيراد صفحة: ${used.has(file) ? "نعم، مع احتمال استخدام مشروط." : "غير مثبت من الاستيرادات الثابتة للصفحات."}\n`;
  screens += `- المكونات الدالية: ${unique(item.functions).map(code).join("، ") || "قد يكون تعريفه متغيرًا أو مكوّنًا مركبًا."}\n`;
  for (const [key, title] of [["dialogs", "النوافذ والحوارات"], ["actions", "الأزرار وعناصر الإجراءات"], ["fields", "الحقول وعناصر الإدخال"], ["labels", "العناوين والتبويبات والأعمدة"]]) {
    if (!item[key].length) continue;
    screens += `\n#### ${title}\n\n| العنصر | السطر | الخصائص واسم الحقل وhandler | النص أو التعبير |\n|---|---|---|---|\n`;
    screens += item[key].map(r => `| ${code(r.tag)} | ${r.line} | ${code(r.attributes)} | ${esc(r.body)} |`).join("\n") + "\n";
  }
  if (item.apis.length) screens += "\n#### API المباشر\n\n" + item.apis.map(a => `- ${code(a.value)} — سطر ${a.line}`).join("\n") + "\n";
  screens += "\n";
}
write("screens.md", screens);
let config = header("ملاحق التنقل والتحقق وقوالب الاستيراد ومسارات العمل");
config += "التعريفات التالية مقتبسة من المصدر الحالي لتوثيق القيم المسموحة والتحقق والحقول الديناميكية. لا تفترض أن قيمة حقل حر مفروضة على مستوى قاعدة البيانات إذا لم يظهر check/enum في قاموس الجداول.\n\n";
for (const [file, src] of sources) {
  const selected = [];
  visit(src, n => {
    if (!ts.isVariableDeclaration(n) || !n.initializer) return;
    const name = text(n.name, src);
    const relevant = file.startsWith("shared/") && (/Schema$|^insert|^PROJECT_|^MODULE_|^RESET_/.test(name)) ||
      file === "shared/data-migration-modules.ts" && name === "dataMigrationModules" ||
      file === "client/src/components/layout/sidebar.tsx" && ["sectionDefinitions", "reportCategoryDefinitions"].includes(name) ||
      file === "server/incident-lifecycle.ts" && ["transitions", "legacyStatusMap"].includes(name) ||
      file === "server/routes.ts" && /^(ITSM_PERMISSIONS|PERSONA_ROLE_PERMISSIONS|PERSONA_PERMISSION_DEFINITIONS)$/.test(name);
    if (relevant) selected.push(n);
  });
  if (!selected.length) continue;
  config += `## ${file}\n\n`;
  for (const n of selected) config += `### ${text(n.name, src)} — ${file}:${line(n, src)}\n\n\`\`\`typescript\n${text(n, src)}\n\`\`\`\n\n`;
}
config += `## المسارات الديناميكية الموسعة يدويًا\n+
هذه التسجيلات تُنشأ بحلقات، وليست endpoints ناقصة. وردت قوالبها في ملحق API:

- POST /api/service-catalog/items؛ PUT /api/service-catalog/items/:id — server/service-catalog.ts:130.
- POST /api/vendor-management/vendors؛ PUT /api/vendor-management/vendors/:id — server/vendor-contracts.ts:247.
- POST /api/vendor-contracts؛ PUT /api/vendor-contracts/:id — server/vendor-contracts.ts:268.
- POST /api/kb/articles/:id/request-review؛ POST /api/kb/articles/:id/approve؛ POST /api/kb/articles/:id/reject — server/knowledge-governance.ts:307.
- GET وPOST /api/incidents/:id/kb-articles؛ GET وPOST /api/service-requests/:id/kb-articles — server/knowledge-governance.ts:500.

## حدود الحصر الآلي

- استخراج TypeScript AST يسجل التعريفات الفعلية في الملفات، لا يختبر تنفيذ handlers ولا يوسّع كل التعبيرات وقت التشغيل.
- عناصر dialogNodes تشمل الحاوية والعنوان والوصف والـPopover، وليست عدد نوافذ مستقلة.
- تكرار زر أو حقل ضمن مكون مشترك لا يعني تكرار الوظيفة في المنتج.
- أي handler يستدعي storage أو service قد يقرأ جداول إضافية غير المذكورة مباشرة في التسجيل؛ العلاقات الكاملة المعلنة موجودة بقاموس البيانات.
- وحدات hooks وlib قد تزود الصفحات بواجهات API؛ تم تتبع الاستيرادات الثابتة المحلية بما فيها ملفات TypeScript غير المرئية، وليس الاستيراد المحسوب ديناميكيًا.
- ملفات الصفحات غير المسجلة في App.tsx أو غير المستوردة من شاشة فعالة تُصنّف «موجودة في المصدر، لم يثبت تفعيلها كمسار».
`;
write("configuration-and-validation.md", config);
const summary = { generatedAt: new Date().toISOString(), scannedSourceFiles: files.length,
  schemaTables: tables.length, pageRegistrations: pages.length, serverRegistrations: routes.length,
  uiFiles: ui.size, dialogNodes: [...ui.values()].reduce((n, v) => n + v.dialogs.length, 0),
  actionNodes: [...ui.values()].reduce((n, v) => n + v.actions.length, 0),
  fieldNodes: [...ui.values()].reduce((n, v) => n + v.fields.length, 0) };
write("inventory.json", JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
