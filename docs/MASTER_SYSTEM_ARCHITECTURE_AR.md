# المرجع الرئيسي لهندسة النظام والوظائف

**تاريخ المراجعة: 14-11-2026.** هذا مرجع للشيفرة الحالية، لا تقرير اختبار إنتاج.

## ملفات المرجع وطريقة استخدامه

اقرأ هذا الملف للتفسير التشغيلي والنتائج، ثم استخدم الملاحق للتفاصيل الدقيقة:

1. [قاموس الشاشات والنوافذ والحقول والإجراءات](architecture-reference-ar/screens.md): المسارات العامة والمحمية، ملفات React، حراس الوصول، استدعاءات API، الأزرار والحقول والحوارات ومراجع الأسطر.
2. [قاموس قاعدة البيانات](architecture-reference-ar/database.md): جميع جداول Drizzle وحقولها وعلاقاتها وقيمها الافتراضية وقيودها وفهارسها المعلنة.
3. [سجل API عبر جميع ملفات الخادم](architecture-reference-ar/apis.md): التسجيلات وHTTP methods والوسطاء والمعالجات ومراجع الجداول المباشرة والاستدعاءات.
4. [التنقل والتحقق وقوالب الاستيراد](architecture-reference-ar/configuration-and-validation.md): التعريفات الدقيقة للقوائم، مخططات Zod، حالات المشاريع، حقول قوالب الاستيراد والمسارات المسجلة بالحلقات.
5. [إحصاءات الحصر](architecture-reference-ar/inventory.json): قياسات الحصر الآلي ووقت إنشائه.

**حدود مهمة:** «موجود في الكود» لا تساوي «مُختبر بالكامل» أو «جاهز للإنتاج 100%». الملاحق تحصر التعريفات الثابتة وتعابير العناصر الديناميكية؛ لا يمكن إثبات جميع حالات النوافذ أو جميع نتائج الصلاحيات بالتفتيش الساكن وحده. لم تُنفذ عمليات كتابة تجريبية على قاعدة البيانات ولم يُشغّل اختبار متصفح لكل شاشة في هذه المراجعة.

## الغرض والنطاق
هذا المرجع يلخص الشيفرة الحالية في المستودع، ويصل بين مسارات الواجهة ومكونات React وواجهات API والجداول ومسارات العمل. تمت مراجعة تعريفات الصفحات في client/src/App.tsx، إعدادات التنقل في client/src/components/layout/sidebar.tsx، مخطط البيانات في shared/schema.ts، تعريف الوحدات في shared/modules.ts، وصلاحيات الأدوار في shared/personas.ts مع تسجيل المسارات في server/routes.ts.

> حالة التنفيذ أدناه مستنتجة من الكود الحالي، وليست شهادة اعتماد أو ضمانًا بأن كل سيناريو مؤسسي تم اختباره في بيئة إنتاج. التوثيق المنفصل قد يصف هدفًا أوسع من الوظائف المثبتة بالكود؛ عند التعارض تكون الشيفرة الفعلية هي المرجع.

## 1. الملخص التنفيذي

التطبيق منصة ويب لإدارة عمليات تقنية المعلومات. بنيته **Modular Monolith**: واجهة React/TypeScript، وخادم Express/TypeScript، وقاعدة PostgreSQL مع Drizzle ORM. الوحدات تشترك في قاعدة الشيفرة والهوية والتدقيق، ويُتحكم في ظهورها والوصول إليها بصلاحيات المستخدم وإعدادات الوحدات.

الأهداف التشغيلية:
- إنشاء سجل مركزي للأصول والموظفين والموردين والمخزون والبنية التحتية.
- تنظيم البلاغات وطلبات الخدمة والتغييرات وموافقات CAB.
- ربط العمليات التقنية بالمشتريات والميزانيات والعقود والمشاريع والمخاطر.
- تحسين إمكانية التتبع عبر الأنشطة وسجلات التدقيق والموافقات.

## 2. البنية التقنية والتشغيل

| الطبقة | التقنية / الدور |
|---|---|
| الواجهة | React 18 وTypeScript، Wouter للمسارات، TanStack Query لجلب البيانات والتخزين المؤقت، Tailwind وshadcn/ui مبنيان على Radix |
| النماذج والتحقق | React Hook Form وZod؛ تُعرّف مخططات التحقق المشتركة عند الحاجة |
| الخادم | Node.js وExpress.js مع TypeScript وواجهات REST تحت /api |
| البيانات | PostgreSQL، Drizzle ORM ومخطط مركزي في shared/schema.ts، مع ملفات migrations |
| التقارير | صفحات تقارير وتصدير، تشمل CSV/XLSX أو PDF/طباعة بحسب الصفحة |
| الدخول | Passport Local مع جلسات PostgreSQL؛ server/auth.ts يستخدم scrypt مع salt عشوائي وtimingSafeEqual، وليس bcrypt كما يذكر بعض التوثيق القديم |
| الأمان | حماية الصفحات وواجهات API، أدوار وصلاحيات دقيقة، حواجز للوحدات المفعّلة، تسجيل تدقيق لبعض الإجراءات |

## 3. الوحدات والترخيص الوظيفي

يحتوي shared/modules.ts على الوحدات التالية، وكلها معرّفة حاليًا كقابلة للتبديل افتراضيًا مفعّلة:

| مفتاح الوحدة | النطاق |
|---|---|
| asset_management | الأصول والموظفون والمخزون والصيانة والمشتريات والمالية وتقارير الأصول |
| cmdb | التطبيقات والخوادم والشبكات والوثائق والنسخ الاحتياطي |
| itsm | البلاغات وطلبات الخدمة والتغييرات والمشكلات وكتالوج الخدمة |
| risk_management | سجل المخاطر وإجراءات التخفيف |
| project_management | المشاريع والمهام والمراحل والخطوط الأساسية والموارد والأصول المرتبطة |

تستخدم واجهة ProtectedRoute وحواجز server-side قيود الوحدة والصلاحيات. تظهر بعض الروابط فقط بحسب الدور والوحدة. توثيق architecture يقول إن بعض الوحدات مستقلة الترخيص، لكن يجب عدم استنتاج استقلال نشر كل وحدة أو حذف جداولها: التطبيق الحالي مخطط قاعدة بيانات واحد ومجموعة شيفرة موحدة.

## 4. خريطة التنقل الجانبي

الأقسام الحالية في sidebar.tsx:

| القسم | الصفحات / المسارات |
|---|---|
| Overview | Dashboard /dashboard؛ Knowledge Base /knowledge-base؛ KPI Dashboard /kpis |
| Employee Support | Portal /portal؛ Service Catalog /service-catalog؛ Approval Queue عبر /service-catalog?tab=approvals |
| My Assets | My Assigned Assets /my-assets |
| Asset Management | Assets /assets؛ Service Contracts /service-contracts؛ Consumables /consumables؛ Employees /employees؛ Access Governance /access-governance؛ Assignments /assignments؛ Handovers /asset-handovers؛ Disposal /asset-disposal؛ Bookings /bookings؛ Asset Requests /asset-requests |
| CMDB & Infrastructure | Applications /applications؛ Servers /servers؛ Network Topology /network-topology؛ Backup & Restore /backup-schedules |
| Organization | Locations /locations؛ Departments /departments |
| Vendors Management | Vendors /vendors |
| Financial | Quotations /finance/quotations؛ Purchase Orders /finance/purchase-orders؛ Purchase Invoices /finance/invoices؛ Purchase Returns /finance/returns؛ Budgets /finance/budgets؛ Contracts /finance/contracts؛ Tax Settings /finance/tax-settings |
| Project Management | Projects /projects؛ Resource Allocation /reports/project-allocations |
| Operations | Maintenance /maintenance؛ Asset Audits /asset-audits |
| IT Service Management | Incidents /incidents و/incidents/tracker؛ Service Requests /service-requests و/service-requests/tracker؛ Problems /problems؛ Changes /changes و/changes/tracker؛ Service Catalog /service-catalog |
| Risk Management & Compliance | Risk Register /risks؛ IT Components & Compliance /reports/hardware-inventory |
| Analytics & Reports | Reports /reports مع فئات تقارير فرعية |
| Tools | Data Migration Center /import؛ Settings /settings |
| Administration | Assignment Groups /admin/assignment-groups |
| System | Users /users؛ Roles /roles؛ Permissions /permissions؛ Dropdowns /system/dropdowns؛ Audit Logs /audit-logs؛ System Settings /system-settings؛ SLA Policies /sla-policies |

## 5. قائمة المسارات والشاشات

المسارات التالية مستخرجة من ProtectedRoute في client/src/App.tsx. المسارات المتعددة التي تشير إلى المكون نفسه هي aliases وليست صفحات مستقلة بالضرورة.

| المسار | مكون الشاشة |
|---|---|
| / | HomeRedirect |
| /dashboard | Dashboard |
| /projects | Projects |
| /projects/:id | ProjectWorkspace |
| /reports/project-allocations | ProjectAllocationsReport |
| /portal | PortalPage |
| /assets | Assets |
| /my-assets | MyAssignedAssets |
| /employees | Employees |
| /access-governance | AccessGovernance |
| /applications | Applications |
| /servers | Servers |
| /network-topology | NetworkTopology |
| /backup-schedules | BackupSchedules |
| /users | Users |
| /roles | Roles |
| /permissions | Permissions |
| /admin/assignment-groups | AssignmentGroups |
| /dropdowns | DropdownManagement |
| /system/dropdowns | DropdownManagement |
| /system-settings | SystemSettings |
| /audit-logs | AuditLogs |
| /assignments | Assignments |
| /asset-handovers | AssetHandovers |
| /locations | Locations |
| /departments | Departments |
| /vendors | Vendors |
| /purchase-orders | PurchaseOrders |
| /finance/quotations | Quotations |
| /finance/purchase-orders | PurchaseOrders |
| /finance/invoices | PurchaseInvoices |
| /finance/returns | PurchaseReturns |
| /finance/tax-settings | FinanceTaxSettings |
| /procure-to-pay | Quotations |
| /consumables | Consumables |
| /inventory | Consumables |
| /budgets | Budgets |
| /finance/budgets | Budgets |
| /maintenance | Maintenance |
| /reports | Reports |
| /reports/enterprise-operations | EnterpriseOperationsReport |
| /reports/personnel | PersonnelDetailReport |
| /reports/employee-directory | PersonnelDetailReport |
| /reports/workload-heatmap | PersonnelDetailReport |
| /reports/account-activity | PersonnelDetailReport |
| /reports/hardware-lifecycle | DepreciationReport |
| /reports/consumables-stock | ConsumablesStockReport |
| /reports/project-variance | PlannedAnalyticsReport |
| /reports/project-velocity | PlannedAnalyticsReport |
| /reports/risk-heatmap | PlannedAnalyticsReport |
| /reports/itsm-mttr | EnterpriseOperationsReport |
| /reports/itsm-sla | EnterpriseOperationsReport |
| /reports/itsm-cab | ChangesReport |
| /reports/asset-summary | AssetSummaryReport |
| /reports/lifecycle | LifecycleReport |
| /reports/hardware-inventory | HardwareInventoryReport |
| /reports/assignments | AssignmentsReport |
| /reports/maintenance | MaintenanceReport |
| /reports/purchase-orders | PurchaseOrdersReport |
| /reports/procurement-finance | ProcurementFinanceReport |
| /reports/budget | BudgetReport |
| /reports/department | DepartmentReport |
| /reports/warranties | WarrantiesReport |
| /reports/vendor-analysis | VendorAnalysisReport |
| /reports/released-assets | ReleasedAssetsReport |
| /reports/depreciation | DepreciationReport |
| /reports/missing-data | MissingDataReport |
| /reports/assignment-history | AssignmentHistoryReport |
| /import | DataMigrationCenter |
| /migration | DataMigrationCenter |
| /settings | Settings |
| /asset-disposal | AssetDisposal |
| /bookings | AssetBookings |
| /contracts | Contracts |
| /finance/contracts | Contracts |
| /service-contracts | ServiceContracts |
| /asset-audits | AssetAudits |
| /asset-requests | AssetRequests |
| /incidents/new | NewIncidentPage |
| /service-requests/new | NewServiceRequestPage |
| /changes/new | NewChangePage |
| /incidents/tracker | IncidentTracker |
| /service-requests/tracker | ServiceRequestTracker |
| /incidents | NewIncidentPage |
| /service-requests | NewServiceRequestPage |
| /reports/tickets | TicketReport |
| /reports/problems | ProblemsReport |
| /reports/changes | ChangesReport |
| /reports/kb-articles | KnowledgeBaseReport |
| /sla-policies | SlaPolicies |
| /knowledge-base | KnowledgeBase |
| /problems | Problems |
| /service-catalog | ServiceCatalog |
| /changes | Changes |
| /changes/tracker | ChangeTracker |
| /risks | RiskManagement |
| /risk-management | RiskManagement |
| /kpis | KpiDashboard |

### ملاحظات على المسارات
- /incidents يفتح نموذج استقبال البلاغ، بينما /incidents/tracker هو مساحة عمل فريق الدعم.
- /service-requests يفتح مسار تقديم الطلب، بينما /service-requests/tracker مساحة متابعة فريق التنفيذ.
- /knowledge-base متاح للمستخدمين المسجلين دون حارس وحدة في App.tsx.
- /inventory و/consumables مساران لنفس مساحة المخزون.
- /purchase-orders و/finance/purchase-orders يشيران إلى صفحة أوامر الشراء نفسها؛ توجد aliases مالية أخرى للعقود والميزانيات.
- المسارات المتخصصة لتباين المشاريع وسرعة المهام وخريطة مخاطر المشاريع تربط حاليًا إلى PlannedAnalyticsReport، ولذلك تصنف كمخططة لا كتقارير تنفيذية مكتملة.

## 6. وظائف الوحدات ومسارات العمل

### 6.1 الموظفون والحوكمة والوصول
**الشاشات:** /employees، /access-governance، /asset-handovers، /my-assets، /audit-logs، /users، /roles، /permissions.

**القدرات المؤكدة من صفحات/جداول/API:** سجل موظفين وحالة عمل؛ مراجعة الإنهاء ومسارات إخلاء العهد؛ حقوق وصول للموظفين؛ تمديد أو سحب بعض الحقوق؛ تسليم العهدة وتوثيق الإقرار؛ إدارة الحسابات والأدوار والصلاحيات؛ استعراض سجل التدقيق.

**طريقة الاستخدام:** ابحث عن الموظف، افتح ملفه، راجع أصوله وحقوق الوصول، أكمل عناصر الإخلاء أو التوثيق، ثم راجع سجل الأنشطة حسب الصلاحية.

**الجداول:** employees، employee_access_rights، employee_offboarding_clearances، users، roles، permissions، user_roles، role_permissions، audit_logs، asset_handovers.

### 6.2 ITAM: الأصول والمخزون والتشغيل
**الشاشات:** /assets، /assignments، /asset-handovers، /asset-disposal، /bookings، /asset-requests، /asset-audits، /consumables، /maintenance.

**الوظائف:** سجل الأصول، تعيين/إرجاع الأصول، الحيازة، الحجز، طلبات الأصول، الصيانة الوقائية وسجلات الصيانة، عمليات جرد الأصول، الاستبعاد، مخزون المواد وحركاته وسجل الصرف وتعديلات المخزون.

**طريقة الاستخدام:** أنشئ أو ابحث عن الأصل؛ سجّل موقعه وحالته؛ خصصه أو أنشئ محضر تسليم؛ استخدم سجل الصيانة عند الإصلاح؛ سجّل صرف أو تحويل المخزون مع الكمية والسبب؛ استخدم سجلات الجرد والاستبعاد للمتابعة.

**الجداول:** assets، assignments، software_license_allocations، asset_handovers، asset_bookings، asset_requests، asset_disposal_records، asset_audit_sessions، asset_audit_items، asset_attachments، asset_relationships، consumables، warehouse_locations، consumable_stock_movements، consumable_dispatch_log، maintenance_schedules، maintenance_records.

### 6.3 ITSM: مكتب الخدمة
**الشاشات:** /portal، /service-catalog، /incidents، /incidents/tracker، /service-requests، /service-requests/tracker، /problems، /changes، /changes/tracker، /sla-policies، /admin/assignment-groups.

**الحوادث:** تسجيل وتصنيف البلاغات، عرض الأولوية والحالة والإسناد والأنشطة، متابعة المسار. يوجد منطق مخصص لدورة حياة الحادث في server/incident-lifecycle.ts.

**طلبات الخدمة:** إدخال طلبات الكتالوج، مسارات الموافقة، الإسناد، المراحل والتنفيذ، بما في ذلك تنفيذ صرف مواد استهلاكية عند توفر الصلاحيات والربط.

**المشكلات:** سجل للمشكلة وربطها بحوادث ذات صلة ومتابعة التفاصيل.

**التغييرات وCAB:** تسجيل التغيير، التصنيف/المخاطر، الإسناد، المراجعة والتصويت، مراحل التنفيذ، الإلغاء/الإكمال ومراجعة ما بعد التنفيذ (PIR) بحسب المسار المتاح.

**طريقة الاستخدام للموظف:** افتح البوابة أو الكتالوج، أرسل طلبًا أو بلاغًا، ثم تابع الحالة.

**طريقة الاستخدام للفني:** افتح tracker، ابحث أو استخدم المرشحات، عيّن مجموعة/موظفًا، حدّث الحالة واكتب ملاحظات الحل أو التنفيذ.

**الجداول:** incidents، incident_activities، service_requests، service_request_activities، service_requests_approvals، problems، problem_incidents، catalog_items، service_catalog_items، changes، change_approvals، change_environment_stages، change_pirs، change_blackouts، assignment_groups، assignment_group_members، sla_policies، service_contracts، tickets والتعليقات/المرفقات التاريخية.

### 6.4 CMDB والبنية التحتية
**الشاشات:** /applications، /servers، /network-topology، /backup-schedules، /reports/hardware-inventory.

**الوظائف:** فهرسة التطبيقات والخوادم، ربط التطبيقات بالخوادم، تسجيل أجهزة الشبكة والمناطق والروابط، إدارة قواعد الجدار الناري ومراجعتها، متابعة تشغيل النسخ الاحتياطي واختبارات الاستعادة، ومراجعة امتثال مكونات التقنية.

**طريقة الاستخدام:** أنشئ سجلًا للتطبيق أو الخادم، أضف العلاقات أو الوثائق، ثم راجع روابط التبعيات ومعلومات الشبكة والنسخ الاحتياطي من المساحات المخصصة.

**الجداول:** cmdb_applications، servers، application_server_links، configuration_documents، network_zones، network_devices، network_device_links، firewall_rules، firewall_rule_reviews، backup_schedules، backup_job_runs، backup_restore_tests، it_component_compliance_reviews.

### 6.5 الموردون والمشتريات والمالية
**الشاشات:** /vendors، /finance/quotations، /finance/purchase-orders، /finance/invoices، /finance/returns، /finance/budgets، /finance/contracts، /service-contracts، /finance/tax-settings.

**الوظائف:** دليل الموردين، عروض الأسعار وبنودها، تحويل العرض إلى أمر شراء، أوامر الشراء ومراحلها، الفواتير والدفعات، المطابقة/الإيصالات، المرتجعات وبنودها، الميزانيات، العقود، إعداد الضرائب وأرقام المستندات.

**مسار العمل المتوقع ضمن الصفحات:** تسجيل المورد والعرض → إنشاء/تحويل أمر شراء → تسجيل فاتورة وربط البنود/الإيصالات → تسجيل الدفع أو حالة الفاتورة → إنشاء مرتجع عند الحاجة. تحقق من سياسة الاستلام المالية الفعلية في الكود والإعدادات قبل تقديم عبارة أن كل فاتورة تُنشئ مخزونًا تلقائيًا في جميع الحالات.

**الجداول:** vendors، vendor_certifications، vendor_contracts، vendor_contract_assets، vendor_contract_purchase_orders، vendor_contract_servers، vendor_quotations، vendor_quotation_items، purchase_orders، purchase_order_items، purchase_order_item_receipts، purchase_invoices، purchase_invoice_items، purchase_invoice_match_lines، purchase_invoice_payments، purchase_returns، purchase_return_items، budgets، contracts، finance_tax_settings، finance_tax_rates، finance_document_sequences، service_contracts.

### 6.6 إدارة المشاريع والمخاطر
**الشاشات:** /projects، /projects/:id، /risks و/changes/tracker.

**الوظائف:** إدارة سجل المشروع ومساحة العمل، مدراء وأعضاء الفرق، المهام، المراحل الرئيسية، خطوط الأساس، الأصول المرتبطة، مخاطر المشروع، ووثائق المشروع أو تغييرات المشروع حسب الواجهة.

**طريقة الاستخدام:** افتح المشروع، راجع الملخص والخطة والفريق، أدر المهام والمراحل والمخاطر، ثم اربط الأصول أو سجّل خط أساس عند صلاحية المستخدم.

**الجداول:** projects، project_baselines، project_managers، project_team_members، project_milestones، project_assets، project_tasks، project_risks، project_changes، project_documents، risk_register، change_risk_links.

### 6.7 المعرفة والتقارير والاستيراد
**قاعدة المعرفة:** /knowledge-base تتيح البحث والتصفح وإدارة المقالات وفق الصلاحيات. توجد مزامنة لدليل النظام من ملفات Markdown في docs/system-manual عبر server/knowledge-manual-sync.ts.

**التقارير:** تشمل صفحات للأصول ودورة الحياة والتخصيص والصيانة والمشتريات والميزانية والضمانات والموردين والتغييرات والمشكلات والمعرفة والتقارير التشغيلية. تقارير المشروع المحددة أعلاه مخططة في الواجهة الحالية.

**استيراد البيانات:** مركز /import موجود، ويستخدم server/data-migration-center.ts مع قوالب shared/data-migration-modules.ts. يدعم CSV وXLSX ومعاينة قبل التأكيد، وله مسارات /api/data-migrations وaliases تحت /api/import؛ الفهرس في القسم 11 أدناه خاص بالتسجيلات المباشرة في routes.ts فقط. جميع التسجيلات في الملفات الأخرى موجودة في ملحق API، وقائمة الكيانات والحقول الحرفية في ملحق التحقق.

## 7. أمن النظام والصلاحيات

| المجال | الآلية الظاهرة في الكود |
|---|---|
| المصادقة | مسارات /auth وPassport/session، وحماية صفحات ProtectedRoute |
| التفويض | صلاحيات دقيقة مثل system_admin، asset_view، ticket_manage، change_approve، finance_view وغيرها |
| أدوار الشخصيات | end_user، it_agent، cab_member، it_manager، auditor؛ مع أسماء بديلة/legacy بحسب shared/personas.ts |
| حواجز الوحدات | requiredModule في الواجهة وrequireModule في API؛ الوحدات المسجلة في shared/modules.ts |
| العرض حسب الدور | sidebar وpersonas.ts يحددان الروابط والصفحات/واجهات API المسموح بها |
| التدقيق | audit_logs وأحداث/أنشطة في مجالات مختلفة؛ لا تفترض أن كل قراءة أو كل تعديل في كل جدول مسجل دون مراجعة التنفيذ الخاص بالمسار |
| إعداد النظام | المستخدمون والأدوار والصلاحيات والوحدات والقوائم المرجعية والإعدادات عبر صفحات الإدارة |

يجب اعتبار الصلاحيات المتحققة من الخادم هي الحماية الفعلية؛ إخفاء رابط في الشريط الجانبي وحده لا يكفي كضابط أمني.

## 8. مراجعة الجاهزية: الموجود والمخطط والفجوات

### موجود بواجهات ومسارات فعلية
- سجل الأصول والتخصيصات والمخزون والصيانة والتسليم والجرد والاستبعاد.
- بوابة وكتالوج خدمة ومساحات ITSM للحوادث والطلبات والمشكلات والتغييرات.
- الموافقات والتصويت ومراحل التغيير وواجهات المجموعات.
- صفحات التطبيقات والخوادم والشبكة والنسخ الاحتياطي.
- صفحات الموردين والاقتباسات وأوامر الشراء والفواتير والمرتجعات والميزانيات والعقود.
- إدارة المشاريع والمهام والمراحل والمخاطر وخطوط الأساس في المخطط والواجهات المخصصة.
- قاعدة معرفة، سجل تدقيق، RBAC، إعداد وحدات، تقارير متعددة.

### مخطط أو يحتاج تحققًا قبل عرضه كوظيفة مكتملة
- تقارير /reports/project-variance و/reports/project-velocity و/reports/risk-heatmap مرتبطة بمكون PlannedAnalyticsReport.
- توجد شاشة تقارير المشروع/تخصيص الموارد؛ لا يعني ذلك أن كل مقاييس PMP/EVM أو كل الرسوم التحليلية المطلوبة مكتملة.
- لا يوجد في مخطط الجداول جدول إطار امتثال عام مستقل باسم compliance_frameworks أو compliance_controls؛ توجد مراجعات امتثال للمكونات وربط ضوابط المقالات، لذلك لا تصف النظام بأنه يطبق ISO أو NCA تلقائيًا أو يمنح شهادة امتثال.
- لا تظهر شاشة تشغيل عامة لكل العمليات اليومية أو Task Runner عام ضمن قسم Operations؛ الصفحات الحالية هناك للصيانة وتدقيق الأصول، بينما النسخ الاحتياطي تحت CMDB.
- أي وصف قديم بأن asset_management وحدة لا يمكن إيقافها غير متوافق مع shared/modules.ts الحالي الذي يعرّفها core=false. كذلك يجب عدم اعتبار الإشارات إلى ISO/NCA أو سجل تدقيق «غير قابل للتغيير» في الدليل إثباتًا لوجود محرك امتثال أو تخزين WORM.
- وثيقة SYSTEM_NAVIGATION_FEATURE_MAP.md أقدم من التنقل الحالي: لا تعكس كل أقسام/vendors، المالية المفصلة، CMDB/backup، assignment groups، وبعض aliases. اعتمد sidebar.tsx وApp.tsx عند تحديث العرض.
- هناك مسارات legacy أو aliases؛ لا تعرضها كصفحات منفصلة إذا كانت تشير إلى المكون نفسه.

## 9. علاقات البيانات الرئيسية

- الموظف يرتبط بالأصول عبر assignments/asset handovers، وبحقوق الوصول والإخلاء الوظيفي.
- الأصل يرتبط بالموقع والمورد والمستخدم/التخصيص والصيانة والمرفقات والضمانات والعلاقات.
- المورد يرتبط بالعروض وأوامر الشراء والعقود والشهادات وبعض الأصول والخوادم.
- بنود أمر الشراء ترتبط بإيصالات وفواتير ومطابقات ومرتجعات.
- التطبيق يرتبط بالخوادم عبر application_server_links، وقد ترتبط تغييرات ITSM بأصول أو عناصر CMDB وبالمخاطر والموافقات.
- الحوادث وطلبات الخدمة لها نشاط/تعليقات/مرفقات وإسناد، وقد ترتبط بسياسات SLA أو اتفاقيات خدمة.
- المشروع يرتبط بمدراء وأعضاء ومهام ومراحل ومخاطر وأصول ووثائق وتغييرات.
- المستخدم يرتبط بالأدوار والصلاحيات؛ صفحات الوصول تتبع قواعد RBAC وحواجز الوحدات.

## 10. فهرس الجداول الكامل من shared/schema.ts

عدد تعريفات pgTable المستخرجة حاليًا: 111. الأسماء كما هي في قاعدة البيانات:

### هوية وصلاحيات وموظفون

- employees
- employee_access_rights
- employee_offboarding_clearances
- locations
- departments
- users
- assignment_groups
- assignment_group_members
- roles
- permissions
- user_roles
- role_permissions
- sessions
- cab_stream_leases
- system_settings
- audit_logs
- system_notifications
- dropdown_options
- settings
- module_settings
- data_migration_batches

### مشاريع ومخاطر

- projects
- project_baselines
- project_managers
- project_team_members
- project_milestones
- project_assets
- project_tasks
- project_risks
- project_changes
- project_documents
- risk_register

### أصول ومخزون وموردون ومالية

- assets
- software_license_allocations
- assignments
- asset_handovers
- vendors
- vendor_certifications
- warehouse_locations
- consumables
- consumable_stock_movements
- consumable_dispatch_log
- vendor_quotations
- vendor_quotation_items
- purchase_orders
- purchase_order_items
- purchase_order_item_receipts
- purchase_invoices
- purchase_invoice_items
- purchase_invoice_match_lines
- purchase_invoice_payments
- purchase_returns
- purchase_return_items
- finance_tax_settings
- finance_tax_rates
- finance_document_sequences
- budgets
- contracts
- maintenance_schedules
- maintenance_records
- vendor_contracts
- vendor_contract_assets
- vendor_contract_purchase_orders
- vendor_contract_servers
- asset_bookings
- asset_disposal_records
- asset_audit_sessions
- asset_audit_items
- asset_relationships
- asset_requests
- asset_attachments

### CMDB وبنية تحتية وامتثال ونسخ احتياطي

- cmdb_applications
- servers
- application_server_links
- network_zones
- it_component_compliance_reviews
- network_devices
- network_device_links
- firewall_rules
- firewall_rule_reviews
- backup_schedules
- backup_job_runs
- backup_restore_tests
- configuration_documents

### ITSM ومعرفة واتفاقيات خدمة

- tickets
- ticket_comments
- ticket_attachments
- sla_policies
- service_contracts
- kb_articles
- kb_article_versions
- kb_article_attachments
- kb_article_control_mappings
- problems
- problem_incidents
- catalog_items
- service_catalog_items
- changes
- change_blackouts
- incidents
- incident_activities
- service_requests
- service_request_activities
- service_requests_approvals
- kb_ticket_links
- change_risk_links
- change_ci_links
- change_asset_links
- change_approvals
- change_environment_stages
- change_pirs

## 11. فهرس مسارات API المسجلة في server/routes.ts

عدد مسارات Express المسجلة مباشرة بصيغة app.method: 323. القائمة أدناه تشمل الطرق HTTP والمسارات كما ظهرت في التسجيل، ولا تعني أن كل مسار متاح لكل دور؛ تطبق المصادقة والصلاحيات وحواجز الوحدة على كل endpoint وفق تعريفه.

### GET

- GET /api/access-governance
- GET /api/access-governance/catalog
- GET /api/alerts
- GET /api/applications
- GET /api/applications/:id/documents
- GET /api/applications/:id/documents/:documentId
- GET /api/applications/:id/servers
- GET /api/asset-audits
- GET /api/asset-audits/:id
- GET /api/asset-audits/:id/items
- GET /api/asset-bookings
- GET /api/asset-bookings/:id
- GET /api/asset-disposal
- GET /api/asset-requests
- GET /api/asset-requests/:id
- GET /api/assets
- GET /api/assets/:id
- GET /api/assets/:id/attachments
- GET /api/assets/:id/depreciation-schedule
- GET /api/assets/:id/license-allocations
- GET /api/assets/:id/relationships
- GET /api/assignment-groups
- GET /api/assignment-groups/eligible-users
- GET /api/assignment-groups/:id/members
- GET /api/assignments
- GET /api/assignments/:id
- GET /api/audit-logs
- GET /api/budgets
- GET /api/catalog/items
- GET /api/catalog/items/:id
- GET /api/changes
- GET /api/changes/calendar
- GET /api/changes/events
- GET /api/changes/:id
- GET /api/changes/:id/approvals
- GET /api/changes/:id/pir
- GET /api/changes/:id/stages
- GET /api/changes/pending-votes
- GET /api/cmdb/application-options
- GET /api/cmdb/change-options
- GET /api/compliance/assets/audit-due
- GET /api/compliance/assets/security-classification/:classification
- GET /api/compliance/assets/status/:status
- GET /api/compliance/dashboard
- GET /api/compliance/vendors/risk/:level
- GET /api/consumables
- GET /api/consumables/options
- GET /api/contracts
- GET /api/contracts/:id
- GET /api/dashboard/executive
- GET /api/dashboard/stats
- GET /api/departments
- GET /api/dropdowns/options
- GET /api/dropdowns/options/:category
- GET /api/employees
- GET /api/employees/:id
- GET /api/employees/:id/access-rights
- GET /api/employees/:id/offboarding-review
- GET /api/finance/document-sequences
- GET /api/finance/tax-rates
- GET /api/finance/tax-settings
- GET /api/import/assets-export
- GET /api/import/template
- GET /api/incidents
- GET /api/incidents/:id
- GET /api/incidents/:id/activity
- GET /api/incidents/options
- GET /api/kpis
- GET /api/locations
- GET /api/maintenance-records
- GET /api/maintenance-schedules
- GET /api/module-settings
- GET /api/module-settings/events
- GET /api/module-status
- GET /api/my/assets
- GET /api/permissions
- GET /api/problems
- GET /api/problems/:id
- GET /api/purchase-invoices
- GET /api/purchase-orders
- GET /api/purchase-orders/:id/match-lines
- GET /api/purchase-orders/:id/receipts
- GET /api/purchase-orders/:id/returnable-assets
- GET /api/purchase-returns
- GET /api/reports/asset-assignments
- GET /api/reports/asset-lifecycle
- GET /api/reports/assets-by-department
- GET /api/reports/asset-summary
- GET /api/reports/assignment-history
- GET /api/reports/assignments
- GET /api/reports/budget
- GET /api/reports/budget-analysis
- GET /api/reports/changes
- GET /api/reports/department
- GET /api/reports/depreciation
- GET /api/reports/expiring-warranties
- GET /api/reports/hardware
- GET /api/reports/hardware-inventory
- GET /api/reports/lifecycle
- GET /api/reports/maintenance
- GET /api/reports/maintenance-schedule
- GET /api/reports/missing-data
- GET /api/reports/problems
- GET /api/reports/procurement-finance
- GET /api/reports/purchase-orders
- GET /api/reports/purchase-orders-v2
- GET /api/reports/released-assets
- GET /api/reports/summary
- GET /api/reports/tickets
- GET /api/reports/vendor-analysis
- GET /api/reports/vendors
- GET /api/reports/warranties
- GET /api/risks
- GET /api/risk-users
- GET /api/roles
- GET /api/roles/:id
- GET /api/servers
- GET /api/servers/:id/applications
- GET /api/servers/:id/documents
- GET /api/servers/:id/documents/:documentId
- GET /api/service-requests
- GET /api/service-requests/:id
- GET /api/service-requests/:id/activity
- GET /api/service-requests/:id/attachments
- GET /api/service-requests/:id/attachments/:attachId
- GET /api/service-requests/:id/consumable-options
- GET /api/settings/:key
- GET /api/sla-policies
- GET /api/system-settings
- GET /api/system/status
- GET /api/system/update-check
- GET /api/system/version
- GET /api/tickets
- GET /api/tickets/:id
- GET /api/tickets/:id/attachments
- GET /api/tickets/:id/comments
- GET /api/tickets/my-assigned
- GET /api/tickets/my-requests
- GET /api/uploads/:filename
- GET /api/users
- GET /api/users/:id
- GET /api/users/:id/permissions
- GET /api/users/:id/roles
- GET /api/vendor-quotations
- GET /api/vendors
- GET /api/vendors/:id
- GET /api/warehouse-locations

### POST

- POST /api/applications
- POST /api/applications/:id/documents
- POST /api/asset-audits
- POST /api/asset-audits/:id/items
- POST /api/asset-bookings
- POST /api/asset-disposal
- POST /api/asset-relationships
- POST /api/asset-requests
- POST /api/asset-requests/:id/approve
- POST /api/asset-requests/:id/fulfill
- POST /api/asset-requests/:id/reject
- POST /api/assets
- POST /api/assets/bulk-update
- POST /api/assets/:id/attachments
- POST /api/assets/:id/license-allocations
- POST /api/assets/:id/license-allocations/:allocationId/release
- POST /api/assignment-groups
- POST /api/assignment-groups/:id/members
- POST /api/assignments
- POST /api/assignments/:id/return
- POST /api/auth/2fa/disable
- POST /api/auth/2fa/enable
- POST /api/auth/2fa/setup
- POST /api/auth/2fa/verify
- POST /api/auth/verify-password
- POST /api/budgets
- POST /api/catalog/items
- POST /api/catalog/items/:id/request
- POST /api/change-blackouts
- POST /api/changes
- POST /api/changes/:id/approvals
- POST /api/changes/:id/assign
- POST /api/changes/:id/cancel
- POST /api/changes/:id/complete
- POST /api/changes/:id/pir
- POST /api/changes/:id/stages/init
- POST /api/changes/:id/start
- POST /api/changes/:id/submit
- POST /api/consumables
- POST /api/consumables/:id/draft-purchase-order
- POST /api/consumables/:id/stock-movement
- POST /api/contracts
- POST /api/departments
- POST /api/dropdowns/cleanup-duplicates
- POST /api/dropdowns/migrate-from-assets
- POST /api/dropdowns/options
- POST /api/dropdowns/seed
- POST /api/employees
- POST /api/employees/:id/access-rights
- POST /api/employees/:id/access-rights/:rightId/extend
- POST /api/employees/:id/access-rights/:rightId/revoke
- POST /api/employees/:id/offboard
- POST /api/employees/:id/reactivate
- POST /api/finance/tax-rates
- POST /api/import/excel
- POST /api/incidents
- POST /api/incidents/:id/to-change
- POST /api/incidents/projects
- POST /api/locations
- POST /api/maintenance-records
- POST /api/maintenance-schedules
- POST /api/problems
- POST /api/problems/:id/link-incident
- POST /api/purchase-invoices
- POST /api/purchase-invoices/:id/payments
- POST /api/purchase-orders
- POST /api/purchase-orders/:id/create-assets
- POST /api/purchase-returns
- POST /api/report-exports/xlsx
- POST /api/risks
- POST /api/roles
- POST /api/servers
- POST /api/servers/:id/documents
- POST /api/service-requests
- POST /api/service-requests/:id/attachments
- POST /api/service-requests/:id/fulfill-consumable
- POST /api/sla-policies
- POST /api/system/seed-data
- POST /api/system/seed-itsm
- POST /api/tickets
- POST /api/tickets/:id/attachments
- POST /api/tickets/:id/cancel-request
- POST /api/tickets/:id/close-request
- POST /api/tickets/:id/comments
- POST /api/tickets/:id/reopen-request
- POST /api/tickets/my-requests
- POST /api/users
- POST /api/users/:userId/roles
- POST /api/vendor-quotations
- POST /api/vendor-quotations/:id/convert-to-po
- POST /api/vendors
- POST /api/warehouse-locations

### PUT

- PUT /api/applications/:id
- PUT /api/asset-audits/:id
- PUT /api/asset-audits/:sessionId/items/:itemId
- PUT /api/asset-bookings/:id
- PUT /api/asset-disposal/:id
- PUT /api/asset-requests/:id
- PUT /api/assets/:id
- PUT /api/assignment-groups/:id
- PUT /api/assignments/:id
- PUT /api/budgets/:id
- PUT /api/catalog/items/:id
- PUT /api/change-blackouts/:id
- PUT /api/changes/:changeId/approvals/:approvalId
- PUT /api/changes/:id
- PUT /api/changes/:id/pir
- PUT /api/changes/:id/stages/:stageId
- PUT /api/contracts/:id
- PUT /api/departments/:id
- PUT /api/dropdowns/options/:id
- PUT /api/employees/:id
- PUT /api/employees/:id/access-rights/:rightId
- PUT /api/finance/document-sequences/:documentType
- PUT /api/finance/tax-rates/:id
- PUT /api/finance/tax-settings
- PUT /api/incidents/:id
- PUT /api/locations/:id
- PUT /api/maintenance-records/:id
- PUT /api/maintenance-schedules/:id
- PUT /api/module-settings/:moduleKey
- PUT /api/problems/:id
- PUT /api/purchase-invoices/:id/status
- PUT /api/purchase-orders/:id
- PUT /api/risks/:riskId
- PUT /api/roles/:id
- PUT /api/servers/:id
- PUT /api/service-requests/:id
- PUT /api/settings/:key
- PUT /api/sla-policies/:id
- PUT /api/system-settings
- PUT /api/tickets/:id
- PUT /api/users/:id
- PUT /api/vendor-quotations/:id/status
- PUT /api/vendors/:id
- PUT /api/warehouse-locations/:id
- PUT /api/warehouses/:id

### PATCH

- PATCH /api/consumables/:id
- PATCH /api/incidents/:id
- PATCH /api/incidents/:id/assignment
- PATCH /api/incidents/:id/status
- PATCH /api/service-requests/:id/approval
- PATCH /api/service-requests/:id/assignment
- PATCH /api/service-requests/:id/close
- PATCH /api/service-requests/:id/stage
- PATCH /api/warehouse-locations/:id

### DELETE

- DELETE /api/asset-bookings/:id
- DELETE /api/asset-relationships/:id
- DELETE /api/assets/:id
- DELETE /api/assets/:id/attachments/:attachId
- DELETE /api/assignment-groups/:id/members/:userId
- DELETE /api/assignments/:id
- DELETE /api/budgets/:id
- DELETE /api/catalog/items/:id
- DELETE /api/change-blackouts/:id
- DELETE /api/changes/:changeId/approvals/:approvalId
- DELETE /api/changes/:id
- DELETE /api/contracts/:id
- DELETE /api/departments/:id
- DELETE /api/dropdowns/options/:id
- DELETE /api/employees/:id
- DELETE /api/locations/:id
- DELETE /api/maintenance-records/:id
- DELETE /api/maintenance-schedules/:id
- DELETE /api/problems/:id
- DELETE /api/problems/:id/link-incident/:ticketId
- DELETE /api/purchase-orders/:id
- DELETE /api/quotations/:id
- DELETE /api/roles/:id
- DELETE /api/sla-policies/:id
- DELETE /api/tickets/:id
- DELETE /api/tickets/:id/attachments/:attachId
- DELETE /api/users/:id
- DELETE /api/users/:userId/roles/:roleId
- DELETE /api/vendor-quotations/:id
- DELETE /api/vendors/:id

## 12. طريقة التعامل اليومية حسب الدور

### الموظف
1. تسجيل الدخول وفتح /portal أو /service-catalog.
2. اختيار الخدمة وتعبئة النموذج وإرساله.
3. متابعة الطلب أو البلاغ من الصفحات الشخصية.
4. الاطلاع على الأصول المسندة وقاعدة المعرفة عند توفر الوحدة والصلاحية.

### فني الدعم
1. فتح Incident Tracker أو Request Tracker.
2. استخدام البحث والمرشحات لتحديد العنصر.
3. مراجعة النشاط والمرفقات، ثم تحديد المجموعة والموظف المسؤول.
4. تحديث المرحلة وتسجيل ملاحظات الحل أو التنفيذ.

### مدير الأصول/المشتريات
1. البحث أو إنشاء الأصل/المورد/المستند المالي.
2. إدارة العرض وأمر الشراء والفاتورة والدفعة/المرتجع حسب تسلسل العمل.
3. متابعة المخزون والصيانة والعقود وتقارير الأصول.

### مدير المشروع
1. فتح المشروع ومساحة العمل.
2. تنظيم أعضاء الفريق والمهام والمراحل ومخاطر المشروع.
3. تسجيل خط أساس أو مراجعة الفروقات إذا كانت الوظيفة متاحة ومفعلة.

### المدقق/مدير النظام
1. مراجعة سجلات التدقيق أو الامتثال والنسخ الاحتياطي وفق الصلاحية.
2. إدارة الأدوار والصلاحيات والقوائم المرجعية والوحدات.
3. التحقق من أن النتائج المعروضة للتقارير مبنية على بيانات فعلية وليست صفحات Planned.

## 13. توصيات تحريرية للعرض التقديمي

- استخدم وصف «منصة موحدة لإدارة عمليات تقنية المعلومات» بدل «نظام امتثال كامل».
- افصل بين قدرات ITAM وITSM وCMDB وProject Management وRisk Management في العرض.
- اعرض التدفق التشغيلي عبر مثال واحد: طلب خدمة أو تغيير، ثم إسناد وموافقة، مع إظهار الأصول/البنية المتأثرة.
- عند عرض مؤشرات الإدارة، اذكر مصدر البيانات وفترة القياس؛ لا تعرض قيمة KPI افتراضية على أنها نتيجة فعلية.
- ضع شارة «مخطط/قيد التطوير» على تقارير المشروع التي تفتح PlannedAnalyticsReport.
- لا تدّعِ اعتماد ISO أو NCA أو ZATCA لمجرد وجود حقول أو صفحات لإدارة تلك المعلومات.

## 14. التفسير التفصيلي للشاشات وعمليات المستخدم

تسميات النوافذ والحقول وhandlers كما هي في React مذكورة لكل ملف في ملحق الشاشات؛ الجدول التالي يفسر المقصود منها تشغيليًا، ولا يمنح الأزرار لكل الأدوار.

| الشاشة | الاستخدام والخيارات الأساسية | مصدر البيانات الرئيسي |
|---|---|---|
| Auth /auth | إدخال اسم المستخدم وكلمة المرور، إظهار/إخفاء كلمة المرور، رسائل الخطأ وحالة الدخول؛ تحقق 2FA عند تفعيله | /api/login و/api/user؛ users وsessions |
| Initialize /initialize | تهيئة النظام حسب شروط الواجهة والخادم؛ ليست صفحة عمل يومية | /api/system/status، seed-data |
| Dashboard /dashboard | نقطة دخول موحدة؛ محتوى وملخصات بحسب الشخصية والصلاحية والوحدة، لا يعني الدخول للشاشة منح حق قراءة كل KPI تنفيذي | /api/dashboard/stats، /api/dashboard/executive، alerts |
| KPI /kpis | عرض مؤشرات تشغيلية؛ يجب التمييز بين مؤشرات tickets القديمة وتحليلات incidents الحديثة | /api/kpis |
| Portal /portal | واجهة الموظف لتقديم ومتابعة الطلبات والبلاغات والوصول إلى الخدمات والمعرفة والعهد المتاحة | tickets الشخصية، service catalog، my-assets |
| Service Catalog /service-catalog | عرض العناصر، طلب خدمة عبر حقول ديناميكية، تحرير العناصر للجهة المخولة، قائمة موافقات لمن يملك الحق | service_catalog_items، catalog_items، service_requests_approvals |
| New Incident /incidents/new | نموذج بلاغ كامل؛ مستخدم متأثر/طلب بالنيابة وفق الصلاحية؛ روابط اختيارية ومعلومات أثر وأولوية | incidents/options، POST incidents |
| Incident Tracker /incidents/tracker | بحث متعدد الحقول؛ نطاق شخصي/مسند/شامل حسب الصلاحية؛ مرشحات حالة ومسؤول؛ تفاصيل وإسناد وتحويل حالة | incidents، incident_activities |
| New Request /service-requests/new | استقبال طلب خدمة مع بيانات الطلب/الكتالوج والمواعيد والمستفيد | service_requests، catalog |
| Request Tracker /service-requests/tracker | متابعة الطلبات والموافقة/التنفيذ/الإسناد والمرفقات والصرف عند انطباقه | service_requests وactivities وapprovals |
| Problems /problems | سجل المشكلات وتفاصيل تحليل السبب والحل المؤقت وربط الحوادث | problems، problem_incidents |
| New Change /changes/new | إدخال RFC وخطة التنفيذ والتراجع والاختبار والموعد والربط المتاح | changes وchange CI/asset links |
| Changes /changes | تحرير ومراجعة التغيير، CAB، مراحل التنفيذ، PIR، تشغيل إجراءات submit/start/complete/cancel حسب الحالة | changes وموافقاته ومراحله |
| Change Tracker /changes/tracker | متابعة محفظة التغييرات وحالاتها والمخاطر المرتبطة | changes، risk_register، change_risk_links |
| SLA Policies /sla-policies | سياسات SLA وهدف الاستجابة والحل ومجال التطبيق؛ صفحة إدارية | sla_policies |
| Assignment Groups /admin/assignment-groups | إنشاء/تحرير مجموعة، تفعيلها وعضوية الفنيين؛ العضوية تؤثر على اختيار المسؤول | assignment_groups وmembers |
| Assets /assets | البحث والتصفية؛ إضافة/تعديل وتفاصيل الأصل؛ اختيار نوع الأصل والخصائص، التراخيص والتخصيصات والبيانات المالية والمرفقات حسب النوع | assets؛ license allocations؛ attachments |
| My Assets /my-assets | عرض عهد الموظف وأصوله ضمن النطاق المصرح | /api/my/assets |
| Assignments /assignments | تخصيص الأصل للموظف ومراجعة التخصيص وتسجيل الإرجاع | assignments |
| Handovers /asset-handovers | محضر إصدار/إرجاع/استبدال؛ اختيار الموظف والأصل والحالة والملحقات، عرض إيصال وإقرار | asset_handovers، my/asset-handovers |
| Consumables /consumables | الأصناف والأرصدة ومواقع المستودعات؛ صرف/تحويل؛ تعديل مخزون بسبب؛ إعداد/تعطيل مستودع؛ إنشاء طلب شراء مسودة للصنف حسب الصلاحية | consumables؛ warehouse_locations؛ stock_movements؛ dispatch_log |
| Asset Requests /asset-requests | طلب أصل ثم اعتماد/رفض/تنفيذ لدى المسؤول | asset_requests |
| Bookings /bookings | حجز أصل لفترة ومتابعة حالته وتعديل بيانات الحجز | asset_bookings |
| Disposal /asset-disposal | سجل الاستبعاد وسببه وطريقته وبياناته؛ لا يثبت بمفرده محوًا آمنًا لوسيط التخزين | asset_disposal_records |
| Maintenance /maintenance | جداول الصيانة، تسجيل أعمال الصيانة، التكلفة المقدرة والفعلية والمواعيد والتكرار؛ البحث والتصفية والتقارير المتاحة | maintenance_schedules، maintenance_records |
| Asset Audits /asset-audits | جلسة جرد وعناصر مراجعة ونتائج كل أصل | asset_audit_sessions، asset_audit_items |
| Employees /employees | سجل نشط/معطل؛ إنشاء وتعديل؛ إدارة الوصول؛ مراجعة إخلاء الطرف ثم إيقاف/إعادة تفعيل | employees؛ access_rights؛ clearances |
| Access Governance /access-governance | مراجعة الحقوق حسب الموظف أو النظام؛ منح/تعديل امتياز؛ تاريخ انتهاء ومبرر؛ تمديد وسحب | employee_access_rights؛ catalog |
| Applications /applications | فهرس التطبيقات ومسؤوليها وأهميتها ونمط الاستضافة، البنية المستضيفة والوثائق | cmdb_applications، application_server_links |
| Servers /servers | اسم مضيف وIP ونظام تشغيل وبيئة ومواصفات؛ التطبيقات المستضافة ووثائق التهيئة | servers، links، configuration_documents |
| Network /network-topology | مناطق وأجهزة وروابط وقواعد Firewall ومراجعاتها؛ تسجيل ومراجعة وليست إدارة تلقائية للأجهزة الحقيقية | network_*، firewall_* |
| Backups /backup-schedules | جداول وسياسات احتفاظ وسجلات تشغيل واختبار استعادة؛ تسجيل أدلة لا تنفيذ نسخ آلي | backup_schedules، backup_job_runs، backup_restore_tests |
| Vendors /vendors | دليل وبحث وفلاتر؛ إضافة/تعديل؛ ملف 360°؛ أصول وعقود وشهادات ومؤشرات أداء | vendors؛ vendor-contracts؛ vendorCertifications |
| Quotations /finance/quotations | عرض سعر وبنود مخصصة/كتالوج؛ تعديل حالة؛ تحويل إلى PO؛ حذف مع مراعاة الروابط | vendor_quotations، vendor_quotation_items |
| Purchase Orders /finance/purchase-orders | إنشاء/تعديل/نسخ ومراجعة حالات PO؛ مصدر عرض السعر والبيانات المالية والبنود | purchase_orders، items |
| Invoices /finance/invoices | فاتورة مورد وربط PO ومطابقة بنود وكميات؛ تسجيل دفعات وحالة الفاتورة؛ الاستلام التلقائي المشروط أدناه | purchase_invoices، match_lines، items، payments |
| Returns /finance/returns | ربط مصدر الشراء/الفاتورة، تحديد كميات وسبب، رصيد دائن ومخزون مرتجع | purchase_returns، items؛ inventory transactions |
| Tax Settings /finance/tax-settings | إعدادات ضريبة ومعدلات ومناطق وشامل/غير شامل وتسلسل أرقام المستندات | finance_tax_settings، rates، sequences |
| Budgets /finance/budgets | موازنات وفترة وإدارة/مركز تكلفة وعرض الاستخدام حسب البيانات | budgets وروابط المشتريات |
| Contracts /finance/contracts | سجل العقود المالية/الموردين ومواعيدها وأطرافها | contracts؛ لا تخلط مع service_contracts |
| Service Contracts /service-contracts | رقم واسم عقد دعم، مشروع وسياسة SLA وتواريخ وإشعار تجديد وحالة | service_contracts؛ projects؛ sla_policies |
| Projects /projects | محفظة مشاريع؛ بحث وفلاتر؛ إضافة/تعديل مدراء وفريق ومراحل وأصول | projects وproject_* |
| Project Workspace /projects/:id | Overview، Tasks، Risks، Changes، Documents، Support & SLA بحسب الحواجز | project-management وproject-workspace APIs |
| Resource Allocation /reports/project-allocations | متابعة موارد ومهام وساعات وتوزيع الفريق من مصدر المشاريع | /api/reports/project-allocations |
| Risks /risks | سجل مؤسسي مستقل للمخاطر والملكية والتقييم والتخفيف | risk_register |
| Knowledge /knowledge-base | بحث وفئات، مقال، نسخ ومرفقات وربط ضوابط؛ نشر/مراجعة وفق الحق؛ أدلة النظام محمية | kb_articles وversions وattachments وcontrol_mappings |
| Reports /reports | فئات قابلة للفتح ثم تقارير فرعية؛ علامة Planned عند عدم التنفيذ | components/routes الخاصة بكل تقرير |
| Migration /import | تحديد كيان؛ تحميل قالب؛ رفع CSV/XLSX؛ معاينة أخطاء؛ تأكيد وسجل نتائج | data_migration_batches وواجهات الاستيراد |
| Settings /settings | تفضيلات وإعدادات متاحة للمستخدم، 2FA، إعدادات وحدات للمخول | settings، module_settings، auth/2fa |
| System Settings /system-settings | إعدادات عامة ومعرفات النظام وعمليات الإدارة المتاحة ومنها clear-data | system_settings و/api/system/clear-data |
| Users /users | حسابات وأدوار وحالة مستخدم؛ يختلف عن سجل الموظفين | users وuser_roles |
| Roles /roles وPermissions /permissions | تعريف الأدوار وإسناد الصلاحيات وفهرسها | roles، permissions، role_permissions |
| Dropdowns /system/dropdowns | قوائم مرجعية وفئات وقيم وحالة وترتيب؛ منع التكرار حسب قواعد الخادم | dropdown_options |
| Audit Logs /audit-logs | البحث والتصفية وعرض من قام بالإجراء والسجل القديم والجديد بحسب ما سجله handler | audit_logs |
| Locations وDepartments | إدارة المواقع والأقسام المرجعية؛ ليست إدارة مؤسسة/مستأجر مستقل | locations، departments |

## 15. الدقة التشغيلية لمسارات العمل

### 15.1 الحوادث والأولويات وSLA

المصدر الأساسي: server/incident-lifecycle.ts:6–159، server/routes.ts لمسارات incidents، server/storage.ts لحساب المواعيد والسياسات.

المسارات المسموحة كما في خدمة الانتقال:

| الحالة الحالية | الانتقالات المسموحة |
|---|---|
| New | In Progress |
| In Progress | Pending أو Resolved |
| Pending | In Progress أو Resolved |
| Resolved | In Progress لإعادة الفتح، أو Closed |
| Closed | لا انتقال مسجل في هذه الخدمة |

- الأولويات التشغيلية P1–P4 لها ربط مع قيم critical/high/medium/low في مسارات حساب SLA؛ توجد نماذج legacy، لذلك لا تفترض أن جميع التقارير تستخدم الجدول نفسه.
- الانتقال إلى Resolved أو Closed يتطلب category وresolutionCode وresolutionNotes؛ يسجل resolvedAt/closedAt حسب الانتقال.
- الخدمة تقفل سجل الحادث وتكتب تحديثه ونشاطه في transaction، وترد بتعارض عند الحالة غير المسموحة.
- firstRespondedAt يُسجل عند New → In Progress إذا لم يكن محفوظًا.
- يحسب سجل النشاط Response SLA وResolution SLA من المواعيد؛ عند التجاوز يضيف «SLA escalation required». هذه إشارة تدقيقية وليست بذاتها إرسال إشعار للفريق.
- يوجد job كل خمس دقائق في server/index.ts:170–242 لتصعيد tickets القديمة وإضافة تعليق؛ لا تنسب هذا تلقائيًا إلى كل مسار incidents الجديد.
- عند ربط مشروع، توجد خدمة server/incident-contract-resolution.ts لفحص عقد دعم فعال وسياسة SLA؛ الصلاحية الزمنية وحالة العقد جزء من القرار، وليست كل عقود الشراء عقود دعم.

### 15.2 التغييرات وCAB

التدفق التشغيلي: إدخال RFC → إرساله → مراجعة/موافقات CAB → تنفيذ المراحل حسب الحالة → إكمال → مراجعة ما بعد التنفيذ.

- الجداول تفصل change_approvals عن changes وعن change_environment_stages وchange_pirs.
- هناك روابط عناصر CI وأصول ومخاطر، وجداول فترات حظر تغيير change_blackouts.
- يوجد تقويم ومسارات pending-votes وevents؛ SSE وتنسيق CAB مدعومان بملفات cab-events/cab-gate وleases.
- لا تصف آلية CAB بأنها «إجماع أو أغلبية حسب اختيار العميل» دون إثبات إعداد السياسة الفعلي؛ تعريف الموافقات في الكود هو المرجع، لا نص الدليل وحده.
- تغييرات المشروع project_changes مسار مستقل عن changes الخاص بـITSM؛ لا تخلط بينهما في مخطط البيانات.

### 15.3 المشاريع: التخطيط والتنفيذ والتسليم

المصدر: shared/project-management.ts، server/project-management.ts، server/project-workspace.ts، components/projects.

- حالة المشروع: Planning، Active، On Hold، Completed، Cancelled.
- الصحة: On Track، At Risk، Delayed.
- المهام: Backlog، To Do، In Progress، In Review، Done؛ الأولويات Low/Medium/High/Critical.
- المراحل: Pending، In Progress، Completed، Delayed؛ تحقق تواريخ المشروع والمراحل موضح حرفيًا في ملحق Zod.
- مدراء متعددون مع مدير أساسي، وأعضاء فريق بأدوار؛ زمن تقديري ووقت مسجل للمهام.
- وثائق المشروع لها فئات Charter وSOW وArchitecture وHandover وOther. وجود Handover كفئة وثيقة ليس بوابة توقيع تسليم مستقلة.
- Lock Baseline محكوم بصلاحية مدير المشروع المعين أو مسؤول؛ النسخ تبدأ v1.0 ثم يزداد الجزء الثاني.
- Budget Variance = baselineBudget − actualSpend؛ Budget Change = currentBudget − baselineBudget.
- Schedule Variance Days = تاريخ النهاية المعتمد − تاريخ النهاية الفعلي إن وجد وإلا الهدف الحالي. الموجب يعني نهاية أبكر، وليس Schedule Variance بالقيمة المكتسبة EV−PV.
- لا يوجد في هذا الحساب محرك EVM كامل يثبت EV/PV/AC أو CPI/SPI أو توقع EAC/ETC.
- مخاطر المشروع: Probability وImpact من 1 إلى 5؛ تقييم متبقٍ واختياري، وخطة طوارئ وتاريخ مراجعة ومالك وتخفيف. حقول mitigation/contingency/owner في مخطط الإدخال تسمح بالاختيارية، فلا تعرضها كمتطلبات إجبارية شاملة.
- تغييرات المشروع: Draft → Submitted → Approved/Rejected → Implemented، مع إعادة Rejected إلى Draft. مدير المشروع يمكنه الإرسال والاعتماد وفق المسار الحالي؛ لا توجد هنا ضمانة فصل مستقل بين طالب التغيير ومعتمده.

### 15.4 المخزون والمالية: الشروط الفعلية للاستلام

المصدر: server/routes.ts:6945–7130 وserver/procurement-inventory.ts.

1. تحويل عرض السعر ينشئ PO مسودة؛ لا ينشئ مخزونًا عند التحويل وحده.
2. عند حفظ فاتورة، يتحقق الخادم من المورد وأمر الشراء والبنود والكميات والأسعار والمجاميع المحسوبة.
3. يجمع الكميات المطابقة عبر الفواتير غير الملغاة. عند اكتمال **مطابقة جميع كميات أمر الشراء** يُشغّل استلام المخزون.
4. إذا كان PO في ordered، يتحول إلى received؛ ثم تنشأ إيصالات/أصول أو تزداد كميات المستهلكات بحسب نوع البند.
5. الدفع واعتماد/حالة الفاتورة لهما إجراءات مستقلة؛ اكتمال المطابقة المحاسبية هنا ليس شهادة استلام مادي مستقلة من أمين مستودع.
6. المرتجعات تتحقق من البنود والكميات والعلاقات وتنتج أثرًا على المخزون/الأصول والرصيد الدائن بحسب التنفيذ. الرصيد الدائن يخفض المستحق ولا يعني دفعة نقدية للمورد.

هذا التصميم يربط invoice-driven receiving بالمطابقة؛ إن كانت سياسة العميل تتطلب فصل طلب الشراء والاعتماد والاستلام الفعلي والمحاسبة، فهذه ضوابط يجب تقييمها وتوسيعها، لا وصفها بأنها مضمونة حاليًا.

### 15.5 الضرائب وZATCA

توجد إعدادات منطقة وضريبة وقيم شاملة/غير شاملة ونسب متعددة وتسلسل مستندات. تدعم shared/procurement-pricing.ts الحساب والخصومات وتوزيعها والتقريب.

**غير مثبت من ذلك:** إرسال فاتورة إلكترونية إلى ZATCA، شهادة توقيع، تسوية/إبلاغ إلكتروني، إقرار ضريبي، أو دفتر أستاذ محاسبي مزدوج. لا تستخدم «متوافق مع ZATCA بالكامل» في المحتوى التجاري.

### ملاحظة تمييز أنواع العقود في API

صفحة /service-contracts لا تستخدم namespace مستقلًا باسم /api/service-contracts. عقود الدعم والعقود المالية تتشارك /api/contracts، ويميز الخادم الطلب عبر kind=service ومعلمات/حقول أخرى في isServiceContractApiRequest. تستخدم الواجهة ذلك عند القراءة؛ كما يختار requireContractPermission مجموعة الصلاحيات بحسب نوع الطلب. لذلك لا يكفي توثيق /api/contracts كـCRUD لجدول واحد، ويجب عدم اعتبار رقم عقد الدعم الصحيح رقم عقد مالي متطابقًا تلقائيًا.

### 15.6 الشبكات والنسخ الاحتياطي والعمليات

- قسم Operations في sidebar يحتوي Maintenance وAsset Audits فقط.
- Network Topology وBackup & Restore تحت CMDB & Infrastructure.
- قواعد Firewall ومراجعاتها سجلات حوكمة؛ لم يثبت موصل يطبق السياسات على جهاز الشبكة.
- Backup Schedules يحفظ الجداول والاحتفاظ، وPOST runs/restore-tests يسجل النتائج والأدلة وتواريخ المتابعة. ليس محرك نسخ احتياطي أو Restore آليًا، ولا يثبت نجاح النسخ خارج البيانات المسجلة.
- حفظ اختبار استعادة مع نتيجة وإثبات يختلف عن تشغيل اختبار فعلي على نظام مستقل.
- لم يثبت وجود وحدة عامة لـDaily Technical Checklists أو مشغل عمليات عام؛ جرد الأصول ليس بديلًا تلقائيًا لقوائم تشغيل يومية.

### 15.7 استيراد CSV وXLSX

المصدر: shared/data-migration-modules.ts وserver/data-migration-center.ts.

- حساب مدير/مسؤول وبوابة الوحدة مطلوبة. القوالب تحدد أسماء الأعمدة والإلزامية والنوع والقيم المرجعية لكل كيان.
- صيغ الرفع: CSV وXLSX. لا يدعم هذا parser ملفات JSON كصيغة رفع عامة.
- حد الملف 10 MB، والدفعة حتى 5,000 صف، وصلاحية المعاينة ساعة، وعرض المعاينة محدود بعدد أولي من الصفوف.
- التحقق يشمل الرؤوس والتكرار والأنواع والتواريخ والمراجع والأذونات/قواعد المجال بحسب الكيان.
- تأكيد الاستيراد صريح، والدفعة مرتبطة بالمستخدم والوحدة والحالة؛ يعيد الخادم التحقق ويمنع معاينة منتهية/غير مطابقة.
- الاستيراد قد ينجح جزئيًا على مستوى الصفوف مع تسجيل الأخطاء؛ لا تعد المستخدم بأن كل الدفعة «كلها أو لا شيء».
- استيراد Employees لا يعني إنشاء حقوق دخول جديدة؛ واستيراد KB أو catalog لا يجوز تفسيره كتجاوز ضوابط النشر والموافقات.
- قائمة الكيانات وحقول كل قالب بالكامل موجودة في ملحق configuration-and-validation، وليس فقط الأصول.

### 15.8 قاعدة المعرفة ودليل النظام

- المصدر الحالي هو kb_articles، وليس جدولًا مستقلًا باسم knowledge_base.
- is_system_guide يحمي دليل المستودع، وتقرأ المزامنة Markdown من docs/system-manual.
- نسخ المقالات في kb_article_versions، والمرفقات في kb_article_attachments، وربط الضوابط في kb_article_control_mappings.
- روابط المقالات بالحوادث/الطلبات في kb_ticket_links. تتطلب الروابط حالة نشر مناسبة وفق المعالج.
- «عام» في سياق المقالات يعني متاحًا لموظفي المؤسسة المسجلين ضمن السياسة، وليس بالضرورة موقعًا متاحًا للإنترنت.
- أسماء فئات الدليل قد تختلف عن تبويبات Policies/Technical SOPs/User Guides/KEDB؛ تعبير المطابقة في الشاشة والخادم هو المرجع.

## 16. خريطة التقارير ومصادرها وحدودها

| المسار/العائلة | المصدر/المكون | الحالة والحدود |
|---|---|---|
| /reports | reports-dashboard.tsx؛ فئات وتنقل | Hub للتقارير، ليس بيانات تحليلية مستقلة بحد ذاته |
| /reports/employee-directory، workload-heatmap، account-activity، personnel | PersonnelDetailReport؛ server/personnel-report.ts | تشترك في مكون واحد؛ اختلاف التبويب/المسار لا يعني تقارير مستقلة تمامًا |
| /reports/project-allocations | ProjectAllocationsReport؛ project-workspace API | تقرير موارد موجود |
| /reports/project-variance | PlannedAnalyticsReport | Planned، رغم وجود مقارنة baseline داخل المشروع |
| /reports/project-velocity | PlannedAnalyticsReport | Planned |
| /reports/risk-heatmap | PlannedAnalyticsReport | Planned، لا تخلطه بسجل تقييم المخاطر |
| /reports/enterprise-operations | EnterpriseOperationsReport؛ /api/enterprise-reporting/operations وaudit-events | MTTR حسب الأولوية وSLA/backlog/workload وبيانات أصول/عقود حسب الوحدة والصلاحية |
| /reports/itsm-mttr وitsm-sla | المكون التشغيلي نفسه | aliases/مداخل إلى التحليل التشغيلي، ليست بالضرورة تطبيقين منفصلين |
| /reports/itsm-cab وchanges | ChangesReport؛ /api/reports/changes | حالات/أنواع/مخاطر وتفاصيل تغييرات وموافقات وفق API |
| /reports/procurement-finance | ProcurementFinanceReport؛ /api/reports/procurement-finance | إنفاق ومستحقات ومدفوعات ومرتجعات؛ العملات لا يجوز جمعها دون تحويل معرف |
| /reports/hardware-inventory | HardwareInventoryReport؛ server/it-components-compliance-report.ts | تقرير مكونات وامتثال، لا يثبت اكتشافًا آليًا للبرمجيات أو تقييم ثغرات حي |
| /reports/asset-summary | /api/reports/summary | ملخص وقيم وحالات أصول |
| /reports/lifecycle | /api/reports/lifecycle | دورة حياة حسب بيانات السجل |
| /reports/hardware-lifecycle وdepreciation | DepreciationReport؛ /api/reports/depreciation | إهلاك/قيمة دفترية؛ ليس تسعيرًا سوقيًا |
| /reports/consumables-stock | ConsumablesStockReport | أرصدة ومستويات إعادة طلب ومواقع |
| /reports/assignments وassignment-history وreleased-assets | APIs التقارير للتخصيص/التاريخ/الأصول المرجعة | اختلاف المصدر حسب التقرير؛ راجع API في ملحق الشاشة |
| /reports/maintenance | /api/reports/maintenance | جداول وسجلات الصيانة |
| /reports/purchase-orders | APIs purchase-orders reports | مستندات/حالات شراء، لا يساوي الدفعات الفعلية تلقائيًا |
| /reports/budget وdepartment | /api/reports/budget وdepartment | موازنات وتجميع إداري |
| /reports/warranties | /api/reports/warranties | ضمانات مسجلة ومواعيد الانتهاء |
| /reports/vendor-analysis | /api/reports/vendors | مشتريات وبيانات موردين |
| /reports/missing-data | /api/reports/missing-data | اكتمال حقول السجل، لا تدقيق صحة كل قيمة خارجيًا |
| /reports/tickets | /api/reports/tickets | مصدر legacy tickets؛ لا تفترض أنه كل incidents وservice_requests الجديدة |
| /reports/problems | /api/reports/problems | بيانات المشكلات وروابطها |
| /reports/kb-articles | /api/reports/kb-articles | بيانات المقالات ضمن حدود الرؤية |

**التصدير:** تختلف الأزرار بين CSV وXLSX وPDF والطباعة حسب الصفحة؛ ملحق الشاشات يعرض الأزرار وhandlers. توليد XLSX من الخادم لا يثبت أن كل تقرير يدعم كل صيغة أو يصدر كل الصفحات. يجب توثيق نطاق الفلاتر/الصفحات لكل تقرير عند اختباره.

## 17. الأمان والصلاحيات وسجل التدقيق: نتائج المراجعة

### ضوابط موجودة

- server/auth.ts:23–33 يستخدم scrypt وsalt عشوائي وtimingSafeEqual.
- الجلسات مخزنة في PostgreSQL؛ cookie من نوع HttpOnly وSameSite Strict، وSecure في production، بمدة افتراضية يوم.
- تقييد محاولات الدخول: 10 محاولات لكل IP خلال 15 دقيقة وفق loginLimiter.
- إعادة التحقق من حالة المستخدم، ومسارات إعداد/تفعيل/تعطيل 2FA.
- middleware رؤوس أمنية وCSP والتحقق من أصل بعض الطلبات الكتابية وتسجيل حجب الطلبات.
- أدوار جاهزة مع مرونة roles النصية، وuser_roles وrole_permissions.
- إسناد الحوادث مرتبط بمجموعة وأعضائها، إضافة إلى حماية role/module.
- Demo Viewer له guard مستقل يمنع الكتابة، وليس مجرد إخفاء أزرار.
- response موحد لتعطيل الوحدة: HTTP 403، code=FEATURE_NOT_ENABLED، moduleKey ورسالة.

### فجوة مثبتة في اتساق صلاحيات قراءة المشاريع — أولوية عالية

المصادر: server/project-management.ts:350–457 مقابل server/project-workspace.ts:90–150.

GET /api/projects وGET /api/projects/:id وGET /api/projects/:id/baselines تعتمد على requireAuth وenabled، ولا تطبق داخلها تحقق عضوية المشروع أو project_view كالمطبق في قراءات المهام/المخاطر.

الحاجز المركزي للـpersona ما زال قائمًا؛ لذلك لا يعني ذلك أن كل مستخدم مجهول يستطيع القراءة. لكنه يعني أن **مستخدمًا مسجلًا يمر من persona gate، خصوصًا custom/legacy role، قد يصل إلى معلومات مشروع وخطوط أساس لا يملك عضويتها** إذا لم توجد صلاحية أخرى تقيده.

**التوصية:** توحيد canViewProject/requireProjectView على القائمة والتفاصيل والخطوط الأساسية وخيارات البيانات الحساسة، مع اختبارات مستخدم غير عضو ودور مخصص. لم يُعدّل التطبيق لإصلاحها ضمن طلب التوثيق.

### التدقيق وعدم قابلية التعديل

audit_logs يسجل الحقول: userId، action، tableName، recordId، recordName، oldValues، newValues، timestamp، ipAddress، userAgent. يختلف اكتمال هذه البيانات باختلاف handler.

- عدم وجود زر تحرير لا يساوي تخزينًا قانونيًا غير قابل للتلاعب.
- لا يثبت المخطط وحده توقيعًا تشفيريًا أو hash chain أو WORM أو منع DBA من التعديل.
- reset يصنف audit_logs كبيانات أعمال تُمسح، ثم ينشئ حدث CLEAR_SYSTEM_DATA جديدًا ضمن نفس transaction. لذلك لا تدّعِ حفظ تاريخ التدقيق كاملًا بعد المسح الإداري.
- دالة logAudit العامة في server/routes.ts تلتقط خطأ كتابة التدقيق وتطبع رسالة دون إفشال العملية الأساسية؛ بعض الخدمات الأخرى تكتب الحدث ضمن transaction. لذلك لا يوجد ضمان شامل بأن كل تعديل يفشل إذا تعذر تدوين أثره.
- «تصعيد مطلوب» في النشاط لا يثبت وصول إشعار أو بريد أو تكامل خارجي.

## 18. التشغيل والنشر والترحيلات وحماية البيانات

- الكود تحت خادم Node واحد مع واجهة Vite مبنية؛ jobs داخل العملية، وليست منصة جدولة موزعة مستقلة.
- متطلبات النشر موثقة في DEPLOYMENT.md وdeployment/onprem؛ وجود ملفات Nginx/ModSecurity/OWASP لا يثبت تفعيل WAF فعليًا على بيئة حالية.
- يجب إعداد الأسرار عبر إدارة الأسرار؛ لا توضع connection strings أو كلمات مرور حقيقية داخل الدليل أو العرض.
- server/startup-migrations.ts يطبق ترقيات SQL مع ledger/checksum وقفل بحسب تنفيذه. لا تستنتج أن ترقيات إضافية تبني baseline كاملًا لقاعدة فارغة.
- دليل النشر يميز قاعدة جديدة عن ترقية قاعدة موجودة؛ schema push ليس بديلًا تلقائيًا لترحيل إنتاج مُراجع.
- فحص تجديد عقود الخدمة في server/services/contract-renewal-checker.ts له initial delay وinterval، ويحسب near_expiration/expired ويولّد systemNotifications للمستحقين بحسب الربط والصلاحية.
- سجلات Backup & Restore ليست نسخة احتياطية من قاعدة بيانات التطبيق بذاتها؛ على التشغيل توفير backup/restore فعلي واختبار استرجاع خارج هذه السجلات.

### Clear All System Data

المصادر: server/system-clear-data-route.ts، server/system-data-reset.ts، shared/system-data-reset.ts.

1. مسؤول موثّق مع تحقق كلمة المرور الحالية.
2. التحقق من تصنيف جميع جداول المخطط قبل المسح؛ جدول غير مصنف يفشل بدل مسح غير مقصود.
3. transaction مع قفل وTRUNCATE صريح دون CASCADE عام.
4. حماية users وroles وpermissions وربطها والجلسات والإعدادات والقوائم المرجعية وبعض المراجع الأخرى حسب RESET_PROTECTED_TABLES.
5. الاحتفاظ بالمقالات is_system_guide=true ونسخها ومرفقاتها وربط ضوابطها، مع حذف المقالات المخصصة.
6. تسجيل CLEAR_SYSTEM_DATA جديد؛ فشل التسجيل يُرجع transaction كاملًا.

لا تستخدم هذا المسار لاختبار التقرير أو QA على بيانات تشغيل حقيقية.

## 19. مصفوفة الجاهزية الصريحة

| المجال | التصنيف | لماذا؟ |
|---|---|---|
| الأصول/المخزون/الصيانة/الجرد | منفذ في الكود | صفحات وجداول وAPI ومسارات عمل؛ لم تُختبر كل الحالات في هذه المراجعة |
| ITSM وCAB | منفذ مع حدود تشغيلية | خدمة انتقال وموافقات وسجلات؛ مصادر legacy/new وإشعارات التصعيد تحتاج تمييزًا |
| CMDB/الشبكات/النسخ | منفذ كسجل وإدارة بيانات | لا يثبت discovery أو نشر Firewall أو تنفيذ backup فعلي |
| المشتريات والفواتير والمرتجعات | منفذ مع سياسة استلام محددة | المطابقة الكاملة للفواتير تقود الاستلام؛ ليس فصل مهام مستقلًا بالكامل |
| الضرائب | حسابات وإعدادات منفذة | لا توجد من ذلك شهادة أو إثبات تكامل ZATCA |
| المشاريع والمهام والمراحل والخطوط الأساسية | منفذ | تبقى فجوة اتساق قراءة المشروع ومحدودية EVM |
| تقارير المشاريع الثلاثة | Planned صراحة | مرتبطة بـPlannedAnalyticsReport |
| سجل المخاطر | منفذ | ليس إطار GRC/ISO/NCA كاملًا أو شهادة امتثال |
| المعرفة والوثائق وربط الضوابط | منفذ | نشر ونسخ ومرفقات؛ ليس محرك تقييم امتثال شامل |
| Bulk Import | منفذ لكتالوج كيانات معرف | CSV/XLSX ومعاينة؛ قد ينجح جزئيًا؛ JSON ليس صيغة عامة مثبتة |
| التدقيق | تسجيل على مستوى التطبيق | يُمسح تاريخ الأعمال عند reset؛ لا إثبات WORM أو توقيع خارجي |
| العزل بين العملاء | غير مثبت كـmulti-tenant مستقل | تمكين الوحدات لكل installation/customer لا يثبت tenant_id/RLS وعزل بيانات كامل |
| جاهزية إنتاج 100% | غير مصادق عليها | لم تُجرَ في هذا الطلب اختبارات تشغيل/أداء/تعافٍ لكل بيئة وكل شاشة |
| الامتثال الرسمي | غير مصادق عليه | دعم معلومات وإجراءات لا يساوي اعتماد ISO/ITIL/NCA/PMI/ZATCA |

### حالة الاختبارات في هذه المراجعة

لم يُطلب تشغيل pipeline في الملف المرفق؛ المراجعة ساكنة ولم تُشغّل npm test أو npm run build أو تدقيق قاعدة إنتاج. وجود ملفات اختبار لا يبرر ادعاء أن suite تمر الآن بنسبة 100%. تحقق اتساق الملاحق مع المصدر يثبت الحصر فقط، وليس صحة جميع مسارات الأعمال.

الـrunner الحالي scripts/run-full-vitest.mjs يهيئ PostgreSQL محليًا مؤقتًا وschema للاختبارات، ويمرر بيئة منفصلة بدل أسرار قاعدة التطبيق؛ server/test-database.ts يطبق المخطط والترقيات في schema آمن. لا تنسخ تعليمات توثيق قديمة تفترض أن npm test يحتاج استخدام قاعدة التطوير أو يمسحها، ولا تعتبر ذلك تقرير نجاح جديدًا دون تشغيل.

## 20. أولويات المعالجة المستخلصة من التدقيق

هذه نتائج وتوصيات للتوثيق وليست مهام بدأت تلقائيًا:

1. **عالية:** توحيد تفويض قراءات المشاريع والقائمة والتفاصيل والـbaseline مع عضوية المشروع والصلاحيات، ثم إثبات الرفض والقبول باختبارات مناسبة.
2. **عالية عند استخدامه للأدلة التنظيمية:** تحديد سياسة احتفاظ audit logs مستقلة عن reset، وتصدير أو أرشفة محمية إن كانت مطلوبة.
3. **تشغيلية:** اتخاذ قرار واضح حول الفصل بين مطابقة الفاتورة والاستلام المادي واعتماد الدفع.
4. **دقة المنتج:** وصف Backup/Firewall كسجلات حوكمة، لا وظائف تنفيذ آلي غير موجودة.
5. **حوكمة المشاريع:** فصل طالب RFC عن معتمده إذا كانت السياسة تتطلب ذلك، وعدم تسمية فروق التواريخ EVM.
6. **اكتمال التقارير:** تنفيذ تقارير المشاريع المخططة أو الإبقاء على Planned، وعدم عرضها كقدرات منجزة.
7. **توثيق:** تحديث الوثائق القديمة التي تذكر bcrypt أو قوائم تنقل أقدم أو تدقيقًا immutable بلا حدود.
8. **ترخيص ونشر:** تحديد هل المطلوب installation لكل عميل أم multi-tenant؛ كل منهما يتطلب أدلة وضوابط مختلفة.

## 21. إعادة توليد الملاحق

شُغّل:

```bash
node scripts/generate-architecture-reference.mjs
```

يقرأ السكربت ملفات المصدر فقط ويكتب ملاحق Markdown وإحصاءات داخل docs/architecture-reference-ar؛ لا يتصل بقاعدة بيانات ولا يشغل مسح بيانات. يُعاد توليده عند تغيير routes أو schema أو مكونات الواجهة. التفسير المهني والنتائج في هذا الملف يحتاجان مراجعة بشرية بعد أي تغيير جوهري.
