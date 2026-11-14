# المرجع الرئيسي لهندسة النظام والوظائف

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
| الدخول | جلسات Passport محلية؛ كلمات المرور مهيأة عبر bcrypt حسب توثيق المشروع |
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

**استيراد البيانات:** مركز /import موجود، والواجهات المؤكدة في API تشمل قالب/تصدير الأصول ورفع Excel. لا تعرضه كاستيراد عالمي مكتمل لكل الوحدات دون التحقق من قوالب وخيارات كل كيان.

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
- ملف docs/system-manual/platform-architecture-getting-started.md يصف asset_management كوحدة أساسية لا يمكن إيقافها، لكن shared/modules.ts الحالي يعرّفها core=false؛ اعتمد تعريف الكود الحالي، وحدث الوثيقة إذا كان الوصف السابق غير مقصود.
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
- change_risk_links

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
