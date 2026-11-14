# سجل واجهات الخادم والوسطاء — جميع ملفات server

هذا جرد ساكن للشيفرة، وليس اختبار تشغيل أو شهادة جاهزية. المسارات الديناميكية تبقى كقوالب صريحة، والمراجع المباشرة لا تعني حصر كل الاعتمادات غير المباشرة.

تم العثور على **446 تسجيلًا صريحًا**، تشمل USE والقوالب الديناميكية. هذا عدد registrations وليس عدد URLs الفريدة بعد توسيع الحلقات؛ قد ينشئ loop عدة endpoints من تسجيل واحد.

الوسطاء أدناه كما في التسجيل. بعض الصلاحيات يتم فحصها داخل handler أو wrapper؛ عدم ظهور requirePermission هنا لا يثبت أن المسار عام. مراجع الجداول المباشرة لا تشمل كل ما ينفذه storage أو service آخر.

## USE `/api`

- المصدر: server/auth.ts:72
- سلسلة الوسطاء/المعالج: `createDemoViewerGuard(userId => storage.getUserRoles(userId))`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `createDemoViewerGuard`، `storage.getUserRoles`

## USE `/api`

- المصدر: server/index.ts:55
- سلسلة الوسطاء/المعالج: `apiSecurityMiddleware()`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `apiSecurityMiddleware`

## USE `/api`

- المصدر: server/routes.ts:641
- سلسلة الوسطاء/المعالج: `inline handler`
- جداول مشار إليها مباشرة: `user_roles`
- الاستدعاءات الظاهرة: `req.originalUrl.split("?")[0].replace`، `req.originalUrl.split`، `moduleForApiRequest`، `personaGuardedPaths.some`، `apiPath.startsWith`، `next`، `requireAuth`، `(async () => { try { if (moduleKey && !await isFeatureEnabled(moduleKey)) return sendFeatureNotEnabled(res, moduleKey); const userId = (req.user as any)?.id; const [userRoles, userPermissions] = await Promise.all([ storage.getUserRoles(userId), storage.getUserPermissions(userId), ]); const roleNames = userRoles.map(role => role.name); if (!isPersonaApiAllowed(roleNames, userPermissions, apiPath, req.method)) { return res.status(403).json({ error: "This persona is not allowed to access this API" }); } return next(); } catch (error) { console.error("Failed to verify API persona access:", error); return res.status(500).json({ error: "Failed to verify API access" }); } })`، `isFeatureEnabled`، `sendFeatureNotEnabled`، `Promise.all`، `storage.getUserRoles`، `storage.getUserPermissions`، `userRoles.map`، `isPersonaApiAllowed`، `res.status(403).json`، `res.status`، `console.error`، `res.status(500).json`

## GET `/api/access-governance`

- المصدر: server/routes.ts:4423
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requireAnyPermission("employee_update", "access_governance_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `employee_access_rights`، `employees`
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `expireDueEmployeeAccessRights`، `z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.enum(["20", "50"]).default("20").transform(Number), employeeId: z.string().trim().min(1).optional(), accessType: z.enum(ACCESS_TYPES).optional(), status: z.enum(["all", "active", "expiring", "expired", "expiry_review", "revoked"]).default("all"), search: z.string().trim().max(120).optional(), catalogSource: z.enum(["application", "server", "asset", "dropdown", "legacy"]).optional(), catalogItemId: z.string().trim().min(1).optional(), }).safeParse`، `z.object`، `z.coerce.number().int().min(1).default`، `z.coerce.number().int().min`، `z.coerce.number().int`، `z.coerce.number`، `z.enum(["20", "50"]).default("20").transform`، `z.enum(["20", "50"]).default`، `z.enum`، `z.string().trim().min(1).optional`، `z.string().trim().min`، `z.string().trim`، `z.string`، `z.enum(ACCESS_TYPES).optional`، `z.enum(["all", "active", "expiring", "expired", "expiry_review", "revoked"]).default`، `z.string().trim().max(120).optional`، `z.string().trim().max`، `z.enum(["application", "server", "asset", "dropdown", "legacy"]).optional`، `res.status(400).json`، `res.status`، `Boolean`، `commonConditions.push`، `eq`، `and`، `filters.search.replace`، `or`، `ilike`، `toDateInputValue`، `throughDate.setDate`، `throughDate.getDate`، `conditions.push`، `db.select({ expiring: sql<number>'count(*) FILTER (WHERE ${employeeAccessRights.status} = 'active' AND ${employeeAccessRights.expiresAt} > ${today}::date AND ${employeeAccessRights.expiresAt} <= ${through}::date)::int', expired: sql<number>'count(*) FILTER (WHERE ${employeeAccessRights.status} = 'expired' OR (${employeeAccessRights.status} = 'active' AND ${employeeAccessRights.expiresAt} IS NOT NULL AND ${employeeAccessRights.expiresAt} <= ${today}::date))::int', }).from(employeeAccessRights).innerJoin(employees, eq(employees.id, employeeAccessRights.employeeId)).where`، `db.select({ expiring: sql<number>'count(*) FILTER (WHERE ${employeeAccessRights.status} = 'active' AND ${employeeAccessRights.expiresAt} > ${today}::date AND ${employeeAccessRights.expiresAt} <= ${through}::date)::int', expired: sql<number>'count(*) FILTER (WHERE ${employeeAccessRights.status} = 'expired' OR (${employeeAccessRights.status} = 'active' AND ${employeeAccessRights.expiresAt} IS NOT NULL AND ${employeeAccessRights.expiresAt} <= ${today}::date))::int', }).from(employeeAccessRights).innerJoin`، `db.select({ expiring: sql<number>'count(*) FILTER (WHERE ${employeeAccessRights.status} = 'active' AND ${employeeAccessRights.expiresAt} > ${today}::date AND ${employeeAccessRights.expiresAt} <= ${through}::date)::int', expired: sql<number>'count(*) FILTER (WHERE ${employeeAccessRights.status} = 'expired' OR (${employeeAccessRights.status} = 'active' AND ${employeeAccessRights.expiresAt} IS NOT NULL AND ${employeeAccessRights.expiresAt} <= ${today}::date))::int', }).from`، `db.select`، `db.select({ total: sql<number>'count(*)::int', }).from(employeeAccessRights).innerJoin(employees, eq(employees.id, employeeAccessRights.employeeId)).where`، `db.select({ total: sql<number>'count(*)::int', }).from(employeeAccessRights).innerJoin`، `db.select({ total: sql<number>'count(*)::int', }).from`، `db.select({ id: employeeAccessRights.id, employeeId: employeeAccessRights.employeeId, applicationName: employeeAccessRights.applicationName, accessType: employeeAccessRights.accessType, catalogSource: employeeAccessRights.catalogSource, catalogItemId: employeeAccessRights.catalogItemId, privilegeLevel: employeeAccessRights.privilegeLevel, accountUsername: employeeAccessRights.accountUsername, businessJustification: employeeAccessRights.businessJustification, grantDate: employeeAccessRights.grantDate, expiresAt: employeeAccessRights.expiresAt, status: employeeAccessRights.status, revocationReason: employeeAccessRights.revocationReason, revokedAt: employeeAccessRights.revokedAt, employee: { id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }, }).from(employeeAccessRights).innerJoin(employees, eq(employees.id, employeeAccessRights.employeeId)) .where(where) .orderBy(desc(employeeAccessRights.grantDate), desc(employeeAccessRights.createdAt)) .limit(filters.pageSize) .offset`، `db.select({ id: employeeAccessRights.id, employeeId: employeeAccessRights.employeeId, applicationName: employeeAccessRights.applicationName, accessType: employeeAccessRights.accessType, catalogSource: employeeAccessRights.catalogSource, catalogItemId: employeeAccessRights.catalogItemId, privilegeLevel: employeeAccessRights.privilegeLevel, accountUsername: employeeAccessRights.accountUsername, businessJustification: employeeAccessRights.businessJustification, grantDate: employeeAccessRights.grantDate, expiresAt: employeeAccessRights.expiresAt, status: employeeAccessRights.status, revocationReason: employeeAccessRights.revocationReason, revokedAt: employeeAccessRights.revokedAt, employee: { id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }, }).from(employeeAccessRights).innerJoin(employees, eq(employees.id, employeeAccessRights.employeeId)) .where(where) .orderBy(desc(employeeAccessRights.grantDate), desc(employeeAccessRights.createdAt)) .limit`، `db.select({ id: employeeAccessRights.id, employeeId: employeeAccessRights.employeeId, applicationName: employeeAccessRights.applicationName, accessType: employeeAccessRights.accessType, catalogSource: employeeAccessRights.catalogSource, catalogItemId: employeeAccessRights.catalogItemId, privilegeLevel: employeeAccessRights.privilegeLevel, accountUsername: employeeAccessRights.accountUsername, businessJustification: employeeAccessRights.businessJustification, grantDate: employeeAccessRights.grantDate, expiresAt: employeeAccessRights.expiresAt, status: employeeAccessRights.status, revocationReason: employeeAccessRights.revocationReason, revokedAt: employeeAccessRights.revokedAt, employee: { id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }, }).from(employeeAccessRights).innerJoin(employees, eq(employees.id, employeeAccessRights.employeeId)) .where(where) .orderBy`، `db.select({ id: employeeAccessRights.id, employeeId: employeeAccessRights.employeeId, applicationName: employeeAccessRights.applicationName, accessType: employeeAccessRights.accessType, catalogSource: employeeAccessRights.catalogSource, catalogItemId: employeeAccessRights.catalogItemId, privilegeLevel: employeeAccessRights.privilegeLevel, accountUsername: employeeAccessRights.accountUsername, businessJustification: employeeAccessRights.businessJustification, grantDate: employeeAccessRights.grantDate, expiresAt: employeeAccessRights.expiresAt, status: employeeAccessRights.status, revocationReason: employeeAccessRights.revocationReason, revokedAt: employeeAccessRights.revokedAt, employee: { id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }, }).from(employeeAccessRights).innerJoin(employees, eq(employees.id, employeeAccessRights.employeeId)) .where`، `db.select({ id: employeeAccessRights.id, employeeId: employeeAccessRights.employeeId, applicationName: employeeAccessRights.applicationName, accessType: employeeAccessRights.accessType, catalogSource: employeeAccessRights.catalogSource, catalogItemId: employeeAccessRights.catalogItemId, privilegeLevel: employeeAccessRights.privilegeLevel, accountUsername: employeeAccessRights.accountUsername, businessJustification: employeeAccessRights.businessJustification, grantDate: employeeAccessRights.grantDate, expiresAt: employeeAccessRights.expiresAt, status: employeeAccessRights.status, revocationReason: employeeAccessRights.revocationReason, revokedAt: employeeAccessRights.revokedAt, employee: { id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }, }).from(employeeAccessRights).innerJoin`، `db.select({ id: employeeAccessRights.id, employeeId: employeeAccessRights.employeeId, applicationName: employeeAccessRights.applicationName, accessType: employeeAccessRights.accessType, catalogSource: employeeAccessRights.catalogSource, catalogItemId: employeeAccessRights.catalogItemId, privilegeLevel: employeeAccessRights.privilegeLevel, accountUsername: employeeAccessRights.accountUsername, businessJustification: employeeAccessRights.businessJustification, grantDate: employeeAccessRights.grantDate, expiresAt: employeeAccessRights.expiresAt, status: employeeAccessRights.status, revocationReason: employeeAccessRights.revocationReason, revokedAt: employeeAccessRights.revokedAt, employee: { id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }, }).from`، `desc`، `res.json`، `records.map`، `getAccessExpiryState`، `res.status(500).json`

## GET `/api/access-governance/catalog`

- المصدر: server/routes.ts:4414
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requireAnyPermission("employee_update", "access_governance_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `res.json`، `getAccessSystemCatalog`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/alerts`

- المصدر: server/routes.ts:5172
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `budgets`، `maintenance_schedules`، `system_notifications`، `tickets`
- الاستدعاءات الظاهرة: `in90Days.setDate`، `today.getDate`، `in30Days.setDate`، `Promise.all`، `isFeatureEnabled`، `storage.getUserPermissions`، `currentUserPermissions.some`، `["system_admin", "change_manage"].includes`، `storage.getAssets`، `storage.getMaintenanceSchedules`، `storage.getBudgets`، `storage.getTickets`، `storage.getPendingCabAlertChanges`، `storage.getDisabledCabAlertChanges`، `db.select().from(systemNotifications).where(and( eq(systemNotifications.userId, currentUserId), eq(systemNotifications.type, "service_contract"), eq(systemNotifications.isRead, false), )).orderBy(desc(systemNotifications.createdAt)).limit`، `db.select().from(systemNotifications).where(and( eq(systemNotifications.userId, currentUserId), eq(systemNotifications.type, "service_contract"), eq(systemNotifications.isRead, false), )).orderBy`، `db.select().from(systemNotifications).where`، `db.select().from`، `db.select`، `and`، `eq`، `desc`، `Math.ceil`، `expiryDate.getTime`، `today.getTime`، `alerts.push`، `nextDue.getTime`، `parseFloat`، `pct.toFixed`، `spent.toLocaleString`، `total.toLocaleString`، `dueAt.getTime`، `encodeURIComponent`، `disabledApproversByChange.get`، `disabledApproversByChange.set`، `blockedChange.approverLabels.add`، `disabledApproversByChange.forEach`، `Array.from`، `approvers.join`، `Number`، `res.json`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/applications`

- المصدر: server/routes.ts:3497
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requireAnyPermission("asset_update", "cmdb_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `cmdb_applications`
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `isFeatureEnabled`، `cmdbPageFilters.extend({ category: z.string().trim().max(120).optional(), hostingType: z.enum(["all", "saas", "on_prem", "hybrid"]).default("all"), status: z.enum(["all", "active", "inactive", "retired"]).default("all"), }).safeParse`، `cmdbPageFilters.extend`، `z.string().trim().max(120).optional`، `z.string().trim().max`، `z.string().trim`، `z.string`، `z.enum(["all", "saas", "on_prem", "hybrid"]).default`، `z.enum`، `z.enum(["all", "active", "inactive", "retired"]).default`، `res.status(400).json`، `res.status`، `conditions.push`، `eq`، `or`، `ilike`، `and`، `Promise.all`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, category: cmdbApplications.category, vendor: cmdbApplications.vendor, businessOwner: cmdbApplications.businessOwner, businessOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.businessOwner})' : sql<string \| null>'NULL', technicalOwner: cmdbApplications.technicalOwner, technicalOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.technicalOwner})' : sql<string \| null>'NULL', hostingType: cmdbApplications.hostingType, criticalityRating: cmdbApplications.criticalityRating, status: cmdbApplications.status, createdAt: cmdbApplications.createdAt, updatedAt: cmdbApplications.updatedAt, }).from(cmdbApplications).where(where) .orderBy(desc(cmdbApplications.updatedAt), desc(cmdbApplications.name)) .limit(pageSize).offset`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, category: cmdbApplications.category, vendor: cmdbApplications.vendor, businessOwner: cmdbApplications.businessOwner, businessOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.businessOwner})' : sql<string \| null>'NULL', technicalOwner: cmdbApplications.technicalOwner, technicalOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.technicalOwner})' : sql<string \| null>'NULL', hostingType: cmdbApplications.hostingType, criticalityRating: cmdbApplications.criticalityRating, status: cmdbApplications.status, createdAt: cmdbApplications.createdAt, updatedAt: cmdbApplications.updatedAt, }).from(cmdbApplications).where(where) .orderBy(desc(cmdbApplications.updatedAt), desc(cmdbApplications.name)) .limit`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, category: cmdbApplications.category, vendor: cmdbApplications.vendor, businessOwner: cmdbApplications.businessOwner, businessOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.businessOwner})' : sql<string \| null>'NULL', technicalOwner: cmdbApplications.technicalOwner, technicalOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.technicalOwner})' : sql<string \| null>'NULL', hostingType: cmdbApplications.hostingType, criticalityRating: cmdbApplications.criticalityRating, status: cmdbApplications.status, createdAt: cmdbApplications.createdAt, updatedAt: cmdbApplications.updatedAt, }).from(cmdbApplications).where(where) .orderBy`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, category: cmdbApplications.category, vendor: cmdbApplications.vendor, businessOwner: cmdbApplications.businessOwner, businessOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.businessOwner})' : sql<string \| null>'NULL', technicalOwner: cmdbApplications.technicalOwner, technicalOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.technicalOwner})' : sql<string \| null>'NULL', hostingType: cmdbApplications.hostingType, criticalityRating: cmdbApplications.criticalityRating, status: cmdbApplications.status, createdAt: cmdbApplications.createdAt, updatedAt: cmdbApplications.updatedAt, }).from(cmdbApplications).where`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, category: cmdbApplications.category, vendor: cmdbApplications.vendor, businessOwner: cmdbApplications.businessOwner, businessOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.businessOwner})' : sql<string \| null>'NULL', technicalOwner: cmdbApplications.technicalOwner, technicalOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.technicalOwner})' : sql<string \| null>'NULL', hostingType: cmdbApplications.hostingType, criticalityRating: cmdbApplications.criticalityRating, status: cmdbApplications.status, createdAt: cmdbApplications.createdAt, updatedAt: cmdbApplications.updatedAt, }).from`، `db.select`، `desc`، `db.select({ total: sql<number>'count(*)::int' }).from(cmdbApplications).where`، `db.select({ total: sql<number>'count(*)::int' }).from`، `res.json`، `res.status(500).json`

## POST `/api/applications`

- المصدر: server/routes.ts:3548
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requirePermission("asset_create")` → `inline handler`
- جداول مشار إليها مباشرة: `cmdb_applications`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertCmdbApplicationSchema.parse`، `hasActiveDropdownValue`، `res.status(400).json`، `res.status`، `db.insert(cmdbApplications).values(input).returning`، `db.insert(cmdbApplications).values`، `db.insert`، `logAudit`، `res.status(201).json`، `res.status(409).json`، `res.status(500).json`

## PUT `/api/applications/:id`

- المصدر: server/routes.ts:3564
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requirePermission("asset_update")` → `inline handler`
- جداول مشار إليها مباشرة: `cmdb_applications`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertCmdbApplicationSchema.partial().parse`، `insertCmdbApplicationSchema.partial`، `hasActiveDropdownValue`، `res.status(400).json`، `res.status`، `db.select().from(cmdbApplications).where`، `db.select().from`، `db.select`، `eq`، `res.status(404).json`، `db.update(cmdbApplications).set({ ...input, updatedAt: new Date() }) .where(eq(cmdbApplications.id, req.params.id)).returning`، `db.update(cmdbApplications).set({ ...input, updatedAt: new Date() }) .where`، `db.update(cmdbApplications).set`، `db.update`، `logAudit`، `res.json`، `res.status(409).json`، `res.status(500).json`

## GET `/api/applications/:id/documents`

- المصدر: server/routes.ts:3956
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requirePermission("asset_update")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `listConfigurationDocuments`، `res.status(500).json`، `res.status`

## POST `/api/applications/:id/documents`

- المصدر: server/routes.ts:3960
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requirePermission("asset_update")` → `diskUpload.single("file")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `diskUpload.single`، `uploadConfigurationDocument`

## GET `/api/applications/:id/documents/:documentId`

- المصدر: server/routes.ts:3963
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requirePermission("asset_update")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `downloadConfigurationDocument`، `res.status(500).json`، `res.status`

## GET `/api/applications/:id/servers`

- المصدر: server/routes.ts:3583
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requireAnyPermission("asset_update", "cmdb_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `application_server_links`، `cmdb_applications`، `servers`
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `db.select({ id: cmdbApplications.id }).from(cmdbApplications).where`، `db.select({ id: cmdbApplications.id }).from`، `db.select`، `eq`، `res.status(404).json`، `res.status`، `db.select({ id: servers.id, hostname: servers.hostname, ipAddress: servers.ipAddress, environment: servers.environment, status: servers.status, osPlatform: servers.osPlatform, location: servers.location, }).from(applicationServerLinks).innerJoin(servers, eq(servers.id, applicationServerLinks.serverId)) .where(eq(applicationServerLinks.applicationId, application.id)) .orderBy`، `db.select({ id: servers.id, hostname: servers.hostname, ipAddress: servers.ipAddress, environment: servers.environment, status: servers.status, osPlatform: servers.osPlatform, location: servers.location, }).from(applicationServerLinks).innerJoin(servers, eq(servers.id, applicationServerLinks.serverId)) .where`، `db.select({ id: servers.id, hostname: servers.hostname, ipAddress: servers.ipAddress, environment: servers.environment, status: servers.status, osPlatform: servers.osPlatform, location: servers.location, }).from(applicationServerLinks).innerJoin`، `db.select({ id: servers.id, hostname: servers.hostname, ipAddress: servers.ipAddress, environment: servers.environment, status: servers.status, osPlatform: servers.osPlatform, location: servers.location, }).from`، `asc`، `res.json`، `res.status(500).json`

## GET `/api/asset-audits`

- المصدر: server/routes.ts:1170
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `sessions`
- الاستدعاءات الظاهرة: `storage.getAssetAuditSessions`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/asset-audits`

- المصدر: server/routes.ts:1179
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `insertAssetAuditSessionSchema.parse`، `storage.createAssetAuditSession`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## GET `/api/asset-audits/:id`

- المصدر: server/routes.ts:1194
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getAssetAuditSession`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/asset-audits/:id`

- المصدر: server/routes.ts:1204
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `insertAssetAuditSessionSchema.partial().parse`، `insertAssetAuditSessionSchema.partial`، `storage.getAssetAuditSession`، `storage.updateAssetAuditSession`، `res.status(404).json`، `res.status`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## GET `/api/asset-audits/:id/items`

- المصدر: server/routes.ts:1218
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getAuditItems`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/asset-audits/:id/items`

- المصدر: server/routes.ts:1227
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `insertAssetAuditItemSchema.parse`، `storage.upsertAuditItem`، `storage.getAuditItems`، `storage.updateAssetAuditSession`، `allItems.filter`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## PUT `/api/asset-audits/:sessionId/items/:itemId`

- المصدر: server/routes.ts:1248
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `insertAssetAuditItemSchema.partial().parse`، `insertAssetAuditItemSchema.partial`، `storage.upsertAuditItem`، `storage.getAuditItems`، `storage.updateAssetAuditSession`، `allItems.filter`، `res.json`، `res.status(400).json`، `res.status`، `res.status(500).json`

## GET `/api/asset-bookings`

- المصدر: server/routes.ts:1072
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getAssetBookings`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/asset-bookings`

- المصدر: server/routes.ts:1081
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `insertAssetBookingSchema.parse`، `storage.createAssetBooking`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## DELETE `/api/asset-bookings/:id`

- المصدر: server/routes.ts:1117
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getAssetBooking`، `storage.deleteAssetBooking`، `res.status(404).json`، `res.status`، `logAudit`، `res.status(204).send`، `res.status(500).json`

## GET `/api/asset-bookings/:id`

- المصدر: server/routes.ts:1093
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getAssetBooking`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/asset-bookings/:id`

- المصدر: server/routes.ts:1103
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `insertAssetBookingSchema.partial().parse`، `insertAssetBookingSchema.partial`، `storage.getAssetBooking`، `storage.updateAssetBooking`، `res.status(404).json`، `res.status`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## GET `/api/asset-disposal`

- المصدر: server/routes.ts:1130
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getAssetDisposalRecords`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/asset-disposal`

- المصدر: server/routes.ts:1139
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `insertAssetDisposalRecordSchema.parse`، `storage.createAssetDisposalRecord`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## PUT `/api/asset-disposal/:id`

- المصدر: server/routes.ts:1155
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `insertAssetDisposalRecordSchema.partial().parse`، `insertAssetDisposalRecordSchema.partial`، `storage.getAssetDisposalRecords().then`، `storage.getAssetDisposalRecords`، `recs.find`، `storage.updateAssetDisposalRecord`، `res.status(404).json`، `res.status`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## GET `/api/asset-handovers`

- المصدر: server/asset-handovers.ts:155
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("asset_view", "assignment_create", "assignment_return", "employee_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `asset_handovers`، `assets`، `assignments`، `employees`، `users`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `z.object({ search: z.string().trim().max(120).optional(), type: handoverTypeSchema.optional(), }).safeParse`، `z.object`، `z.string().trim().max(120).optional`، `z.string().trim().max`، `z.string().trim`، `z.string`، `handoverTypeSchema.optional`، `res.status(400).json`، `res.status`، `conditions.push`، `eq`، `parsed.data.search?.replace`، `or`، `ilike`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, assignmentId: assetHandovers.assignmentId, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, createdAt: assetHandovers.createdAt, issuedByUserId: assetHandovers.issuedByUserId, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin(assets, eq(assets.id, assetHandovers.assetId)) .innerJoin(assignments, eq(assignments.id, assetHandovers.assignmentId)) .leftJoin(users, eq(users.id, assetHandovers.issuedByUserId)) .where(conditions.length ? and(...conditions) : undefined) .orderBy`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, assignmentId: assetHandovers.assignmentId, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, createdAt: assetHandovers.createdAt, issuedByUserId: assetHandovers.issuedByUserId, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin(assets, eq(assets.id, assetHandovers.assetId)) .innerJoin(assignments, eq(assignments.id, assetHandovers.assignmentId)) .leftJoin(users, eq(users.id, assetHandovers.issuedByUserId)) .where`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, assignmentId: assetHandovers.assignmentId, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, createdAt: assetHandovers.createdAt, issuedByUserId: assetHandovers.issuedByUserId, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin(assets, eq(assets.id, assetHandovers.assetId)) .innerJoin(assignments, eq(assignments.id, assetHandovers.assignmentId)) .leftJoin`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, assignmentId: assetHandovers.assignmentId, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, createdAt: assetHandovers.createdAt, issuedByUserId: assetHandovers.issuedByUserId, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin(assets, eq(assets.id, assetHandovers.assetId)) .innerJoin`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, assignmentId: assetHandovers.assignmentId, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, createdAt: assetHandovers.createdAt, issuedByUserId: assetHandovers.issuedByUserId, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, assignmentId: assetHandovers.assignmentId, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, createdAt: assetHandovers.createdAt, issuedByUserId: assetHandovers.issuedByUserId, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from(assetHandovers) .innerJoin`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, assignmentId: assetHandovers.assignmentId, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, createdAt: assetHandovers.createdAt, issuedByUserId: assetHandovers.issuedByUserId, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from`، `db.select`، `and`، `desc`، `res.json`، `console.error`، `res.status(500).json`

## POST `/api/asset-handovers`

- المصدر: server/asset-handovers.ts:268
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("assignment_create", "assignment_return", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `asset_handovers`، `assets`، `assignments`، `audit_logs`، `dropdown_options`، `employee_offboarding_clearances`، `employees`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `insertAssetHandoverSchema.safeParse`، `res.status(400).json`، `res.status`، `validIsoDate`، `Array.from`، `input.includedAccessories.map(item => item.trim()).filter`، `input.includedAccessories.map`، `item.trim`، `String`، `res.status(401).json`، `db.transaction`، `tx.select().from(assets).where(eq(assets.id, input.assetId)).for`، `tx.select().from(assets).where`، `tx.select().from`، `tx.select`، `eq`، `Object.assign`، `tx.select().from(employees).where(eq(employees.id, input.employeeId)).for`، `tx.select().from(employees).where`، `tx.select({ value: dropdownOptions.value }).from(dropdownOptions).where(and( sql'lower(btrim(${dropdownOptions.category})) = 'asset_condition'', sql'lower(btrim(${dropdownOptions.value})) = ${input.condition.toLowerCase()}', eq(dropdownOptions.isActive, true), )).limit`، `tx.select({ value: dropdownOptions.value }).from(dropdownOptions).where`، `tx.select({ value: dropdownOptions.value }).from`، `and`، `input.condition.toLowerCase`، `tx.select({ value: dropdownOptions.value }).from(dropdownOptions).where(and( sql'lower(btrim(${dropdownOptions.category})) = 'handover_type'', sql'lower(btrim(${dropdownOptions.value})) = ${input.type.toLowerCase()}', eq(dropdownOptions.isActive, true), )).limit`، `input.type.toLowerCase`، `isIssueType`، `tx.select().from(assignments) .where(and(eq(assignments.assetId, asset.id), isNull(assignments.returnedDate))).limit`، `tx.select().from(assignments) .where`، `isNull`، `String(asset.status ?? "").trim().toLowerCase`، `String(asset.status ?? "").trim`، `["available", "in stock", "in_stock"].includes`، `["software", "cloud_service"].includes`، `String(asset.type ?? "").trim().toLowerCase`، `String(asset.type ?? "").trim`، `input.handoverDate.slice`، `tx.execute`، `tx.select({ handoverNumber: assetHandovers.handoverNumber }) .from(assetHandovers) .where(sql'${assetHandovers.handoverNumber} LIKE ${'HO-${year}-%'}') .orderBy(desc(assetHandovers.handoverNumber)) .limit`، `tx.select({ handoverNumber: assetHandovers.handoverNumber }) .from(assetHandovers) .where(sql'${assetHandovers.handoverNumber} LIKE ${'HO-${year}-%'}') .orderBy`، `tx.select({ handoverNumber: assetHandovers.handoverNumber }) .from(assetHandovers) .where`، `tx.select({ handoverNumber: assetHandovers.handoverNumber }) .from`، `desc`، `Number`، `lastHandover?.handoverNumber?.split("-").at`، `lastHandover?.handoverNumber?.split`، `String(lastSequence + 1).padStart`، `tx.insert(assignments).values({ assetId: asset.id, employeeId: employee.id, assignedDate: input.handoverDate, notes: 'Custody receipt ${handoverNumber}${input.notes ? ' — ${input.notes}' : ""}', }).returning`، `tx.insert(assignments).values`، `tx.insert`، `tx.update(assets).set({ status: "assigned", assetOwner: employeeName(employee), updatedBy: actorId, lastUpdatedDate: new Date(), }).where`، `tx.update(assets).set`، `tx.update`، `employeeName`، `tx.update(assignments).set({ returnedDate: input.handoverDate, notes: activeAssignment!.notes ? '${activeAssignment!.notes}\nReturned under custody receipt ${handoverNumber}${input.notes ? ' — ${input.notes}' : ""}' : 'Returned under custody receipt ${handoverNumber}${input.notes ? ' — ${input.notes}' : ""}', }).where`، `tx.update(assignments).set`، `tx.update(assets).set({ status: input.condition === "Needs Repair" ? "maintenance" : "available", assetOwner: null, assetCondition: input.condition, updatedBy: actorId, lastUpdatedDate: new Date(), }).where`، `tx.insert(assetHandovers).values({ handoverNumber, type: input.type, employeeId: employee.id, assetId: asset.id, assignmentId, issuedByUserId: actorId, handoverDate: input.handoverDate, condition: input.condition, includedAccessories: accessories, notes: input.notes?.trim() \|\| null, }).returning`، `tx.insert(assetHandovers).values`، `input.notes?.trim`، `tx.insert(auditLogs).values`، `auditEntry`، `tx.select({ id: assignments.id }) .from(assignments) .where(and(eq(assignments.employeeId, employee.id), isNull(assignments.returnedDate))) .limit`، `tx.select({ id: assignments.id }) .from(assignments) .where`، `tx.select({ id: assignments.id }) .from`، `tx.select({ id: employeeOffboardingClearances.id }) .from(employeeOffboardingClearances) .where(and( eq(employeeOffboardingClearances.employeeId, employee.id), eq(employeeOffboardingClearances.offboardingDate, employee.offboardedDate), eq(employeeOffboardingClearances.clearanceType, "physical_asset_return"), eq(employeeOffboardingClearances.status, "waived"), )) .limit`، `tx.select({ id: employeeOffboardingClearances.id }) .from(employeeOffboardingClearances) .where`، `tx.select({ id: employeeOffboardingClearances.id }) .from`، `tx.insert(employeeOffboardingClearances).values`، `res.status(201).json`، `errorStatus`، `res.status(errorStatus(error)!).json`، `console.error`، `res.status(500).json`

## GET `/api/asset-handovers/:id`

- المصدر: server/asset-handovers.ts:221
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `asset_handovers`، `assets`، `assignments`، `employees`، `permissions`، `users`
- الاستدعاءات الظاهرة: `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin(assets, eq(assets.id, assetHandovers.assetId)) .innerJoin(assignments, eq(assignments.id, assetHandovers.assignmentId)) .leftJoin(users, eq(users.id, assetHandovers.issuedByUserId)) .where(eq(assetHandovers.id, req.params.id)) .limit`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin(assets, eq(assets.id, assetHandovers.assetId)) .innerJoin(assignments, eq(assignments.id, assetHandovers.assignmentId)) .leftJoin(users, eq(users.id, assetHandovers.issuedByUserId)) .where`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin(assets, eq(assets.id, assetHandovers.assetId)) .innerJoin(assignments, eq(assignments.id, assetHandovers.assignmentId)) .leftJoin`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin(assets, eq(assets.id, assetHandovers.assetId)) .innerJoin`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from(assetHandovers) .innerJoin`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, employeeId: assetHandovers.employeeId, employeeNumber: employees.employeeId, employeeName: sql<string>'concat_ws(' ', ${employees.firstName}, ${employees.lastName})', employeeEmail: employees.email, assetId: assetHandovers.assetId, assetName: assets.name, assetTag: assets.assetTag, assetType: assets.type, serialNumber: assets.serialNumber, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', assignmentReturnedDate: assignments.returnedDate, }).from`، `db.select`، `eq`، `res.status(404).json`، `res.status`، `String((req.user as any)?.email ?? "").trim().toLowerCase`، `String((req.user as any)?.email ?? "").trim`، `String`، `String(row.employeeEmail ?? "").trim().toLowerCase`، `String(row.employeeEmail ?? "").trim`، `(await import("./storage")).storage.getUserPermissions`، `import`، `["asset_view", "assignment_create", "assignment_return", "employee_view", "system_admin"].some`، `permissions.includes`، `res.status(403).json`، `res.json`، `console.error`، `res.status(500).json`

## GET `/api/asset-handovers/options`

- المصدر: server/asset-handovers.ts:53
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("assignment_create", "assignment_return", "asset_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `assignments`، `dropdown_options`، `employees`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `z.object({ type: handoverTypeSchema.optional(), employeeId: z.string().uuid().optional(), }).safeParse`، `z.object`، `handoverTypeSchema.optional`، `z.string().uuid().optional`، `z.string().uuid`، `z.string`، `res.status(400).json`، `res.status`، `isIssueType`، `db.select({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }).from(employees) .where(eq(employees.status, "active")) .orderBy`، `db.select({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }).from(employees) .where`، `db.select({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }).from`، `db.select`، `eq`، `asc`، `db.selectDistinct({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }).from(assignments) .innerJoin(employees, eq(employees.id, assignments.employeeId)) .where(and(isNull(assignments.returnedDate), parsed.data.employeeId ? eq(employees.id, parsed.data.employeeId) : undefined)) .orderBy`، `db.selectDistinct({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }).from(assignments) .innerJoin(employees, eq(employees.id, assignments.employeeId)) .where`، `db.selectDistinct({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }).from(assignments) .innerJoin`، `db.selectDistinct({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email, department: employees.department, status: employees.status, }).from`، `db.selectDistinct`، `and`، `isNull`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, type: assets.type, serialNumber: assets.serialNumber, status: assets.status, }).from(assets) .where(and( sql'lower(btrim(${assets.status})) IN ('available', 'in stock', 'in_stock')', notExists(db.select({ id: assignments.id }).from(assignments).where(and( eq(assignments.assetId, assets.id), isNull(assignments.returnedDate), ))), sql'lower(btrim(coalesce(${assets.type}, ''))) NOT IN ('software', 'cloud_service')', )) .orderBy`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, type: assets.type, serialNumber: assets.serialNumber, status: assets.status, }).from(assets) .where`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, type: assets.type, serialNumber: assets.serialNumber, status: assets.status, }).from`، `notExists`، `db.select({ id: assignments.id }).from(assignments).where`، `db.select({ id: assignments.id }).from`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, type: assets.type, serialNumber: assets.serialNumber, status: assets.status, }).from(assignments) .innerJoin(assets, eq(assets.id, assignments.assetId)) .where(and(eq(assignments.employeeId, parsed.data.employeeId), isNull(assignments.returnedDate))) .orderBy`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, type: assets.type, serialNumber: assets.serialNumber, status: assets.status, }).from(assignments) .innerJoin(assets, eq(assets.id, assignments.assetId)) .where`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, type: assets.type, serialNumber: assets.serialNumber, status: assets.status, }).from(assignments) .innerJoin`، `Promise.all`، `db.select({ value: dropdownOptions.value, label: dropdownOptions.label }) .from(dropdownOptions) .where(and(sql'lower(btrim(${dropdownOptions.category})) = 'handover_type'', eq(dropdownOptions.isActive, true))) .orderBy`، `db.select({ value: dropdownOptions.value, label: dropdownOptions.label }) .from(dropdownOptions) .where`، `db.select({ value: dropdownOptions.value, label: dropdownOptions.label }) .from`، `db.select({ value: dropdownOptions.value, label: dropdownOptions.label }) .from(dropdownOptions) .where(and(sql'lower(btrim(${dropdownOptions.category})) = 'asset_condition'', eq(dropdownOptions.isActive, true))) .orderBy`، `res.json`، `console.error`، `res.status(500).json`

## POST `/api/asset-relationships`

- المصدر: server/routes.ts:1282
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `insertAssetRelationshipSchema.parse`، `storage.createAssetRelationship`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## DELETE `/api/asset-relationships/:id`

- المصدر: server/routes.ts:1293
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.deleteAssetRelationship`، `res.status(404).json`، `res.status`، `res.status(204).send`، `res.status(500).json`

## GET `/api/asset-requests`

- المصدر: server/routes.ts:1304
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getAssetRequests`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/asset-requests`

- المصدر: server/routes.ts:1313
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `insertAssetRequestSchema.parse`، `storage.createAssetRequest`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## GET `/api/asset-requests/:id`

- المصدر: server/routes.ts:2642
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getAssetRequest`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/asset-requests/:id`

- المصدر: server/routes.ts:2652
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `insertAssetRequestSchema.partial().parse`، `insertAssetRequestSchema.partial`، `storage.getAssetRequest`، `storage.updateAssetRequest`، `res.status(404).json`، `res.status`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## POST `/api/asset-requests/:id/approve`

- المصدر: server/routes.ts:2666
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('system_admin')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.updateAssetRequest`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## POST `/api/asset-requests/:id/fulfill`

- المصدر: server/routes.ts:2696
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('system_admin')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.updateAssetRequest`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## POST `/api/asset-requests/:id/reject`

- المصدر: server/routes.ts:2680
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('system_admin')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.updateAssetRequest`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## GET `/api/assets`

- المصدر: server/routes.ts:3206
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `requireAnyPermission("asset_view", "asset_update", "asset_create", "assignment_create", "assignment_update", "maintenance_create", "maintenance_update", "compliance_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `contracts`، `vendor_contract_assets`
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `storage.getAssetsWithAssignments`، `db.select({ id: contracts.id, name: contracts.name, assetId: contracts.assetId, endDate: contracts.endDate, }).from(contracts).where`، `db.select({ id: contracts.id, name: contracts.name, assetId: contracts.assetId, endDate: contracts.endDate, }).from`، `db.select`، `inArray`، `assets.map`، `db.select({ id: contracts.id, name: contracts.name, assetId: vendorContractAssets.assetId, endDate: contracts.endDate, }).from(vendorContractAssets).innerJoin(contracts, eq(contracts.id, vendorContractAssets.contractId)) .where`، `db.select({ id: contracts.id, name: contracts.name, assetId: vendorContractAssets.assetId, endDate: contracts.endDate, }).from(vendorContractAssets).innerJoin`، `db.select({ id: contracts.id, name: contracts.name, assetId: vendorContractAssets.assetId, endDate: contracts.endDate, }).from`، `eq`، `and`، `res.json`، `Array.from`، `new Map( [...linked, ...slaLinks].filter(contract => contract.assetId === asset.id).map(contract => [contract.id, contract]), ).values`، `[...linked, ...slaLinks].filter(contract => contract.assetId === asset.id).map`، `[...linked, ...slaLinks].filter`، `res.status(500).json`، `res.status`

## POST `/api/assets`

- المصدر: server/routes.ts:3242
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `requirePermission('asset_create')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertAssetSchema.parse`، `storage.getSetting`، `validatedData.assetTag.trim`، `res.status(400).json`، `res.status`، `storage.getNextAssetIdNumber`، `nextNumber.toString().padStart`، `nextNumber.toString`، `storage.createAsset`، `logAudit`، `res.status(201).json`، `res.status(409).json`، `console.error`، `res.status(500).json`

## DELETE `/api/assets/:id`

- المصدر: server/routes.ts:3331
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('asset_delete')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getAsset`، `storage.deleteAsset`، `res.status(404).json`، `res.status`، `logAudit`، `res.status(204).send`، `res.status(409).json`، `console.error`، `res.status(500).json`

## GET `/api/assets/:id`

- المصدر: server/routes.ts:3224
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("asset_view", "asset_update", "asset_create", "assignment_create", "assignment_update", "maintenance_create", "maintenance_update", "compliance_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `contracts`، `vendor_contract_assets`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `storage.getAsset`، `res.status(404).json`، `res.status`، `db.select({ id: contracts.id, name: contracts.name, endDate: contracts.endDate, }).from(contracts).where`، `db.select({ id: contracts.id, name: contracts.name, endDate: contracts.endDate, }).from`، `db.select`، `eq`، `db.select({ id: contracts.id, name: contracts.name, endDate: contracts.endDate }) .from(vendorContractAssets).innerJoin(contracts, eq(contracts.id, vendorContractAssets.contractId)) .where`، `db.select({ id: contracts.id, name: contracts.name, endDate: contracts.endDate }) .from(vendorContractAssets).innerJoin`، `db.select({ id: contracts.id, name: contracts.name, endDate: contracts.endDate }) .from`، `and`، `res.json`، `Array.from`، `new Map([...linkedContracts, ...slaLinks].map(contract => [contract.id, contract])).values`، `[...linkedContracts, ...slaLinks].map`، `res.status(500).json`

## PUT `/api/assets/:id`

- المصدر: server/routes.ts:3283
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('asset_update')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertAssetSchema.partial().parse`، `insertAssetSchema.partial`، `storage.getSetting`، `validatedData.assetTag.trim`، `res.status(400).json`، `res.status`، `storage.getAsset`، `updateAssetWithLicenseChecks`، `res.status(404).json`، `logAudit`، `res.json`، `res.status(error.status).json`، `res.status(409).json`، `console.error`، `res.status(500).json`

## GET `/api/assets/:id/attachments`

- المصدر: server/routes.ts:3786
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `asset_attachments`
- الاستدعاءات الظاهرة: `db.select().from(assetAttachments).where`، `db.select().from`، `db.select`، `eq`، `res.json`، `console.error`، `res.status(500).json`، `res.status`

## POST `/api/assets/:id/attachments`

- المصدر: server/routes.ts:3796
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `requirePermission('asset_update')` → `inline handler` → `diskUpload.single('file')` → `inline handler`
- جداول مشار إليها مباشرة: `asset_attachments`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.getAsset`، `res.status(404).json`، `res.status`، `next`، `res.status(500).json`، `diskUpload.single`، `res.status(400).json`، `db.insert(assetAttachments).values({ assetId: req.params.id, fileName: req.file.filename, originalName: req.file.originalname, fileType: req.file.mimetype, fileSize: req.file.size, filePath: req.file.path, description: description \|\| null, uploadedBy: req.user?.id \|\| null, }).returning`، `db.insert(assetAttachments).values`، `db.insert`، `res.json`، `console.error`

## DELETE `/api/assets/:id/attachments/:attachId`

- المصدر: server/routes.ts:3826
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `requirePermission('asset_update')` → `inline handler`
- جداول مشار إليها مباشرة: `asset_attachments`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `db.delete(assetAttachments) .where(and(eq(assetAttachments.id, req.params.attachId), eq(assetAttachments.assetId, req.params.id))) .returning`، `db.delete(assetAttachments) .where`، `db.delete`، `and`، `eq`، `import`، `fs.unlinkSync`، `res.status(204).send`، `res.status`، `console.error`، `res.status(500).json`

## GET `/api/assets/:id/depreciation-schedule`

- المصدر: server/routes.ts:8768
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getAsset`، `res.status(404).json`، `res.status`، `parseFloat`، `generateDepreciationSchedule`، `calculateDepreciation`، `res.json`، `console.error`، `res.status(500).json`

## GET `/api/assets/:id/license-allocations`

- المصدر: server/routes.ts:3359
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `inline handler`
- جداول مشار إليها مباشرة: `employees`، `software_license_allocations`
- الاستدعاءات الظاهرة: `requireModule`، `storage.getAsset`، `res.status(404).json`، `res.status`، `db.select({ id: softwareLicenseAllocations.id, employeeId: softwareLicenseAllocations.employeeId, allocatedAt: softwareLicenseAllocations.allocatedAt, employee: { firstName: employees.firstName, lastName: employees.lastName, email: employees.email, }, }).from(softwareLicenseAllocations).innerJoin(employees, eq(employees.id, softwareLicenseAllocations.employeeId)) .where`، `db.select({ id: softwareLicenseAllocations.id, employeeId: softwareLicenseAllocations.employeeId, allocatedAt: softwareLicenseAllocations.allocatedAt, employee: { firstName: employees.firstName, lastName: employees.lastName, email: employees.email, }, }).from(softwareLicenseAllocations).innerJoin`، `db.select({ id: softwareLicenseAllocations.id, employeeId: softwareLicenseAllocations.employeeId, allocatedAt: softwareLicenseAllocations.allocatedAt, employee: { firstName: employees.firstName, lastName: employees.lastName, email: employees.email, }, }).from`، `db.select`، `eq`، `and`، `isNull`، `res.json`، `res.status(500).json`

## POST `/api/assets/:id/license-allocations`

- المصدر: server/routes.ts:3373
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("asset_update")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `z.object({ employeeId: z.string().min(1) }).parse`، `z.object`، `z.string().min`، `z.string`، `allocateSoftwareSeat`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(error.status).json`، `res.status(400).json`، `res.status(500).json`

## POST `/api/assets/:id/license-allocations/:allocationId/release`

- المصدر: server/routes.ts:3386
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("asset_update")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `releaseSoftwareSeat`، `logAudit`، `res.json`، `res.status(error.status).json`، `res.status`، `res.status(500).json`

## GET `/api/assets/:id/relationships`

- المصدر: server/routes.ts:1273
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getAssetRelationships`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/assets/bulk-update`

- المصدر: server/routes.ts:3398
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('asset_update')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `Array.isArray`، `res.status(400).json`، `res.status`، `Object.keys`، `storage.updateAsset`، `logAudit`، `res.json`، `console.error`، `res.status(500).json`

## GET `/api/assignment-groups`

- المصدر: server/routes.ts:2166
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `assignment_group_members`، `assignment_groups`، `users`
- الاستدعاءات الظاهرة: `requireModule`، `canManageAssignmentGroups`، `assignmentGroupsForbidden`، `db.select().from(assignmentGroups).orderBy`، `db.select().from`، `db.select`، `asc`، `db.select().from(assignmentGroups).where(eq(assignmentGroups.active, true)).orderBy`، `db.select().from(assignmentGroups).where`، `eq`، `res.json`، `db.select({ groupId: assignmentGroupMembers.groupId, id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, isActive: users.isActive, }).from(assignmentGroupMembers) .innerJoin(users, eq(assignmentGroupMembers.userId, users.id)) .where(inArray(assignmentGroupMembers.groupId, groupRows.map(group => group.id))) .orderBy`، `db.select({ groupId: assignmentGroupMembers.groupId, id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, isActive: users.isActive, }).from(assignmentGroupMembers) .innerJoin(users, eq(assignmentGroupMembers.userId, users.id)) .where`، `db.select({ groupId: assignmentGroupMembers.groupId, id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, isActive: users.isActive, }).from(assignmentGroupMembers) .innerJoin`، `db.select({ groupId: assignmentGroupMembers.groupId, id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, isActive: users.isActive, }).from`، `inArray`، `groupRows.map`، `membersByGroup.get`، `members.push`، `membersByGroup.set`، `res.status(500).json`، `res.status`

## POST `/api/assignment-groups`

- المصدر: server/routes.ts:2241
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `assignment_groups`
- الاستدعاءات الظاهرة: `requireModule`، `canManageAssignmentGroups`، `assignmentGroupsForbidden`، `insertAssignmentGroupSchema.parse`، `db.insert(assignmentGroups).values({ name: group.name, description: group.description ?? null, active: group.active ?? true, }).returning`، `db.insert(assignmentGroups).values`، `db.insert`، `logAudit`، `String`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(409).json`، `res.status(500).json`

## PUT `/api/assignment-groups/:id`

- المصدر: server/routes.ts:2259
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `assignment_groups`
- الاستدعاءات الظاهرة: `requireModule`، `canManageAssignmentGroups`، `assignmentGroupsForbidden`، `Number`، `Number.isSafeInteger`، `res.status(400).json`، `res.status`، `z.object({ name: z.string().trim().min(1).max(120).optional(), description: z.string().trim().max(2000).nullable().optional(), active: z.boolean().optional(), }).strict().refine(value => Object.keys(value).length > 0, { message: "Provide at least one field to update." }).parse`، `z.object({ name: z.string().trim().min(1).max(120).optional(), description: z.string().trim().max(2000).nullable().optional(), active: z.boolean().optional(), }).strict().refine`، `z.object({ name: z.string().trim().min(1).max(120).optional(), description: z.string().trim().max(2000).nullable().optional(), active: z.boolean().optional(), }).strict`، `z.object`، `z.string().trim().min(1).max(120).optional`، `z.string().trim().min(1).max`، `z.string().trim().min`، `z.string().trim`، `z.string`، `z.string().trim().max(2000).nullable().optional`، `z.string().trim().max(2000).nullable`، `z.string().trim().max`، `z.boolean().optional`، `z.boolean`، `Object.keys`، `db.update(assignmentGroups).set(input).where(eq(assignmentGroups.id, id)).returning`، `db.update(assignmentGroups).set(input).where`، `db.update(assignmentGroups).set`، `db.update`، `eq`، `res.status(404).json`، `logAudit`، `String`، `res.json`، `res.status(409).json`، `res.status(500).json`

## GET `/api/assignment-groups/:id/members`

- المصدر: server/routes.ts:2280
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `assignment_group_members`، `assignment_groups`، `roles`، `user_roles`، `users`
- الاستدعاءات الظاهرة: `requireModule`، `canAccessAssignmentMembers`، `res.status(403).json`، `res.status`، `Number`، `Number.isSafeInteger`، `res.status(400).json`، `db.select({ id: assignmentGroups.id, active: assignmentGroups.active }) .from(assignmentGroups).where`، `db.select({ id: assignmentGroups.id, active: assignmentGroups.active }) .from`، `db.select`، `eq`، `res.status(404).json`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, isActive: users.isActive, roleName: roles.name, }).from(assignmentGroupMembers) .innerJoin(users, eq(assignmentGroupMembers.userId, users.id)) .innerJoin(userRoles, eq(userRoles.userId, users.id)) .innerJoin(roles, eq(userRoles.roleId, roles.id)) .where(eq(assignmentGroupMembers.groupId, id)) .orderBy`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, isActive: users.isActive, roleName: roles.name, }).from(assignmentGroupMembers) .innerJoin(users, eq(assignmentGroupMembers.userId, users.id)) .innerJoin(userRoles, eq(userRoles.userId, users.id)) .innerJoin(roles, eq(userRoles.roleId, roles.id)) .where`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, isActive: users.isActive, roleName: roles.name, }).from(assignmentGroupMembers) .innerJoin(users, eq(assignmentGroupMembers.userId, users.id)) .innerJoin(userRoles, eq(userRoles.userId, users.id)) .innerJoin`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, isActive: users.isActive, roleName: roles.name, }).from(assignmentGroupMembers) .innerJoin(users, eq(assignmentGroupMembers.userId, users.id)) .innerJoin`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, isActive: users.isActive, roleName: roles.name, }).from(assignmentGroupMembers) .innerJoin`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, isActive: users.isActive, roleName: roles.name, }).from`، `asc`، `eligibleAssignmentRoles.has`، `row.roleName.trim().toLowerCase`، `row.roleName.trim`، `(await storage.getUserPermissions(row.id)).includes`، `storage.getUserPermissions`، `members.set`، `[row.firstName, row.lastName].filter(Boolean).join`، `[row.firstName, row.lastName].filter`، `res.json`، `Array.from`، `members.values`، `res.status(500).json`

## POST `/api/assignment-groups/:id/members`

- المصدر: server/routes.ts:2322
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `assignment_group_members`، `assignment_groups`، `roles`، `user_roles`، `users`
- الاستدعاءات الظاهرة: `requireModule`، `canManageAssignmentGroups`، `assignmentGroupsForbidden`، `Number`، `insertGroupMemberSchema.pick({ userId: true }).parse`، `insertGroupMemberSchema.pick`، `Number.isSafeInteger`، `res.status(400).json`، `res.status`، `db.select().from(assignmentGroups).where`، `db.select().from`، `db.select`، `and`، `eq`، `res.status(404).json`، `db.select({ id: users.id, roleName: roles.name }) .from(users) .innerJoin(userRoles, eq(userRoles.userId, users.id)) .innerJoin(roles, eq(userRoles.roleId, roles.id)) .where`، `db.select({ id: users.id, roleName: roles.name }) .from(users) .innerJoin(userRoles, eq(userRoles.userId, users.id)) .innerJoin`، `db.select({ id: users.id, roleName: roles.name }) .from(users) .innerJoin`، `db.select({ id: users.id, roleName: roles.name }) .from`، `eligibleRows.some`، `eligibleAssignmentRoles.has`، `row.roleName.trim().toLowerCase`، `row.roleName.trim`، `(await storage.getUserPermissions(userId)).includes`، `storage.getUserPermissions`، `db.insert(assignmentGroupMembers) .values({ groupId, userId }) .onConflictDoNothing() .returning`، `db.insert(assignmentGroupMembers) .values({ groupId, userId }) .onConflictDoNothing`، `db.insert(assignmentGroupMembers) .values`، `db.insert`، `res.status(409).json`، `logAudit`، `String`، `res.status(201).json`، `res.status(500).json`

## DELETE `/api/assignment-groups/:id/members/:userId`

- المصدر: server/routes.ts:2354
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `assignment_group_members`
- الاستدعاءات الظاهرة: `requireModule`، `canManageAssignmentGroups`، `assignmentGroupsForbidden`، `Number`، `Number.isSafeInteger`، `res.status(400).json`، `res.status`، `db.delete(assignmentGroupMembers) .where(and(eq(assignmentGroupMembers.groupId, groupId), eq(assignmentGroupMembers.userId, req.params.userId))) .returning`، `db.delete(assignmentGroupMembers) .where`، `db.delete`، `and`، `eq`، `res.status(404).json`، `logAudit`، `String`، `res.status(204).end`، `res.status(500).json`

## GET `/api/assignment-groups/eligible-users`

- المصدر: server/routes.ts:2201
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `roles`، `user_roles`، `users`
- الاستدعاءات الظاهرة: `requireModule`، `canManageAssignmentGroups`، `assignmentGroupsForbidden`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, roleName: roles.name, }).from(users) .innerJoin(userRoles, eq(userRoles.userId, users.id)) .innerJoin(roles, eq(userRoles.roleId, roles.id)) .where(eq(users.isActive, true)) .orderBy`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, roleName: roles.name, }).from(users) .innerJoin(userRoles, eq(userRoles.userId, users.id)) .innerJoin(roles, eq(userRoles.roleId, roles.id)) .where`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, roleName: roles.name, }).from(users) .innerJoin(userRoles, eq(userRoles.userId, users.id)) .innerJoin`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, roleName: roles.name, }).from(users) .innerJoin`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email, roleName: roles.name, }).from`، `db.select`، `eq`، `asc`، `eligibleAssignmentRoles.has`، `row.roleName.trim().toLowerCase`، `row.roleName.trim`، `eligible.set`، `[row.firstName, row.lastName].filter(Boolean).join`، `[row.firstName, row.lastName].filter`، `eligible.has`، `(await storage.getUserPermissions(row.id)).includes`، `storage.getUserPermissions`، `res.json`، `Array.from`، `eligible.values`، `res.status(500).json`، `res.status`

## GET `/api/assignments`

- المصدر: server/routes.ts:4811
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `inline handler`
- جداول مشار إليها مباشرة: `assignments`
- الاستدعاءات الظاهرة: `requireModule`، `storage.getAssignmentsWithDetails`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/assignments`

- المصدر: server/routes.ts:4832
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `requirePermission('assignment_create')` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `assignments`، `employees`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertAssignmentSchema.parse`، `db.transaction`، `tx.select({ id: assets.id }).from(assets).where(eq(assets.id, validatedData.assetId)).for`، `tx.select({ id: assets.id }).from(assets).where`، `tx.select({ id: assets.id }).from`، `tx.select`، `eq`، `Object.assign`، `tx.select({ id: employees.id, status: employees.status }).from(employees) .where(eq(employees.id, validatedData.employeeId)).for`، `tx.select({ id: employees.id, status: employees.status }).from(employees) .where`، `tx.select({ id: employees.id, status: employees.status }).from`، `tx.insert(assignments).values(validatedData).returning`، `tx.insert(assignments).values`، `tx.insert`، `tx.update(assets).set({ status: "assigned" }).where`، `tx.update(assets).set`، `tx.update`، `logAudit`، `assignment.id.toString`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status((error as any).status).json`، `res.status(500).json`

## DELETE `/api/assignments/:id`

- المصدر: server/routes.ts:4893
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('assignment_delete')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getAssignment`، `storage.deleteAssignment`، `res.status(404).json`، `res.status`، `storage.updateAsset`، `logAudit`، `assignment.id.toString`، `res.status(204).send`، `res.status(500).json`

## GET `/api/assignments/:id`

- المصدر: server/routes.ts:4820
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getAssignment`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/assignments/:id`

- المصدر: server/routes.ts:4862
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('assignment_update')` → `inline handler`
- جداول مشار إليها مباشرة: `assignments`، `employees`
- الاستدعاءات الظاهرة: `requirePermission`، `insertAssignmentSchema.partial().parse`، `insertAssignmentSchema.partial`، `db.transaction`، `tx.select().from(assignments).where(eq(assignments.id, req.params.id)).for`، `tx.select().from(assignments).where`، `tx.select().from`، `tx.select`، `eq`، `Object.assign`، `tx.select({ id: employees.id, status: employees.status }).from(employees) .where(eq(employees.id, validatedData.employeeId)).for`، `tx.select({ id: employees.id, status: employees.status }).from(employees) .where`، `tx.select({ id: employees.id, status: employees.status }).from`، `tx.update(assignments).set(validatedData) .where(eq(assignments.id, req.params.id)).returning`، `tx.update(assignments).set(validatedData) .where`، `tx.update(assignments).set`، `tx.update`، `logAudit`، `assignment.id.toString`، `res.json`، `res.status(400).json`، `res.status`، `res.status((error as any).status).json`، `res.status(500).json`

## POST `/api/assignments/:id/return`

- المصدر: server/routes.ts:4920
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('assignment_return')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getAssignment`، `res.status(404).json`، `res.status`، `storage.updateAssignment`، `new Date().toISOString().split`، `new Date().toISOString`، `storage.updateAsset`، `logAudit`، `res.json`، `res.status(500).json`

## GET `/api/audit-logs`

- المصدر: server/routes.ts:8985
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("audit_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireAnyPermission`، `res.setHeader`، `storage.getAuditLogs`، `Promise.all`، `logs.map`، `storage.getUser`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/auth/2fa/disable`

- المصدر: server/routes.ts:2766
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.updateUser2FA`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/auth/2fa/enable`

- المصدر: server/routes.ts:2744
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `import`، `speakeasy.default.totp.verify`، `res.status(400).json`، `res.status`، `storage.updateUser2FA`، `res.json`، `res.status(500).json`

## POST `/api/auth/2fa/setup`

- المصدر: server/routes.ts:2727
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `import`، `speakeasy.default.generateSecret`، `QRCode.default.toDataURL`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/auth/2fa/verify`

- المصدر: server/routes.ts:2775
- سلسلة الوسطاء/المعالج: `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getUserById`، `res.status(400).json`، `res.status`، `import`، `speakeasy.default.totp.verify`، `res.json`، `res.status(500).json`

## POST `/api/auth/verify-password`

- المصدر: server/routes.ts:2711
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `res.status(400).json`، `res.status`، `import`، `storage.getUser`، `res.status(404).json`، `comparePasswords`، `res.status(401).json`، `res.json`، `res.status(500).json`

## GET `/api/backup-schedules`

- المصدر: server/backup-governance.ts:168
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(false, async (_req, res) => { const schedules = await db.select().from(backupSchedules).orderBy(desc(backupSchedules.updatedAt)); if (!schedules.length) return res.json([]); const [runs, tests, serverRows, applicationRows] = await Promise.all([ db.select().from(backupJobRuns)`
- جداول مشار إليها مباشرة: `backup_job_runs`، `backup_restore_tests`، `backup_schedules`، `cmdb_applications`، `servers`
- الاستدعاءات الظاهرة: `route`، `db.select().from(backupSchedules).orderBy`، `db.select().from`، `db.select`، `desc`، `res.json`، `Promise.all`، `db.select().from(backupJobRuns).where(inArray(backupJobRuns.scheduleId, schedules.map(row => row.id))) .orderBy`، `db.select().from(backupJobRuns).where`، `inArray`، `schedules.map`، `db.select().from(backupRestoreTests).where(inArray(backupRestoreTests.scheduleId, schedules.map(row => row.id))) .orderBy`، `db.select().from(backupRestoreTests).where`، `db.select({ id: servers.id, name: servers.hostname }).from`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name }).from`، `latestRuns.has`، `latestRuns.set`، `latestTests.has`، `latestTests.set`، `serverRows.map`، `applicationRows.map`، `serverNames.get`، `applicationNames.get`، `latestRuns.get`، `latestTests.get`

## POST `/api/backup-schedules`

- المصدر: server/backup-governance.ts:195
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { const input = scheduleInput.parse(req.body); const [created] = await db.transaction(async tx => { const [row] = await tx.insert(backupSchedules).values({ ...input, nextDueAt: input.nextDueAt ? new Date(input.nextDueAt) : null,`
- جداول مشار إليها مباشرة: `backup_schedules`
- الاستدعاءات الظاهرة: `route`، `scheduleInput.parse`، `db.transaction`، `tx.insert(backupSchedules).values({ ...input, nextDueAt: input.nextDueAt ? new Date(input.nextDueAt) : null, createdById: user.id, }).returning`، `tx.insert(backupSchedules).values`، `tx.insert`، `writeAudit`، `res.status(201).json`، `res.status`

## PUT `/api/backup-schedules/:id`

- المصدر: server/backup-governance.ts:208
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { const input = scheduleInput.parse(req.body); const updated = await db.transaction(async tx => { const [before] = await tx.select().from(backupSchedules).where(eq(backupSchedules.id, req.params.id)).for("update"); if (!before) throw new Back`
- جداول مشار إليها مباشرة: `backup_schedules`
- الاستدعاءات الظاهرة: `route`، `scheduleInput.parse`، `db.transaction`، `tx.select().from(backupSchedules).where(eq(backupSchedules.id, req.params.id)).for`، `tx.select().from(backupSchedules).where`، `tx.select().from`، `tx.select`، `eq`، `tx.update(backupSchedules).set({ ...input, nextDueAt: input.nextDueAt === undefined ? before.nextDueAt : input.nextDueAt ? new Date(input.nextDueAt) : null, updatedAt: new Date(), }).where(eq(backupSchedules.id, before.id)).returning`، `tx.update(backupSchedules).set({ ...input, nextDueAt: input.nextDueAt === undefined ? before.nextDueAt : input.nextDueAt ? new Date(input.nextDueAt) : null, updatedAt: new Date(), }).where`، `tx.update(backupSchedules).set`، `tx.update`، `writeAudit`، `res.json`

## POST `/api/backup-schedules/:id/restore-tests`

- المصدر: server/backup-governance.ts:285
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { const input = restoreTestInput.parse(req.body); const created = await db.transaction(async tx => { const [schedule] = await tx.select().from(backupSchedules).where(eq(backupSchedules.id, req.params.id)).for("update"); if (!schedule) throw n`
- جداول مشار إليها مباشرة: `backup_restore_tests`، `backup_schedules`
- الاستدعاءات الظاهرة: `route`، `restoreTestInput.parse`، `db.transaction`، `tx.select().from(backupSchedules).where(eq(backupSchedules.id, req.params.id)).for`، `tx.select().from(backupSchedules).where`، `tx.select().from`، `tx.select`، `eq`، `tx.insert(backupRestoreTests).values({ ...input, scheduleId: schedule.id, testedAt: input.testedAt ? new Date(input.testedAt) : new Date(), testerId: user.id, }).returning`، `tx.insert(backupRestoreTests).values`، `tx.insert`، `writeAudit`، `res.status(201).json`، `res.status`

## POST `/api/backup-schedules/:id/runs`

- المصدر: server/backup-governance.ts:261
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { const input = jobRunInput.parse(req.body); const created = await db.transaction(async tx => { const [schedule] = await tx.select().from(backupSchedules).where(eq(backupSchedules.id, req.params.id)).for("update"); if (!schedule) throw new Ba`
- جداول مشار إليها مباشرة: `backup_job_runs`، `backup_schedules`
- الاستدعاءات الظاهرة: `route`، `jobRunInput.parse`، `db.transaction`، `tx.select().from(backupSchedules).where(eq(backupSchedules.id, req.params.id)).for`، `tx.select().from(backupSchedules).where`، `tx.select().from`، `tx.select`، `eq`، `tx.insert(backupJobRuns).values({ ...input, scheduleId: schedule.id, startedAt: new Date(input.startedAt), completedAt: input.completedAt ? new Date(input.completedAt) : null, loggedById: user.id, }).returning`، `tx.insert(backupJobRuns).values`، `tx.insert`، `advanceDueDate`، `tx.update(backupSchedules).set({ nextDueAt: nextDue, updatedAt: new Date(), }).where(eq(backupSchedules.id, schedule.id)).returning`، `tx.update(backupSchedules).set({ nextDueAt: nextDue, updatedAt: new Date(), }).where`، `tx.update(backupSchedules).set`، `tx.update`، `writeAudit`، `res.status(201).json`، `res.status`

## GET `/api/backup-schedules/options`

- المصدر: server/backup-governance.ts:154
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(false, async (_req, res, user) => { const [serverRows, applicationRows, ownerRows] = await Promise.all([ db.select({ id: servers.id, name: servers.hostname, status: servers.status }).from(servers).orderBy(asc(servers.hostname)), db.select({ id: cmdbApplications.id, name: cmdbAp`
- جداول مشار إليها مباشرة: `cmdb_applications`، `servers`، `users`
- الاستدعاءات الظاهرة: `route`، `Promise.all`، `db.select({ id: servers.id, name: servers.hostname, status: servers.status }).from(servers).orderBy`، `db.select({ id: servers.id, name: servers.hostname, status: servers.status }).from`، `db.select`، `asc`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, status: cmdbApplications.status }).from(cmdbApplications).orderBy`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, status: cmdbApplications.status }).from`، `isManager`، `db.select({ id: users.id, name: sql<string>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(users).where(eq(users.isActive, true)).orderBy`، `db.select({ id: users.id, name: sql<string>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(users).where`، `db.select({ id: users.id, name: sql<string>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from`، `eq`، `Promise.resolve`، `res.json`

## GET `/api/backup-schedules/restore-tests`

- المصدر: server/backup-governance.ts:242
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(false, async (_req, res) => { const rows = await db.select({ ...getTableColumns(backupRestoreTests), scheduleName: backupSchedules.name, serverId: backupSchedules.serverId, applicationId: backupSchedules.applicationId, }).from(backupRestoreTests).innerJoin(backu`
- جداول مشار إليها مباشرة: `backup_restore_tests`، `backup_schedules`، `cmdb_applications`، `servers`
- الاستدعاءات الظاهرة: `route`، `db.select({ ...getTableColumns(backupRestoreTests), scheduleName: backupSchedules.name, serverId: backupSchedules.serverId, applicationId: backupSchedules.applicationId, }).from(backupRestoreTests).innerJoin(backupSchedules, eq(backupRestoreTests.scheduleId, backupSchedules.id)) .orderBy(desc(backupRestoreTests.testedAt)).limit`، `db.select({ ...getTableColumns(backupRestoreTests), scheduleName: backupSchedules.name, serverId: backupSchedules.serverId, applicationId: backupSchedules.applicationId, }).from(backupRestoreTests).innerJoin(backupSchedules, eq(backupRestoreTests.scheduleId, backupSchedules.id)) .orderBy`، `db.select({ ...getTableColumns(backupRestoreTests), scheduleName: backupSchedules.name, serverId: backupSchedules.serverId, applicationId: backupSchedules.applicationId, }).from(backupRestoreTests).innerJoin`، `db.select({ ...getTableColumns(backupRestoreTests), scheduleName: backupSchedules.name, serverId: backupSchedules.serverId, applicationId: backupSchedules.applicationId, }).from`، `db.select`، `getTableColumns`، `eq`، `desc`، `res.json`، `Array.from`، `rows.flatMap`، `Promise.all`، `db.select({ id: servers.id, name: servers.hostname }).from(servers).where`، `db.select({ id: servers.id, name: servers.hostname }).from`، `inArray`، `Promise.resolve`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name }).from(cmdbApplications).where`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name }).from`، `[...serverRows, ...applicationRows].map`، `rows.map`، `names.get`

## GET `/api/backup-schedules/runs`

- المصدر: server/backup-governance.ts:224
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(false, async (_req, res) => { const rows = await db.select({ ...getTableColumns(backupJobRuns), scheduleName: backupSchedules.name, serverId: backupSchedules.serverId, applicationId: backupSchedules.applicationId, }).from(backupJobRuns).innerJoin(backupSchedules`
- جداول مشار إليها مباشرة: `backup_job_runs`، `backup_schedules`، `cmdb_applications`، `servers`
- الاستدعاءات الظاهرة: `route`، `db.select({ ...getTableColumns(backupJobRuns), scheduleName: backupSchedules.name, serverId: backupSchedules.serverId, applicationId: backupSchedules.applicationId, }).from(backupJobRuns).innerJoin(backupSchedules, eq(backupJobRuns.scheduleId, backupSchedules.id)) .orderBy(desc(backupJobRuns.startedAt)).limit`، `db.select({ ...getTableColumns(backupJobRuns), scheduleName: backupSchedules.name, serverId: backupSchedules.serverId, applicationId: backupSchedules.applicationId, }).from(backupJobRuns).innerJoin(backupSchedules, eq(backupJobRuns.scheduleId, backupSchedules.id)) .orderBy`، `db.select({ ...getTableColumns(backupJobRuns), scheduleName: backupSchedules.name, serverId: backupSchedules.serverId, applicationId: backupSchedules.applicationId, }).from(backupJobRuns).innerJoin`، `db.select({ ...getTableColumns(backupJobRuns), scheduleName: backupSchedules.name, serverId: backupSchedules.serverId, applicationId: backupSchedules.applicationId, }).from`، `db.select`، `getTableColumns`، `eq`، `desc`، `res.json`، `Array.from`، `rows.flatMap`، `Promise.all`، `db.select({ id: servers.id, name: servers.hostname }).from(servers).where`، `db.select({ id: servers.id, name: servers.hostname }).from`، `inArray`، `Promise.resolve`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name }).from(cmdbApplications).where`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name }).from`، `[...serverRows, ...applicationRows].map`، `rows.map`، `names.get`

## GET `/api/budgets`

- المصدر: server/routes.ts:7507
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "budget_create", "budget_update", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `budgets`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `storage.getBudgets`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/budgets`

- المصدر: server/routes.ts:7516
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('budget_create')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertBudgetSchema.parse`، `storage.createBudget`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## DELETE `/api/budgets/:id`

- المصدر: server/routes.ts:7557
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('budget_delete')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getBudget`، `storage.deleteBudget`، `res.status(404).json`، `res.status`، `logAudit`، `res.status(204).send`، `res.status(500).json`

## PUT `/api/budgets/:id`

- المصدر: server/routes.ts:7533
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('budget_update')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertBudgetSchema.partial().parse`، `insertBudgetSchema.partial`، `storage.getBudget`، `storage.updateBudget`، `res.status(404).json`، `res.status`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## GET `/api/catalog/items`

- المصدر: server/routes.ts:10045
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `res.json`، `storage.getCatalogItems`، `res.status(500).json`، `res.status`

## POST `/api/catalog/items`

- المصدر: server/routes.ts:10060
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertCatalogItemSchema.parse`، `storage.createCatalogItem`، `syncLegacyCatalogItem`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## DELETE `/api/catalog/items/:id`

- المصدر: server/routes.ts:10085
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `isStructuredCatalogItem`، `res.status(409).json`، `res.status`، `storage.deleteCatalogItem`، `res.status(404).json`، `res.json`، `res.status(500).json`

## GET `/api/catalog/items/:id`

- المصدر: server/routes.ts:10052
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getCatalogItem`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/catalog/items/:id`

- المصدر: server/routes.ts:10072
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `isStructuredCatalogItem`، `res.status(409).json`، `res.status`، `insertCatalogItemSchema.partial().parse`، `insertCatalogItemSchema.partial`، `storage.updateCatalogItem`، `res.status(404).json`، `res.json`، `res.status(400).json`، `res.status(500).json`

## POST `/api/catalog/items/:id/request`

- المصدر: server/routes.ts:10095
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `isStructuredCatalogItem`، `catalogRequestHandler`، `storage.getCatalogItem`، `res.status(404).json`، `res.status`، `storage.createTicket`، `new Date(Date.now() + item.slaHours * 3600000).toISOString().split`، `new Date(Date.now() + item.slaHours * 3600000).toISOString`، `Date.now`، `res.status(201).json`، `res.status(500).json`

## POST `/api/change-blackouts`

- المصدر: server/routes.ts:10707
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `change_blackouts`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `blackoutPayloadSchema.safeParse`، `res.status(400).json`، `res.status`، `db.insert(changeBlackouts).values({ ...parsed.data, reason: parsed.data.reason \|\| null, createdById: (req.user as any).id, }).returning`، `db.insert(changeBlackouts).values`، `db.insert`، `res.status(201).json`، `res.status(500).json`

## DELETE `/api/change-blackouts/:id`

- المصدر: server/routes.ts:10738
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `change_blackouts`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `db.delete(changeBlackouts).where(eq(changeBlackouts.id, req.params.id)).returning`، `db.delete(changeBlackouts).where`، `db.delete`، `eq`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/change-blackouts/:id`

- المصدر: server/routes.ts:10722
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `change_blackouts`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `blackoutPayloadSchema.safeParse`، `res.status(400).json`، `res.status`، `db.update(changeBlackouts).set({ ...parsed.data, reason: parsed.data.reason \|\| null, updatedAt: new Date(), }).where(eq(changeBlackouts.id, req.params.id)).returning`، `db.update(changeBlackouts).set({ ...parsed.data, reason: parsed.data.reason \|\| null, updatedAt: new Date(), }).where`، `db.update(changeBlackouts).set`، `db.update`، `eq`، `res.status(404).json`، `res.json`، `res.status(500).json`

## GET `/api/changes`

- المصدر: server/routes.ts:10748
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `changes`
- الاستدعاءات الظاهرة: `requireModule`، `canViewAllItsmRecords`، `Number`، `Number.isSafeInteger`، `["standard", "normal", "emergency"].includes`، `["draft", "submitted", "approved", "rejected", "in_progress", "completed", "cancelled", "failed"].includes`، `res.status(400).json`، `res.status`، `storage.getChangesPage`، `getChangeImpactSummaries`، `result.changes.map`، `res.json`، `impactSummaries.get`، `res.status(500).json`

## POST `/api/changes`

- المصدر: server/routes.ts:10797
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `projects`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `changeTargetSchema.parse`، `isFeatureEnabled`، `sendFeatureNotEnabled`، `db.select({ id: projects.id }).from(projects).where`، `db.select({ id: projects.id }).from`، `db.select`، `eq`، `res.status(400).json`، `res.status`، `validateChangeCiTargets`، `validateChangeAssetTargets`، `["normal", "emergency"].includes`، `["high", "critical"].includes`، `storage.createChange`، `db.transaction`، `syncChangeCiLinks`، `syncChangeAssetLinks`، `res.status(201).json`، `getChangeImpactAnalysis`، `console.error`، `res.status((err as any).status).json`، `res.status(500).json`، `String`

## DELETE `/api/changes/:changeId/approvals/:approvalId`

- المصدر: server/routes.ts:11027
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getUserPermissions`، `callerPermissions.includes`، `res.status(403).json`، `res.status`، `storage.getChangeApprovals`، `approvals.find`، `res.status(404).json`، `res.status(409).json`، `storage.removeChangeApproval`، `logAudit`، `publishCabChange`، `res.json`، `console.error`، `res.status(500).json`

## PUT `/api/changes/:changeId/approvals/:approvalId`

- المصدر: server/routes.ts:11055
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requireAnyPermission("change_approve", "change_manage", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `VALID_DECISIONS.includes`، `res.status(400).json`، `res.status`، `storage.getChangeApprovals`، `allApprovals.find`، `res.status(404).json`، `res.status(409).json`، `res.status(403).json`، `storage.updateChangeApproval`، `storage.getChange`، `publishCabChange`، `res.json`، `res.status(500).json`

## DELETE `/api/changes/:id`

- المصدر: server/routes.ts:10937
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.deleteChange`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## GET `/api/changes/:id`

- المصدر: server/routes.ts:10782
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getChange`، `res.status(404).json`، `res.status`، `(await storage.getUserPermissions(userId)).some`، `storage.getUserPermissions`، `["system_admin", "change_manage"].includes`، `canViewAllItsmRecords`، `res.status(403).json`، `res.json`، `getChangeImpactAnalysis`، `res.status(500).json`

## PUT `/api/changes/:id`

- المصدر: server/routes.ts:10848
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `change_asset_links`، `change_ci_links`، `projects`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.getChange`، `changeTargetSchema.parse`، `isFeatureEnabled`، `sendFeatureNotEnabled`، `db.select({ id: projects.id }).from(projects).where`، `db.select({ id: projects.id }).from`، `db.select`، `eq`، `res.status(400).json`، `res.status`، `db.select().from(changeCiLinks).where`، `db.select().from`، `currentLinks.flatMap`، `validateChangeCiTargets`، `db.select().from(changeAssetLinks).where`، `currentAssetLinks.map`، `validateChangeAssetTargets`، `storage.updateChangeWithCabStatusGuard`، `res.status(409).json`، `logAudit`، `res.status(403).json`، `res.status(404).json`، `db.transaction`، `syncChangeCiLinks`، `syncChangeAssetLinks`، `res.json`، `getChangeImpactAnalysis`، `console.error`، `res.status((err as any).status).json`، `res.status(500).json`، `String`

## GET `/api/changes/:id/approvals`

- المصدر: server/routes.ts:10945
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getChange`، `res.status(404).json`، `res.status`، `canViewAllItsmRecords`، `res.status(403).json`، `res.json`، `storage.getChangeApprovals`، `res.status(500).json`

## POST `/api/changes/:id/approvals`

- المصدر: server/routes.ts:10957
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.getUserPermissions`، `callerPermissions.includes`، `res.status(403).json`، `res.status`، `storage.createChangeApproval`، `logAudit`، `publishCabChange`، `res.status(201).json`، `res.status(409).json`، `storage.getAllChangeApprovalRecords`، `history.some`، `console.error`، `res.status(500).json`

## POST `/api/changes/:id/assign`

- المصدر: server/routes.ts:11135
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.updateChange`، `res.status(404).json`، `res.status`، `res.json`، `storage.getChange`، `console.error`، `res.status(500).json`

## POST `/api/changes/:id/cancel`

- المصدر: server/routes.ts:11215
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.getChange`، `res.status(404).json`، `res.status`، `["completed","cancelled"].includes`، `res.status(400).json`، `storage.updateChange`، `res.json`، `console.error`، `res.status(500).json`

## POST `/api/changes/:id/complete`

- المصدر: server/routes.ts:11205
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.getChange`، `res.status(404).json`، `res.status`، `res.status(400).json`، `storage.updateChange`، `res.json`، `console.error`، `res.status(500).json`

## GET `/api/changes/:id/pir`

- المصدر: server/routes.ts:11102
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getChangePIR`، `res.status(404).json`، `res.status`، `canReadChangeRecord`، `res.status(403).json`، `res.json`، `res.status(500).json`

## POST `/api/changes/:id/pir`

- المصدر: server/routes.ts:11111
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.getChange`، `res.status(404).json`، `res.status`، `["completed", "cancelled"].includes`، `res.status(400).json`، `storage.getChangePIR`، `res.status(409).json`، `storage.createChangePIR`، `res.status(201).json`، `res.status(500).json`

## PUT `/api/changes/:id/pir`

- المصدر: server/routes.ts:11126
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.updateChangePIR`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## GET `/api/changes/:id/stages`

- المصدر: server/routes.ts:11226
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `canReadChangeRecord`، `res.status(403).json`، `res.status`، `res.json`، `storage.getChangeStages`، `res.status(500).json`

## PUT `/api/changes/:id/stages/:stageId`

- المصدر: server/routes.ts:11243
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.getChange`، `res.status(404).json`، `res.status`، `res.status(400).json`، `storage.getChangeStages`، `existingStages.some`، `storage.updateChangeStage`، `res.json`، `console.error`، `res.status(500).json`

## POST `/api/changes/:id/stages/init`

- المصدر: server/routes.ts:11234
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.getChangeStages`، `res.json`، `storage.createDefaultChangeStages`، `res.status(201).json`، `res.status`، `res.status(500).json`

## POST `/api/changes/:id/start`

- المصدر: server/routes.ts:11166
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.getChange`، `res.status(404).json`، `res.status`، `res.status(400).json`، `storage.updateChangeWithCabStatusGuard`، `storage.getChangeStages`، `storage.createDefaultChangeStages`، `res.json`، `console.error`، `res.status(500).json`

## POST `/api/changes/:id/submit`

- المصدر: server/routes.ts:11148
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.getChange`، `res.status(404).json`، `res.status`، `["draft","rejected"].includes`، `res.status(400).json`، `storage.updateChangeWithCabStatusGuard`، `res.json`، `console.error`، `res.status(500).json`

## GET `/api/changes/calendar`

- المصدر: server/routes.ts:10658
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("change_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `change_blackouts`، `changes`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `blackoutDateSchema.safeParse`، `res.status(400).json`، `res.status`، `new Date('${to}T00:00:00.000Z').getTime`، `toExclusive.getTime`، `fromTime.getTime`، `Promise.all`، `db.select({ id: changes.id, changeNumber: changes.changeNumber, title: changes.title, status: changes.status, type: changes.type, scheduledStart: changes.scheduledStart, scheduledEnd: changes.scheduledEnd, risk: changes.risk, }).from(changes).where(and( inArray(changes.status, ["submitted", "approved", "in_progress"]), isNotNull(changes.scheduledStart), isNotNull(changes.scheduledEnd), lt(changes.scheduledStart, toExclusive), gte(changes.scheduledEnd, fromTime), )).orderBy`، `db.select({ id: changes.id, changeNumber: changes.changeNumber, title: changes.title, status: changes.status, type: changes.type, scheduledStart: changes.scheduledStart, scheduledEnd: changes.scheduledEnd, risk: changes.risk, }).from(changes).where`، `db.select({ id: changes.id, changeNumber: changes.changeNumber, title: changes.title, status: changes.status, type: changes.type, scheduledStart: changes.scheduledStart, scheduledEnd: changes.scheduledEnd, risk: changes.risk, }).from`، `db.select`، `and`، `inArray`، `isNotNull`، `lt`، `gte`، `asc`، `db.select({ id: changeBlackouts.id, title: changeBlackouts.title, reason: changeBlackouts.reason, startDate: changeBlackouts.startDate, endDate: changeBlackouts.endDate, createdAt: changeBlackouts.createdAt, }).from(changeBlackouts).where(and( lte(changeBlackouts.startDate, to), gte(changeBlackouts.endDate, from), )).orderBy`، `db.select({ id: changeBlackouts.id, title: changeBlackouts.title, reason: changeBlackouts.reason, startDate: changeBlackouts.startDate, endDate: changeBlackouts.endDate, createdAt: changeBlackouts.createdAt, }).from(changeBlackouts).where`، `db.select({ id: changeBlackouts.id, title: changeBlackouts.title, reason: changeBlackouts.reason, startDate: changeBlackouts.startDate, endDate: changeBlackouts.endDate, createdAt: changeBlackouts.createdAt, }).from`، `lte`، `res.json`، `res.status(500).json`

## GET `/api/changes/events`

- المصدر: server/routes.ts:10250
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `cabEventsHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`

## GET `/api/changes/pending-votes`

- المصدر: server/routes.ts:10777
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `res.json`، `storage.getPendingCabChanges`، `res.status(500).json`، `res.status`

## GET `/api/cmdb/application-options`

- المصدر: server/routes.ts:3484
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requirePermission("asset_update")` → `inline handler`
- جداول مشار إليها مباشرة: `cmdb_applications`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, status: cmdbApplications.status, }).from(cmdbApplications).orderBy`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, status: cmdbApplications.status, }).from`، `db.select`، `asc`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/cmdb/change-options`

- المصدر: server/routes.ts:10608
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requireModule("cmdb")` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `cmdb_applications`، `servers`
- الاستدعاءات الظاهرة: `requireModule`، `isFeatureEnabled`، `Promise.all`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, category: cmdbApplications.category, criticalityRating: cmdbApplications.criticalityRating, businessOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.businessOwner})' : sql<string \| null>'NULL', technicalOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.technicalOwner})' : sql<string \| null>'NULL', }).from(cmdbApplications).where(eq(cmdbApplications.status, "active")).orderBy`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, category: cmdbApplications.category, criticalityRating: cmdbApplications.criticalityRating, businessOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.businessOwner})' : sql<string \| null>'NULL', technicalOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.technicalOwner})' : sql<string \| null>'NULL', }).from(cmdbApplications).where`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, category: cmdbApplications.category, criticalityRating: cmdbApplications.criticalityRating, businessOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.businessOwner})' : sql<string \| null>'NULL', technicalOwnerName: employeeDirectoryEnabled ? sql<string \| null>'(SELECT concat_ws(' ', first_name, last_name) FROM employees WHERE id = ${cmdbApplications.technicalOwner})' : sql<string \| null>'NULL', }).from`، `db.select`، `eq`، `asc`، `db.select({ id: servers.id, hostname: servers.hostname, ipAddress: servers.ipAddress, environment: servers.environment, status: servers.status, }).from(servers).where(sql'${servers.status} <> 'offline'').orderBy`، `db.select({ id: servers.id, hostname: servers.hostname, ipAddress: servers.ipAddress, environment: servers.environment, status: servers.status, }).from(servers).where`، `db.select({ id: servers.id, hostname: servers.hostname, ipAddress: servers.ipAddress, environment: servers.environment, status: servers.status, }).from`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, type: assets.type, category: assets.category, criticalityRating: assets.criticalityRating, lifecycleStatus: assets.lifecycleStatus, }).from(assets).orderBy`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, type: assets.type, category: assets.category, criticalityRating: assets.criticalityRating, lifecycleStatus: assets.lifecycleStatus, }).from`، `Promise.resolve`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/compliance/assets/audit-due`

- المصدر: server/routes.ts:7751
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('compliance_view')` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getAssets`، `assets.filter`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/compliance/assets/security-classification/:classification`

- المصدر: server/routes.ts:7738
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('compliance_view')` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getAssets`، `assets.filter`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/compliance/assets/status/:status`

- المصدر: server/routes.ts:7767
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('compliance_view')` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getAssets`، `assets.filter`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/compliance/dashboard`

- المصدر: server/routes.ts:7793
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('compliance_view')` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `vendors`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getAssets`، `storage.getVendors`، `assets.filter`، `vendors.filter`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/compliance/vendors/risk/:level`

- المصدر: server/routes.ts:7780
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('compliance_view')` → `inline handler`
- جداول مشار إليها مباشرة: `vendors`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getVendors`، `vendors.filter`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/consumables`

- المصدر: server/routes.ts:5695
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `inline handler`
- جداول مشار إليها مباشرة: `consumables`، `vendors`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requireModule`، `db.select({ id: consumables.id, name: consumables.name, category: consumables.category, modelPartNumber: consumables.modelPartNumber, quantityInStock: consumables.quantityInStock, minReorderLevel: consumables.minReorderLevel, warehouseLocationId: consumables.warehouseLocationId, storageRoom: consumables.storageRoom, unitCost: consumables.unitCost, vendorId: consumables.vendorId, createdAt: consumables.createdAt, updatedAt: consumables.updatedAt, warehouseName: warehouseLocations.name, warehouseCode: warehouseLocations.code, warehouseIsActive: warehouseLocations.isActive, vendorName: vendors.name, }).from(consumables) .leftJoin(warehouseLocations, eq(warehouseLocations.id, consumables.warehouseLocationId)) .leftJoin(vendors, eq(vendors.id, consumables.vendorId)) .orderBy`، `db.select({ id: consumables.id, name: consumables.name, category: consumables.category, modelPartNumber: consumables.modelPartNumber, quantityInStock: consumables.quantityInStock, minReorderLevel: consumables.minReorderLevel, warehouseLocationId: consumables.warehouseLocationId, storageRoom: consumables.storageRoom, unitCost: consumables.unitCost, vendorId: consumables.vendorId, createdAt: consumables.createdAt, updatedAt: consumables.updatedAt, warehouseName: warehouseLocations.name, warehouseCode: warehouseLocations.code, warehouseIsActive: warehouseLocations.isActive, vendorName: vendors.name, }).from(consumables) .leftJoin(warehouseLocations, eq(warehouseLocations.id, consumables.warehouseLocationId)) .leftJoin`، `db.select({ id: consumables.id, name: consumables.name, category: consumables.category, modelPartNumber: consumables.modelPartNumber, quantityInStock: consumables.quantityInStock, minReorderLevel: consumables.minReorderLevel, warehouseLocationId: consumables.warehouseLocationId, storageRoom: consumables.storageRoom, unitCost: consumables.unitCost, vendorId: consumables.vendorId, createdAt: consumables.createdAt, updatedAt: consumables.updatedAt, warehouseName: warehouseLocations.name, warehouseCode: warehouseLocations.code, warehouseIsActive: warehouseLocations.isActive, vendorName: vendors.name, }).from(consumables) .leftJoin`، `db.select({ id: consumables.id, name: consumables.name, category: consumables.category, modelPartNumber: consumables.modelPartNumber, quantityInStock: consumables.quantityInStock, minReorderLevel: consumables.minReorderLevel, warehouseLocationId: consumables.warehouseLocationId, storageRoom: consumables.storageRoom, unitCost: consumables.unitCost, vendorId: consumables.vendorId, createdAt: consumables.createdAt, updatedAt: consumables.updatedAt, warehouseName: warehouseLocations.name, warehouseCode: warehouseLocations.code, warehouseIsActive: warehouseLocations.isActive, vendorName: vendors.name, }).from`، `db.select`، `eq`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/consumables`

- المصدر: server/routes.ts:5724
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("asset_create")` → `inline handler`
- جداول مشار إليها مباشرة: `consumable_stock_movements`، `consumables`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertConsumableSchema.parse`، `db.transaction`، `tx.select({ id: warehouseLocations.id }).from(warehouseLocations) .where(and(eq(warehouseLocations.id, input.warehouseLocationId), eq(warehouseLocations.isActive, true))).for`، `tx.select({ id: warehouseLocations.id }).from(warehouseLocations) .where`، `tx.select({ id: warehouseLocations.id }).from`، `tx.select`، `and`، `eq`، `Object.assign`، `tx.insert(consumables).values({ ...input, storageRoom: input.storageRoom \|\| null }).returning`، `tx.insert(consumables).values`، `tx.insert`، `tx.insert(consumableStockMovements).values`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status((error as any).status).json`، `res.status(500).json`

## PATCH `/api/consumables/:id`

- المصدر: server/routes.ts:5750
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("asset_update")` → `inline handler`
- جداول مشار إليها مباشرة: `consumables`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertConsumableSchema.partial().omit({ quantityInStock: true }).parse`، `insertConsumableSchema.partial().omit`، `insertConsumableSchema.partial`، `db.transaction`، `tx.select({ id: consumables.id, warehouseLocationId: consumables.warehouseLocationId }) .from(consumables).where(eq(consumables.id, req.params.id)).for`، `tx.select({ id: consumables.id, warehouseLocationId: consumables.warehouseLocationId }) .from(consumables).where`، `tx.select({ id: consumables.id, warehouseLocationId: consumables.warehouseLocationId }) .from`، `tx.select`، `eq`، `tx.select({ id: warehouseLocations.id }).from(warehouseLocations) .where(and(eq(warehouseLocations.id, input.warehouseLocationId), eq(warehouseLocations.isActive, true))).for`، `tx.select({ id: warehouseLocations.id }).from(warehouseLocations) .where`، `tx.select({ id: warehouseLocations.id }).from`، `and`، `Object.assign`، `tx.update(consumables).set({ ...input, updatedAt: new Date() }) .where(eq(consumables.id, req.params.id)).returning`، `tx.update(consumables).set({ ...input, updatedAt: new Date() }) .where`، `tx.update(consumables).set`، `tx.update`، `res.status(404).json`، `res.status`، `res.json`، `res.status(400).json`، `res.status((error as any).status).json`، `res.status(500).json`

## POST `/api/consumables/:id/draft-purchase-order`

- المصدر: server/routes.ts:5881
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("purchase_order_create")` → `inline handler`
- جداول مشار إليها مباشرة: `consumables`، `purchase_order_items`، `purchase_orders`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `db.select().from(consumables).where`، `db.select().from`، `db.select`، `eq`، `res.status(404).json`، `res.status`، `db.select({ name: warehouseLocations.name }).from(warehouseLocations) .where`، `db.select({ name: warehouseLocations.name }).from`، `and`، `res.status(400).json`، `storage.getVendor`، `Math.max`، `db.transaction`، `reserveFinancialDocumentNumber`، `tx.insert(purchaseOrders).values({ poNumber, vendorId: item.vendorId, vendor: vendorName, reference: 'Low stock reorder: ${item.name}', orderDate: new Date().toISOString().slice(0, 10), expectedDelivery: null, actualDelivery: null, totalAmount: (Number(item.unitCost) * shortage).toFixed(2), status: "pending", departmentId: null, notes: 'Draft reorder for ${location.name}; current stock ${item.quantityInStock}, minimum ${item.minReorderLevel}.', assetsCreated: false, }).returning`، `tx.insert(purchaseOrders).values`، `tx.insert`، `new Date().toISOString().slice`، `new Date().toISOString`، `(Number(item.unitCost) * shortage).toFixed`، `Number`، `tx.insert(purchaseOrderItems).values`، `res.status(201).json`، `res.status(status).json`، `res.status(409).json`، `console.error`، `res.status(500).json`

## POST `/api/consumables/:id/stock-movement`

- المصدر: server/routes.ts:5775
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("asset_update")` → `inline handler`
- جداول مشار إليها مباشرة: `consumable_stock_movements`، `consumables`، `users`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `z.discriminatedUnion`، `z.object`، `z.literal`، `z.number().int().positive`، `z.number().int`، `z.number`، `z.string().uuid`، `z.string`، `z.string().trim().max(2000).optional`، `z.string().trim().max`، `z.string().trim`، `z.object({ movementType: z.literal("adjustment"), direction: z.enum(["increase", "decrease"]), quantity: z.number().int().positive(), reasonCode: z.enum(["cycle_count", "damage", "correction", "found_stock", "other"]), notes: z.string().trim().max(2000).optional(), }).superRefine`، `z.enum`، `input.notes?.trim`، `context.addIssue`، `movementSchema.parse`، `db.transaction`، `tx.select().from(consumables).where(eq(consumables.id, req.params.id)).for`، `tx.select().from(consumables).where`، `tx.select().from`، `tx.select`، `eq`، `Object.assign`، `tx.select({ id: warehouseLocations.id }).from(warehouseLocations) .where(and(eq(warehouseLocations.id, source.warehouseLocationId), eq(warehouseLocations.isActive, true))).for`، `tx.select({ id: warehouseLocations.id }).from(warehouseLocations) .where`، `tx.select({ id: warehouseLocations.id }).from`، `and`، `tx.select({ id: users.id }).from(users).where`، `tx.select({ id: users.id }).from`، `tx.update(consumables).set({ quantityInStock: source.quantityInStock - input.quantity, updatedAt: new Date(), }).where(eq(consumables.id, source.id)).returning`، `tx.update(consumables).set({ quantityInStock: source.quantityInStock - input.quantity, updatedAt: new Date(), }).where`، `tx.update(consumables).set`، `tx.update`، `tx.insert(consumableStockMovements).values({ consumableId: source.id, movementType: "issue", quantity: input.quantity, fromWarehouseLocationId: source.warehouseLocationId, recipientUserId: input.recipientUserId, actorId: req.user!.id, notes: input.notes \|\| null, }).returning`، `tx.insert(consumableStockMovements).values`، `tx.insert`، `tx.update(consumables).set({ quantityInStock: adjustedQuantity, updatedAt: new Date(), }).where(eq(consumables.id, source.id)).returning`، `tx.update(consumables).set({ quantityInStock: adjustedQuantity, updatedAt: new Date(), }).where`، `tx.insert(consumableStockMovements).values({ consumableId: source.id, movementType: input.direction === "increase" ? "adjustment_in" : "adjustment_out", reasonCode: input.reasonCode, quantity: input.quantity, fromWarehouseLocationId: input.direction === "decrease" ? source.warehouseLocationId : null, toWarehouseLocationId: input.direction === "increase" ? source.warehouseLocationId : null, actorId: req.user!.id, notes: input.notes?.trim() \|\| null, }).returning`، `tx.select({ id: warehouseLocations.id }).from(warehouseLocations) .where(and(eq(warehouseLocations.id, input.toWarehouseLocationId), eq(warehouseLocations.isActive, true))).for`، `tx.update(consumables).set({ quantityInStock: source.quantityInStock - input.quantity, updatedAt: new Date(), }).where(eq(consumables.id, source.id)).returning`، `tx.update(consumables).set({ quantityInStock: source.quantityInStock - input.quantity, updatedAt: new Date(), }).where`، `tx.select().from(consumables).where(eq(consumables.warehouseLocationId, input.toWarehouseLocationId)).for`، `destinationRows.find`، `row.name.toLocaleLowerCase`، `source.name.toLocaleLowerCase`، `(row.modelPartNumber ?? "").toLocaleLowerCase`، `(source.modelPartNumber ?? "").toLocaleLowerCase`، `tx.update(consumables).set({ quantityInStock: destinationItem.quantityInStock + input.quantity, updatedAt: new Date(), }).where(eq(consumables.id, destinationItem.id)).returning`، `tx.update(consumables).set({ quantityInStock: destinationItem.quantityInStock + input.quantity, updatedAt: new Date(), }).where`، `tx.insert(consumables).values({ name: source.name, category: source.category, modelPartNumber: source.modelPartNumber, quantityInStock: input.quantity, minReorderLevel: source.minReorderLevel, warehouseLocationId: input.toWarehouseLocationId, storageRoom: null, unitCost: source.unitCost, vendorId: source.vendorId, }).returning`، `tx.insert(consumables).values`، `tx.insert(consumableStockMovements).values({ consumableId: source.id, movementType: "transfer", quantity: input.quantity, fromWarehouseLocationId: source.warehouseLocationId, toWarehouseLocationId: input.toWarehouseLocationId, actorId: req.user!.id, notes: input.notes \|\| null, }).returning`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(status).json`، `res.status(500).json`

## GET `/api/consumables/options`

- المصدر: server/routes.ts:5678
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `inline handler`
- جداول مشار إليها مباشرة: `locations`، `users`، `vendors`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requireModule`، `Promise.all`، `db.select().from(warehouseLocations).where(eq(warehouseLocations.isActive, true)).orderBy`، `db.select().from(warehouseLocations).where`، `db.select().from`، `db.select`، `eq`، `db.select({ id: vendors.id, name: vendors.name }).from`، `db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, email: users.email }).from(users).where`، `db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, email: users.email }).from`، `res.json`، `userRows.map`، `[user.firstName, user.lastName].filter(Boolean).join`، `[user.firstName, user.lastName].filter`، `res.status(500).json`، `res.status`

## GET `/api/contracts`

- المصدر: server/routes.ts:989
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireContractPermission("GET")` → `inline handler`
- جداول مشار إليها مباشرة: `contracts`، `vendor_contracts`
- الاستدعاءات الظاهرة: `requireContractPermission`، `isServiceContractApiRequest`، `listServiceContracts`، `storage.getContracts`، `new Date().toISOString().split`، `new Date().toISOString`، `contracts .filter(c => c.endDate && c.endDate < today && ["active", "pending"].includes(c.status ?? "")) .map`، `contracts .filter`، `["active", "pending"].includes`، `Promise.all`، `expiredIds.map`، `storage.updateContract`، `db.select({ id: vendorContracts.id }).from`، `db.select`، `managed.map`، `res.json`، `updated.map`، `managedIds.has`، `contracts.map`، `res.status(500).json`، `res.status`

## POST `/api/contracts`

- المصدر: server/routes.ts:1015
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireContractPermission("POST")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireContractPermission`، `isServiceContractApiRequest`، `createServiceContract`، `insertContractSchema.parse`، `storage.createContract`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## DELETE `/api/contracts/:id`

- المصدر: server/routes.ts:1057
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireContractPermission("DELETE")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireContractPermission`، `/^\d+$/.test`، `deleteServiceContract`، `Number`، `isGovernedVendorContract`، `res.status(409).json`، `res.status`، `storage.getContract`، `storage.deleteContract`، `res.status(404).json`، `logAudit`، `res.status(204).send`، `res.status(500).json`

## GET `/api/contracts/:id`

- المصدر: server/routes.ts:1030
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireContractPermission("GET")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireContractPermission`، `/^\d+$/.test`، `getServiceContractById`، `Number`، `storage.getContract`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/contracts/:id`

- المصدر: server/routes.ts:1041
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireContractPermission("PUT")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireContractPermission`، `/^\d+$/.test`، `updateServiceContract`، `Number`، `isGovernedVendorContract`، `res.status(409).json`، `res.status`، `insertContractSchema.partial().parse`، `insertContractSchema.partial`، `storage.getContract`، `storage.updateContract`، `res.status(404).json`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## GET `/api/dashboard/executive`

- المصدر: server/routes.ts:4969
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `change_approvals`، `changes`، `cmdb_applications`، `configuration_documents`، `contracts`، `employee_access_rights`، `employees`، `incidents`، `servers`، `user_roles`
- الاستدعاءات الظاهرة: `Promise.all`، `storage.getUserRoles`، `storage.getUserPermissions`، `userRoles.map`، `role.name.trim().toLowerCase().replace`، `role.name.trim().toLowerCase`، `role.name.trim`، `userPermissions.includes`، `roleNames.some`، `["admin", "administrator", "system_administrator"].includes`، `getPersonaRoleKeys`، `isDemoViewer`، `personaRoles.some`، `res.status(403).json`، `res.status`، `toDateInputValue`، `accessThroughDate.setDate`، `accessThroughDate.getDate`، `contractThrough.setDate`، `contractThrough.getDate`، `now.getTime`، `isFeatureEnabled`، `db.select({ activeEmployees: sql<number>'count(*) FILTER (WHERE ${employees.status} = 'active')::int', }).from`، `db.select`، `db.select({ total: sql<number>'count(*)::int', online: sql<number>'count(*) FILTER (WHERE lower(${servers.status}) = 'online')::int', maintenance: sql<number>'count(*) FILTER (WHERE lower(${servers.status}) = 'maintenance')::int', offline: sql<number>'count(*) FILTER (WHERE lower(${servers.status}) = 'offline')::int', }).from`، `db.select({ total: sql<number>'count(*)::int' }).from(cmdbApplications) .where`، `db.select({ total: sql<number>'count(*)::int' }).from`، `db.select({ total: sql<number>'count(*)::int' }).from(configurationDocuments).where`، `db.select({ P1: sql<number>'count(*) FILTER (WHERE ${incidents.priority} = 'P1' AND lower(${incidents.status}) NOT IN ('resolved', 'closed', 'cancelled'))::int', P2: sql<number>'count(*) FILTER (WHERE ${incidents.priority} = 'P2' AND lower(${incidents.status}) NOT IN ('resolved', 'closed', 'cancelled'))::int', P3: sql<number>'count(*) FILTER (WHERE ${incidents.priority} = 'P3' AND lower(${incidents.status}) NOT IN ('resolved', 'closed', 'cancelled'))::int', P4: sql<number>'count(*) FILTER (WHERE ${incidents.priority} = 'P4' AND lower(${incidents.status}) NOT IN ('resolved', 'closed', 'cancelled'))::int', }).from`، `db.select({ withinSla: sql<number>'count(*) FILTER (WHERE ${incidents.resolvedAt} <= ${incidents.resolveDueAt})::int', breached: sql<number>'count(*) FILTER (WHERE ${incidents.resolvedAt} > ${incidents.resolveDueAt})::int', }).from(incidents).where`، `db.select({ withinSla: sql<number>'count(*) FILTER (WHERE ${incidents.resolvedAt} <= ${incidents.resolveDueAt})::int', breached: sql<number>'count(*) FILTER (WHERE ${incidents.resolvedAt} > ${incidents.resolveDueAt})::int', }).from`، `and`، `db.select({ total: sql<number>'count(*)::int' }).from(changeApprovals).where`، `isNull`، `or`، `eq`، `db.select({ total: sql<number>'count(*)::int' }).from(incidents).where`، `db.select({ hardwareAssetValuation: sql<number>'COALESCE(SUM(CASE WHEN lower(${assets.type}) <> 'software' THEN COALESCE(${assets.currentBookValue}, ${assets.currentValue}, ${assets.purchasePrice}, 0) ELSE 0 END), 0)::float8', usedSeats: sql<number>'COALESCE(SUM(CASE WHEN lower(${assets.type}) = 'software' THEN COALESCE(${assets.usedSeats}, 0) ELSE 0 END), 0)::float8', totalSeats: sql<number>'COALESCE(SUM(CASE WHEN lower(${assets.type}) = 'software' THEN COALESCE(${assets.licenseQuantity}, 0) ELSE 0 END), 0)::float8', }).from`، `db.select({ valid: sql<number>'count(*) FILTER (WHERE ${employeeAccessRights.status} = 'active' AND (${employeeAccessRights.expiresAt} IS NULL OR ${employeeAccessRights.expiresAt} > ${accessThrough}::date))::int', expiring: sql<number>'count(*) FILTER (WHERE ${employeeAccessRights.status} = 'active' AND ${employeeAccessRights.expiresAt} > ${today}::date AND ${employeeAccessRights.expiresAt} <= ${accessThrough}::date)::int', expired: sql<number>'count(*) FILTER (WHERE ${employeeAccessRights.status} = 'expired' OR (${employeeAccessRights.status} = 'active' AND ${employeeAccessRights.expiresAt} IS NOT NULL AND ${employeeAccessRights.expiresAt} <= ${today}::date))::int', }).from`، `db.select({ P1: sql<number>'count(*) FILTER (WHERE upper(${cmdbApplications.criticalityRating}) = 'P1')::int', P2: sql<number>'count(*) FILTER (WHERE upper(${cmdbApplications.criticalityRating}) = 'P2')::int', P3: sql<number>'count(*) FILTER (WHERE upper(${cmdbApplications.criticalityRating}) = 'P3')::int', P4: sql<number>'count(*) FILTER (WHERE upper(${cmdbApplications.criticalityRating}) = 'P4')::int', }).from(cmdbApplications).where`، `db.select({ P1: sql<number>'count(*) FILTER (WHERE upper(${cmdbApplications.criticalityRating}) = 'P1')::int', P2: sql<number>'count(*) FILTER (WHERE upper(${cmdbApplications.criticalityRating}) = 'P2')::int', P3: sql<number>'count(*) FILTER (WHERE upper(${cmdbApplications.criticalityRating}) = 'P3')::int', P4: sql<number>'count(*) FILTER (WHERE upper(${cmdbApplications.criticalityRating}) = 'P4')::int', }).from`، `db.select({ total: sql<number>'count(*)::int' }).from(employees).where`، `db.select({ id: employees.id, title: sql<string>'${employees.firstName} \|\| ' ' \|\| ${employees.lastName}', createdAt: employees.offboardedDate, }).from(employees).where(and( eq(employees.status, "disabled"), sql'(SELECT count(DISTINCT c.clearance_type) FROM employee_offboarding_clearances c WHERE c.employee_id = ${employees.id} AND c.offboarding_date = ${employees.offboardedDate}) < 3', )).limit`، `db.select({ id: employees.id, title: sql<string>'${employees.firstName} \|\| ' ' \|\| ${employees.lastName}', createdAt: employees.offboardedDate, }).from(employees).where`، `db.select({ id: employees.id, title: sql<string>'${employees.firstName} \|\| ' ' \|\| ${employees.lastName}', createdAt: employees.offboardedDate, }).from`، `db.selectDistinct({ id: changes.id, title: changes.title, changeNumber: changes.changeNumber, priority: changes.priority, createdAt: changes.createdAt, }).from(changeApprovals).innerJoin(changes, eq(changeApprovals.changeId, changes.id)).where(and( isNull(changeApprovals.removedAt), or(isNull(changeApprovals.decision), eq(changeApprovals.decision, "pending")), )).orderBy(desc(changes.createdAt)).limit`، `db.selectDistinct({ id: changes.id, title: changes.title, changeNumber: changes.changeNumber, priority: changes.priority, createdAt: changes.createdAt, }).from(changeApprovals).innerJoin(changes, eq(changeApprovals.changeId, changes.id)).where(and( isNull(changeApprovals.removedAt), or(isNull(changeApprovals.decision), eq(changeApprovals.decision, "pending")), )).orderBy`، `db.selectDistinct({ id: changes.id, title: changes.title, changeNumber: changes.changeNumber, priority: changes.priority, createdAt: changes.createdAt, }).from(changeApprovals).innerJoin(changes, eq(changeApprovals.changeId, changes.id)).where`، `db.selectDistinct({ id: changes.id, title: changes.title, changeNumber: changes.changeNumber, priority: changes.priority, createdAt: changes.createdAt, }).from(changeApprovals).innerJoin`، `db.selectDistinct({ id: changes.id, title: changes.title, changeNumber: changes.changeNumber, priority: changes.priority, createdAt: changes.createdAt, }).from`، `db.selectDistinct`، `desc`، `db.select({ id: employeeAccessRights.id, systemName: employeeAccessRights.applicationName, expiresAt: employeeAccessRights.expiresAt, employeeName: sql<string>'${employees.firstName} \|\| ' ' \|\| ${employees.lastName}', }).from(employeeAccessRights).innerJoin(employees, eq(employeeAccessRights.employeeId, employees.id)).where(or( eq(employeeAccessRights.status, "expired"), and( eq(employeeAccessRights.status, "active"), sql'${employeeAccessRights.expiresAt} IS NOT NULL AND ${employeeAccessRights.expiresAt} <= ${today}::date', ), )).orderBy(asc(employeeAccessRights.expiresAt)).limit`، `db.select({ id: employeeAccessRights.id, systemName: employeeAccessRights.applicationName, expiresAt: employeeAccessRights.expiresAt, employeeName: sql<string>'${employees.firstName} \|\| ' ' \|\| ${employees.lastName}', }).from(employeeAccessRights).innerJoin(employees, eq(employeeAccessRights.employeeId, employees.id)).where(or( eq(employeeAccessRights.status, "expired"), and( eq(employeeAccessRights.status, "active"), sql'${employeeAccessRights.expiresAt} IS NOT NULL AND ${employeeAccessRights.expiresAt} <= ${today}::date', ), )).orderBy`، `db.select({ id: employeeAccessRights.id, systemName: employeeAccessRights.applicationName, expiresAt: employeeAccessRights.expiresAt, employeeName: sql<string>'${employees.firstName} \|\| ' ' \|\| ${employees.lastName}', }).from(employeeAccessRights).innerJoin(employees, eq(employeeAccessRights.employeeId, employees.id)).where`، `db.select({ id: employeeAccessRights.id, systemName: employeeAccessRights.applicationName, expiresAt: employeeAccessRights.expiresAt, employeeName: sql<string>'${employees.firstName} \|\| ' ' \|\| ${employees.lastName}', }).from(employeeAccessRights).innerJoin`، `db.select({ id: employeeAccessRights.id, systemName: employeeAccessRights.applicationName, expiresAt: employeeAccessRights.expiresAt, employeeName: sql<string>'${employees.firstName} \|\| ' ' \|\| ${employees.lastName}', }).from`، `asc`، `db.select({ total: sql<number>'count(*)::int' }) .from(contracts).where`، `db.select({ total: sql<number>'count(*)::int' }) .from`، `[ ...pendingOffboardings.map(item => ({ id: item.id, type: "offboarding", title: 'Pending offboarding: ${item.title}', description: "Required clearance records are incomplete.", href: "/employees", priority: "high", createdAt: item.createdAt, })), ...pendingApprovals.map(item => ({ id: item.id, type: "change_approval", title: 'CAB approval: ${item.changeNumber}', description: item.title, href: "/changes", priority: item.priority ?? "medium", createdAt: item.createdAt, })), ...expiredAccessItems.map(item => ({ id: item.id, type: "expired_access", title: 'Expired access: ${item.systemName}', description: '${item.employeeName} · expiry ${item.expiresAt ?? "expired"}', href: "/access-governance", priority: "critical", createdAt: item.expiresAt, })), ].sort((a, b) => { const priorityOrder: Record<string, number> = { critical: 0, high: 1, P1: 0, P2: 1, medium: 2, P3: 3, low: 4, P4: 4 }; return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3); }).slice`، `[ ...pendingOffboardings.map(item => ({ id: item.id, type: "offboarding", title: 'Pending offboarding: ${item.title}', description: "Required clearance records are incomplete.", href: "/employees", priority: "high", createdAt: item.createdAt, })), ...pendingApprovals.map(item => ({ id: item.id, type: "change_approval", title: 'CAB approval: ${item.changeNumber}', description: item.title, href: "/changes", priority: item.priority ?? "medium", createdAt: item.createdAt, })), ...expiredAccessItems.map(item => ({ id: item.id, type: "expired_access", title: 'Expired access: ${item.systemName}', description: '${item.employeeName} · expiry ${item.expiresAt ?? "expired"}', href: "/access-governance", priority: "critical", createdAt: item.expiresAt, })), ].sort`، `pendingOffboardings.map`، `pendingApprovals.map`، `expiredAccessItems.map`، `res.json`، `Math.min`، `Math.round`، `console.error`، `res.status(500).json`

## GET `/api/dashboard/stats`

- المصدر: server/routes.ts:4942
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `departments`، `employees`، `locations`
- الاستدعاءات الظاهرة: `storage.getAssets`، `storage.getEmployees`، `storage.getLocations`، `storage.getDepartments`، `assets.filter`، `res.json`، `res.status(500).json`، `res.status`

## USE `/api/data-migrations`

- المصدر: server/index.ts:56
- سلسلة الوسطاء/المعالج: `dataMigrationRateLimit`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## POST `/api/data-migrations/:batchId/import`

- المصدر: server/data-migration-center.ts:1305
- سلسلة الوسطاء/المعالج: `...guards` → `commitHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## POST `/api/data-migrations/:moduleKey/preview`

- المصدر: server/data-migration-center.ts:1209
- سلسلة الوسطاء/المعالج: `...guards` → `requireEnabledModule` → `parseMultipart` → `previewHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## GET `/api/data-migrations/:moduleKey/template`

- المصدر: server/data-migration-center.ts:1169
- سلسلة الوسطاء/المعالج: `...guards` → `requireEnabledModule` → `templateHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## GET `/api/data-migrations/history`

- المصدر: server/data-migration-center.ts:1155
- سلسلة الوسطاء/المعالج: `...guards` → `historyHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## GET `/api/data-migrations/modules`

- المصدر: server/data-migration-center.ts:1121
- سلسلة الوسطاء/المعالج: `...guards` → `moduleListHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## GET `/api/departments`

- المصدر: server/routes.ts:5475
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `departments`
- الاستدعاءات الظاهرة: `storage.getDepartmentsWithDetails`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/departments`

- المصدر: server/routes.ts:5484
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('department_create')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertDepartmentSchema.parse`، `storage.createDepartment`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## DELETE `/api/departments/:id`

- المصدر: server/routes.ts:5525
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('department_delete')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getDepartment`، `storage.deleteDepartment`، `res.status(404).json`، `res.status`، `logAudit`، `res.status(204).send`، `res.status(500).json`

## PUT `/api/departments/:id`

- المصدر: server/routes.ts:5501
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('department_update')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertDepartmentSchema.partial().parse`، `insertDepartmentSchema.partial`، `storage.getDepartment`، `storage.updateDepartment`، `res.status(404).json`، `res.status`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## POST `/api/dropdowns/cleanup-duplicates`

- المصدر: server/routes.ts:9678
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('system_admin')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `z.object({ category: z.string().trim().min(1).optional() }).parse`، `z.object`، `z.string().trim().min(1).optional`، `z.string().trim().min`، `z.string().trim`، `z.string`، `ensureDropdownIntegrity`، `logAudit`، `res.json`، `res.status(400).json`، `res.status`، `res.status(500).json`

## POST `/api/dropdowns/migrate-from-assets`

- المصدر: server/routes.ts:9691
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('system_admin')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getAssets`، `storage.getMaintenanceSchedules`، `storage.getBudgets`، `storage.getPurchaseOrders`، `migratedData.assetType.add`، `migratedData.status.add`، `migratedData.assetCondition.add`، `migratedData.informationClassification.add`، `migratedData.dataSensitivityLevel.add`، `migratedData.securityLevel.add`، `migratedData.riskAssessmentScore.add`، `migratedData.lifecycleStatus.add`، `migratedData.accessControlMethod.add`، `migratedData.physicalSecurityLevel.add`، `migratedData.complianceStatus.add`، `migratedData.maintenanceType.add`، `migratedData.maintenanceFrequency.add`، `migratedData.maintenancePriority.add`، `migratedData.budgetCategory.add`، `migratedData.purchaseOrderStatus.add`، `storage.getAllDropdownOptions`، `existingOptions.map`، `dropdownIdentity`، `Object.entries`، `Array.from`، `value.trim`، `normalizeLookupKey(value).replace`، `normalizeLookupKey`، `existingKeys.has`، `storage.createDropdownOption`، `existingKeys.add`، `res.json`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/dropdowns/options`

- المصدر: server/routes.ts:9595
- سلسلة الوسطاء/المعالج: `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getAllDropdownOptions`، `storage.getDropdownOptions`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/dropdowns/options`

- المصدر: server/routes.ts:9618
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('system_admin')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertDropdownOptionSchema.parse`، `storage.getAllDropdownOptions`، `existing.find`، `dropdownIdentity`، `res.status(409).json`، `res.status`، `storage.createDropdownOption`، `res.status(201).json`، `res.status(400).json`، `res.status(500).json`

## GET `/api/dropdowns/options/:category`

- المصدر: server/routes.ts:9607
- سلسلة الوسطاء/المعالج: `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getAllDropdownOptionsByCategory`، `storage.getDropdownOptionsByCategory`، `res.json`، `res.status(500).json`، `res.status`

## DELETE `/api/dropdowns/options/:id`

- المصدر: server/routes.ts:9665
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('system_admin')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.deleteDropdownOption`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/dropdowns/options/:id`

- المصدر: server/routes.ts:9640
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('system_admin')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertDropdownOptionSchema.partial().parse`، `insertDropdownOptionSchema.partial`، `storage.getAllDropdownOptions`، `existing.find`، `res.status(404).json`، `res.status`، `existing.some`، `dropdownIdentity`، `res.status(409).json`، `storage.updateDropdownOption`، `res.json`، `res.status(400).json`، `res.status(500).json`

## POST `/api/dropdowns/seed`

- المصدر: server/routes.ts:9794
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('system_admin')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.createDropdownOption`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/employees`

- المصدر: server/routes.ts:4285
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `inline handler`
- جداول مشار إليها مباشرة: `employees`
- الاستدعاءات الظاهرة: `requireModule`، `storage.getEmployeesWithDetails`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/employees`

- المصدر: server/routes.ts:4760
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `requirePermission('employee_create')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertEmployeeSchema.omit({ status: true, offboardedDate: true, offboardedReason: true }).parse`، `insertEmployeeSchema.omit`، `storage.createEmployee`، `logAudit`، `employee.id.toString`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## DELETE `/api/employees/:id`

- المصدر: server/routes.ts:4804
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('employee_delete')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getEmployee`، `res.status(404).json`، `res.status`، `res.status(409).json`

## GET `/api/employees/:id`

- المصدر: server/routes.ts:4294
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getEmployee`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/employees/:id`

- المصدر: server/routes.ts:4777
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('employee_update')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `res.status(400).json`، `res.status`، `insertEmployeeSchema.partial().omit({ status: true, offboardedDate: true, offboardedReason: true }).parse`، `insertEmployeeSchema.partial().omit`، `insertEmployeeSchema.partial`، `storage.getEmployee`، `storage.updateEmployee`، `res.status(404).json`، `logAudit`، `employee.id.toString`، `res.json`، `res.status(500).json`

## GET `/api/employees/:id/access-rights`

- المصدر: server/routes.ts:4539
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("employee_update")` → `inline handler`
- جداول مشار إليها مباشرة: `employee_access_rights`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `expireDueEmployeeAccessRights`، `storage.getEmployee`، `res.status(404).json`، `res.status`، `db.select().from(employeeAccessRights).where`، `db.select().from`، `db.select`، `eq`، `res.json`، `rows.map`، `getAccessExpiryState`، `res.status(500).json`

## POST `/api/employees/:id/access-rights`

- المصدر: server/routes.ts:4550
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("employee_update")` → `inline handler`
- جداول مشار إليها مباشرة: `employee_access_rights`، `employees`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `createAccessRightBodySchema.parse`، `toDateInputValue`، `res.status(400).json`، `res.status`، `db.transaction`، `tx.select({ id: employees.id, status: employees.status }).from(employees) .where(eq(employees.id, req.params.id)).for`، `tx.select({ id: employees.id, status: employees.status }).from(employees) .where`، `tx.select({ id: employees.id, status: employees.status }).from`، `tx.select`، `eq`، `Object.assign`، `resolveAccessSystem`، `validatePrivilegeLevel`، `tx.insert(employeeAccessRights).values({ employeeId: employee.id, applicationName: catalogItem.name, accessType: catalogItem.accessType, catalogSource: catalogItem.source, catalogItemId: catalogItem.id, privilegeLevel: input.privilegeLevel, accountUsername: input.accountUsername \|\| null, businessJustification: input.businessJustification, grantDate: input.grantDate, expiresAt: input.expiresAt ?? null, status: "active", }).returning`، `tx.insert(employeeAccessRights).values`، `tx.insert`، `logEmployeeAccessMutation`، `req.get`، `res.status(201).json`، `res.status(error.status).json`، `res.status(500).json`

## PUT `/api/employees/:id/access-rights/:rightId`

- المصدر: server/routes.ts:4597
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("employee_update")` → `inline handler`
- جداول مشار إليها مباشرة: `changes`، `employee_access_rights`، `employees`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `accessRightBodySchema.parse`، `db.transaction`، `tx.select({ id: employees.id, status: employees.status }).from(employees) .where(eq(employees.id, req.params.id)).for`، `tx.select({ id: employees.id, status: employees.status }).from(employees) .where`، `tx.select({ id: employees.id, status: employees.status }).from`، `tx.select`، `eq`، `Object.assign`، `tx.select().from(employeeAccessRights).where(and( eq(employeeAccessRights.id, req.params.rightId), eq(employeeAccessRights.employeeId, employee.id), )).for`، `tx.select().from(employeeAccessRights).where`، `tx.select().from`، `and`، `validatePrivilegeLevel`، `resolveAccessSystem`، `Object.keys`، `tx.update(employeeAccessRights).set(changes) .where(eq(employeeAccessRights.id, current.id)).returning`، `tx.update(employeeAccessRights).set(changes) .where`، `tx.update(employeeAccessRights).set`، `tx.update`، `logEmployeeAccessMutation`، `req.get`، `res.json`، `res.status(400).json`، `res.status`، `res.status(error.status).json`، `res.status(500).json`

## POST `/api/employees/:id/access-rights/:rightId/extend`

- المصدر: server/routes.ts:4670
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("employee_update")` → `inline handler`
- جداول مشار إليها مباشرة: `employee_access_rights`، `employees`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `z.object({ days: z.coerce.number().int().min(30).max(365).default(90), businessJustification: z.string().trim().min(5).max(4000), }).parse`، `z.object`، `z.coerce.number().int().min(30).max(365).default`، `z.coerce.number().int().min(30).max`، `z.coerce.number().int().min`، `z.coerce.number().int`، `z.coerce.number`، `z.string().trim().min(5).max`، `z.string().trim().min`، `z.string().trim`، `z.string`، `db.transaction`، `tx.select({ id: employees.id, status: employees.status }) .from(employees).where(eq(employees.id, req.params.id)).for`، `tx.select({ id: employees.id, status: employees.status }) .from(employees).where`، `tx.select({ id: employees.id, status: employees.status }) .from`، `tx.select`، `eq`، `Object.assign`، `tx.select().from(employeeAccessRights).where(and( eq(employeeAccessRights.id, req.params.rightId), eq(employeeAccessRights.employeeId, employee.id), inArray(employeeAccessRights.status, ["active", "expired"]), )).for`، `tx.select().from(employeeAccessRights).where`، `tx.select().from`، `and`، `inArray`، `toDateInputValue`، `nextDate.setDate`، `nextDate.getDate`، `tx.update(employeeAccessRights).set({ status: "active", expiresAt, businessJustification: input.businessJustification, updatedAt: new Date(), }).where(eq(employeeAccessRights.id, current.id)).returning`، `tx.update(employeeAccessRights).set({ status: "active", expiresAt, businessJustification: input.businessJustification, updatedAt: new Date(), }).where`، `tx.update(employeeAccessRights).set`، `tx.update`، `logEmployeeAccessMutation`، `req.get`، `res.json`، `getAccessExpiryState`، `res.status(400).json`، `res.status`، `res.status(error.status).json`، `res.status(500).json`

## POST `/api/employees/:id/access-rights/:rightId/revoke`

- المصدر: server/routes.ts:4724
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("employee_update")` → `inline handler`
- جداول مشار إليها مباشرة: `employee_access_rights`، `employees`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `z.object({ reason: z.string().trim().min(3).max(2000) }).parse`، `z.object`، `z.string().trim().min(3).max`، `z.string().trim().min`، `z.string().trim`، `z.string`، `db.transaction`، `tx.select({ id: employees.id }).from(employees).where(eq(employees.id, req.params.id)).for`، `tx.select({ id: employees.id }).from(employees).where`، `tx.select({ id: employees.id }).from`، `tx.select`، `eq`، `Object.assign`، `tx.select().from(employeeAccessRights).where(and( eq(employeeAccessRights.id, req.params.rightId), eq(employeeAccessRights.employeeId, employee.id), inArray(employeeAccessRights.status, ["active", "expired"]), )).for`، `tx.select().from(employeeAccessRights).where`، `tx.select().from`، `and`، `inArray`، `tx.update(employeeAccessRights).set({ status: "revoked", revokedAt: new Date(), revocationReason: reason, updatedAt: new Date(), }).where(eq(employeeAccessRights.id, current.id)).returning`، `tx.update(employeeAccessRights).set({ status: "revoked", revokedAt: new Date(), revocationReason: reason, updatedAt: new Date(), }).where`، `tx.update(employeeAccessRights).set`، `tx.update`، `logEmployeeAccessMutation`، `req.get`، `res.json`، `res.status(400).json`، `res.status`، `res.status(error.status).json`، `res.status(500).json`

## POST `/api/employees/:id/offboard`

- المصدر: server/routes.ts:4316
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requireAnyPermission("employee_update", "offboarding_approve", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `audit_logs`، `employee_offboarding_clearances`، `employees`
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `employeeOffboardingSubmissionSchema.parse`، `db.transaction`، `tx.select().from(employees).where(eq(employees.id, req.params.id)).for`، `tx.select().from(employees).where`، `tx.select().from`، `tx.select`، `eq`، `Object.assign`، `getEmployeeOffboardingReview`، `input.clearances.map`، `blockerClearances.some`، `submittedClearances.get`، `tx.insert(employeeOffboardingClearances).values`، `tx.insert`، `clearance.note?.trim`، `tx.insert(auditLogs).values`، `JSON.stringify`، `req.get`، `tx.update(employees).set({ status: "disabled", offboardedDate: input.offboardedDate, offboardedReason: input.offboardedReason, }).where(eq(employees.id, employee.id)).returning`، `tx.update(employees).set({ status: "disabled", offboardedDate: input.offboardedDate, offboardedReason: input.offboardedReason, }).where`، `tx.update(employees).set`، `tx.update`، `logAudit`، `res.json`، `res.status(400).json`، `res.status`، `res.status(409).json`، `res.status(error.status).json`، `res.status(500).json`

## GET `/api/employees/:id/offboarding-review`

- المصدر: server/routes.ts:4306
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requireAnyPermission("employee_update", "offboarding_approve", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `storage.getEmployee`، `res.status(404).json`، `res.status`، `res.json`، `getEmployeeOffboardingReview`، `res.status(500).json`

## POST `/api/employees/:id/reactivate`

- المصدر: server/routes.ts:4382
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("employee_update")` → `inline handler`
- جداول مشار إليها مباشرة: `employees`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `z.object({ reason: z.string().trim().min(3).max(1000) }).parse`، `z.object`، `z.string().trim().min(3).max`، `z.string().trim().min`، `z.string().trim`، `z.string`، `db.transaction`، `tx.select().from(employees).where(eq(employees.id, req.params.id)).for`، `tx.select().from(employees).where`، `tx.select().from`، `tx.select`، `eq`، `Object.assign`، `tx.update(employees).set({ status: "active", offboardedDate: null, offboardedReason: null, }).where(eq(employees.id, employee.id)).returning`، `tx.update(employees).set({ status: "active", offboardedDate: null, offboardedReason: null, }).where`، `tx.update(employees).set`، `tx.update`، `logAudit`، `res.json`، `res.status(400).json`، `res.status`، `res.status(error.status).json`، `res.status(500).json`

## GET `/api/enterprise-reporting/audit-events`

- المصدر: server/enterprise-reporting.ts:289
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assignment_groups`، `audit_logs`، `incidents`، `permissions`، `service_requests`، `users`
- الاستدعاءات الظاهرة: `enterpriseAuditFiltersSchema.safeParse`، `res.status(400).json`، `res.status`، `storage.getUserPermissions`، `getReportAccess`، `res.status(403).json`، `Promise.all`، `isFeatureEnabled`، `db.select({ name: assignmentGroups.name }).from(assignmentGroups) .where`، `db.select({ name: assignmentGroups.name }).from`، `db.select`، `eq`، `db.select({ id: incidents.id }).from(incidents) .where`، `db.select({ id: incidents.id }).from`، `db.select({ id: serviceRequests.id }).from(serviceRequests) .where`، `db.select({ id: serviceRequests.id }).from`، `incidentIds.map`، `requestIds.map`، `dateConditions`، `conditions.push`، `inArray`، `and`، `db.select({ id: auditLogs.id, timestamp: auditLogs.timestamp, action: auditLogs.action, tableName: auditLogs.tableName, recordId: auditLogs.recordId, recordName: auditLogs.recordName, oldValues: auditLogs.oldValues, newValues: auditLogs.newValues, userId: auditLogs.userId, username: users.username, firstName: users.firstName, lastName: users.lastName, }).from(auditLogs) .leftJoin(users, eq(auditLogs.userId, users.id)) .where(conditions.length ? and(...conditions) : undefined) .orderBy(desc(auditLogs.timestamp)).limit`، `db.select({ id: auditLogs.id, timestamp: auditLogs.timestamp, action: auditLogs.action, tableName: auditLogs.tableName, recordId: auditLogs.recordId, recordName: auditLogs.recordName, oldValues: auditLogs.oldValues, newValues: auditLogs.newValues, userId: auditLogs.userId, username: users.username, firstName: users.firstName, lastName: users.lastName, }).from(auditLogs) .leftJoin(users, eq(auditLogs.userId, users.id)) .where(conditions.length ? and(...conditions) : undefined) .orderBy`، `db.select({ id: auditLogs.id, timestamp: auditLogs.timestamp, action: auditLogs.action, tableName: auditLogs.tableName, recordId: auditLogs.recordId, recordName: auditLogs.recordName, oldValues: auditLogs.oldValues, newValues: auditLogs.newValues, userId: auditLogs.userId, username: users.username, firstName: users.firstName, lastName: users.lastName, }).from(auditLogs) .leftJoin(users, eq(auditLogs.userId, users.id)) .where`، `db.select({ id: auditLogs.id, timestamp: auditLogs.timestamp, action: auditLogs.action, tableName: auditLogs.tableName, recordId: auditLogs.recordId, recordName: auditLogs.recordName, oldValues: auditLogs.oldValues, newValues: auditLogs.newValues, userId: auditLogs.userId, username: users.username, firstName: users.firstName, lastName: users.lastName, }).from(auditLogs) .leftJoin`، `db.select({ id: auditLogs.id, timestamp: auditLogs.timestamp, action: auditLogs.action, tableName: auditLogs.tableName, recordId: auditLogs.recordId, recordName: auditLogs.recordName, oldValues: auditLogs.oldValues, newValues: auditLogs.newValues, userId: auditLogs.userId, username: users.username, firstName: users.firstName, lastName: users.lastName, }).from`، `desc`، `res.setHeader`، `res.json`، `rows.map`، `[row.firstName, row.lastName].filter(Boolean).join`، `[row.firstName, row.lastName].filter`، `csvSafeAuditSummary`، `console.error`، `res.status(500).json`

## GET `/api/enterprise-reporting/operations`

- المصدر: server/enterprise-reporting.ts:84
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `assignment_groups`، `contracts`، `incidents`، `permissions`، `projects`، `service_contracts`، `vendor_contracts`، `vendors`
- الاستدعاءات الظاهرة: `enterpriseReportFiltersSchema.safeParse`، `res.status(400).json`، `res.status`، `Promise.all`، `storage.getUserPermissions`، `isFeatureEnabled`، `getReportAccess`، `res.status(403).json`، `db.select({ id: assignmentGroups.id, name: assignmentGroups.name }) .from(assignmentGroups).where`، `db.select({ id: assignmentGroups.id, name: assignmentGroups.name }) .from`، `db.select`، `eq`، `dateConditions`، `incidentConditions.push`، `and`، `db.select({ priority: incidents.priority, resolvedCount: sql<number>'count(*)', meanHours: sql<number>'avg(extract(epoch from (${incidents.resolvedAt} - ${incidents.createdAt})) / 3600.0)', }).from(incidents) .where(and(incidentWhere, inArray(incidents.status, resolvedStatuses), isNotNull(incidents.resolvedAt))) .groupBy`، `db.select({ priority: incidents.priority, resolvedCount: sql<number>'count(*)', meanHours: sql<number>'avg(extract(epoch from (${incidents.resolvedAt} - ${incidents.createdAt})) / 3600.0)', }).from(incidents) .where`، `db.select({ priority: incidents.priority, resolvedCount: sql<number>'count(*)', meanHours: sql<number>'avg(extract(epoch from (${incidents.resolvedAt} - ${incidents.createdAt})) / 3600.0)', }).from`، `inArray`، `isNotNull`، `db.select({ eligible: sql<number>'count(*) filter (where ${incidents.status} in ('Resolved', 'Closed') and ${incidents.resolveDueAt} is not null and ${incidents.resolvedAt} is not null)', onTime: sql<number>'count(*) filter (where ${incidents.status} in ('Resolved', 'Closed') and ${incidents.resolveDueAt} is not null and ${incidents.resolvedAt} is not null and ${incidents.resolvedAt} <= ${incidents.resolveDueAt})', currentlyOverdue: sql<number>'count(*) filter (where ${incidents.status} not in ('Resolved', 'Closed') and ${incidents.resolveDueAt} < now())', }).from(incidents).where`، `db.select({ eligible: sql<number>'count(*) filter (where ${incidents.status} in ('Resolved', 'Closed') and ${incidents.resolveDueAt} is not null and ${incidents.resolvedAt} is not null)', onTime: sql<number>'count(*) filter (where ${incidents.status} in ('Resolved', 'Closed') and ${incidents.resolveDueAt} is not null and ${incidents.resolvedAt} is not null and ${incidents.resolvedAt} <= ${incidents.resolveDueAt})', currentlyOverdue: sql<number>'count(*) filter (where ${incidents.status} not in ('Resolved', 'Closed') and ${incidents.resolveDueAt} < now())', }).from`، `db.select({ underOneDay: sql<number>'count(*) filter (where ${incidents.createdAt} >= now() - interval '1 day')', oneToSevenDays: sql<number>'count(*) filter (where ${incidents.createdAt} < now() - interval '1 day' and ${incidents.createdAt} >= now() - interval '7 days')', eightToThirtyDays: sql<number>'count(*) filter (where ${incidents.createdAt} < now() - interval '7 days' and ${incidents.createdAt} >= now() - interval '30 days')', thirtyOneToNinetyDays: sql<number>'count(*) filter (where ${incidents.createdAt} < now() - interval '30 days' and ${incidents.createdAt} >= now() - interval '90 days')', overNinetyDays: sql<number>'count(*) filter (where ${incidents.createdAt} < now() - interval '90 days')', total: sql<number>'count(*)', }).from(incidents).where`، `db.select({ underOneDay: sql<number>'count(*) filter (where ${incidents.createdAt} >= now() - interval '1 day')', oneToSevenDays: sql<number>'count(*) filter (where ${incidents.createdAt} < now() - interval '1 day' and ${incidents.createdAt} >= now() - interval '7 days')', eightToThirtyDays: sql<number>'count(*) filter (where ${incidents.createdAt} < now() - interval '7 days' and ${incidents.createdAt} >= now() - interval '30 days')', thirtyOneToNinetyDays: sql<number>'count(*) filter (where ${incidents.createdAt} < now() - interval '30 days' and ${incidents.createdAt} >= now() - interval '90 days')', overNinetyDays: sql<number>'count(*) filter (where ${incidents.createdAt} < now() - interval '90 days')', total: sql<number>'count(*)', }).from`، `db.select({ name: sql<string>'coalesce(nullif(btrim(${incidents.assignmentGroup}), ''), 'Unassigned')', openCount: sql<number>'count(*)', overdueCount: sql<number>'count(*) filter (where ${incidents.resolveDueAt} < now())', }).from(incidents) .where(and(incidentWhere, inArray(incidents.status, openStatuses))) .groupBy(sql'coalesce(nullif(btrim(${incidents.assignmentGroup}), ''), 'Unassigned')') .orderBy`، `db.select({ name: sql<string>'coalesce(nullif(btrim(${incidents.assignmentGroup}), ''), 'Unassigned')', openCount: sql<number>'count(*)', overdueCount: sql<number>'count(*) filter (where ${incidents.resolveDueAt} < now())', }).from(incidents) .where(and(incidentWhere, inArray(incidents.status, openStatuses))) .groupBy`، `db.select({ name: sql<string>'coalesce(nullif(btrim(${incidents.assignmentGroup}), ''), 'Unassigned')', openCount: sql<number>'count(*)', overdueCount: sql<number>'count(*) filter (where ${incidents.resolveDueAt} < now())', }).from(incidents) .where`، `db.select({ name: sql<string>'coalesce(nullif(btrim(${incidents.assignmentGroup}), ''), 'Unassigned')', openCount: sql<number>'count(*)', overdueCount: sql<number>'count(*) filter (where ${incidents.resolveDueAt} < now())', }).from`، `desc`، `db.select({ id: assignmentGroups.id, name: assignmentGroups.name }) .from(assignmentGroups).where(eq(assignmentGroups.active, true)).orderBy`، `db.select({ id: assignmentGroups.id, name: assignmentGroups.name }) .from(assignmentGroups).where`، `db.select({ id: assignmentGroups.id, name: assignmentGroups.name }) .from`، `numeric`، `["P1", "P2", "P3", "P4"].map`، `priorityRows.find`، `workloadRows.map`، `db.select({ status: assets.status, count: sql<number>'count(*)', valuation: sql<string>'coalesce(sum(coalesce(${assets.currentBookValue}, ${assets.currentValue}, ${assets.purchasePrice}, 0)), 0)', }).from(assets).where(assetConditions.length ? and(...assetConditions) : undefined).groupBy`، `db.select({ status: assets.status, count: sql<number>'count(*)', valuation: sql<string>'coalesce(sum(coalesce(${assets.currentBookValue}, ${assets.currentValue}, ${assets.purchasePrice}, 0)), 0)', }).from(assets).where`، `db.select({ status: assets.status, count: sql<number>'count(*)', valuation: sql<string>'coalesce(sum(coalesce(${assets.currentBookValue}, ${assets.currentValue}, ${assets.purchasePrice}, 0)), 0)', }).from`، `db.selectDistinct({ category: assets.category }).from(assets).where(isNotNull(assets.category)).orderBy`، `db.selectDistinct({ category: assets.category }).from(assets).where`، `db.selectDistinct({ category: assets.category }).from`، `db.selectDistinct`، `db.select({ id: serviceContracts.id, contractNumber: serviceContracts.contractNumber, contractName: serviceContracts.contractName, projectName: projects.name, endDate: serviceContracts.endDate, status: serviceContracts.status, daysRemaining: sql<number>'${serviceContracts.endDate}::date - current_date', contractType: sql<string>''Support contract'', }).from(serviceContracts) .leftJoin(projects, eq(serviceContracts.projectId, projects.id)) .where(and( inArray(serviceContracts.status, ["active", "near_expiration"]), sql'${serviceContracts.endDate}::date between current_date and current_date + interval '60 days'', )) .orderBy(serviceContracts.endDate).limit`، `db.select({ id: serviceContracts.id, contractNumber: serviceContracts.contractNumber, contractName: serviceContracts.contractName, projectName: projects.name, endDate: serviceContracts.endDate, status: serviceContracts.status, daysRemaining: sql<number>'${serviceContracts.endDate}::date - current_date', contractType: sql<string>''Support contract'', }).from(serviceContracts) .leftJoin(projects, eq(serviceContracts.projectId, projects.id)) .where(and( inArray(serviceContracts.status, ["active", "near_expiration"]), sql'${serviceContracts.endDate}::date between current_date and current_date + interval '60 days'', )) .orderBy`، `db.select({ id: serviceContracts.id, contractNumber: serviceContracts.contractNumber, contractName: serviceContracts.contractName, projectName: projects.name, endDate: serviceContracts.endDate, status: serviceContracts.status, daysRemaining: sql<number>'${serviceContracts.endDate}::date - current_date', contractType: sql<string>''Support contract'', }).from(serviceContracts) .leftJoin(projects, eq(serviceContracts.projectId, projects.id)) .where`، `db.select({ id: serviceContracts.id, contractNumber: serviceContracts.contractNumber, contractName: serviceContracts.contractName, projectName: projects.name, endDate: serviceContracts.endDate, status: serviceContracts.status, daysRemaining: sql<number>'${serviceContracts.endDate}::date - current_date', contractType: sql<string>''Support contract'', }).from(serviceContracts) .leftJoin`، `db.select({ id: serviceContracts.id, contractNumber: serviceContracts.contractNumber, contractName: serviceContracts.contractName, projectName: projects.name, endDate: serviceContracts.endDate, status: serviceContracts.status, daysRemaining: sql<number>'${serviceContracts.endDate}::date - current_date', contractType: sql<string>''Support contract'', }).from`، `db.select({ count: sql<number>'count(*)' }).from(serviceContracts).where`، `db.select({ count: sql<number>'count(*)' }).from`، `db.select({ id: vendorContracts.id, contractNumber: vendorContracts.contractNumber, contractName: vendorContracts.title, projectName: vendors.name, endDate: vendorContracts.endDate, status: vendorContracts.status, daysRemaining: sql<number>'${vendorContracts.endDate}::date - current_date', contractType: vendorContracts.contractType, }).from(vendorContracts) .innerJoin(vendors, eq(vendorContracts.vendorId, vendors.id)) .where(and( inArray(vendorContracts.status, ["Active", "Expiring Soon"]), sql'${vendorContracts.endDate}::date between current_date and current_date + interval '60 days'', )) .orderBy(vendorContracts.endDate).limit`، `db.select({ id: vendorContracts.id, contractNumber: vendorContracts.contractNumber, contractName: vendorContracts.title, projectName: vendors.name, endDate: vendorContracts.endDate, status: vendorContracts.status, daysRemaining: sql<number>'${vendorContracts.endDate}::date - current_date', contractType: vendorContracts.contractType, }).from(vendorContracts) .innerJoin(vendors, eq(vendorContracts.vendorId, vendors.id)) .where(and( inArray(vendorContracts.status, ["Active", "Expiring Soon"]), sql'${vendorContracts.endDate}::date between current_date and current_date + interval '60 days'', )) .orderBy`، `db.select({ id: vendorContracts.id, contractNumber: vendorContracts.contractNumber, contractName: vendorContracts.title, projectName: vendors.name, endDate: vendorContracts.endDate, status: vendorContracts.status, daysRemaining: sql<number>'${vendorContracts.endDate}::date - current_date', contractType: vendorContracts.contractType, }).from(vendorContracts) .innerJoin(vendors, eq(vendorContracts.vendorId, vendors.id)) .where`، `db.select({ id: vendorContracts.id, contractNumber: vendorContracts.contractNumber, contractName: vendorContracts.title, projectName: vendors.name, endDate: vendorContracts.endDate, status: vendorContracts.status, daysRemaining: sql<number>'${vendorContracts.endDate}::date - current_date', contractType: vendorContracts.contractType, }).from(vendorContracts) .innerJoin`، `db.select({ id: vendorContracts.id, contractNumber: vendorContracts.contractNumber, contractName: vendorContracts.title, projectName: vendors.name, endDate: vendorContracts.endDate, status: vendorContracts.status, daysRemaining: sql<number>'${vendorContracts.endDate}::date - current_date', contractType: vendorContracts.contractType, }).from`، `db.select({ count: sql<number>'count(*)' }).from(vendorContracts).where`، `db.select({ id: assets.id, contractNumber: assets.assetTag, contractName: assets.name, projectName: assets.siteBuilding, endDate: assets.warrantyExpiry, status: sql<string>'case when ${assets.warrantyExpiry} < current_date then 'Expired' else 'Active' end', daysRemaining: sql<number>'${assets.warrantyExpiry}::date - current_date', contractType: sql<string>''Warranty'', }).from(assets).where(and( isNotNull(assets.warrantyExpiry), sql'${assets.warrantyExpiry}::date between current_date and current_date + interval '60 days'', ...(assetConditions.length ? assetConditions : []), )).orderBy(assets.warrantyExpiry).limit`، `db.select({ id: assets.id, contractNumber: assets.assetTag, contractName: assets.name, projectName: assets.siteBuilding, endDate: assets.warrantyExpiry, status: sql<string>'case when ${assets.warrantyExpiry} < current_date then 'Expired' else 'Active' end', daysRemaining: sql<number>'${assets.warrantyExpiry}::date - current_date', contractType: sql<string>''Warranty'', }).from(assets).where(and( isNotNull(assets.warrantyExpiry), sql'${assets.warrantyExpiry}::date between current_date and current_date + interval '60 days'', ...(assetConditions.length ? assetConditions : []), )).orderBy`، `db.select({ id: assets.id, contractNumber: assets.assetTag, contractName: assets.name, projectName: assets.siteBuilding, endDate: assets.warrantyExpiry, status: sql<string>'case when ${assets.warrantyExpiry} < current_date then 'Expired' else 'Active' end', daysRemaining: sql<number>'${assets.warrantyExpiry}::date - current_date', contractType: sql<string>''Warranty'', }).from(assets).where`، `db.select({ id: assets.id, contractNumber: assets.assetTag, contractName: assets.name, projectName: assets.siteBuilding, endDate: assets.warrantyExpiry, status: sql<string>'case when ${assets.warrantyExpiry} < current_date then 'Expired' else 'Active' end', daysRemaining: sql<number>'${assets.warrantyExpiry}::date - current_date', contractType: sql<string>''Warranty'', }).from`، `db.select({ count: sql<number>'count(*)' }).from(assets).where`، `lifecycleRows.map`، `[...contractRows, ...vendorExpiryRows, ...warrantyRows].map(row => ({ ...row, daysRemaining: numeric(row.daysRemaining), })).sort`، `[...contractRows, ...vendorExpiryRows, ...warrantyRows].map`، `lifecycle.reduce`، `contracts.filter`، `categoryRows.map(row => row.category).filter`، `categoryRows.map`، `Boolean`، `res.json`، `console.error`، `res.status(500).json`

## GET `/api/finance/document-sequences`

- المصدر: server/routes.ts:6598
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requireAnyPermission("finance_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `finance_document_sequences`
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `db.select().from(financeDocumentSequences).orderBy`، `db.select().from`، `db.select`، `asc`، `res.json`، `console.error`، `res.status(500).json`، `res.status`

## PUT `/api/finance/document-sequences/:documentType`

- المصدر: server/routes.ts:6608
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `finance_document_sequences`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `z.enum(["quotation", "purchase_order", "invoice"]).parse`، `z.enum`، `financeDocumentSequenceInputSchema.parse`، `db.update(financeDocumentSequences).set({ ...input, prefix: input.prefix.trim(), updatedBy: req.user!.id, updatedAt: new Date(), }).where(eq(financeDocumentSequences.documentType, documentType)).returning`، `db.update(financeDocumentSequences).set({ ...input, prefix: input.prefix.trim(), updatedBy: req.user!.id, updatedAt: new Date(), }).where`، `db.update(financeDocumentSequences).set`، `db.update`، `input.prefix.trim`، `eq`، `res.status(503).json`، `res.status`، `logAudit`، `String`، `res.json`، `res.status(400).json`، `console.error`، `res.status(500).json`

## GET `/api/finance/tax-rates`

- المصدر: server/routes.ts:6531
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requireAnyPermission("finance_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `finance_tax_rates`
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `db.select().from(financeTaxRates).orderBy`، `db.select().from`، `db.select`، `asc`، `res.json`، `console.error`، `res.status(500).json`، `res.status`

## POST `/api/finance/tax-rates`

- المصدر: server/routes.ts:6541
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `finance_tax_rates`، `finance_tax_settings`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `financeTaxRateInputSchema.parse`، `res.status(400).json`، `res.status`، `db.transaction`، `tx.update(financeTaxRates).set({ isDefault: false, updatedAt: new Date() }).where`، `tx.update(financeTaxRates).set`، `tx.update`، `eq`، `tx.insert(financeTaxRates).values({ ...input, rate: input.rate.toFixed(4), updatedAt: new Date() }).returning`، `tx.insert(financeTaxRates).values`، `tx.insert`، `input.rate.toFixed`، `tx.update(financeTaxSettings).set({ defaultTaxRate: input.rate.toFixed(4), defaultTaxMode: input.taxMode, updatedBy: req.user!.id, updatedAt: new Date(), }).where`، `tx.update(financeTaxSettings).set`، `logAudit`، `String`، `res.status(201).json`، `res.status(409).json`، `console.error`، `res.status(500).json`

## PUT `/api/finance/tax-rates/:id`

- المصدر: server/routes.ts:6566
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `finance_tax_rates`، `finance_tax_settings`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `z.coerce.number().int().positive().parse`، `z.coerce.number().int().positive`، `z.coerce.number().int`، `z.coerce.number`، `financeTaxRateInputSchema.parse`، `res.status(400).json`، `res.status`، `db.transaction`، `tx.select().from(financeTaxRates).where(eq(financeTaxRates.id, id)).for`، `tx.select().from(financeTaxRates).where`، `tx.select().from`، `tx.select`، `eq`، `Object.assign`، `tx.update(financeTaxRates).set({ isDefault: false, updatedAt: new Date() }).where`، `tx.update(financeTaxRates).set`، `tx.update`، `and`، `tx.update(financeTaxRates).set({ ...input, rate: input.rate.toFixed(4), updatedAt: new Date() }) .where(eq(financeTaxRates.id, id)).returning`، `tx.update(financeTaxRates).set({ ...input, rate: input.rate.toFixed(4), updatedAt: new Date() }) .where`، `input.rate.toFixed`، `tx.update(financeTaxSettings).set({ defaultTaxRate: input.rate.toFixed(4), defaultTaxMode: input.taxMode, updatedBy: req.user!.id, updatedAt: new Date(), }).where`، `tx.update(financeTaxSettings).set`، `logAudit`، `String`، `res.json`، `res.status(status).json`، `res.status(409).json`، `console.error`، `res.status(500).json`

## GET `/api/finance/tax-settings`

- المصدر: server/routes.ts:6464
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requireAnyPermission("finance_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `finance_tax_settings`، `settings`
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `db.select().from(financeTaxSettings).where`، `db.select().from`، `db.select`، `eq`، `res.json`، `res.status(503).json`، `res.status`، `console.error`، `res.status(500).json`

## PUT `/api/finance/tax-settings`

- المصدر: server/routes.ts:6475
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `finance_tax_rates`، `finance_tax_settings`، `settings`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `financeTaxSettingsInputSchema.parse`، `db.transaction`، `tx.insert(financeTaxSettings).values({ ...input, id: 1, defaultTaxRate: input.defaultTaxRate.toFixed(4), updatedBy: req.user!.id, updatedAt: new Date(), }).onConflictDoUpdate({ target: financeTaxSettings.id, set: { regionCode: input.regionCode, defaultTaxRate: input.defaultTaxRate.toFixed(4), defaultTaxMode: input.defaultTaxMode, currencyCode: input.currencyCode, updatedBy: req.user!.id, updatedAt: new Date(), }, }).returning`، `tx.insert(financeTaxSettings).values({ ...input, id: 1, defaultTaxRate: input.defaultTaxRate.toFixed(4), updatedBy: req.user!.id, updatedAt: new Date(), }).onConflictDoUpdate`، `tx.insert(financeTaxSettings).values`، `tx.insert`، `input.defaultTaxRate.toFixed`، `tx.select().from(financeTaxRates).where(eq(financeTaxRates.isDefault, true)).for`، `tx.select().from(financeTaxRates).where`، `tx.select().from`، `tx.select`، `eq`، `tx.update(financeTaxRates).set({ rate: input.defaultTaxRate.toFixed(4), taxMode: input.defaultTaxMode, name: '${input.defaultTaxRate}% default tax', classification: "custom", updatedAt: new Date(), }).where`، `tx.update(financeTaxRates).set`، `tx.update`، `tx.insert(financeTaxRates).values({ code: "DEFAULT_TAX", name: '${input.defaultTaxRate}% default tax', classification: "custom", rate: input.defaultTaxRate.toFixed(4), taxMode: input.defaultTaxMode, isActive: true, isDefault: true, sortOrder: 0, }).onConflictDoUpdate`، `tx.insert(financeTaxRates).values`، `logAudit`، `String`، `res.json`، `res.status(400).json`، `res.status`، `console.error`، `res.status(500).json`

## USE `/api/import`

- المصدر: server/index.ts:57
- سلسلة الوسطاء/المعالج: `dataMigrationRateLimit`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## POST `/api/import/:moduleKey/:batchId/commit`

- المصدر: server/data-migration-center.ts:1306
- سلسلة الوسطاء/المعالج: `...guards` → `commitHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## POST `/api/import/:moduleKey/preview`

- المصدر: server/data-migration-center.ts:1210
- سلسلة الوسطاء/المعالج: `...guards` → `requireEnabledModule` → `parseMultipart` → `previewHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## GET `/api/import/:moduleKey/template`

- المصدر: server/data-migration-center.ts:1170
- سلسلة الوسطاء/المعالج: `...guards` → `requireEnabledModule` → `templateHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## GET `/api/import/assets-export`

- المصدر: server/routes.ts:9151
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('asset_management')` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `departments`، `locations`
- الاستدعاءات الظاهرة: `requireModule`، `Promise.all`، `storage.getAssets`، `storage.getLocations`، `storage.getDepartments`، `locations.map`، `departments.map`، `workbook.addWorksheet`، `sheet.addRow`، `Object.fromEntries`، `Object.entries(asset).map`، `Object.entries`، `formatExportValue`، `locationNames.get`، `departmentNames.get`، `res.setHeader`، `workbook.xlsx.write`، `res.end`، `res.status(500).json`، `res.status`، `res.destroy`

## POST `/api/import/excel`

- المصدر: server/routes.ts:9287
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `res.status(410).json`، `res.status`

## POST `/api/import/excel`

- المصدر: server/routes.ts:9294
- سلسلة الوسطاء/المعالج: `requireAuth` → `upload.single('file')` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `assignments`، `departments`، `employees`، `locations`
- الاستدعاءات الظاهرة: `upload.single`، `res.status(400).json`، `res.status`، `workbook.xlsx.load`، `toSpreadsheetDateInput`، `workbook.getWorksheet`، `storage.getLocations`، `storage.getDepartments`، `locations.forEach`، `locationMap.set`، `loc.name.toLowerCase().trim`، `loc.name.toLowerCase`، `departments.forEach`، `departmentMap.set`، `dept.name.toLowerCase().trim`، `dept.name.toLowerCase`، `assetsSheet.eachRow`، `assetRows.push`، `row.getCell`، `assetData.locationName.toString().toLowerCase().trim`، `assetData.locationName.toString().toLowerCase`، `assetData.locationName.toString`، `locationMap.get`، `assetData.departmentName.toString().toLowerCase().trim`، `assetData.departmentName.toString().toLowerCase`، `assetData.departmentName.toString`، `departmentMap.get`، `value.toString`، `storage.createAsset`، `assetData.name?.toString`، `optionalString`، `assetData.type?.toString`، `assetData.status?.toString`، `convertDate`، `logAudit`، `errors.push`، `employeesSheet.eachRow`، `employeeRows.push`، `storage.createEmployee`، `empData.employeeId?.toString`، `empData.firstName?.toString`، `empData.lastName?.toString`، `empData.email?.toString`، `empData.department?.toString`، `empData.position?.toString`، `empData.phone?.toString`، `empData.salary.toString`، `assignmentsSheet.eachRow`، `assignmentRows.push`، `storage.getAssets`، `assets.find`، `assignData.assetSerialNumber?.toString`، `storage.getEmployees`، `employees.find`، `assignData.employeeEmail?.toString`، `storage.createAssignment`، `toDateInputValue`، `res.json`، `console.error`، `res.status(500).json`

## GET `/api/import/history`

- المصدر: server/data-migration-center.ts:1156
- سلسلة الوسطاء/المعالج: `...guards` → `historyHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## GET `/api/import/modules`

- المصدر: server/data-migration-center.ts:1122
- سلسلة الوسطاء/المعالج: `...guards` → `moduleListHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## GET `/api/import/template`

- المصدر: server/routes.ts:9180
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `res.status(410).json`، `res.status`

## GET `/api/import/template`

- المصدر: server/routes.ts:9187
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `workbook.addWorksheet`، `assetsSheet.addRow`، `employeesSheet.addRow`، `assignmentsSheet.addRow`، `res.setHeader`، `workbook.xlsx.write`، `res.end`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/incidents`

- المصدر: server/routes.ts:1329
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `employees`، `projects`، `users`
- الاستدعاءات الظاهرة: `requireModule`، `storage.getIncidents`، `canViewAllItsmRecords`، `rows.filter`، `Promise.all`، `isFeatureEnabled("project_management").then`، `isFeatureEnabled`، `db.select({ id: projects.id, name: projects.name }).from`، `db.select`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email }).from`، `isFeatureEnabled("asset_management").then`، `db.select({ email: employees.email, phone: employees.phone, mobile: employees.mobile }).from`، `projectRows.map`، `userRows.map`، `[user.firstName, user.lastName].filter(Boolean).join`، `[user.firstName, user.lastName].filter`، `employeeRows.map`، `employee.email.toLowerCase`، `res.json`، `visibleRows.map`، `projectNames.get`، `userDetails.get`، `employeeContacts.get`، `userDetails.get(row.creatorId)?.email.toLowerCase`، `userDetails.get(row.requesterId)?.email.toLowerCase`، `res.status(500).json`، `res.status`

## POST `/api/incidents`

- المصدر: server/routes.ts:1453
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `incident_activities`، `projects`، `sla_policies`
- الاستدعاءات الظاهرة: `requireModule`، `canViewAllItsmRecords`، `storage.getUser`، `res.status(400).json`، `res.status`، `insertIncidentSchema.parse`، `canManageAllTickets`، `res.status(403).json`، `isAllowedIncidentAssignee`، `["P1", "P2", "P3", "P4"].includes`، `isFeatureEnabled`، `sendFeatureNotEnabled`، `db.select({ id: projects.id }).from(projects).where`، `db.select({ id: projects.id }).from`، `db.select`، `eq`، `resolveIncidentContractContext`، `db.select().from(slaPolicies).where`، `db.select().from`، `and`، `policies.find`، `db.select({ id: slaPolicies.id }).from(slaPolicies).where`، `db.select({ id: slaPolicies.id }).from`، `storage.createIncident`، `db.insert(incidentActivities).values`، `db.insert`، `logAudit`، `res.status(201).json`، `res.status(500).json`

## GET `/api/incidents/:id`

- المصدر: server/routes.ts:1421
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `(await storage.getIncidents()).find`، `storage.getIncidents`، `res.status(404).json`، `res.status`، `canViewAllItsmRecords`، `res.status(403).json`، `res.json`، `res.status(500).json`

## PATCH `/api/incidents/:id`

- المصدر: server/routes.ts:1673
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requireAnyPermission("ticket_manage", "system_admin")` → `updateIncidentHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`

## PUT `/api/incidents/:id`

- المصدر: server/routes.ts:1672
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requireAnyPermission("ticket_manage", "system_admin")` → `updateIncidentHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`

## GET `/api/incidents/:id/activity`

- المصدر: server/routes.ts:1434
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `incident_activities`، `users`
- الاستدعاءات الظاهرة: `requireModule`، `(await storage.getIncidents()).find`، `storage.getIncidents`، `res.status(404).json`، `res.status`، `canViewAllItsmRecords`، `res.status(403).json`، `db.select({ id: incidentActivities.id, action: incidentActivities.action, details: incidentActivities.details, createdAt: incidentActivities.createdAt, actorId: incidentActivities.actorId, actorName: users.username, }).from(incidentActivities).leftJoin(users, eq(users.id, incidentActivities.actorId)) .where`، `db.select({ id: incidentActivities.id, action: incidentActivities.action, details: incidentActivities.details, createdAt: incidentActivities.createdAt, actorId: incidentActivities.actorId, actorName: users.username, }).from(incidentActivities).leftJoin`، `db.select({ id: incidentActivities.id, action: incidentActivities.action, details: incidentActivities.details, createdAt: incidentActivities.createdAt, actorId: incidentActivities.actorId, actorName: users.username, }).from`، `db.select`، `eq`، `res.json`، `res.status(500).json`

## PATCH `/api/incidents/:id/assignment`

- المصدر: server/routes.ts:1517
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requireAnyPermission("ticket_manage", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `incident_activities`، `incidents`
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `z.object`، `z.string().trim().max(120).nullable().optional`، `z.string().trim().max(120).nullable`، `z.string().trim().max`، `z.string().trim`، `z.string`، `z.string().uuid().nullable().optional`، `z.string().uuid().nullable`، `z.string().uuid`، `schema.parse`، `(await storage.getIncidents()).find`، `storage.getIncidents`، `res.status(404).json`، `res.status`، `isAllowedIncidentAssignee`، `res.status(400).json`، `db.transaction`، `tx.select().from(incidents).where(eq(incidents.id, req.params.id)).for`، `tx.select().from(incidents).where`، `tx.select().from`، `tx.select`، `eq`، `tx.update(incidents).set({ ...(assignment.assignmentGroup !== undefined ? { assignmentGroup: assignment.assignmentGroup \|\| null } : {}), ...(assignment.assigneeId !== undefined ? { assigneeId: assignment.assigneeId, assignedToId: assignment.assigneeId } : {}), updatedAt: new Date(), }).where(eq(incidents.id, incident.id)).returning`، `tx.update(incidents).set({ ...(assignment.assignmentGroup !== undefined ? { assignmentGroup: assignment.assignmentGroup \|\| null } : {}), ...(assignment.assigneeId !== undefined ? { assigneeId: assignment.assigneeId, assignedToId: assignment.assigneeId } : {}), updatedAt: new Date(), }).where`، `tx.update(incidents).set`، `tx.update`، `tx.insert(incidentActivities).values`، `tx.insert`، `logAudit`، `res.json`، `res.status(error.statusCode).json`، `res.status(500).json`

## PATCH `/api/incidents/:id/status`

- المصدر: server/routes.ts:1552
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requireAnyPermission("ticket_manage", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `incidents`
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `z.object({ status: z.enum(["New", "In Progress", "Pending", "Resolved", "Closed"]), category: z.string().trim().max(120).nullable().optional(), resolutionCode: z.string().trim().max(120).nullable().optional(), resolutionNotes: z.string().trim().max(4000).nullable().optional(), }).parse`، `z.object`، `z.enum`، `z.string().trim().max(120).nullable().optional`، `z.string().trim().max(120).nullable`، `z.string().trim().max`، `z.string().trim`، `z.string`، `z.string().trim().max(4000).nullable().optional`، `z.string().trim().max(4000).nullable`، `db.select({ id: incidents.id, title: incidents.title, status: incidents.status, }).from(incidents).where`، `db.select({ id: incidents.id, title: incidents.title, status: incidents.status, }).from`، `db.select`، `eq`، `res.status(404).json`، `res.status`، `transitionIncident`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(error.statusCode).json`، `res.status(500).json`

## POST `/api/incidents/:id/to-change`

- المصدر: server/routes.ts:1675
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requireAnyPermission("ticket_manage", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `(await storage.getIncidents()).find`، `storage.getIncidents`، `res.status(404).json`، `res.status`، `res.status(409).json`، `storage.createChange`، `storage.updateIncident`، `res.status(201).json`، `res.status(500).json`

## GET `/api/incidents/options`

- المصدر: server/routes.ts:1366
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `assignment_groups`، `projects`، `roles`، `sla_policies`، `user_roles`، `users`
- الاستدعاءات الظاهرة: `requireModule`، `canManageAllTickets`، `Promise.all`، `isFeatureEnabled("project_management").then`، `isFeatureEnabled`، `db.select({ id: projects.id, name: projects.name }).from(projects).where`، `db.select({ id: projects.id, name: projects.name }).from`، `db.select`، `eq`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, roleName: roles.name }) .from(users).innerJoin(userRoles, eq(userRoles.userId, users.id)).innerJoin(roles, eq(userRoles.roleId, roles.id)).where`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, roleName: roles.name }) .from(users).innerJoin(userRoles, eq(userRoles.userId, users.id)).innerJoin`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, roleName: roles.name }) .from(users).innerJoin`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, roleName: roles.name }) .from`، `db.select({ id: slaPolicies.id, name: slaPolicies.name, priority: slaPolicies.priority, ticketType: slaPolicies.ticketType }).from(slaPolicies).where`، `db.select({ id: slaPolicies.id, name: slaPolicies.name, priority: slaPolicies.priority, ticketType: slaPolicies.ticketType }).from`، `storage.getIncidents`، `storage.getServiceRequests`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email }).from`، `db.select({ id: assignmentGroups.id, name: assignmentGroups.name }).from(assignmentGroups) .where(eq(assignmentGroups.active, true)).orderBy`، `db.select({ id: assignmentGroups.id, name: assignmentGroups.name }).from(assignmentGroups) .where`، `db.select({ id: assignmentGroups.id, name: assignmentGroups.name }).from`، `asc`، `Promise.resolve`، `staffRoleNames.has`، `user.roleName.trim().toLowerCase`، `user.roleName.trim`، `eligibleUsers.set`، `[user.firstName, user.lastName].filter(Boolean).join`، `[user.firstName, user.lastName].filter`، `res.json`، `Array.from`، `eligibleUsers.values`، `canViewAllItsmRecords`، `requesterRows.map`، `[person.firstName, person.lastName].filter(Boolean).join`، `[person.firstName, person.lastName].filter`، `[...managedAssignmentGroups.map(group => group.name), ...incidentRows, ...requestRows].map(row => typeof row === "string" ? row.trim() : row.assignmentGroup?.trim()).filter`، `[...managedAssignmentGroups.map(group => group.name), ...incidentRows, ...requestRows].map`، `managedAssignmentGroups.map`، `row.trim`، `row.assignmentGroup?.trim`، `Boolean`، `policyRows.filter`، `res.status(500).json`، `res.status`

## POST `/api/incidents/projects`

- المصدر: server/routes.ts:1406
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requireModule("project_management")` → `requirePermission("ticket_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `projects`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertProjectSchema.pick({ name: true, description: true }).parse`، `insertProjectSchema.pick`، `db.insert(projects).values({ ...projectData, title: projectData.name, createdBy: req.user?.id ?? null, }).returning`، `db.insert(projects).values`، `db.insert`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(409).json`

## GET `/api/kb/articles`

- المصدر: server/knowledge-governance.ts:231
- سلسلة الوسطاء/المعالج: `requireAuth` → `list()`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `list`

## POST `/api/kb/articles`

- المصدر: server/knowledge-governance.ts:262
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (req, res, user) => { requireEditor(user); const input = knowledgeArticleInput.parse(req.body); const { changeNote, ...fields } = input; const article = await db.transaction(async tx => { await validateReferences(tx, input); const [created] = await tx.insert(k`
- جداول مشار إليها مباشرة: `kb_articles`
- الاستدعاءات الظاهرة: `route`، `requireEditor`، `knowledgeArticleInput.parse`، `db.transaction`، `validateReferences`، `tx.insert(kbArticles).values({ ...fields, authorId: user.id, ownerId: input.ownerId === undefined ? user.id : input.ownerId, version: "1.0", slug: input.slug ?? '${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-\|-$/g, "").slice(0, 160) \|\| "article"}-${randomUUID().slice(0, 8)}', publishedAt: input.status === "published" ? new Date() : null, }).returning`، `tx.insert(kbArticles).values`، `tx.insert`، `input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-\|-$/g, "").slice`، `input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace`، `input.title.toLowerCase().replace`، `input.title.toLowerCase`، `randomUUID().slice`، `randomUUID`، `revision`، `audit`، `res.status(201).json`، `res.status`

## DELETE `/api/kb/articles/:id`

- المصدر: server/knowledge-governance.ts:283
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (req, res, user) => { const archived = await db.transaction(async tx => { const [previous] = await tx.select().from(kbArticles) .where(eq(kbArticles.id, req.params.id)).for("update"); if (!previous) throw new KnowledgeError(404, "Article not found"); if (!ca`
- جداول مشار إليها مباشرة: `kb_articles`
- الاستدعاءات الظاهرة: `route`، `db.transaction`، `tx.select().from(kbArticles) .where(eq(kbArticles.id, req.params.id)).for`، `tx.select().from(kbArticles) .where`، `tx.select().from`، `tx.select`، `eq`، `canDeleteKnowledgeArticle`، `revision`، `tx.update(kbArticles).set({ status: "archived", ...(previous.isSystemGuide ? { isPublic: false } : {}), version: nextKnowledgeVersion(previous.version), updatedAt: new Date(), }).where(eq(kbArticles.id, previous.id)).returning`، `tx.update(kbArticles).set({ status: "archived", ...(previous.isSystemGuide ? { isPublic: false } : {}), version: nextKnowledgeVersion(previous.version), updatedAt: new Date(), }).where`، `tx.update(kbArticles).set`، `tx.update`، `nextKnowledgeVersion`، `audit`، `res.json`

## GET `/api/kb/articles/:id`

- المصدر: server/knowledge-governance.ts:234
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (req, res, user) => { const article = await articleDetail(req.params.id, user); await db.update(kbArticles).set({ views: sql'${kbArticles.views} + 1' }).where(eq(kbArticles.id, article.id)); res.json(article); })`
- جداول مشار إليها مباشرة: `kb_articles`
- الاستدعاءات الظاهرة: `route`، `articleDetail`، `db.update(kbArticles).set({ views: sql'${kbArticles.views} + 1' }).where`، `db.update(kbArticles).set`، `db.update`، `eq`، `res.json`

## PUT `/api/kb/articles/:id`

- المصدر: server/knowledge-governance.ts:279
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (req, res, user) => { res.json(await updateArticle(req, user)); })`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `route`، `res.json`، `updateArticle`

## GET `/api/kb/articles/:id/attachments`

- المصدر: server/knowledge-governance.ts:326
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (req, res, user) => { const article = await articleDetail(req.params.id, user); if (!["policy", "technical sop", "dr plan"].includes(article.category.trim().toLowerCase())) { throw new KnowledgeError(404, "Policy documents not found"); } const rows = await db.select`
- جداول مشار إليها مباشرة: `kb_article_attachments`، `users`
- الاستدعاءات الظاهرة: `route`، `articleDetail`، `["policy", "technical sop", "dr plan"].includes`، `article.category.trim().toLowerCase`، `article.category.trim`، `db.select({ id: kbArticleAttachments.id, articleId: kbArticleAttachments.articleId, articleVersion: kbArticleAttachments.articleVersion, documentType: kbArticleAttachments.documentType, version: kbArticleAttachments.version, originalName: kbArticleAttachments.originalName, fileType: kbArticleAttachments.fileType, fileSize: kbArticleAttachments.fileSize, uploadedAt: kbArticleAttachments.uploadedAt, uploadedBy: kbArticleAttachments.uploadedBy, uploadedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(kbArticleAttachments).leftJoin(users, eq(kbArticleAttachments.uploadedBy, users.id)) .where(eq(kbArticleAttachments.articleId, article.id)) .orderBy`، `db.select({ id: kbArticleAttachments.id, articleId: kbArticleAttachments.articleId, articleVersion: kbArticleAttachments.articleVersion, documentType: kbArticleAttachments.documentType, version: kbArticleAttachments.version, originalName: kbArticleAttachments.originalName, fileType: kbArticleAttachments.fileType, fileSize: kbArticleAttachments.fileSize, uploadedAt: kbArticleAttachments.uploadedAt, uploadedBy: kbArticleAttachments.uploadedBy, uploadedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(kbArticleAttachments).leftJoin(users, eq(kbArticleAttachments.uploadedBy, users.id)) .where`، `db.select({ id: kbArticleAttachments.id, articleId: kbArticleAttachments.articleId, articleVersion: kbArticleAttachments.articleVersion, documentType: kbArticleAttachments.documentType, version: kbArticleAttachments.version, originalName: kbArticleAttachments.originalName, fileType: kbArticleAttachments.fileType, fileSize: kbArticleAttachments.fileSize, uploadedAt: kbArticleAttachments.uploadedAt, uploadedBy: kbArticleAttachments.uploadedBy, uploadedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(kbArticleAttachments).leftJoin`، `db.select({ id: kbArticleAttachments.id, articleId: kbArticleAttachments.articleId, articleVersion: kbArticleAttachments.articleVersion, documentType: kbArticleAttachments.documentType, version: kbArticleAttachments.version, originalName: kbArticleAttachments.originalName, fileType: kbArticleAttachments.fileType, fileSize: kbArticleAttachments.fileSize, uploadedAt: kbArticleAttachments.uploadedAt, uploadedBy: kbArticleAttachments.uploadedBy, uploadedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from`، `db.select`، `eq`، `desc`، `canManageKnowledge`، `res.json`، `row.originalName.trim().toLowerCase`، `row.originalName.trim`، `row.documentType.toLowerCase`، `latest.has`، `latest.set`، `Array.from`، `latest.values`

## POST `/api/kb/articles/:id/attachments`

- المصدر: server/knowledge-governance.ts:354
- سلسلة الوسطاء/المعالج: `requireAuth` → `editorMiddleware` → `fileMiddleware` → `route(async (req, res, user) => { const file = (req as Request & { file?: Express.Multer.File }).file; if (!file) throw new KnowledgeError(400, "Choose a policy document to upload"); let body: { documentType: string }; try { body = z.object({ documentType: z.string().tr`
- جداول مشار إليها مباشرة: `audit_logs`، `kb_article_attachments`، `kb_articles`
- الاستدعاءات الظاهرة: `route`، `z.object({ documentType: z.string().trim().min(1).max(100).default("official_policy"), }).strict().parse`، `z.object({ documentType: z.string().trim().min(1).max(100).default("official_policy"), }).strict`، `z.object`، `z.string().trim().min(1).max(100).default`، `z.string().trim().min(1).max`، `z.string().trim().min`، `z.string().trim`، `z.string`، `unlink(file.path).catch`، `unlink`، `basename(file.originalname.replace(/\\/g, "/")).slice`، `basename`، `file.originalname.replace`، `db.transaction`، `tx.select().from(kbArticles) .where(eq(kbArticles.id, req.params.id)).for`، `tx.select().from(kbArticles) .where`، `tx.select().from`، `tx.select`، `eq`، `requireSystemGuideAdministrator`، `["policy", "technical sop", "dr plan"].includes`، `article.category.trim().toLowerCase`، `article.category.trim`، `tx.select({ version: kbArticleAttachments.version }) .from(kbArticleAttachments).where(and( eq(kbArticleAttachments.articleId, article.id), sql'lower(btrim(${kbArticleAttachments.originalName})) = ${originalName.trim().toLowerCase()}', eq(kbArticleAttachments.documentType, body.documentType), )).orderBy(desc(kbArticleAttachments.version)).limit`، `tx.select({ version: kbArticleAttachments.version }) .from(kbArticleAttachments).where(and( eq(kbArticleAttachments.articleId, article.id), sql'lower(btrim(${kbArticleAttachments.originalName})) = ${originalName.trim().toLowerCase()}', eq(kbArticleAttachments.documentType, body.documentType), )).orderBy`، `tx.select({ version: kbArticleAttachments.version }) .from(kbArticleAttachments).where`، `tx.select({ version: kbArticleAttachments.version }) .from`، `and`، `originalName.trim().toLowerCase`، `originalName.trim`، `desc`، `tx.insert(kbArticleAttachments).values({ articleId: article.id, articleVersion: article.version, documentType: body.documentType, version: (latest?.version ?? 0) + 1, originalName, fileName: basename(file.filename), fileType: file.mimetype, fileSize: file.size, filePath: file.path, uploadedBy: user.id, }).returning`، `tx.insert(kbArticleAttachments).values`، `tx.insert`، `tx.insert(auditLogs).values`، `JSON.stringify`، `req.get`، `res.status(201).json`، `res.status`

## GET `/api/kb/articles/:id/attachments/:attachmentId`

- المصدر: server/knowledge-governance.ts:409
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (req, res, user) => { const article = await articleDetail(req.params.id, user); const [attachment] = await db.select().from(kbArticleAttachments).where(and( eq(kbArticleAttachments.articleId, article.id), eq(kbArticleAttachments.id, req.params.attachmentId), )).li`
- جداول مشار إليها مباشرة: `kb_article_attachments`
- الاستدعاءات الظاهرة: `route`، `articleDetail`، `db.select().from(kbArticleAttachments).where(and( eq(kbArticleAttachments.articleId, article.id), eq(kbArticleAttachments.id, req.params.attachmentId), )).limit`، `db.select().from(kbArticleAttachments).where`، `db.select().from`، `db.select`، `and`، `eq`، `canManageKnowledge`، `db.select({ id: kbArticleAttachments.id }) .from(kbArticleAttachments).where(and( eq(kbArticleAttachments.articleId, article.id), eq(kbArticleAttachments.documentType, attachment.documentType), sql'lower(btrim(${kbArticleAttachments.originalName})) = ${attachment.originalName.trim().toLowerCase()}', )).orderBy(desc(kbArticleAttachments.version)).limit`، `db.select({ id: kbArticleAttachments.id }) .from(kbArticleAttachments).where(and( eq(kbArticleAttachments.articleId, article.id), eq(kbArticleAttachments.documentType, attachment.documentType), sql'lower(btrim(${kbArticleAttachments.originalName})) = ${attachment.originalName.trim().toLowerCase()}', )).orderBy`، `db.select({ id: kbArticleAttachments.id }) .from(kbArticleAttachments).where`، `db.select({ id: kbArticleAttachments.id }) .from`، `attachment.originalName.trim().toLowerCase`، `attachment.originalName.trim`، `desc`، `res.download`

## GET `/api/kb/articles/:id/controls`

- المصدر: server/knowledge-governance.ts:428
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (req, res, user) => { if (!canManageKnowledge(user) && !canAuditPublishedPolicies(user)) { throw new KnowledgeError(403, "Compliance control mappings are restricted to IT governance staff and auditors"); } const article = await articleDetail(req.params.id, user); co`
- جداول مشار إليها مباشرة: `kb_article_control_mappings`، `users`
- الاستدعاءات الظاهرة: `route`، `canManageKnowledge`، `canAuditPublishedPolicies`، `articleDetail`، `db.select({ ...getTableColumns(kbArticleControlMappings), mapperName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(kbArticleControlMappings).leftJoin(users, eq(kbArticleControlMappings.mappedBy, users.id)) .where(and( eq(kbArticleControlMappings.articleId, article.id), canManageKnowledge(user) ? undefined : and( eq(kbArticleControlMappings.isActive, true), eq(kbArticleControlMappings.articleVersion, article.version), ), )).orderBy`، `db.select({ ...getTableColumns(kbArticleControlMappings), mapperName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(kbArticleControlMappings).leftJoin(users, eq(kbArticleControlMappings.mappedBy, users.id)) .where`، `db.select({ ...getTableColumns(kbArticleControlMappings), mapperName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(kbArticleControlMappings).leftJoin`، `db.select({ ...getTableColumns(kbArticleControlMappings), mapperName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from`، `db.select`، `getTableColumns`، `eq`، `and`، `desc`، `res.json`

## POST `/api/kb/articles/:id/controls`

- المصدر: server/knowledge-governance.ts:446
- سلسلة الوسطاء/المعالج: `requireAuth` → `editorMiddleware` → `route(async (req, res, user) => { const input = z.object({ framework: z.string().trim().min(1).max(120), controlId: z.string().trim().min(1).max(120), controlTitle: z.string().trim().min(1).max(300), implementationNotes: z.string().trim().max(4000).nullable().optional(),`
- جداول مشار إليها مباشرة: `audit_logs`، `kb_article_control_mappings`، `kb_articles`
- الاستدعاءات الظاهرة: `route`، `z.object({ framework: z.string().trim().min(1).max(120), controlId: z.string().trim().min(1).max(120), controlTitle: z.string().trim().min(1).max(300), implementationNotes: z.string().trim().max(4000).nullable().optional(), }).strict().parse`، `z.object({ framework: z.string().trim().min(1).max(120), controlId: z.string().trim().min(1).max(120), controlTitle: z.string().trim().min(1).max(300), implementationNotes: z.string().trim().max(4000).nullable().optional(), }).strict`، `z.object`، `z.string().trim().min(1).max`، `z.string().trim().min`، `z.string().trim`، `z.string`، `z.string().trim().max(4000).nullable().optional`، `z.string().trim().max(4000).nullable`، `z.string().trim().max`، `db.transaction`، `tx.select().from(kbArticles).where(eq(kbArticles.id, req.params.id)).for`، `tx.select().from(kbArticles).where`، `tx.select().from`، `tx.select`، `eq`، `requireSystemGuideAdministrator`، `["policy", "technical sop", "dr plan"].includes`، `article.category.trim().toLowerCase`، `article.category.trim`، `tx.insert(kbArticleControlMappings).values({ articleId: article.id, articleVersion: article.version, ...input, mappedBy: user.id, }).returning`، `tx.insert(kbArticleControlMappings).values`، `tx.insert`، `tx.insert(auditLogs).values`، `JSON.stringify`، `req.get`، `res.status(201).json`، `res.status`

## POST `/api/kb/articles/:id/controls/:mappingId/remove`

- المصدر: server/knowledge-governance.ts:473
- سلسلة الوسطاء/المعالج: `requireAuth` → `editorMiddleware` → `route(async (req, res, user) => { const { removalNote } = z.object({ removalNote: z.string().trim().min(5).max(1000) }).strict().parse(req.body); const updated = await db.transaction(async tx => { const [before] = await tx.select().from(kbArticleControlMappings).where(and( eq(k`
- جداول مشار إليها مباشرة: `audit_logs`، `kb_article_control_mappings`، `kb_articles`
- الاستدعاءات الظاهرة: `route`، `z.object({ removalNote: z.string().trim().min(5).max(1000) }).strict().parse`، `z.object({ removalNote: z.string().trim().min(5).max(1000) }).strict`، `z.object`، `z.string().trim().min(5).max`، `z.string().trim().min`، `z.string().trim`، `z.string`، `db.transaction`، `tx.select().from(kbArticleControlMappings).where(and( eq(kbArticleControlMappings.id, req.params.mappingId), eq(kbArticleControlMappings.articleId, req.params.id), )).for`، `tx.select().from(kbArticleControlMappings).where`، `tx.select().from`، `tx.select`، `and`، `eq`، `tx.select().from(kbArticles) .where(eq(kbArticles.id, before.articleId)).for`، `tx.select().from(kbArticles) .where`، `requireSystemGuideAdministrator`، `tx.update(kbArticleControlMappings).set({ isActive: false, removedBy: user.id, removedAt: new Date(), removalNote, }).where(eq(kbArticleControlMappings.id, before.id)).returning`، `tx.update(kbArticleControlMappings).set({ isActive: false, removedBy: user.id, removedAt: new Date(), removalNote, }).where`، `tx.update(kbArticleControlMappings).set`، `tx.update`، `tx.insert(auditLogs).values`، `tx.insert`، `JSON.stringify`، `req.get`، `res.json`

## POST `/api/kb/articles/:id/rate`

- المصدر: server/knowledge-governance.ts:316
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (req, res, user) => { await articleDetail(req.params.id, user); const { helpful } = z.object({ helpful: z.boolean() }).parse(req.body); const field = helpful ? kbArticles.helpfulCount : kbArticles.notHelpfulCount; await db.update(kbArticles).set(helpful ? { helpfulC`
- جداول مشار إليها مباشرة: `kb_articles`
- الاستدعاءات الظاهرة: `route`، `articleDetail`، `z.object({ helpful: z.boolean() }).parse`، `z.object`، `z.boolean`، `db.update(kbArticles).set(helpful ? { helpfulCount: sql'coalesce(${field}, 0) + 1' } : { notHelpfulCount: sql'coalesce(${field}, 0) + 1' }).where`، `db.update(kbArticles).set`، `db.update`، `eq`، `res.json`

## GET `/api/kb/articles/:id/versions`

- المصدر: server/knowledge-governance.ts:239
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (req, res, user) => { const article = await articleDetail(req.params.id, user); const versions = await db.select({ ...getTableColumns(kbArticleVersions), actorName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', snapshotAuthorName: sq`
- جداول مشار إليها مباشرة: `kb_article_versions`، `users`
- الاستدعاءات الظاهرة: `route`، `articleDetail`، `db.select({ ...getTableColumns(kbArticleVersions), actorName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', snapshotAuthorName: sql<string \| null>'concat_ws(' ', ${revisionAuthors.firstName}, ${revisionAuthors.lastName})', snapshotOwnerName: sql<string \| null>'concat_ws(' ', ${revisionOwners.firstName}, ${revisionOwners.lastName})', }).from(kbArticleVersions).leftJoin(users, eq(kbArticleVersions.actorId, users.id)) .leftJoin(revisionAuthors, eq(revisionAuthors.id, sql'${kbArticleVersions.snapshot}->>'authorId'')) .leftJoin(revisionOwners, eq(revisionOwners.id, sql'${kbArticleVersions.snapshot}->>'ownerId'')) .where(and(eq(kbArticleVersions.articleId, article.id), canManageKnowledge(user) ? undefined : eq(kbArticleVersions.version, article.version))) .orderBy`، `db.select({ ...getTableColumns(kbArticleVersions), actorName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', snapshotAuthorName: sql<string \| null>'concat_ws(' ', ${revisionAuthors.firstName}, ${revisionAuthors.lastName})', snapshotOwnerName: sql<string \| null>'concat_ws(' ', ${revisionOwners.firstName}, ${revisionOwners.lastName})', }).from(kbArticleVersions).leftJoin(users, eq(kbArticleVersions.actorId, users.id)) .leftJoin(revisionAuthors, eq(revisionAuthors.id, sql'${kbArticleVersions.snapshot}->>'authorId'')) .leftJoin(revisionOwners, eq(revisionOwners.id, sql'${kbArticleVersions.snapshot}->>'ownerId'')) .where`، `db.select({ ...getTableColumns(kbArticleVersions), actorName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', snapshotAuthorName: sql<string \| null>'concat_ws(' ', ${revisionAuthors.firstName}, ${revisionAuthors.lastName})', snapshotOwnerName: sql<string \| null>'concat_ws(' ', ${revisionOwners.firstName}, ${revisionOwners.lastName})', }).from(kbArticleVersions).leftJoin(users, eq(kbArticleVersions.actorId, users.id)) .leftJoin(revisionAuthors, eq(revisionAuthors.id, sql'${kbArticleVersions.snapshot}->>'authorId'')) .leftJoin`، `db.select({ ...getTableColumns(kbArticleVersions), actorName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', snapshotAuthorName: sql<string \| null>'concat_ws(' ', ${revisionAuthors.firstName}, ${revisionAuthors.lastName})', snapshotOwnerName: sql<string \| null>'concat_ws(' ', ${revisionOwners.firstName}, ${revisionOwners.lastName})', }).from(kbArticleVersions).leftJoin(users, eq(kbArticleVersions.actorId, users.id)) .leftJoin`، `db.select({ ...getTableColumns(kbArticleVersions), actorName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', snapshotAuthorName: sql<string \| null>'concat_ws(' ', ${revisionAuthors.firstName}, ${revisionAuthors.lastName})', snapshotOwnerName: sql<string \| null>'concat_ws(' ', ${revisionOwners.firstName}, ${revisionOwners.lastName})', }).from(kbArticleVersions).leftJoin`، `db.select({ ...getTableColumns(kbArticleVersions), actorName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', snapshotAuthorName: sql<string \| null>'concat_ws(' ', ${revisionAuthors.firstName}, ${revisionAuthors.lastName})', snapshotOwnerName: sql<string \| null>'concat_ws(' ', ${revisionOwners.firstName}, ${revisionOwners.lastName})', }).from`، `db.select`، `getTableColumns`، `eq`، `and`، `canManageKnowledge`، `desc`، `versions.filter`، `canReadKnowledge`، `res.json`، `visible.map`

## GET `/api/kb/options`

- المصدر: server/knowledge-governance.ts:221
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (_req, res, user) => { const categories = await db.select({ value: dropdownOptions.value, label: dropdownOptions.label }) .from(dropdownOptions).where(and(eq(dropdownOptions.category, "kb_category"), eq(dropdownOptions.isActive, true))) .orderBy(dropdownOptions.displayOrd`
- جداول مشار إليها مباشرة: `dropdown_options`، `users`
- الاستدعاءات الظاهرة: `route`، `db.select({ value: dropdownOptions.value, label: dropdownOptions.label }) .from(dropdownOptions).where(and(eq(dropdownOptions.category, "kb_category"), eq(dropdownOptions.isActive, true))) .orderBy`، `db.select({ value: dropdownOptions.value, label: dropdownOptions.label }) .from(dropdownOptions).where`، `db.select({ value: dropdownOptions.value, label: dropdownOptions.label }) .from`، `db.select`، `and`، `eq`، `canManageKnowledge`، `db.select({ id: users.id, name: sql<string>'concat_ws(' ', ${users.firstName}, ${users.lastName})', }).from(users).where(eq(users.isActive, true)).orderBy`، `db.select({ id: users.id, name: sql<string>'concat_ws(' ', ${users.firstName}, ${users.lastName})', }).from(users).where`، `db.select({ id: users.id, name: sql<string>'concat_ws(' ', ${users.firstName}, ${users.lastName})', }).from`، `res.json`

## GET `/api/kb/search`

- المصدر: server/knowledge-governance.ts:232
- سلسلة الوسطاء/المعالج: `requireAuth` → `list(true)`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `list`

## GET `/api/kpis`

- المصدر: server/routes.ts:11625
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `changes`، `problems`، `tickets`
- الاستدعاءات الظاهرة: `now.getFullYear`، `now.getMonth`، `Promise.all`، `storage.getTickets`، `isFeatureEnabled`، `storage.getAssets`، `storage.getProblems`، `storage.getChangeReportSummary`، `now.getTime`، `tickets.filter`، `["resolved","closed","cancelled"].includes`، `resolvedTix.reduce`، `new Date(t.resolvedAt as any).getTime`، `new Date(t.createdAt as any).getTime`، `Math.round`، `resolvedTix.filter`، `slaEligible.filter`، `assets.filter`، `problems.filter`، `["open","investigating","known_error"].includes`، `openProb.reduce`، `new Date(p.createdAt as any).getTime`، `res.json`، `new Date().toISOString`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/locations`

- المصدر: server/routes.ts:5403
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `locations`
- الاستدعاءات الظاهرة: `storage.getLocationsWithDetails`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/locations`

- المصدر: server/routes.ts:5412
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('location_create')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertLocationSchema.parse`، `storage.createLocation`، `logAudit`، `location.id.toString`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## DELETE `/api/locations/:id`

- المصدر: server/routes.ts:5453
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('location_delete')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getLocation`، `storage.deleteLocation`، `res.status(404).json`، `res.status`، `logAudit`، `location.id.toString`، `res.status(204).send`، `res.status(500).json`

## PUT `/api/locations/:id`

- المصدر: server/routes.ts:5429
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('location_update')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertLocationSchema.partial().parse`، `insertLocationSchema.partial`، `storage.getLocation`، `storage.updateLocation`، `res.status(404).json`، `res.status`، `logAudit`، `location.id.toString`، `res.json`، `res.status(400).json`، `res.status(500).json`

## POST `/api/login`

- المصدر: server/auth.ts:134
- سلسلة الوسطاء/المعالج: `loginLimiter` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `passport.authenticate("local", (err: any, user: SelectUser \| false, info: any) => { if (err) return next(err); if (!user) return res.status(401).json({ error: info?.message \|\| "Authentication failed" }); void withUserSessionLock(user.id, async () => { // The account may have been deactivated after Passport looked it up. const currentUser = await storage.getUser(user.id); if (!currentUser?.isActive) { res.status(401).json({ error: "Account is inactive" }); return; } await new Promise<void>((resolve, reject) => { req.login(currentUser, { session: true }, (loginErr: any) => { if (loginErr) return reject(loginErr); req.session.save((saveErr: any) => { if (saveErr) return reject(saveErr); const { password, ...safeUser } = currentUser; res.status(200).json(safeUser); resolve(); }); }); }); }).catch((loginError) => { if (res.headersSent) return next(loginError); res.status(500).json({ error: "Login failed during session creation" }); }); })`، `passport.authenticate`، `next`، `res.status(401).json`، `res.status`، `withUserSessionLock(user.id, async () => { // The account may have been deactivated after Passport looked it up. const currentUser = await storage.getUser(user.id); if (!currentUser?.isActive) { res.status(401).json({ error: "Account is inactive" }); return; } await new Promise<void>((resolve, reject) => { req.login(currentUser, { session: true }, (loginErr: any) => { if (loginErr) return reject(loginErr); req.session.save((saveErr: any) => { if (saveErr) return reject(saveErr); const { password, ...safeUser } = currentUser; res.status(200).json(safeUser); resolve(); }); }); }); }).catch`، `withUserSessionLock`، `storage.getUser`، `req.login`، `reject`، `req.session.save`، `res.status(200).json`، `resolve`، `res.status(500).json`

## POST `/api/logout`

- المصدر: server/auth.ts:165
- سلسلة الوسطاء/المعالج: `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `req.logout`، `next`، `req.session.destroy`، `res.clearCookie`، `res.sendStatus`

## GET `/api/maintenance-records`

- المصدر: server/routes.ts:7651
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getMaintenanceRecordsWithDetails`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/maintenance-records`

- المصدر: server/routes.ts:7660
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('maintenance_create')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `maintenanceRecordSubmissionSchema.parse`، `storage.createMaintenanceRecordWithScheduleAdvance`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(404).json`، `error.message.startsWith`، `res.status(409).json`، `res.status(500).json`

## DELETE `/api/maintenance-records/:id`

- المصدر: server/routes.ts:7714
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('maintenance_delete')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getMaintenanceRecord`، `storage.deleteMaintenanceRecord`، `res.status(404).json`، `res.status`، `logAudit`، `res.status(204).send`، `res.status(500).json`

## PUT `/api/maintenance-records/:id`

- المصدر: server/routes.ts:7690
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('maintenance_update')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertMaintenanceRecordSchema.partial().parse`، `insertMaintenanceRecordSchema.partial`، `storage.getMaintenanceRecord`، `storage.updateMaintenanceRecord`، `res.status(404).json`، `res.status`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## GET `/api/maintenance-schedules`

- المصدر: server/routes.ts:7579
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getMaintenanceSchedulesWithDetails`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/maintenance-schedules`

- المصدر: server/routes.ts:7588
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('maintenance_create')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertMaintenanceScheduleSchema.parse`، `storage.createMaintenanceSchedule`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## DELETE `/api/maintenance-schedules/:id`

- المصدر: server/routes.ts:7629
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('maintenance_delete')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getMaintenanceSchedule`، `storage.deleteMaintenanceSchedule`، `res.status(404).json`، `res.status`، `logAudit`، `res.status(204).send`، `res.status(500).json`

## PUT `/api/maintenance-schedules/:id`

- المصدر: server/routes.ts:7605
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('maintenance_update')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertMaintenanceScheduleSchema.partial().parse`، `insertMaintenanceScheduleSchema.partial`، `storage.getMaintenanceSchedule`، `storage.updateMaintenanceSchedule`، `res.status(404).json`، `res.status`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## GET `/api/module-settings`

- المصدر: server/routes.ts:9079
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getModuleSettings`، `MODULE_REGISTRY.map`، `settingsList.find`، `res.json`، `res.status(500).json`، `res.status`

## PUT `/api/module-settings/:moduleKey`

- المصدر: server/routes.ts:9104
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('system_admin')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `isValidModuleKey`، `res.status(404).json`، `res.status`، `res.status(400).json`، `getModuleDefinition`، `storage.updateModuleSetting`، `publishItsmEnabled`، `res.json`، `res.status(500).json`

## GET `/api/module-settings/events`

- المصدر: server/routes.ts:9102
- سلسلة الوسطاء/المعالج: `requireAuth` → `cabAccessEventsHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## GET `/api/module-status`

- المصدر: server/routes.ts:9061
- سلسلة الوسطاء/المعالج: `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getModuleSettings`، `MODULE_REGISTRY.map`، `settingsList.find`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/my/asset-handovers`

- المصدر: server/asset-handovers.ts:419
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("my_assets_view")` → `inline handler`
- جداول مشار إليها مباشرة: `asset_handovers`، `assets`، `assignments`، `employees`، `users`
- الاستدعاءات الظاهرة: `requirePermission`، `String(req.user?.email ?? "").trim().toLowerCase`، `String(req.user?.email ?? "").trim`، `String`، `res.json`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, assetId: assets.id, assetTag: assets.assetTag, assetName: assets.name, assetType: assets.type, serialNumber: assets.serialNumber, assignmentReturnedDate: assignments.returnedDate, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin(assets, eq(assets.id, assetHandovers.assetId)) .innerJoin(assignments, eq(assignments.id, assetHandovers.assignmentId)) .leftJoin(users, eq(users.id, assetHandovers.issuedByUserId)) .where(and( sql'lower(${employees.email}) = ${email}', isNull(assignments.returnedDate), or( eq(assetHandovers.type, "Issue / Assignment"), eq(assetHandovers.type, "Replacement / Swap"), ), )) .orderBy`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, assetId: assets.id, assetTag: assets.assetTag, assetName: assets.name, assetType: assets.type, serialNumber: assets.serialNumber, assignmentReturnedDate: assignments.returnedDate, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin(assets, eq(assets.id, assetHandovers.assetId)) .innerJoin(assignments, eq(assignments.id, assetHandovers.assignmentId)) .leftJoin(users, eq(users.id, assetHandovers.issuedByUserId)) .where`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, assetId: assets.id, assetTag: assets.assetTag, assetName: assets.name, assetType: assets.type, serialNumber: assets.serialNumber, assignmentReturnedDate: assignments.returnedDate, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin(assets, eq(assets.id, assetHandovers.assetId)) .innerJoin(assignments, eq(assignments.id, assetHandovers.assignmentId)) .leftJoin`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, assetId: assets.id, assetTag: assets.assetTag, assetName: assets.name, assetType: assets.type, serialNumber: assets.serialNumber, assignmentReturnedDate: assignments.returnedDate, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin(assets, eq(assets.id, assetHandovers.assetId)) .innerJoin`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, assetId: assets.id, assetTag: assets.assetTag, assetName: assets.name, assetType: assets.type, serialNumber: assets.serialNumber, assignmentReturnedDate: assignments.returnedDate, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', }).from(assetHandovers) .innerJoin(employees, eq(employees.id, assetHandovers.employeeId)) .innerJoin`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, assetId: assets.id, assetTag: assets.assetTag, assetName: assets.name, assetType: assets.type, serialNumber: assets.serialNumber, assignmentReturnedDate: assignments.returnedDate, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', }).from(assetHandovers) .innerJoin`، `db.select({ id: assetHandovers.id, handoverNumber: assetHandovers.handoverNumber, type: assetHandovers.type, handoverDate: assetHandovers.handoverDate, condition: assetHandovers.condition, includedAccessories: assetHandovers.includedAccessories, notes: assetHandovers.notes, acknowledged: assetHandovers.acknowledged, acknowledgedAt: assetHandovers.acknowledgedAt, signatureData: assetHandovers.signatureData, assetId: assets.id, assetTag: assets.assetTag, assetName: assets.name, assetType: assets.type, serialNumber: assets.serialNumber, assignmentReturnedDate: assignments.returnedDate, issuedByName: sql<string \| null>'concat_ws(' ', ${users.firstName}, ${users.lastName})', }).from`، `db.select`، `eq`، `and`، `isNull`، `or`، `desc`، `console.error`، `res.status(500).json`، `res.status`

## POST `/api/my/asset-handovers/:id/acknowledge`

- المصدر: server/asset-handovers.ts:462
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("my_assets_view")` → `inline handler`
- جداول مشار إليها مباشرة: `asset_handovers`، `audit_logs`، `employees`
- الاستدعاءات الظاهرة: `requirePermission`، `z.object({ confirmed: z.literal(true) }).safeParse`، `z.object`، `z.literal`، `res.status(400).json`، `res.status`، `String(req.user?.email ?? "").trim().toLowerCase`، `String(req.user?.email ?? "").trim`، `String`، `res.status(403).json`، `db.select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName, }).from(employees) .where(sql'lower(${employees.email}) = ${email}') .limit`، `db.select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName, }).from(employees) .where`، `db.select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName, }).from`، `db.select`، `db.transaction`، `tx.select().from(assetHandovers) .where(and(eq(assetHandovers.id, req.params.id), eq(assetHandovers.employeeId, employee.id))) .for`، `tx.select().from(assetHandovers) .where`، `tx.select().from`، `tx.select`، `and`، `eq`، `Object.assign`، `isIssueType`، `JSON.stringify`، `employeeName`، `acknowledgedAt.toISOString`، `tx.update(assetHandovers).set({ acknowledged: true, acknowledgedAt, signatureData, }).where(and(eq(assetHandovers.id, handover.id), eq(assetHandovers.acknowledged, false))).returning`، `tx.update(assetHandovers).set({ acknowledged: true, acknowledgedAt, signatureData, }).where`، `tx.update(assetHandovers).set`، `tx.update`، `tx.insert(auditLogs).values`، `tx.insert`، `auditEntry`، `res.json`، `errorStatus`، `res.status(errorStatus(error)!).json`، `console.error`، `res.status(500).json`

## GET `/api/my/assets`

- المصدر: server/routes.ts:3174
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("my_assets_view")` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `assignments`، `employees`
- الاستدعاءات الظاهرة: `requirePermission`، `res.json`، `db.select({ id: employees.id }) .from(employees) .where(sql'lower(${employees.email}) = lower(${userEmail})') .limit`، `db.select({ id: employees.id }) .from(employees) .where`، `db.select({ id: employees.id }) .from`، `db.select`، `db.select({ assignmentId: assignments.id, assignedDate: assignments.assignedDate, assetId: assets.id, assetTag: assets.assetTag, name: assets.name, type: assets.type, model: assets.model, serialNumber: assets.serialNumber, status: assets.status, }) .from(assignments) .innerJoin(assets, eq(assets.id, assignments.assetId)) .where(and(eq(assignments.employeeId, employee.id), isNull(assignments.returnedDate))) .orderBy`، `db.select({ assignmentId: assignments.id, assignedDate: assignments.assignedDate, assetId: assets.id, assetTag: assets.assetTag, name: assets.name, type: assets.type, model: assets.model, serialNumber: assets.serialNumber, status: assets.status, }) .from(assignments) .innerJoin(assets, eq(assets.id, assignments.assetId)) .where`، `db.select({ assignmentId: assignments.id, assignedDate: assignments.assignedDate, assetId: assets.id, assetTag: assets.assetTag, name: assets.name, type: assets.type, model: assets.model, serialNumber: assets.serialNumber, status: assets.status, }) .from(assignments) .innerJoin`، `db.select({ assignmentId: assignments.id, assignedDate: assignments.assignedDate, assetId: assets.id, assetTag: assets.assetTag, name: assets.name, type: assets.type, model: assets.model, serialNumber: assets.serialNumber, status: assets.status, }) .from`، `eq`، `and`، `isNull`، `desc`، `asc`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/network-topology/devices`

- المصدر: server/network-topology.ts:203
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(false, async (req, res) => { const term = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 120) : ""; const rows = await db.select({ ...getTableColumns(networkDevices), zoneName: networkZones.name, zoneCode: networkZones.code, }).from(networ`
- جداول مشار إليها مباشرة: `network_devices`، `network_zones`
- الاستدعاءات الظاهرة: `route`، `req.query.search.trim().slice`، `req.query.search.trim`، `db.select({ ...getTableColumns(networkDevices), zoneName: networkZones.name, zoneCode: networkZones.code, }).from(networkDevices).leftJoin(networkZones, eq(networkDevices.zoneId, networkZones.id)) .where(term ? or( ilike(networkDevices.name, '%${term}%'), ilike(networkDevices.hostname, '%${term}%'), ilike(networkDevices.managementIp, '%${term}%'), ilike(networkDevices.serialNumber, '%${term}%'), ) : undefined) .orderBy`، `db.select({ ...getTableColumns(networkDevices), zoneName: networkZones.name, zoneCode: networkZones.code, }).from(networkDevices).leftJoin(networkZones, eq(networkDevices.zoneId, networkZones.id)) .where`، `db.select({ ...getTableColumns(networkDevices), zoneName: networkZones.name, zoneCode: networkZones.code, }).from(networkDevices).leftJoin`، `db.select({ ...getTableColumns(networkDevices), zoneName: networkZones.name, zoneCode: networkZones.code, }).from`، `db.select`، `getTableColumns`، `eq`، `or`، `ilike`، `asc`، `res.json`

## POST `/api/network-topology/devices`

- المصدر: server/network-topology.ts:219
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { const input = deviceInput.parse(req.body); const [created] = await db.transaction(async tx => { const [row] = await tx.insert(networkDevices).values({ ...input, createdById: user.id }).returning(); await writeAudit(tx, req, user.id, "CREATE`
- جداول مشار إليها مباشرة: `network_devices`
- الاستدعاءات الظاهرة: `route`، `deviceInput.parse`، `db.transaction`، `tx.insert(networkDevices).values({ ...input, createdById: user.id }).returning`، `tx.insert(networkDevices).values`، `tx.insert`، `writeAudit`، `res.status(201).json`، `res.status`

## PUT `/api/network-topology/devices/:id`

- المصدر: server/network-topology.ts:228
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { const input = deviceInput.parse(req.body); const updated = await db.transaction(async tx => { const [before] = await tx.select().from(networkDevices).where(eq(networkDevices.id, req.params.id)).for("update"); if (!before) throw new NetworkE`
- جداول مشار إليها مباشرة: `network_devices`
- الاستدعاءات الظاهرة: `route`، `deviceInput.parse`، `db.transaction`، `tx.select().from(networkDevices).where(eq(networkDevices.id, req.params.id)).for`، `tx.select().from(networkDevices).where`، `tx.select().from`، `tx.select`، `eq`، `tx.update(networkDevices).set({ ...input, updatedAt: new Date() }) .where(eq(networkDevices.id, before.id)).returning`، `tx.update(networkDevices).set({ ...input, updatedAt: new Date() }) .where`، `tx.update(networkDevices).set`، `tx.update`، `writeAudit`، `res.json`

## GET `/api/network-topology/firewall-rules`

- المصدر: server/network-topology.ts:286
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(false, async (_req, res) => { const rules = await db.select({ ...getTableColumns(firewallRules), firewallDeviceName: firewallDevice.name, firewallHostname: firewallDevice.hostname, sourceZoneName: sourceZone.name, destinationZoneName: destinationZone.name,`
- جداول مشار إليها مباشرة: `firewall_rule_reviews`، `firewall_rules`، `users`
- الاستدعاءات الظاهرة: `route`، `db.select({ ...getTableColumns(firewallRules), firewallDeviceName: firewallDevice.name, firewallHostname: firewallDevice.hostname, sourceZoneName: sourceZone.name, destinationZoneName: destinationZone.name, }).from(firewallRules) .innerJoin(firewallDevice, eq(firewallRules.firewallDeviceId, firewallDevice.id)) .leftJoin(sourceZone, eq(firewallRules.sourceZoneId, sourceZone.id)) .leftJoin(destinationZone, eq(firewallRules.destinationZoneId, destinationZone.id)) .orderBy`، `db.select({ ...getTableColumns(firewallRules), firewallDeviceName: firewallDevice.name, firewallHostname: firewallDevice.hostname, sourceZoneName: sourceZone.name, destinationZoneName: destinationZone.name, }).from(firewallRules) .innerJoin(firewallDevice, eq(firewallRules.firewallDeviceId, firewallDevice.id)) .leftJoin(sourceZone, eq(firewallRules.sourceZoneId, sourceZone.id)) .leftJoin`، `db.select({ ...getTableColumns(firewallRules), firewallDeviceName: firewallDevice.name, firewallHostname: firewallDevice.hostname, sourceZoneName: sourceZone.name, destinationZoneName: destinationZone.name, }).from(firewallRules) .innerJoin(firewallDevice, eq(firewallRules.firewallDeviceId, firewallDevice.id)) .leftJoin`، `db.select({ ...getTableColumns(firewallRules), firewallDeviceName: firewallDevice.name, firewallHostname: firewallDevice.hostname, sourceZoneName: sourceZone.name, destinationZoneName: destinationZone.name, }).from(firewallRules) .innerJoin`، `db.select({ ...getTableColumns(firewallRules), firewallDeviceName: firewallDevice.name, firewallHostname: firewallDevice.hostname, sourceZoneName: sourceZone.name, destinationZoneName: destinationZone.name, }).from`، `db.select`، `getTableColumns`، `eq`، `asc`، `res.json`، `db.select({ ...getTableColumns(firewallRuleReviews), reviewerName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(firewallRuleReviews).leftJoin(users, eq(firewallRuleReviews.reviewerId, users.id)) .where(inArray(firewallRuleReviews.firewallRuleId, rules.map(rule => rule.id))) .orderBy`، `db.select({ ...getTableColumns(firewallRuleReviews), reviewerName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(firewallRuleReviews).leftJoin(users, eq(firewallRuleReviews.reviewerId, users.id)) .where`، `db.select({ ...getTableColumns(firewallRuleReviews), reviewerName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(firewallRuleReviews).leftJoin`، `db.select({ ...getTableColumns(firewallRuleReviews), reviewerName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from`، `inArray`، `rules.map`، `desc`، `latest.has`، `latest.set`، `latest.get`

## POST `/api/network-topology/firewall-rules`

- المصدر: server/network-topology.ts:309
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { const input = firewallRuleInput.parse(req.body); const [device] = await db.select({ id: networkDevices.id, name: networkDevices.name, deviceType: networkDevices.deviceType }) .from(networkDevices).where(eq(networkDevices.id, input.firewallDeviceI`
- جداول مشار إليها مباشرة: `firewall_rules`، `network_devices`
- الاستدعاءات الظاهرة: `route`، `firewallRuleInput.parse`، `db.select({ id: networkDevices.id, name: networkDevices.name, deviceType: networkDevices.deviceType }) .from(networkDevices).where`، `db.select({ id: networkDevices.id, name: networkDevices.name, deviceType: networkDevices.deviceType }) .from`، `db.select`، `eq`، `db.transaction`، `tx.insert(firewallRules).values({ ...input, nextReviewDueAt: input.nextReviewDueAt ?? addDays(input.reviewIntervalDays), createdById: user.id, }).returning`، `tx.insert(firewallRules).values`، `tx.insert`، `addDays`، `writeAudit`، `res.status(201).json`، `res.status`

## PUT `/api/network-topology/firewall-rules/:id`

- المصدر: server/network-topology.ts:325
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { const input = firewallRuleInput.parse(req.body); const [device] = await db.select({ id: networkDevices.id, deviceType: networkDevices.deviceType }) .from(networkDevices).where(eq(networkDevices.id, input.firewallDeviceId)); if (!device \|\| dev`
- جداول مشار إليها مباشرة: `firewall_rules`، `network_devices`
- الاستدعاءات الظاهرة: `route`، `firewallRuleInput.parse`، `db.select({ id: networkDevices.id, deviceType: networkDevices.deviceType }) .from(networkDevices).where`، `db.select({ id: networkDevices.id, deviceType: networkDevices.deviceType }) .from`، `db.select`، `eq`، `db.transaction`، `tx.select().from(firewallRules).where(eq(firewallRules.id, req.params.id)).for`، `tx.select().from(firewallRules).where`، `tx.select().from`، `tx.select`، `tx.update(firewallRules).set({ ...input, nextReviewDueAt: input.nextReviewDueAt ?? before.nextReviewDueAt, updatedAt: new Date(), }).where(eq(firewallRules.id, before.id)).returning`، `tx.update(firewallRules).set({ ...input, nextReviewDueAt: input.nextReviewDueAt ?? before.nextReviewDueAt, updatedAt: new Date(), }).where`، `tx.update(firewallRules).set`، `tx.update`، `writeAudit`، `res.json`

## GET `/api/network-topology/firewall-rules/:id/reviews`

- المصدر: server/network-topology.ts:343
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(false, async (req, res) => { const [rule] = await db.select({ id: firewallRules.id }).from(firewallRules) .where(eq(firewallRules.id, req.params.id)); if (!rule) throw new NetworkError(404, "Firewall rule not found"); res.json(await db.select({ ...getTableColumns(firewa`
- جداول مشار إليها مباشرة: `firewall_rule_reviews`، `firewall_rules`، `users`
- الاستدعاءات الظاهرة: `route`، `db.select({ id: firewallRules.id }).from(firewallRules) .where`، `db.select({ id: firewallRules.id }).from`، `db.select`، `eq`، `res.json`، `db.select({ ...getTableColumns(firewallRuleReviews), reviewerName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(firewallRuleReviews).leftJoin(users, eq(firewallRuleReviews.reviewerId, users.id)) .where(eq(firewallRuleReviews.firewallRuleId, rule.id)) .orderBy`، `db.select({ ...getTableColumns(firewallRuleReviews), reviewerName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(firewallRuleReviews).leftJoin(users, eq(firewallRuleReviews.reviewerId, users.id)) .where`، `db.select({ ...getTableColumns(firewallRuleReviews), reviewerName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(firewallRuleReviews).leftJoin`، `db.select({ ...getTableColumns(firewallRuleReviews), reviewerName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from`، `getTableColumns`، `desc`

## POST `/api/network-topology/firewall-rules/:id/reviews`

- المصدر: server/network-topology.ts:354
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { const input = reviewInput.parse(req.body); const result = await db.transaction(async tx => { const [before] = await tx.select().from(firewallRules).where(eq(firewallRules.id, req.params.id)).for("update"); if (!before) throw new NetworkErro`
- جداول مشار إليها مباشرة: `firewall_rule_reviews`، `firewall_rules`
- الاستدعاءات الظاهرة: `route`، `reviewInput.parse`، `db.transaction`، `tx.select().from(firewallRules).where(eq(firewallRules.id, req.params.id)).for`، `tx.select().from(firewallRules).where`، `tx.select().from`، `tx.select`، `eq`، `addDays`، `tx.insert(firewallRuleReviews).values({ firewallRuleId: before.id, reviewerId: user.id, outcome: input.outcome, nextReviewDueAt, notes: input.notes, }).returning`، `tx.insert(firewallRuleReviews).values`، `tx.insert`، `tx.update(firewallRules).set({ lastReviewedAt: review.reviewedAt, nextReviewDueAt, status: input.outcome === "revoked" ? "inactive" : before.status, updatedAt: new Date(), }).where(eq(firewallRules.id, before.id)).returning`، `tx.update(firewallRules).set({ lastReviewedAt: review.reviewedAt, nextReviewDueAt, status: input.outcome === "revoked" ? "inactive" : before.status, updatedAt: new Date(), }).where`، `tx.update(firewallRules).set`، `tx.update`، `writeAudit`، `res.status(201).json`، `res.status`

## GET `/api/network-topology/links`

- المصدر: server/network-topology.ts:243
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(false, async (_req, res) => { res.json(await db.select({ ...getTableColumns(networkDeviceLinks), sourceName: sourceDevices.name, sourceHostname: sourceDevices.hostname, targetName: targetDevices.name, targetHostname: targetDevices.hostname, }).from(network`
- جداول مشار إليها مباشرة: `network_device_links`
- الاستدعاءات الظاهرة: `route`، `res.json`، `db.select({ ...getTableColumns(networkDeviceLinks), sourceName: sourceDevices.name, sourceHostname: sourceDevices.hostname, targetName: targetDevices.name, targetHostname: targetDevices.hostname, }).from(networkDeviceLinks) .innerJoin(sourceDevices, eq(networkDeviceLinks.sourceDeviceId, sourceDevices.id)) .innerJoin(targetDevices, eq(networkDeviceLinks.targetDeviceId, targetDevices.id)) .orderBy`، `db.select({ ...getTableColumns(networkDeviceLinks), sourceName: sourceDevices.name, sourceHostname: sourceDevices.hostname, targetName: targetDevices.name, targetHostname: targetDevices.hostname, }).from(networkDeviceLinks) .innerJoin(sourceDevices, eq(networkDeviceLinks.sourceDeviceId, sourceDevices.id)) .innerJoin`، `db.select({ ...getTableColumns(networkDeviceLinks), sourceName: sourceDevices.name, sourceHostname: sourceDevices.hostname, targetName: targetDevices.name, targetHostname: targetDevices.hostname, }).from(networkDeviceLinks) .innerJoin`، `db.select({ ...getTableColumns(networkDeviceLinks), sourceName: sourceDevices.name, sourceHostname: sourceDevices.hostname, targetName: targetDevices.name, targetHostname: targetDevices.hostname, }).from`، `db.select`، `getTableColumns`، `eq`، `asc`

## POST `/api/network-topology/links`

- المصدر: server/network-topology.ts:255
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { const input = linkInput.parse(req.body); const [source, target] = [input.sourceDeviceId, input.targetDeviceId].sort(); const isReversed = source !== input.sourceDeviceId; const created = await db.transaction(async tx => { const [row] = aw`
- جداول مشار إليها مباشرة: `network_device_links`
- الاستدعاءات الظاهرة: `route`، `linkInput.parse`، `[input.sourceDeviceId, input.targetDeviceId].sort`، `db.transaction`، `tx.insert(networkDeviceLinks).values({ ...input, sourceDeviceId: source, targetDeviceId: target, sourceInterface: isReversed ? input.targetInterface : input.sourceInterface, targetInterface: isReversed ? input.sourceInterface : input.targetInterface, createdById: user.id, }).returning`، `tx.insert(networkDeviceLinks).values`، `tx.insert`، `writeAudit`، `res.status(201).json`، `res.status`

## DELETE `/api/network-topology/links/:id`

- المصدر: server/network-topology.ts:273
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { await db.transaction(async tx => { const [before] = await tx.select().from(networkDeviceLinks).where(eq(networkDeviceLinks.id, req.params.id)).for("update"); if (!before) throw new NetworkError(404, "Topology link not found"); await tx.de`
- جداول مشار إليها مباشرة: `network_device_links`
- الاستدعاءات الظاهرة: `route`، `db.transaction`، `tx.select().from(networkDeviceLinks).where(eq(networkDeviceLinks.id, req.params.id)).for`، `tx.select().from(networkDeviceLinks).where`، `tx.select().from`، `tx.select`، `eq`، `tx.delete(networkDeviceLinks).where`، `tx.delete`، `writeAudit`، `res.json`

## GET `/api/network-topology/options`

- المصدر: server/network-topology.ts:162
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(false, async (_req, res, user) => { const [zones, devices, owners] = await Promise.all([ db.select({ id: networkZones.id, name: networkZones.name, code: networkZones.code }) .from(networkZones).where(eq(networkZones.isActive, true)).orderBy(asc(networkZones.name)), db.s`
- جداول مشار إليها مباشرة: `network_devices`، `network_zones`، `users`
- الاستدعاءات الظاهرة: `route`، `Promise.all`، `db.select({ id: networkZones.id, name: networkZones.name, code: networkZones.code }) .from(networkZones).where(eq(networkZones.isActive, true)).orderBy`، `db.select({ id: networkZones.id, name: networkZones.name, code: networkZones.code }) .from(networkZones).where`، `db.select({ id: networkZones.id, name: networkZones.name, code: networkZones.code }) .from`، `db.select`، `eq`، `asc`، `db.select({ id: networkDevices.id, name: networkDevices.name, deviceType: networkDevices.deviceType, status: networkDevices.status }) .from(networkDevices).where(eq(networkDevices.status, "active")).orderBy`، `db.select({ id: networkDevices.id, name: networkDevices.name, deviceType: networkDevices.deviceType, status: networkDevices.status }) .from(networkDevices).where`، `db.select({ id: networkDevices.id, name: networkDevices.name, deviceType: networkDevices.deviceType, status: networkDevices.status }) .from`، `isManager`، `db.select({ id: users.id, name: sql<string>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(users).where(eq(users.isActive, true)).orderBy`، `db.select({ id: users.id, name: sql<string>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(users).where`، `db.select({ id: users.id, name: sql<string>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from`، `Promise.resolve`، `res.json`

## GET `/api/network-topology/zones`

- المصدر: server/network-topology.ts:178
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(false, async (_req, res) => { res.json(await db.select().from(networkZones).orderBy(asc(networkZones.name))); })`
- جداول مشار إليها مباشرة: `network_zones`
- الاستدعاءات الظاهرة: `route`، `res.json`، `db.select().from(networkZones).orderBy`، `db.select().from`، `db.select`، `asc`

## POST `/api/network-topology/zones`

- المصدر: server/network-topology.ts:181
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { const input = zoneInput.parse(req.body); const [created] = await db.transaction(async tx => { const [row] = await tx.insert(networkZones).values({ ...input, createdById: user.id }).returning(); await writeAudit(tx, req, user.id, "CREATE", "`
- جداول مشار إليها مباشرة: `network_zones`
- الاستدعاءات الظاهرة: `route`، `zoneInput.parse`، `db.transaction`، `tx.insert(networkZones).values({ ...input, createdById: user.id }).returning`، `tx.insert(networkZones).values`، `tx.insert`، `writeAudit`، `res.status(201).json`، `res.status`

## PUT `/api/network-topology/zones/:id`

- المصدر: server/network-topology.ts:190
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `route(true, async (req, res, user) => { const input = zoneInput.parse(req.body); const updated = await db.transaction(async tx => { const [before] = await tx.select().from(networkZones).where(eq(networkZones.id, req.params.id)).for("update"); if (!before) throw new NetworkError(4`
- جداول مشار إليها مباشرة: `network_zones`
- الاستدعاءات الظاهرة: `route`، `zoneInput.parse`، `db.transaction`، `tx.select().from(networkZones).where(eq(networkZones.id, req.params.id)).for`، `tx.select().from(networkZones).where`، `tx.select().from`، `tx.select`، `eq`، `tx.update(networkZones).set({ ...input, updatedAt: new Date() }) .where(eq(networkZones.id, before.id)).returning`، `tx.update(networkZones).set({ ...input, updatedAt: new Date() }) .where`، `tx.update(networkZones).set`، `tx.update`، `writeAudit`، `res.json`

## GET `/api/permissions`

- المصدر: server/routes.ts:979
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('permission_view')` → `inline handler`
- جداول مشار إليها مباشرة: `permissions`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getPermissions`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/problems`

- المصدر: server/routes.ts:9993
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `res.json`، `storage.getProblems`، `res.status(500).json`، `res.status`

## POST `/api/problems`

- المصدر: server/routes.ts:10006
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.createProblem`، `res.status(201).json`، `res.status`، `res.status(500).json`

## DELETE `/api/problems/:id`

- المصدر: server/routes.ts:10022
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.deleteProblem`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## GET `/api/problems/:id`

- المصدر: server/routes.ts:9998
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getProblem`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/problems/:id`

- المصدر: server/routes.ts:10014
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.updateProblem`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## POST `/api/problems/:id/link-incident`

- المصدر: server/routes.ts:10030
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.linkIncidentToProblem`، `res.status(201).json`، `res.status`، `res.status(500).json`

## DELETE `/api/problems/:id/link-incident/:ticketId`

- المصدر: server/routes.ts:10037
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.unlinkIncidentFromProblem`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/projects`

- المصدر: server/project-management.ts:350
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_managers`، `project_team_members`، `projects`، `users`
- الاستدعاءات الظاهرة: `String(req.query.status ?? "").trim`، `String`، `String(req.query.healthStatus ?? "").trim`، `PROJECT_STATUSES.includes`، `conditions.push`، `eq`، `PROJECT_HEALTH_STATUSES.includes`، `String(req.query.managerId ?? "").trim`، `db.select({ projectId: projectManagers.projectId }) .from(projectManagers).where`، `db.select({ projectId: projectManagers.projectId }) .from`، `db.select`، `res.json`، `inArray`، `matches.map`، `String(req.query.teamMemberId ?? "").trim`، `db.select({ projectId: projectTeamMembers.projectId }) .from(projectTeamMembers).where`، `db.select({ projectId: projectTeamMembers.projectId }) .from`، `String(req.query.search ?? "").trim`، `search.replace`، `or`، `ilike`، `db.select().from(projects) .where(conditions.length ? and(...conditions) : undefined) .orderBy`، `db.select().from(projects) .where`، `db.select().from`، `and`، `desc`، `rows.map`، `Promise.all`، `db.select({ projectId: projectManagers.projectId, userId: projectManagers.userId, isPrimary: projectManagers.isPrimary, firstName: users.firstName, lastName: users.lastName, username: users.username, }).from(projectManagers).innerJoin(users, eq(projectManagers.userId, users.id)) .where`، `db.select({ projectId: projectManagers.projectId, userId: projectManagers.userId, isPrimary: projectManagers.isPrimary, firstName: users.firstName, lastName: users.lastName, username: users.username, }).from(projectManagers).innerJoin`، `db.select({ projectId: projectManagers.projectId, userId: projectManagers.userId, isPrimary: projectManagers.isPrimary, firstName: users.firstName, lastName: users.lastName, username: users.username, }).from`، `db.select({ projectId: projectTeamMembers.projectId, teamCount: count(), }).from(projectTeamMembers) .where(inArray(projectTeamMembers.projectId, ids)) .groupBy`، `db.select({ projectId: projectTeamMembers.projectId, teamCount: count(), }).from(projectTeamMembers) .where`، `db.select({ projectId: projectTeamMembers.projectId, teamCount: count(), }).from`، `count`، `managersByProject.set`، `managersByProject.get`، `teamCountRows.map`، `Number`، `teamCountsByProject.get`، `(managersByProject.get(project.id) ?? []).map`، `displayName`، `sendMutationError`

## POST `/api/projects`

- المصدر: server/project-management.ts:505
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `projects`
- الاستدعاءات الظاهرة: `res.status(401).json`، `res.status`، `userCanManageProjects`، `res.status(403).json`، `projectMutationSchema.safeParse`، `res.status(400).json`، `isFeatureEnabled`، `sendFeatureNotEnabled`، `db.transaction`، `validateReferences`، `tx.insert(projects) .values({ ...coreValues(parsed.data, userId), createdBy: userId }) .returning`، `tx.insert(projects) .values`، `tx.insert`، `coreValues`، `replaceAssignments`، `replaceMilestones`، `getProjectDetail`، `writeProjectAudit`، `res.status(201).json`، `sendMutationError`

## DELETE `/api/projects/:id`

- المصدر: server/project-management.ts:608
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `permissions`، `project_managers`، `projects`، `roles`
- الاستدعاءات الظاهرة: `res.status(401).json`، `res.status`، `userCanManageProject`، `res.status(403).json`، `getProjectDetail`، `res.status(404).json`، `Promise.all`، `userCanManageProjects(userId).then`، `userCanManageProjects`، `storage.getUserRoles`، `storage.getUserPermissions`، `isSystemAdministrator`، `db.select({ userId: projectManagers.userId }).from(projectManagers) .where(and( eq(projectManagers.projectId, req.params.id), eq(projectManagers.userId, userId), eq(projectManagers.isPrimary, true), )).limit`، `db.select({ userId: projectManagers.userId }).from(projectManagers) .where`، `db.select({ userId: projectManagers.userId }).from`، `db.select`، `and`، `eq`، `db.delete(projects).where`، `db.delete`، `writeProjectAudit`، `res.json`، `sendMutationError`

## GET `/api/projects/:id`

- المصدر: server/project-management.ts:427
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `getProjectDetail`، `res.status(404).json`، `res.status`، `res.json`، `sendMutationError`

## PUT `/api/projects/:id`

- المصدر: server/project-management.ts:535
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `projects`
- الاستدعاءات الظاهرة: `res.status(401).json`، `res.status`، `projectMutationSchema.safeParse`، `res.status(400).json`، `isFeatureEnabled`، `sendFeatureNotEnabled`، `getProjectDetail`، `res.status(404).json`، `userCanManageProject`، `res.status(403).json`، `db.transaction`، `validateReferences`، `tx.update(projects).set(coreValues(parsed.data)) .where(eq(projects.id, req.params.id)).returning`، `tx.update(projects).set(coreValues(parsed.data)) .where`، `tx.update(projects).set`، `tx.update`، `coreValues`، `eq`، `replaceAssignments`، `replaceMilestones`، `writeProjectAudit`، `res.json`، `sendMutationError`

## GET `/api/projects/:id/baselines`

- المصدر: server/project-management.ts:437
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_baselines`، `projects`، `users`
- الاستدعاءات الظاهرة: `db.select().from(projects).where(eq(projects.id, req.params.id)).limit`، `db.select().from(projects).where`، `db.select().from`، `db.select`، `eq`، `res.status(404).json`، `res.status`، `db.select({ baseline: projectBaselines, approvedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectBaselines).leftJoin(users, eq(projectBaselines.approvedBy, users.id)) .where(eq(projectBaselines.projectId, project.id)) .orderBy`، `db.select({ baseline: projectBaselines, approvedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectBaselines).leftJoin(users, eq(projectBaselines.approvedBy, users.id)) .where`، `db.select({ baseline: projectBaselines, approvedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectBaselines).leftJoin`، `db.select({ baseline: projectBaselines, approvedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from`، `desc`، `rows.map`، `res.json`، `calculateProjectBaselineVariance`، `sendMutationError`

## POST `/api/projects/:id/baselines`

- المصدر: server/project-management.ts:459
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_baselines`، `projects`
- الاستدعاءات الظاهرة: `res.status(401).json`، `res.status`، `userCanManageProject`، `res.status(403).json`، `z.object({ approvalConfirmed: z.literal(true), revisionNote: z.string().trim().max(2000).optional(), }).strict`، `z.object`، `z.literal`، `z.string().trim().max(2000).optional`، `z.string().trim().max`، `z.string().trim`، `z.string`، `bodySchema.safeParse`، `res.status(400).json`، `db.transaction`، `tx.select().from(projects).where(eq(projects.id, req.params.id)).for`، `tx.select().from(projects).where`، `tx.select().from`، `tx.select`، `eq`، `tx.select().from(projectBaselines) .where(eq(projectBaselines.projectId, project.id)) .orderBy(desc(projectBaselines.createdAt), desc(projectBaselines.id)) .limit`، `tx.select().from(projectBaselines) .where(eq(projectBaselines.projectId, project.id)) .orderBy`، `tx.select().from(projectBaselines) .where`، `desc`، `parsed.data.revisionNote?.trim`، `tx.insert(projectBaselines).values({ projectId: project.id, versionNumber: nextProjectBaselineVersion(latest?.versionNumber), baselineBudget: project.budget, baselineStartDate: calendarDate(project.startDate), baselineTargetEndDate: calendarDate(project.targetEndDate), approvedBy: userId, revisionNote: revisionNote \|\| "Initial planning approval", }).returning`، `tx.insert(projectBaselines).values`، `tx.insert`، `nextProjectBaselineVersion`، `calendarDate`، `writeProjectAudit`، `res.status(201).json`، `sendMutationError`

## GET `/api/projects/:id/changes`

- المصدر: server/project-workspace.ts:450
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_changes`، `users`
- الاستدعاءات الظاهرة: `requireProjectView`، `db.select({ ...getTableColumns(projectChanges), requestedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectChanges).leftJoin(users, eq(projectChanges.requestedBy, users.id)) .where(eq(projectChanges.projectId, req.params.id)) .orderBy`، `db.select({ ...getTableColumns(projectChanges), requestedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectChanges).leftJoin(users, eq(projectChanges.requestedBy, users.id)) .where`، `db.select({ ...getTableColumns(projectChanges), requestedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectChanges).leftJoin`، `db.select({ ...getTableColumns(projectChanges), requestedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from`، `db.select`، `getTableColumns`، `eq`، `desc`، `res.json`، `sendError`

## POST `/api/projects/:id/changes`

- المصدر: server/project-workspace.ts:463
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_changes`
- الاستدعاءات الظاهرة: `requireProjectManager`، `projectChangeInputSchema.parse`، `db.transaction`، `tx.insert(projectChanges).values({ projectId: req.params.id, ...input, requestedBy: actorId!, status: "Draft", }).returning`، `tx.insert(projectChanges).values`، `tx.insert`، `writeAudit`، `res.status(201).json`، `res.status`، `sendError`

## DELETE `/api/projects/:id/changes/:changeId`

- المصدر: server/project-workspace.ts:512
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_changes`
- الاستدعاءات الظاهرة: `requireProjectManager`، `db.select().from(projectChanges).where(and( eq(projectChanges.id, req.params.changeId), eq(projectChanges.projectId, req.params.id), )).limit`، `db.select().from(projectChanges).where`، `db.select().from`، `db.select`، `and`، `eq`، `res.status(404).json`، `res.status`، `["Draft", "Rejected"].includes`، `res.status(409).json`، `db.transaction`، `tx.delete(projectChanges).where(and( eq(projectChanges.id, current.id), eq(projectChanges.status, current.status), )).returning`، `tx.delete(projectChanges).where`، `tx.delete`، `writeAudit`، `res.json`، `sendError`

## PATCH `/api/projects/:id/changes/:changeId`

- المصدر: server/project-workspace.ts:482
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_changes`
- الاستدعاءات الظاهرة: `requireProjectManager`، `projectChangeUpdateSchema.parse`، `db.select().from(projectChanges).where(and( eq(projectChanges.id, req.params.changeId), eq(projectChanges.projectId, req.params.id), )).limit`، `db.select().from(projectChanges).where`، `db.select().from`، `db.select`، `and`، `eq`، `res.status(404).json`، `res.status`، `["Draft", "Rejected"].includes`، `res.status(409).json`، `db.transaction`، `tx.update(projectChanges).set(values).where(and( eq(projectChanges.id, current.id), eq(projectChanges.status, current.status), )).returning`، `tx.update(projectChanges).set(values).where`، `tx.update(projectChanges).set`، `tx.update`، `writeAudit`، `res.json`، `sendError`

## POST `/api/projects/:id/changes/:changeId/status`

- المصدر: server/project-workspace.ts:534
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_changes`
- الاستدعاءات الظاهرة: `requireProjectManager`، `projectChangeStatusSchema.parse`، `db.select().from(projectChanges).where(and( eq(projectChanges.id, req.params.changeId), eq(projectChanges.projectId, req.params.id), )).limit`، `db.select().from(projectChanges).where`، `db.select().from`، `db.select`، `and`، `eq`، `res.status(404).json`، `res.status`، `transitions[current.status as keyof typeof transitions]?.includes`، `res.status(409).json`، `db.transaction`، `tx.update(projectChanges).set({ status, updatedAt: new Date() }) .where(and(eq(projectChanges.id, current.id), eq(projectChanges.status, current.status))).returning`، `tx.update(projectChanges).set({ status, updatedAt: new Date() }) .where`، `tx.update(projectChanges).set`، `tx.update`، `writeAudit`، `res.json`، `sendError`

## GET `/api/projects/:id/documents`

- المصدر: server/project-workspace.ts:565
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_documents`، `users`
- الاستدعاءات الظاهرة: `requireProjectView`، `db.select({ document: projectDocuments, uploadedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectDocuments).leftJoin(users, eq(projectDocuments.uploadedBy, users.id)) .where(eq(projectDocuments.projectId, req.params.id)) .orderBy`، `db.select({ document: projectDocuments, uploadedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectDocuments).leftJoin(users, eq(projectDocuments.uploadedBy, users.id)) .where`، `db.select({ document: projectDocuments, uploadedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectDocuments).leftJoin`، `db.select({ document: projectDocuments, uploadedByName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from`، `db.select`، `eq`، `desc`، `res.json`، `rows.map`، `projectDocumentView`، `sendError`

## POST `/api/projects/:id/documents`

- المصدر: server/project-workspace.ts:578
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `requireDocumentFile` → `inline handler`
- جداول مشار إليها مباشرة: `project_documents`
- الاستدعاءات الظاهرة: `requireProjectManager`، `res.status(400).json`، `res.status`، `projectDocumentMetadataSchema.parse`، `safeFileName`، `sendError`، `randomUUID`، `extname(originalName).toLowerCase`، `extname`، `resolve`، `mkdir`، `writeFile`، `db.transaction`، `tx.insert(projectDocuments).values({ id, projectId: req.params.id, name: input.name, version: input.version, fileUrl, category: input.category, uploadedBy: actorId!, filePath: storedPath, originalName, mimeType: file.mimetype \|\| "application/octet-stream", fileSize: file.size, }).returning`، `tx.insert(projectDocuments).values`، `tx.insert`، `writeAudit`، `res.status(201).json`، `projectDocumentView`، `unlink(storedPath).catch`، `unlink`

## DELETE `/api/projects/:id/documents/:documentId`

- المصدر: server/project-workspace.ts:659
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_documents`
- الاستدعاءات الظاهرة: `requireProjectManager`، `db.select().from(projectDocuments).where(and( eq(projectDocuments.id, req.params.documentId), eq(projectDocuments.projectId, req.params.id), )).limit`، `db.select().from(projectDocuments).where`، `db.select().from`، `db.select`، `and`، `eq`، `res.status(404).json`، `res.status`، `db.transaction`، `tx.delete(projectDocuments).where`، `tx.delete`، `writeAudit`، `unlink(current.filePath).catch`، `unlink`، `console.warn`، `res.json`، `sendError`

## PATCH `/api/projects/:id/documents/:documentId`

- المصدر: server/project-workspace.ts:626
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_documents`
- الاستدعاءات الظاهرة: `requireProjectManager`، `projectDocumentUpdateSchema.parse`، `db.transaction`، `tx.select().from(projectDocuments).where(and( eq(projectDocuments.id, req.params.documentId), eq(projectDocuments.projectId, req.params.id), )).limit(1).for`، `tx.select().from(projectDocuments).where(and( eq(projectDocuments.id, req.params.documentId), eq(projectDocuments.projectId, req.params.id), )).limit`، `tx.select().from(projectDocuments).where`، `tx.select().from`، `tx.select`، `and`، `eq`، `tx.update(projectDocuments).set(input).where(eq(projectDocuments.id, current.id)).returning`، `tx.update(projectDocuments).set(input).where`، `tx.update(projectDocuments).set`، `tx.update`، `writeAudit`، `res.json`، `projectDocumentView`، `sendError`

## GET `/api/projects/:id/documents/:documentId/download`

- المصدر: server/project-workspace.ts:646
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_documents`
- الاستدعاءات الظاهرة: `requireProjectView`، `db.select().from(projectDocuments).where(and( eq(projectDocuments.id, req.params.documentId), eq(projectDocuments.projectId, req.params.id), )).limit`، `db.select().from(projectDocuments).where`، `db.select().from`، `db.select`، `and`، `eq`، `res.status(404).json`، `res.status`، `res.download`، `sendError`

## PATCH `/api/projects/:id/milestones/:milestoneId`

- المصدر: server/project-management.ts:567
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_milestones`
- الاستدعاءات الظاهرة: `res.status(401).json`، `res.status`، `projectMilestoneUpdateSchema.safeParse`، `res.status(400).json`، `userCanManageProject`، `res.status(403).json`، `getProjectDetail`، `res.status(404).json`، `current.milestones.find`، `db.update(projectMilestones).set({ status: parsed.data.status, completionDate: projectDate(parsed.data.completionDate), }).where(and( eq(projectMilestones.id, req.params.milestoneId), eq(projectMilestones.projectId, req.params.id), )).returning`، `db.update(projectMilestones).set({ status: parsed.data.status, completionDate: projectDate(parsed.data.completionDate), }).where`، `db.update(projectMilestones).set`، `db.update`، `projectDate`، `and`، `eq`، `writeProjectAudit`، `res.json`، `sendMutationError`

## GET `/api/projects/:id/risks`

- المصدر: server/project-workspace.ts:338
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_risks`، `users`
- الاستدعاءات الظاهرة: `requireProjectView`، `z.object({ status: z.string().trim().max(50).optional(), category: z.string().trim().max(50).optional(), search: z.string().trim().max(160).optional(), }).parse`، `z.object`، `z.string().trim().max(50).optional`، `z.string().trim().max`، `z.string().trim`، `z.string`، `z.string().trim().max(160).optional`، `query.search?.replace`، `db.select({ ...getTableColumns(projectRisks), ownerName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectRisks).leftJoin(users, eq(projectRisks.ownerId, users.id)) .where(and( eq(projectRisks.projectId, req.params.id), query.status && query.status !== "all" ? eq(projectRisks.status, query.status) : undefined, query.category && query.category !== "all" ? eq(projectRisks.category, query.category) : undefined, search ? or(ilike(projectRisks.title, '%${search}%'), ilike(projectRisks.description, '%${search}%'), ilike(projectRisks.mitigationStrategy, '%${search}%')) : undefined, )).orderBy`، `db.select({ ...getTableColumns(projectRisks), ownerName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectRisks).leftJoin(users, eq(projectRisks.ownerId, users.id)) .where`، `db.select({ ...getTableColumns(projectRisks), ownerName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectRisks).leftJoin`، `db.select({ ...getTableColumns(projectRisks), ownerName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from`، `db.select`، `getTableColumns`، `eq`، `and`، `or`، `ilike`، `desc`، `res.json`، `sendError`

## POST `/api/projects/:id/risks`

- المصدر: server/project-workspace.ts:362
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_risks`
- الاستدعاءات الظاهرة: `requireProjectManager`، `projectRiskInputSchema.parse`، `validateActiveUser`، `db.transaction`، `tx.insert(projectRisks).values({ projectId: req.params.id, title: input.title, description: input.description \|\| null, category: input.category, probability: input.probability, impact: input.impact, residualProbability: input.residualProbability ?? null, residualImpact: input.residualImpact ?? null, mitigationStrategy: input.mitigationStrategy \|\| null, contingencyPlan: input.contingencyPlan \|\| null, reviewDate: input.reviewDate \|\| null, status: input.status, ownerId: input.ownerId ?? null, }).returning`، `tx.insert(projectRisks).values`، `tx.insert`، `writeAudit`، `res.status(201).json`، `res.status`، `sendError`

## DELETE `/api/projects/:id/risks/:riskId`

- المصدر: server/project-workspace.ts:434
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_risks`
- الاستدعاءات الظاهرة: `requireProjectManager`، `db.select().from(projectRisks).where(and( eq(projectRisks.id, req.params.riskId), eq(projectRisks.projectId, req.params.id), )).limit`، `db.select().from(projectRisks).where`، `db.select().from`، `db.select`، `and`، `eq`، `res.status(404).json`، `res.status`، `db.transaction`، `tx.delete(projectRisks).where`، `tx.delete`، `writeAudit`، `res.json`، `sendError`

## PATCH `/api/projects/:id/risks/:riskId`

- المصدر: server/project-workspace.ts:391
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_risks`
- الاستدعاءات الظاهرة: `res.status(401).json`، `res.status`، `access`، `res.status(403).json`، `db.select().from(projectRisks).where(and( eq(projectRisks.id, req.params.riskId), eq(projectRisks.projectId, req.params.id), )).limit`، `db.select().from(projectRisks).where`، `db.select().from`، `db.select`، `and`، `eq`، `res.status(404).json`، `canManageProject`، `projectRiskUpdateSchema.parse`، `Object.keys(input).some`، `Object.keys`، `[ "mitigationStrategy", "contingencyPlan", "residualProbability", "residualImpact", "reviewDate", "status", ].includes`، `validateActiveUser`، `db.transaction`، `tx.update(projectRisks).set(values).where(and( eq(projectRisks.id, current.id), eq(projectRisks.projectId, req.params.id), )).returning`، `tx.update(projectRisks).set(values).where`، `tx.update(projectRisks).set`، `tx.update`، `writeAudit`، `res.json`، `sendError`

## GET `/api/projects/:id/tasks`

- المصدر: server/project-workspace.ts:212
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_tasks`، `users`
- الاستدعاءات الظاهرة: `requireProjectView`، `z.object({ status: z.string().trim().max(50).optional(), assigneeId: z.string().trim().max(100).optional(), search: z.string().trim().max(160).optional(), }).parse`، `z.object`، `z.string().trim().max(50).optional`، `z.string().trim().max`، `z.string().trim`، `z.string`، `z.string().trim().max(100).optional`، `z.string().trim().max(160).optional`، `query.search?.replace`، `db.select({ ...getTableColumns(projectTasks), assigneeName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectTasks).leftJoin(users, eq(projectTasks.assigneeId, users.id)) .where(and( eq(projectTasks.projectId, req.params.id), query.status && query.status !== "all" ? eq(projectTasks.status, query.status) : undefined, query.assigneeId ? eq(projectTasks.assigneeId, query.assigneeId) : undefined, search ? or(ilike(projectTasks.title, '%${search}%'), ilike(projectTasks.description, '%${search}%')) : undefined, )).orderBy`، `db.select({ ...getTableColumns(projectTasks), assigneeName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectTasks).leftJoin(users, eq(projectTasks.assigneeId, users.id)) .where`، `db.select({ ...getTableColumns(projectTasks), assigneeName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from(projectTasks).leftJoin`، `db.select({ ...getTableColumns(projectTasks), assigneeName: sql<string \| null>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', }).from`، `db.select`، `getTableColumns`، `eq`، `and`، `or`، `ilike`، `res.json`، `sendError`

## POST `/api/projects/:id/tasks`

- المصدر: server/project-workspace.ts:235
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_tasks`
- الاستدعاءات الظاهرة: `requireProjectManager`، `projectTaskInputSchema.parse`، `validateActiveUser`، `db.transaction`، `tx.insert(projectTasks).values({ projectId: req.params.id, title: input.title, description: input.description \|\| null, status: input.status, priority: input.priority, assigneeId: input.assigneeId ?? null, estimatedHours: input.estimatedHours.toFixed(2), loggedHours: input.loggedHours.toFixed(2), dueDate: toTimestamp(input.dueDate), sortOrder: input.sortOrder, }).returning`، `tx.insert(projectTasks).values`، `tx.insert`، `input.estimatedHours.toFixed`، `input.loggedHours.toFixed`، `toTimestamp`، `writeAudit`، `res.status(201).json`، `res.status`، `sendError`

## DELETE `/api/projects/:id/tasks/:taskId`

- المصدر: server/project-workspace.ts:322
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_tasks`
- الاستدعاءات الظاهرة: `requireProjectManager`، `db.select().from(projectTasks).where(and( eq(projectTasks.id, req.params.taskId), eq(projectTasks.projectId, req.params.id), )).limit`، `db.select().from(projectTasks).where`، `db.select().from`، `db.select`، `and`، `eq`، `res.status(404).json`، `res.status`، `db.transaction`، `tx.delete(projectTasks).where`، `tx.delete`، `writeAudit`، `res.json`، `sendError`

## PATCH `/api/projects/:id/tasks/:taskId`

- المصدر: server/project-workspace.ts:284
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_tasks`
- الاستدعاءات الظاهرة: `res.status(401).json`، `res.status`، `access`، `res.status(403).json`، `db.select().from(projectTasks).where(and( eq(projectTasks.id, req.params.taskId), eq(projectTasks.projectId, req.params.id), )).limit`، `db.select().from(projectTasks).where`، `db.select().from`، `db.select`، `and`، `eq`، `res.status(404).json`، `canManageProject`، `projectTaskUpdateSchema.parse`، `projectTaskWorkUpdateSchema.parse`، `validateActiveUser`، `input.estimatedHours.toFixed`، `input.loggedHours.toFixed`، `toTimestamp`، `db.transaction`، `tx.update(projectTasks).set(values).where(and( eq(projectTasks.id, current.id), eq(projectTasks.projectId, req.params.id), )).returning`، `tx.update(projectTasks).set(values).where`، `tx.update(projectTasks).set`، `tx.update`، `writeAudit`، `res.json`، `sendError`

## PATCH `/api/projects/:id/tasks/reorder`

- المصدر: server/project-workspace.ts:261
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_tasks`
- الاستدعاءات الظاهرة: `requireProjectManager`، `projectTaskReorderSchema.parse`، `db.select({ id: projectTasks.id }).from(projectTasks) .where`، `db.select({ id: projectTasks.id }).from`، `db.select`، `eq`، `current.some`، `taskIds.includes`، `db.transaction`، `tx.update(projectTasks).set({ sortOrder }).where`، `tx.update(projectTasks).set`، `tx.update`، `and`، `writeAudit`، `res.json`، `sendError`

## GET `/api/projects/options`

- المصدر: server/project-management.ts:321
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `users`
- الاستدعاءات الظاهرة: `isFeatureEnabled`، `Promise.all`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, }).from(users).where(eq(users.isActive, true)).orderBy`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, }).from(users).where`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, }).from`، `db.select`، `eq`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, serialNumber: assets.serialNumber, status: assets.status, }).from(assets).orderBy`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, serialNumber: assets.serialNumber, status: assets.status, }).from`، `Promise.resolve`، `res.json`، `people.map`، `displayName`، `sendMutationError`

## GET `/api/purchase-invoices`

- المصدر: server/routes.ts:6855
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_invoice_items`، `purchase_invoice_match_lines`، `purchase_invoice_payments`، `purchase_invoices`، `purchase_returns`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `db.select().from(purchaseInvoices).orderBy`، `db.select().from`، `db.select`، `desc`، `res.json`، `Promise.all`، `rows.map`، `db.select().from(purchaseInvoiceItems).where`، `eq`، `db.select().from(purchaseInvoiceMatchLines).where`، `db.select().from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.invoiceId, invoice.id)).orderBy`، `db.select().from(purchaseInvoicePayments).where`، `db.select({ totalCredit: purchaseReturns.totalCredit }).from(purchaseReturns).where`، `db.select({ totalCredit: purchaseReturns.totalCredit }).from`، `and`، `credits.reduce`، `Number`، `payments.reduce`، `Math.max`، `Math.round`، `console.error`، `res.status(500).json`، `res.status`

## POST `/api/purchase-invoices`

- المصدر: server/routes.ts:6945
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("purchase_order_create")` → `inline handler`
- جداول مشار إليها مباشرة: `audit_logs`، `purchase_invoice_items`، `purchase_invoice_match_lines`، `purchase_invoices`، `purchase_order_item_receipts`، `purchase_order_items`، `purchase_orders`، `vendor_quotations`
- الاستدعاءات الظاهرة: `requirePermission`، `z.string().uuid().safeParse`، `z.string().uuid`، `z.string`، `res.status(400).json`، `res.status`، `db.select().from(purchaseOrders).where`، `db.select().from`، `db.select`، `eq`، `res.status(404).json`، `insertPurchaseInvoiceSchema.safeParse`، `res.status(409).json`، `db.select({ currency: vendorQuotations.currency }).from(vendorQuotations).where`، `db.select({ currency: vendorQuotations.currency }).from`، `db.select().from(purchaseOrderItems).where`، `and`، `Number`، `Math.abs`، `db.select({ quantity: purchaseInvoiceItems.quantity, status: purchaseInvoices.status }) .from(purchaseInvoiceItems).innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.invoiceId, purchaseInvoices.id)) .where`، `db.select({ quantity: purchaseInvoiceItems.quantity, status: purchaseInvoices.status }) .from(purchaseInvoiceItems).innerJoin`، `db.select({ quantity: purchaseInvoiceItems.quantity, status: purchaseInvoices.status }) .from`، `db.select({ quantity: purchaseInvoiceMatchLines.quantity, status: purchaseInvoices.status }) .from(purchaseInvoiceMatchLines).innerJoin(purchaseInvoices, eq(purchaseInvoiceMatchLines.invoiceId, purchaseInvoices.id)) .where`، `db.select({ quantity: purchaseInvoiceMatchLines.quantity, status: purchaseInvoices.status }) .from(purchaseInvoiceMatchLines).innerJoin`، `db.select({ quantity: purchaseInvoiceMatchLines.quantity, status: purchaseInvoices.status }) .from`، `[...previousReceived, ...previousStaged].filter(row => row.status !== "void").reduce`، `[...previousReceived, ...previousStaged].filter`، `requestedInvoiceQuantities.get`، `requestedInvoiceQuantities.set`، `pricingLines.push`، `matchedLines.push`، `invoiceUnitPrice.toFixed`، `discountValue.toFixed`، `taxRate.toFixed`، `calculateDocumentTotals`، `matchedLines.map`، `totals.lines[index].discountAmount.toFixed`، `totals.lines[index].totalAmount.toFixed`، `db.transaction`، `reserveFinancialDocumentNumber`، `tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, po.id)).for`، `tx.select().from(purchaseOrders).where`، `tx.select().from`، `tx.select`، `["ordered", "received"].includes`، `Object.assign`، `Array.from`، `requestedInvoiceQuantities.entries`، `tx.select().from(purchaseOrderItems).where`، `tx.select({ quantity: purchaseInvoiceItems.quantity }).from(purchaseInvoiceItems) .innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.invoiceId, purchaseInvoices.id)) .where`، `tx.select({ quantity: purchaseInvoiceItems.quantity }).from(purchaseInvoiceItems) .innerJoin`، `tx.select({ quantity: purchaseInvoiceItems.quantity }).from`، `tx.select({ quantity: purchaseInvoiceMatchLines.quantity }).from(purchaseInvoiceMatchLines) .innerJoin(purchaseInvoices, eq(purchaseInvoiceMatchLines.invoiceId, purchaseInvoices.id)) .where`، `tx.select({ quantity: purchaseInvoiceMatchLines.quantity }).from(purchaseInvoiceMatchLines) .innerJoin`، `tx.select({ quantity: purchaseInvoiceMatchLines.quantity }).from`، `[...priorReceived, ...priorStaged].reduce`، `tx.insert(purchaseInvoices).values({ ...invoiceInput, invoiceNumber, status: "pending", paymentStatus: "pending", documentDiscountValue: Number(invoiceInput.documentDiscountValue ?? 0).toFixed(2), subtotal: totals.subtotal.toFixed(2), taxAmount: totals.taxAmount.toFixed(2), grandTotal: totals.grandTotal.toFixed(2), documentDiscountAmount: totals.documentDiscountAmount.toFixed(2), createdBy: req.user!.id, }).returning`، `tx.insert(purchaseInvoices).values`، `tx.insert`، `Number(invoiceInput.documentDiscountValue ?? 0).toFixed`، `totals.subtotal.toFixed`، `totals.taxAmount.toFixed`، `totals.grandTotal.toFixed`، `totals.documentDiscountAmount.toFixed`، `tx.insert(purchaseInvoiceMatchLines).values`، `normalizedLines.map`، `tx.select({ invoiceId: purchaseInvoiceMatchLines.invoiceId, purchaseOrderItemId: purchaseInvoiceMatchLines.purchaseOrderItemId, description: purchaseInvoiceMatchLines.description, quantity: purchaseInvoiceMatchLines.quantity, unitPrice: purchaseInvoiceMatchLines.unitPrice, discountType: purchaseInvoiceMatchLines.discountType, discountValue: purchaseInvoiceMatchLines.discountValue, discountAmount: purchaseInvoiceMatchLines.discountAmount, taxRate: purchaseInvoiceMatchLines.taxRate, taxInclusive: purchaseInvoiceMatchLines.taxInclusive, totalPrice: purchaseInvoiceMatchLines.totalPrice, }).from(purchaseInvoiceMatchLines) .innerJoin(purchaseInvoices, eq(purchaseInvoiceMatchLines.invoiceId, purchaseInvoices.id)) .where`، `tx.select({ invoiceId: purchaseInvoiceMatchLines.invoiceId, purchaseOrderItemId: purchaseInvoiceMatchLines.purchaseOrderItemId, description: purchaseInvoiceMatchLines.description, quantity: purchaseInvoiceMatchLines.quantity, unitPrice: purchaseInvoiceMatchLines.unitPrice, discountType: purchaseInvoiceMatchLines.discountType, discountValue: purchaseInvoiceMatchLines.discountValue, discountAmount: purchaseInvoiceMatchLines.discountAmount, taxRate: purchaseInvoiceMatchLines.taxRate, taxInclusive: purchaseInvoiceMatchLines.taxInclusive, totalPrice: purchaseInvoiceMatchLines.totalPrice, }).from(purchaseInvoiceMatchLines) .innerJoin`، `tx.select({ invoiceId: purchaseInvoiceMatchLines.invoiceId, purchaseOrderItemId: purchaseInvoiceMatchLines.purchaseOrderItemId, description: purchaseInvoiceMatchLines.description, quantity: purchaseInvoiceMatchLines.quantity, unitPrice: purchaseInvoiceMatchLines.unitPrice, discountType: purchaseInvoiceMatchLines.discountType, discountValue: purchaseInvoiceMatchLines.discountValue, discountAmount: purchaseInvoiceMatchLines.discountAmount, taxRate: purchaseInvoiceMatchLines.taxRate, taxInclusive: purchaseInvoiceMatchLines.taxInclusive, totalPrice: purchaseInvoiceMatchLines.totalPrice, }).from`، `tx.select({ purchaseOrderItemId: purchaseInvoiceItems.purchaseOrderItemId, quantity: purchaseInvoiceItems.quantity, }).from(purchaseInvoiceItems) .innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.invoiceId, purchaseInvoices.id)) .where`، `tx.select({ purchaseOrderItemId: purchaseInvoiceItems.purchaseOrderItemId, quantity: purchaseInvoiceItems.quantity, }).from(purchaseInvoiceItems) .innerJoin`، `tx.select({ purchaseOrderItemId: purchaseInvoiceItems.purchaseOrderItemId, quantity: purchaseInvoiceItems.quantity, }).from`، `matchedQuantities.set`، `matchedQuantities.get`، `orderedLines.every`، `tx.update(purchaseOrders).set({ status: "received", actualDelivery: toDateInputValue(new Date()), }).where`، `tx.update(purchaseOrders).set`، `tx.update`، `toDateInputValue`، `tx.insert(auditLogs).values`، `JSON.stringify`، `req.get("user-agent")?.slice`، `req.get`، `receivePurchaseOrderInventory`، `tx.select({ id: purchaseOrderItemReceipts.id, purchaseOrderItemId: purchaseOrderItemReceipts.purchaseOrderItemId, }).from(purchaseOrderItemReceipts).where`، `tx.select({ id: purchaseOrderItemReceipts.id, purchaseOrderItemId: purchaseOrderItemReceipts.purchaseOrderItemId, }).from`، `receiptRows.map`، `matched.map`، `receiptIds.get`، `tx.insert(purchaseInvoiceItems).values`، `tx.delete(purchaseInvoiceMatchLines).where`، `tx.delete`، `inArray`، `tx.update(purchaseInvoices).set({ receivedAt: new Date(), updatedAt: new Date() }) .where`، `tx.update(purchaseInvoices).set`، `tx.select().from(purchaseInvoices).where`، `Boolean`، `logAudit`، `res.status(201).json`، `res.status((error as any).status).json`، `console.error`، `res.status(500).json`

## POST `/api/purchase-invoices/:id/payments`

- المصدر: server/routes.ts:7190
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("purchase_order_update")` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_invoice_payments`، `purchase_invoices`، `purchase_returns`
- الاستدعاءات الظاهرة: `requirePermission`، `insertPurchaseInvoicePaymentSchema.safeParse`، `res.status(400).json`، `res.status`، `db.transaction`، `tx.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, req.params.id)).for`، `tx.select().from(purchaseInvoices).where`، `tx.select().from`، `tx.select`، `eq`، `Object.assign`، `tx.select({ amount: purchaseInvoicePayments.amount }).from(purchaseInvoicePayments).where`، `tx.select({ amount: purchaseInvoicePayments.amount }).from`، `existing.reduce`، `Number`، `tx.select({ totalCredit: purchaseReturns.totalCredit }).from(purchaseReturns).where`، `tx.select({ totalCredit: purchaseReturns.totalCredit }).from`، `and`، `credits.reduce`، `Math.round`، `tx.insert(purchaseInvoicePayments).values({ invoiceId: invoice.id, paymentDate: parsed.data.paymentDate, amount: amount.toFixed(2), paymentMethod: parsed.data.paymentMethod, referenceNumber: parsed.data.referenceNumber ?? null, notes: parsed.data.notes ?? null, recordedBy: req.user!.id, }).returning`، `tx.insert(purchaseInvoicePayments).values`، `tx.insert`، `amount.toFixed`، `tx.update(purchaseInvoices).set({ paymentStatus: Math.round((totalPaid + credited) * 100) >= Math.round(Number(invoice.grandTotal) * 100) ? "paid" : "partially_paid", updatedAt: new Date(), }).where`، `tx.update(purchaseInvoices).set`، `tx.update`، `logAudit`، `res.status(201).json`، `res.status(status).json`، `console.error`، `res.status(500).json`

## PUT `/api/purchase-invoices/:id/status`

- المصدر: server/routes.ts:7153
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("purchase_order_update")` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_invoice_items`، `purchase_invoice_payments`، `purchase_invoices`، `purchase_returns`
- الاستدعاءات الظاهرة: `requirePermission`، `z.enum(["pending", "approved", "received", "void"]).parse`، `z.enum`، `db.transaction`، `tx.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, req.params.id)).for`، `tx.select().from(purchaseInvoices).where`، `tx.select().from`، `tx.select`، `eq`، `Object.assign`، `conflict`، `tx.select({ id: purchaseInvoicePayments.id }).from(purchaseInvoicePayments).where`، `tx.select({ id: purchaseInvoicePayments.id }).from`، `tx.select({ id: purchaseReturns.id }).from(purchaseReturns).where`، `tx.select({ id: purchaseReturns.id }).from`، `tx.select({ id: purchaseInvoiceItems.id }).from(purchaseInvoiceItems).where`، `tx.select({ id: purchaseInvoiceItems.id }).from`، `tx.update(purchaseInvoices).set({ status, approvedAt: status === "approved" \|\| status === "received" ? invoice.approvedAt ?? new Date() : invoice.approvedAt, receivedAt: status === "received" ? invoice.receivedAt ?? new Date() : invoice.receivedAt, updatedAt: new Date(), }).where(eq(purchaseInvoices.id, invoice.id)).returning`، `tx.update(purchaseInvoices).set({ status, approvedAt: status === "approved" \|\| status === "received" ? invoice.approvedAt ?? new Date() : invoice.approvedAt, receivedAt: status === "received" ? invoice.receivedAt ?? new Date() : invoice.receivedAt, updatedAt: new Date(), }).where`، `tx.update(purchaseInvoices).set`، `tx.update`، `logAudit`، `res.json`، `res.status(status).json`، `res.status`، `res.status(400).json`، `console.error`، `res.status(500).json`

## GET `/api/purchase-orders`

- المصدر: server/routes.ts:5939
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "budget_create", "budget_update", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_orders`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `storage.getPurchaseOrdersWithDetails`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/purchase-orders`

- المصدر: server/routes.ts:5948
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('purchase_order_create')` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_order_items`، `purchase_orders`، `vendor_quotation_items`، `vendor_quotations`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requirePermission`، `z.object`، `z.string().trim().min`، `z.string().trim`، `z.string`، `z.string().nullable().optional`، `z.string().nullable`، `z.enum(["asset", "consumable"]).default`، `z.enum`، `z.union([z.string().uuid(), z.literal("")]).nullable().optional`، `z.union([z.string().uuid(), z.literal("")]).nullable`، `z.union`، `z.string().uuid`، `z.literal`، `z.string().trim().max(100).nullable().optional`، `z.string().trim().max(100).nullable`، `z.string().trim().max`، `z.string().trim().max(160).nullable().optional`، `z.string().trim().max(160).nullable`، `z.coerce.number().int().min(1).max`، `z.coerce.number().int().min`، `z.coerce.number().int`، `z.coerce.number`، `z.coerce.number().min`، `z.enum(["fixed", "percentage"]).default`، `z.coerce.number().min(0).default`، `z.coerce.number().min(0).max(100).optional`، `z.coerce.number().min(0).max`، `z.boolean().optional`، `z.boolean`، `z.array(lineSchema).min(1).max(500).parse`، `z.array(lineSchema).min(1).max`، `z.array(lineSchema).min`، `z.array`، `itemInputs.some`، `res.status(400).json`، `res.status`، `Array.from`، `itemInputs.filter(item => item.itemType === "consumable").map(item => item.warehouseLocationId!).filter`، `itemInputs.filter(item => item.itemType === "consumable").map`، `itemInputs.filter`، `db.select({ id: warehouseLocations.id }).from(warehouseLocations) .where`، `db.select({ id: warehouseLocations.id }).from`، `db.select`، `and`، `inArray`، `eq`، `getDefaultFinancialProfile`، `insertPurchaseOrderSchema.extend({ poNumber: z.string().trim().min(1).max(100).optional(), currency: z.string().regex(/^[A-Z]{3}$/).default("USD"), taxMode: z.enum(["exclusive", "inclusive"]).default("exclusive"), taxRate: z.coerce.number().min(0).max(100).default(0), documentDiscountType: z.enum(["fixed", "percentage"]).default("fixed"), documentDiscountValue: z.coerce.number().min(0).default(0), }).parse`، `insertPurchaseOrderSchema.extend`، `z.string().trim().min(1).max(100).optional`، `z.string().trim().min(1).max`، `z.string().regex(/^[A-Z]{3}$/).default`، `z.string().regex`، `z.enum(["exclusive", "inclusive"]).default`، `z.coerce.number().min(0).max(100).default`، `res.status(409).json`، `calculateDocumentTotals`، `itemInputs.map`، `Math.abs`، `Number`، `db.transaction`، `reserveFinancialDocumentNumber`، `tx.select().from(vendorQuotations).where(eq(vendorQuotations.id, validatedData.quotationId)).for`، `tx.select().from(vendorQuotations).where`، `tx.select().from`، `tx.select`، `Object.assign`، `tx.select({ id: purchaseOrders.id }).from(purchaseOrders).where`، `tx.select({ id: purchaseOrders.id }).from`، `tx.select().from(vendorQuotationItems).where`، `Math.round`، `quoteItems.every`، `moneyEquals`، `Boolean`، `tx.insert(purchaseOrders).values({ ...validatedData, reference: sourceQuoteNumber ? 'Quotation ${sourceQuoteNumber}' : validatedData.reference, poNumber, status: "pending", expectedDelivery: validatedData.expectedDelivery \|\| null, actualDelivery: null, departmentId: validatedData.departmentId \|\| null, subtotal: totals.subtotal.toFixed(2), taxRate: Number(validatedData.taxRate).toFixed(4), documentDiscountValue: Number(validatedData.documentDiscountValue).toFixed(2), documentDiscountAmount: totals.documentDiscountAmount.toFixed(2), taxAmount: totals.taxAmount.toFixed(2), totalAmount: totals.grandTotal.toFixed(2), assetsCreated: false, }).returning`، `tx.insert(purchaseOrders).values`، `tx.insert`، `totals.subtotal.toFixed`، `Number(validatedData.taxRate).toFixed`، `Number(validatedData.documentDiscountValue).toFixed`، `totals.documentDiscountAmount.toFixed`، `totals.taxAmount.toFixed`، `totals.grandTotal.toFixed`، `tx.insert(purchaseOrderItems).values`، `item.unitPrice.toString`، `item.discountValue.toFixed`، `totals.lines[index].discountAmount.toFixed`، `Number(item.taxRate ?? validatedData.taxRate).toFixed`، `totals.lines[index].totalAmount.toFixed`، `tx.update(vendorQuotations).set({ status: "converted", updatedAt: new Date() }).where`، `tx.update(vendorQuotations).set`، `tx.update`، `logAudit`، `new Date().getFullYear`، `storage.getBudgetsByDepartment`، `deptBudgets.find`، `storage.getPurchaseOrdersWithDetails`، `allPOs .filter(p => p.departmentId === purchaseOrder.departmentId && p.status !== 'cancelled') .reduce`، `allPOs .filter`، `parseFloat`، `storage.updateBudget`، `deptPOTotal.toFixed`، `res.status(201).json`، `res.status((error as any).status).json`، `console.error`، `res.status(500).json`

## DELETE `/api/purchase-orders/:id`

- المصدر: server/routes.ts:6267
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('purchase_order_delete')` → `inline handler`
- جداول مشار إليها مباشرة: `permissions`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getPurchaseOrder`، `res.status(404).json`، `res.status`، `storage.getUserPermissions`، `permissions.includes`، `res.status(403).json`، `res.status(400).json`، `storage.getAssetsByPurchaseOrderNumber`، `storage.updateAsset`، `logAudit`، `storage.getPurchaseOrderItems`، `storage.deletePurchaseOrderItem`، `storage.deletePurchaseOrder`، `res.status(204).send`، `res.status(500).json`

## PUT `/api/purchase-orders/:id`

- المصدر: server/routes.ts:6107
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('purchase_order_update')` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_invoices`، `purchase_order_items`، `purchase_orders`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requirePermission`، `z.array(z.object({ description: z.string().trim().min(1), assetType: z.string().nullable().optional(), itemType: z.enum(["asset", "consumable"]).default("asset"), consumableId: z.union([z.string().uuid(), z.literal("")]).nullable().optional(), consumableCategory: z.string().trim().max(100).nullable().optional(), modelPartNumber: z.string().trim().max(160).nullable().optional(), warehouseLocationId: z.union([z.string().uuid(), z.literal("")]).nullable().optional(), serialNumber: z.string().nullable().optional(), quantity: z.coerce.number().int().min(1).max(100000), unitPrice: z.coerce.number().min(0), discountType: z.enum(["fixed", "percentage"]).default("fixed"), discountValue: z.coerce.number().min(0).default(0), taxRate: z.coerce.number().min(0).max(100).optional(), taxInclusive: z.boolean().optional(), assetId: z.union([z.string().uuid(), z.literal("")]).nullable().optional(), })).parse`، `z.array`، `z.object`، `z.string().trim().min`، `z.string().trim`، `z.string`، `z.string().nullable().optional`، `z.string().nullable`، `z.enum(["asset", "consumable"]).default`، `z.enum`، `z.union([z.string().uuid(), z.literal("")]).nullable().optional`، `z.union([z.string().uuid(), z.literal("")]).nullable`، `z.union`، `z.string().uuid`، `z.literal`، `z.string().trim().max(100).nullable().optional`، `z.string().trim().max(100).nullable`، `z.string().trim().max`، `z.string().trim().max(160).nullable().optional`، `z.string().trim().max(160).nullable`، `z.coerce.number().int().min(1).max`، `z.coerce.number().int().min`، `z.coerce.number().int`، `z.coerce.number`، `z.coerce.number().min`، `z.enum(["fixed", "percentage"]).default`، `z.coerce.number().min(0).default`، `z.coerce.number().min(0).max(100).optional`، `z.coerce.number().min(0).max`، `z.boolean().optional`، `z.boolean`، `itemInputs?.some`، `res.status(400).json`، `res.status`، `Array.from`، `(itemInputs ?? []).filter(item => item.itemType === "consumable").map(item => item.warehouseLocationId!).filter`، `(itemInputs ?? []).filter(item => item.itemType === "consumable").map`، `(itemInputs ?? []).filter`، `db.select({ id: warehouseLocations.id }).from(warehouseLocations) .where`، `db.select({ id: warehouseLocations.id }).from`، `db.select`، `and`، `inArray`، `eq`، `insertPurchaseOrderSchema.partial().extend({ currency: z.string().regex(/^[A-Z]{3}$/).optional(), taxMode: z.enum(["exclusive", "inclusive"]).optional(), taxRate: z.coerce.number().min(0).max(100).optional(), documentDiscountType: z.enum(["fixed", "percentage"]).optional(), documentDiscountValue: z.coerce.number().min(0).optional(), }).parse`، `insertPurchaseOrderSchema.partial().extend`، `insertPurchaseOrderSchema.partial`، `z.string().regex(/^[A-Z]{3}$/).optional`، `z.string().regex`، `z.enum(["exclusive", "inclusive"]).optional`، `z.enum(["fixed", "percentage"]).optional`، `z.coerce.number().min(0).optional`، `storage.getPurchaseOrder`، `res.status(404).json`، `Object.keys(purchaseOrderData).some`، `Object.keys`، `res.status(409).json`، `["totalAmount", "taxRate", "taxMode", "documentDiscountType", "documentDiscountValue", "taxAmount", "subtotal"].some`، `canTransitionPurchaseOrder`، `calculateDocumentTotals`، `itemInputs.map`، `Number`، `Math.abs`، `updatedTotals.subtotal.toFixed`، `updatedTotals.taxAmount.toFixed`، `updatedTotals.grandTotal.toFixed`، `updatedTotals.documentDiscountAmount.toFixed`، `updatedTaxRate.toFixed`، `updatedDiscountValue.toFixed`، `db.transaction`، `tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, req.params.id)).for`، `tx.select().from(purchaseOrders).where`، `tx.select().from`، `tx.select`، `Object.assign`، `tx.select({ id: purchaseInvoices.id }).from(purchaseInvoices).where`، `tx.select({ id: purchaseInvoices.id }).from`، `tx.update(purchaseOrders).set(updatePayload).where(eq(purchaseOrders.id, req.params.id)).returning`، `tx.update(purchaseOrders).set(updatePayload).where`، `tx.update(purchaseOrders).set`، `tx.update`، `tx.delete(purchaseOrderItems).where`، `tx.delete`، `tx.insert(purchaseOrderItems).values`، `tx.insert`، `item.unitPrice.toString`، `item.discountValue.toFixed`، `updatedTotals!.lines[index].discountAmount.toFixed`، `Number(item.taxRate ?? validatedData.taxRate ?? oldPO.taxRate).toFixed`، `updatedTotals!.lines[index].totalAmount.toFixed`، `logAudit`، `[purchaseOrder.departmentId, oldPO?.departmentId].filter`، `new Date().getFullYear`، `storage.getBudgetsByDepartment`، `deptBudgets.find`، `storage.getPurchaseOrdersWithDetails`، `allPOs .filter(p => p.departmentId === deptId && p.status !== 'cancelled') .reduce`، `allPOs .filter`، `parseFloat`، `storage.updateBudget`، `deptPOTotal.toFixed`، `res.json`، `res.status((error as any).status).json`، `res.status(500).json`

## POST `/api/purchase-orders/:id/create-assets`

- المصدر: server/routes.ts:6323
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `consumable_stock_movements`، `consumables`، `purchase_order_item_receipts`، `purchase_order_items`، `purchase_orders`، `vendors`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getPurchaseOrder`، `res.status(404).json`، `res.status`، `res.status(400).json`، `res.status(409).json`، `storage.getPurchaseOrderItems`، `items.some`، `storage.getVendors`، `vendors.find`، `(await db.select({ id: purchaseOrderItemReceipts.purchaseOrderItemId }) .from(purchaseOrderItemReceipts).where(eq(purchaseOrderItemReceipts.purchaseOrderId, po.id))).map`، `db.select({ id: purchaseOrderItemReceipts.purchaseOrderItemId }) .from(purchaseOrderItemReceipts).where`، `db.select({ id: purchaseOrderItemReceipts.purchaseOrderItemId }) .from`، `db.select`، `eq`، `items.filter`، `unprocessedIds.has`، `tags.push`، `String(await storage.getNextAssetIdNumber()).padStart`، `String`، `storage.getNextAssetIdNumber`، `allocatedTags.set`، `db.transaction`، `tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, po.id)).for`، `tx.select().from(purchaseOrders).where`، `tx.select().from`، `tx.select`، `Object.assign`، `tx.select({ id: purchaseOrderItemReceipts.id }).from(purchaseOrderItemReceipts) .where`، `tx.select({ id: purchaseOrderItemReceipts.id }).from`، `tx.select({ id: warehouseLocations.id, storageRoom: warehouseLocations.storageRoom }) .from(warehouseLocations).where(and(eq(warehouseLocations.id, locationId), eq(warehouseLocations.isActive, true))).for`، `tx.select({ id: warehouseLocations.id, storageRoom: warehouseLocations.storageRoom }) .from(warehouseLocations).where`، `tx.select({ id: warehouseLocations.id, storageRoom: warehouseLocations.storageRoom }) .from`، `and`، `tx.select().from(consumables).where(and( eq(consumables.id, item.consumableId), eq(consumables.warehouseLocationId, locationId), )).for`، `tx.select().from(consumables).where`، `tx.select().from(consumables).where(eq(consumables.warehouseLocationId, locationId)).for`، `candidates.find`، `candidate.name.toLocaleLowerCase`، `item.description.toLocaleLowerCase`، `(candidate.modelPartNumber ?? "").toLocaleLowerCase`، `(item.modelPartNumber ?? "").toLocaleLowerCase`، `tx.update(consumables).set({ quantityInStock: target.quantityInStock + quantity, unitCost: item.unitPrice, vendorId: lockedPO.vendorId, updatedAt: new Date(), }).where`، `tx.update(consumables).set`، `tx.update`، `tx.insert(consumables).values({ name: item.description, category: item.consumableCategory \|\| "Other", modelPartNumber: item.modelPartNumber \|\| null, quantityInStock: quantity, minReorderLevel: 0, warehouseLocationId: locationId, storageRoom: location.storageRoom, unitCost: item.unitPrice, vendorId: lockedPO.vendorId, }).returning`، `tx.insert(consumables).values`، `tx.insert`، `tx.insert(consumableStockMovements).values`، `tx.update(purchaseOrderItems).set({ consumableId: target.id }).where`، `tx.update(purchaseOrderItems).set`، `allocatedTags.get`، `tx.insert(assets).values({ name: quantity > 1 ? '${item.description} #${unit + 1}' : item.description, assetTag: tags[unit], type: item.assetType \|\| "other", status: "available", vendor: vendorName, serialNumber: quantity === 1 ? item.serialNumber : null, purchasePrice: item.unitPrice, purchaseDate: lockedPO.orderDate, purchaseOrderNumber: lockedPO.poNumber, departmentId: lockedPO.departmentId, primaryVendorId: lockedPO.vendorId, }).returning`، `tx.insert(assets).values`، `createdAssets.push`، `tx.insert(purchaseOrderItemReceipts).values`، `tx.update(purchaseOrders).set({ assetsCreated: true }).where`، `tx.update(purchaseOrders).set`، `logAudit`، `res.json`، `res.status(status).json`، `console.error`، `res.status(500).json`

## GET `/api/purchase-orders/:id/match-lines`

- المصدر: server/routes.ts:6895
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_order_items`، `purchase_orders`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `db.select({ id: purchaseOrders.id, status: purchaseOrders.status }).from(purchaseOrders).where`، `db.select({ id: purchaseOrders.id, status: purchaseOrders.status }).from`، `db.select`، `eq`، `res.status(404).json`، `res.status`، `res.status(409).json`، `db.select({ purchaseOrderItemId: purchaseOrderItems.id, description: purchaseOrderItems.description, itemType: purchaseOrderItems.itemType, quantity: purchaseOrderItems.quantity, unitPrice: purchaseOrderItems.unitPrice, discountType: purchaseOrderItems.discountType, discountValue: purchaseOrderItems.discountValue, discountAmount: purchaseOrderItems.discountAmount, taxRate: purchaseOrderItems.taxRate, taxInclusive: purchaseOrderItems.taxInclusive, totalPrice: purchaseOrderItems.totalPrice, }).from(purchaseOrderItems).where`، `db.select({ purchaseOrderItemId: purchaseOrderItems.id, description: purchaseOrderItems.description, itemType: purchaseOrderItems.itemType, quantity: purchaseOrderItems.quantity, unitPrice: purchaseOrderItems.unitPrice, discountType: purchaseOrderItems.discountType, discountValue: purchaseOrderItems.discountValue, discountAmount: purchaseOrderItems.discountAmount, taxRate: purchaseOrderItems.taxRate, taxInclusive: purchaseOrderItems.taxInclusive, totalPrice: purchaseOrderItems.totalPrice, }).from`، `res.json`، `res.status(500).json`

## GET `/api/purchase-orders/:id/receipts`

- المصدر: server/routes.ts:6875
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_order_item_receipts`، `purchase_order_items`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `db.select({ receiptId: purchaseOrderItemReceipts.id, purchaseOrderItemId: purchaseOrderItems.id, description: purchaseOrderItems.description, itemType: purchaseOrderItems.itemType, quantity: purchaseOrderItems.quantity, unitPrice: purchaseOrderItems.unitPrice, consumableId: purchaseOrderItems.consumableId, warehouseLocationId: purchaseOrderItems.warehouseLocationId, }).from(purchaseOrderItemReceipts) .innerJoin(purchaseOrderItems, eq(purchaseOrderItemReceipts.purchaseOrderItemId, purchaseOrderItems.id)) .where`، `db.select({ receiptId: purchaseOrderItemReceipts.id, purchaseOrderItemId: purchaseOrderItems.id, description: purchaseOrderItems.description, itemType: purchaseOrderItems.itemType, quantity: purchaseOrderItems.quantity, unitPrice: purchaseOrderItems.unitPrice, consumableId: purchaseOrderItems.consumableId, warehouseLocationId: purchaseOrderItems.warehouseLocationId, }).from(purchaseOrderItemReceipts) .innerJoin`، `db.select({ receiptId: purchaseOrderItemReceipts.id, purchaseOrderItemId: purchaseOrderItems.id, description: purchaseOrderItems.description, itemType: purchaseOrderItems.itemType, quantity: purchaseOrderItems.quantity, unitPrice: purchaseOrderItems.unitPrice, consumableId: purchaseOrderItems.consumableId, warehouseLocationId: purchaseOrderItems.warehouseLocationId, }).from`، `db.select`، `eq`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/purchase-orders/:id/returnable-assets`

- المصدر: server/routes.ts:6919
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("finance_view", "purchase_order_update", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `purchase_order_items`، `purchase_orders`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `db.select({ poNumber: purchaseOrders.poNumber }).from(purchaseOrders).where`، `db.select({ poNumber: purchaseOrders.poNumber }).from`، `db.select`، `eq`، `res.status(404).json`، `res.status`، `db.select({ description: purchaseOrderItems.description }).from(purchaseOrderItems) .where`، `db.select({ description: purchaseOrderItems.description }).from`، `and`، `res.status(400).json`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, status: assets.status, purchaseOrderNumber: assets.purchaseOrderNumber, }).from(assets).where`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, status: assets.status, purchaseOrderNumber: assets.purchaseOrderNumber, }).from`، `inArray`، `or`، `ilike`، `res.json`، `res.status(500).json`

## GET `/api/purchase-returns`

- المصدر: server/routes.ts:7231
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_return_items`، `purchase_returns`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `db.select().from(purchaseReturns).orderBy`، `db.select().from`، `db.select`، `desc`، `res.json`، `Promise.all`، `rows.map`، `db.select().from(purchaseReturnItems).where`، `eq`، `res.status(500).json`، `res.status`

## POST `/api/purchase-returns`

- المصدر: server/routes.ts:7243
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("purchase_order_update")` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `consumable_stock_movements`، `consumables`، `purchase_invoice_payments`، `purchase_invoices`، `purchase_order_item_receipts`، `purchase_order_items`، `purchase_orders`، `purchase_return_items`، `purchase_returns`، `vendor_quotations`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requirePermission`، `insertPurchaseReturnSchema.safeParse`، `res.status(400).json`، `res.status`، `db.select().from(purchaseOrders).where`، `db.select().from`، `db.select`، `eq`، `res.status(404).json`، `db.select().from(purchaseInvoices).where`، `Date.now`، `randomUUID().slice`، `randomUUID`، `db.transaction`، `tx.select().from(purchaseInvoices) .where(eq(purchaseInvoices.id, returnInput.purchaseInvoiceId)).for`، `tx.select().from(purchaseInvoices) .where`، `tx.select().from`، `tx.select`، `Object.assign`، `tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, po.id)).for`، `tx.select().from(purchaseOrders).where`، `tx.select({ currency: vendorQuotations.currency }).from(vendorQuotations).where`، `tx.select({ currency: vendorQuotations.currency }).from`، `inventoryTargets.has`، `inventoryTargets.add`، `tx.select().from(purchaseOrderItems).where(and(eq(purchaseOrderItems.id, line.purchaseOrderItemId), eq(purchaseOrderItems.purchaseOrderId, po.id))).for`، `tx.select().from(purchaseOrderItems).where`، `and`، `tx.select({ id: purchaseOrderItemReceipts.id }).from(purchaseOrderItemReceipts).where`، `tx.select({ id: purchaseOrderItemReceipts.id }).from`، `tx.select({ quantity: purchaseReturnItems.quantity, status: purchaseReturns.status }) .from(purchaseReturnItems).innerJoin(purchaseReturns, eq(purchaseReturnItems.returnId, purchaseReturns.id)) .where`، `tx.select({ quantity: purchaseReturnItems.quantity, status: purchaseReturns.status }) .from(purchaseReturnItems).innerJoin`، `tx.select({ quantity: purchaseReturnItems.quantity, status: purchaseReturns.status }) .from`، `previousReturns.filter(row => row.status === "approved").reduce`، `previousReturns.filter`، `requestedReturnQuantities.get`، `requestedReturnQuantities.set`، `tx.select({ id: warehouseLocations.id }).from(warehouseLocations).where(and(eq(warehouseLocations.id, warehouseId), eq(warehouseLocations.isActive, true))).for`، `tx.select({ id: warehouseLocations.id }).from(warehouseLocations).where`، `tx.select({ id: warehouseLocations.id }).from`، `tx.select().from(consumables).where(and(eq(consumables.id, consumableId), eq(consumables.warehouseLocationId, warehouseId))).for`، `tx.select().from(consumables).where`، `stock.name.toLowerCase`، `poItem.description.toLowerCase`، `(stock.modelPartNumber ?? "").toLowerCase`، `(poItem.modelPartNumber ?? "").toLowerCase`، `checkedItems.push`، `Number`، `tx.select().from(assets).where(and(eq(assets.id, line.assetId), eq(assets.purchaseOrderNumber, po.poNumber))).for`، `tx.select().from(assets).where`، `asset.name.startsWith`، `checkedItems.reduce`، `tx.insert(purchaseReturns).values({ ...returnInput, returnNumber, debitNoteNumber, status: "approved", totalCredit: totalCredit.toFixed(2), processedAt: new Date(), createdBy: req.user!.id, }).returning`، `tx.insert(purchaseReturns).values`، `tx.insert`، `totalCredit.toFixed`، `(line.quantity * line.price).toFixed`، `tx.insert(purchaseReturnItems).values`، `line.price.toFixed`، `tx.update(consumables).set({ quantityInStock: line.consumable.quantityInStock - line.quantity, updatedAt: new Date(), }).where`، `tx.update(consumables).set`، `tx.update`، `tx.insert(consumableStockMovements).values`، `tx.update(assets).set({ status: "returned_to_vendor", currentBookValue: "0.00", currentValue: "0.00", }).where`، `tx.update(assets).set`، `tx.select({ totalCredit: purchaseReturns.totalCredit }).from(purchaseReturns).where`، `tx.select({ totalCredit: purchaseReturns.totalCredit }).from`، `tx.select({ amount: purchaseInvoicePayments.amount }).from(purchaseInvoicePayments).where`، `tx.select({ amount: purchaseInvoicePayments.amount }).from`، `credits.reduce`، `payments.reduce`، `tx.update(purchaseInvoices).set({ paymentStatus: Math.round(settled * 100) >= Math.round(Number(linkedInvoice.grandTotal) * 100) ? "paid" : "partially_paid", updatedAt: new Date(), }).where`، `tx.update(purchaseInvoices).set`، `Math.round`، `logAudit`، `res.status(201).json`، `res.status(status).json`، `console.error`، `res.status(500).json`

## DELETE `/api/quotations/:id`

- المصدر: server/routes.ts:6674
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("purchase_order_update")` → `deleteVendorQuotation`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`

## POST `/api/register`

- المصدر: server/auth.ts:107
- سلسلة الوسطاء/المعالج: `inline handler`
- جداول مشار إليها مباشرة: `permissions`
- الاستدعاءات الظاهرة: `req.isAuthenticated`، `res.status(401).json`، `res.status`، `storage.getUserPermissions`، `permissions.includes`، `res.status(403).json`، `storage.getUserByUsername`، `res.status(400).json`، `storage.getUserByEmail`، `hashPassword`، `storage.createUser`، `res.status(201).json`، `next`

## POST `/api/report-exports/xlsx`

- المصدر: server/routes.ts:617
- سلسلة الوسطاء/المعالج: `requireAuth` → `rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { message: "Too many spreadsheet exports. Please try again in a minute." }, })` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `rateLimit`، `reportExportSchema.parse`، `buildReportWorkbook`، `workbook.xlsx.writeBuffer`، `res.attachment`، `res.type`، `res.send`، `Buffer.from`، `res.status(400).json`، `res.status`، `res.status(500).json`

## USE `/api/report-exports/xlsx`

- المصدر: server/index.ts:52
- سلسلة الوسطاء/المعالج: `express.json({ limit: "10mb" })`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `express.json`

## GET `/api/reports/asset-assignments`

- المصدر: server/routes.ts:7979
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `assignments`، `employees`
- الاستدعاءات الظاهرة: `storage.getAssignmentsWithDetails`، `storage.getAssets`، `storage.getEmployees`، `assignments.filter`، `currentAssignments.forEach`، `assetAssignmentMap.set`، `'${a.employee.firstName} ${a.employee.lastName}'.trim`، `assets.map`، `assetAssignmentMap.get`، `assignments.map`، `assets.filter`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/asset-lifecycle`

- المصدر: server/routes.ts:7890
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `storage.getAssets`، `assets.map`، `Math.floor`، `today.getTime`، `purchaseDate.getTime`، `lifecycle.reduce`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/asset-summary`

- المصدر: server/routes.ts:7844
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `departments`، `locations`
- الاستدعاءات الظاهرة: `storage.getAssets`، `storage.getDepartments`، `storage.getLocations`، `assets.reduce`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/assets-by-department`

- المصدر: server/routes.ts:8241
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `departments`
- الاستدعاءات الظاهرة: `storage.getAssets`، `storage.getDepartments`، `departments.map`، `assets.filter`، `deptAssets.reduce`، `parseFloat`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/assignment-history`

- المصدر: server/routes.ts:8851
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getAssignmentsWithDetails`، `storage.getDepartments`، `deptsList.map`، `allAssignments.map`، `'${a.employee.firstName} ${a.employee.lastName}'.trim`، `deptMap.get`، `Math.floor`، `end.getTime`، `start.getTime`، `records.sort`، `new Date(b.assignedDate \|\| 0).getTime`، `new Date(a.assignedDate \|\| 0).getTime`، `records.filter`، `returnedRecords.map((r: any) => r.durationDays).filter`، `returnedRecords.map`، `Math.round`، `durations.reduce`، `records.map`، `res.json`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/reports/assignments`

- المصدر: server/routes.ts:8058
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `assignments`
- الاستدعاءات الظاهرة: `storage.getAssignmentsWithDetails`، `storage.getAssets`، `assignments.filter`، `currentAssignments.forEach`، `assetAssignmentMap.set`، `'${a.employee.firstName} ${a.employee.lastName}'.trim`، `assets.map`، `assetAssignmentMap.get`، `assignments.map`، `assets.filter`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/budget`

- المصدر: server/routes.ts:8586
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `budgets`، `departments`
- الاستدعاءات الظاهرة: `storage.getBudgets`، `storage.getDepartments`، `departments.map`، `budgets.map`، `deptMap.get`، `parseFloat`، `Math.round`، `budgetDetails.reduce`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/budget-analysis`

- المصدر: server/routes.ts:8202
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `budgets`، `departments`
- الاستدعاءات الظاهرة: `storage.getBudgets`، `storage.getDepartments`، `budgets.map`، `parseFloat`، `departments.find`، `Math.round`، `budgetAnalysis.reduce`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/changes`

- المصدر: server/routes.ts:11280
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `changes`
- الاستدعاءات الظاهرة: `requireModule`، `Math.max`، `Number.parseInt`، `String`، `Math.min`، `req.query.search.trim`، `/^\d{4}-\d{2}-\d{2}$/.test`، `Number.isNaN`، `date.getTime`، `date.toISOString().slice`، `date.toISOString`، `parseDateOnly`، `res.status(400).json`، `res.status`، `scheduledStartTo.getTime`، `startOfMonth.setDate`، `startOfMonth.setHours`، `Promise.all`، `storage.getChangeReportPage`، `storage.getChangeReportSummary`، `getChangeImpactSummaries`، `result.changes.map`، `res.json`، `impactSummaries.get`، `res.status(500).json`

## GET `/api/reports/department`

- المصدر: server/routes.ts:8623
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `departments`
- الاستدعاءات الظاهرة: `storage.getAssets`، `storage.getDepartments`، `departments.map`، `assets.filter`، `deptAssets.reduce`، `parseFloat`، `now.getTime`، `purchased.getTime`، `assets.reduce`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/depreciation`

- المصدر: server/routes.ts:8701
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `storage.getAssets`، `assets.map((a: any) => { const price = parseFloat(a.purchasePrice \|\| "0"); const summary = calculateDepreciation({ purchasePrice: price, purchaseDate: a.purchaseDate \|\| null, depreciationMethod: a.depreciationMethod \|\| null, depreciationRate: parseFloat(a.depreciationRate \|\| "20"), usefulLifeYears: a.usefulLifeYears \|\| null, residualValue: parseFloat(a.residualValue \|\| "0") \|\| null, }); if (!summary \|\| price <= 0) { noDataCount++; } else { totalOriginalValue += price; totalAccumulatedDepreciation += summary.accumulatedDepreciation; totalCurrentBookValue += summary.currentBookValue; if (summary.fullyDepreciated) fullyDepreciatedCount++; } return { id: a.id, assetTag: a.assetTag \|\| a.id?.slice(0, 8).toUpperCase(), name: a.name, type: a.type, department: a.department \|\| null, purchasePrice: price, purchaseDate: a.purchaseDate \|\| null, depreciationMethod: a.depreciationMethod \|\| "none", depreciationRate: parseFloat(a.depreciationRate \|\| "20"), usefulLifeYears: a.usefulLifeYears \|\| null, residualValue: parseFloat(a.residualValue \|\| "0") \|\| 0, ...(summary \|\| { yearsOwned: 0, annualDepreciation: 0, accumulatedDepreciation: 0, currentBookValue: price, percentDepreciated: 0, fullyDepreciated: false, }), hasDepreciationData: !!summary, }; }).filter`، `assets.map`، `parseFloat`، `calculateDepreciation`، `a.id?.slice(0, 8).toUpperCase`، `a.id?.slice`، `res.json`، `Math.round`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/reports/expiring-warranties`

- المصدر: server/routes.ts:8272
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `storage.getAssets`، `threeMonthsFromNow.setMonth`، `threeMonthsFromNow.getMonth`، `assets .filter((asset: any) => { if (!asset.warrantyEndDate) return false; const warrantyEnd = new Date(asset.warrantyEndDate); return warrantyEnd > today && warrantyEnd <= threeMonthsFromNow; }) .map((asset: any) => ({ id: asset.id, assetTag: asset.assetTag, assetType: asset.assetType, manufacturer: asset.manufacturer, model: asset.model, warrantyEndDate: asset.warrantyEndDate, daysRemaining: Math.floor((new Date(asset.warrantyEndDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) })) .sort`، `assets .filter((asset: any) => { if (!asset.warrantyEndDate) return false; const warrantyEnd = new Date(asset.warrantyEndDate); return warrantyEnd > today && warrantyEnd <= threeMonthsFromNow; }) .map`، `assets .filter`، `Math.floor`، `new Date(asset.warrantyEndDate).getTime`، `today.getTime`، `assets .filter((asset: any) => { if (!asset.warrantyEndDate) return false; const warrantyEnd = new Date(asset.warrantyEndDate); return warrantyEnd <= today; }) .map`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/hardware`

- المصدر: server/routes.ts:8420
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `storage.getAssets`، `assets.map`، `a.id?.slice(0, 8).toUpperCase`، `a.id?.slice`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/hardware-inventory`

- المصدر: server/routes.ts:7949
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `storage.getAssets`، `assets.filter((asset: any) => { const t = (asset.type \|\| asset.assetType \|\| "").toLowerCase(); return !softwareTypes.includes(t); }).map`، `assets.filter`، `(asset.type \|\| asset.assetType \|\| "").toLowerCase`، `softwareTypes.includes`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/it-components-compliance`

- المصدر: server/it-components-compliance-report.ts:84
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `requireComplianceRead` → `inline handler`
- جداول مشار إليها مباشرة: `cmdb_applications`، `it_component_compliance_reviews`، `locations`، `network_devices`، `network_zones`، `servers`
- الاستدعاءات الظاهرة: `Promise.all`، `storage.getAssets`، `db.select().from(cmdbApplications).orderBy`، `db.select().from`، `db.select`، `asc`، `db.select().from(servers).orderBy`، `db.select().from(networkDevices).orderBy`، `db.select({ id: locations.id, name: locations.name }).from`، `reviews.map`، `locationRows.map`، `zones.map`، `networkRows.map(device => device.assetId).filter`، `networkRows.map`، `Boolean`، `reviewMap.get`، `result.push`، `normalizeStatus`، `assetRows.filter`، `endpointTypes.has`، `String(asset.type ?? "").toLowerCase`، `String`، `linkedNetworkAssetIds.has`، `softwareTypes.has`، `maskLicenseKey`، `identifierParts.filter(Boolean).join`، `identifierParts.filter`، `locationMap.get`، `addRow`، `[name, asset.assetTag, asset.serialNumber, asset.ipAddress, asset.version, asset.manufacturer, asset.model, asset.licenseType].filter(Boolean).join`، `[name, asset.assetTag, asset.serialNumber, asset.ipAddress, asset.version, asset.manufacturer, asset.model, asset.licenseType].filter`، `[location, asset.businessPurpose, asset.category].filter(Boolean).join`، `[location, asset.businessPurpose, asset.category].filter`، `[name, asset.assetTag, asset.serialNumber, asset.installedSoftware, asset.version].filter(Boolean).join`، `[name, asset.assetTag, asset.serialNumber, asset.installedSoftware, asset.version].filter`، `[location, "Installed endpoint applications"].filter(Boolean).join`، `[location, "Installed endpoint applications"].filter`، `[asset.serialNumber, asset.assetTag, asset.version].filter(Boolean).join`، `[asset.serialNumber, asset.assetTag, asset.version].filter`، `[name, asset.assetTag, asset.serialNumber, asset.ipAddress, asset.version, protection].filter(Boolean).join`، `[name, asset.assetTag, asset.serialNumber, asset.ipAddress, asset.version, protection].filter`، `[location, "Endpoint protection"].filter(Boolean).join`، `[location, "Endpoint protection"].filter`، `protectionStatus`، `assetRows.find`، `zoneMap.get`، `[device.serialNumber \|\| linkedAsset?.serialNumber, device.managementIp, device.hostname, device.firmwareVersion].filter(Boolean).join`، `[device.serialNumber \|\| linkedAsset?.serialNumber, device.managementIp, device.hostname, device.firmwareVersion].filter`، `[name, device.serialNumber, device.managementIp, device.hostname, device.model, device.manufacturer, device.firmwareVersion].filter(Boolean).join`، `[name, device.serialNumber, device.managementIp, device.hostname, device.model, device.manufacturer, device.firmwareVersion].filter`، `[zoneName, device.deviceType, linkedAsset?.siteBuilding].filter(Boolean).join`، `[zoneName, device.deviceType, linkedAsset?.siteBuilding].filter`، `[server.hostname, server.ipAddress, server.osPlatform].filter(Boolean).join`، `[server.hostname, server.ipAddress, server.osPlatform].filter`، `[server.hostname, server.ipAddress, server.osPlatform, server.environment, server.cpuRamSpecs].filter(Boolean).join`، `[server.hostname, server.ipAddress, server.osPlatform, server.environment, server.cpuRamSpecs].filter`، `[server.location, server.environment].filter(Boolean).join`، `[server.location, server.environment].filter`، `[application.vendor, application.hostingType].filter(Boolean).join`، `[application.vendor, application.hostingType].filter`، `[application.name, application.vendor, application.category, application.criticalityRating].filter(Boolean).join`، `[application.name, application.vendor, application.category, application.criticalityRating].filter`، `[application.hostingType, application.criticalityRating, "CMDB application"].filter(Boolean).join`، `[application.hostingType, application.criticalityRating, "CMDB application"].filter`، `res.json`، `console.error`، `res.status(500).json`، `res.status`

## PUT `/api/reports/it-components-compliance/:componentType/:componentId/review`

- المصدر: server/it-components-compliance-report.ts:266
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAssetManagement` → `requireAssetUpdate` → `inline handler`
- جداول مشار إليها مباشرة: `audit_logs`، `cmdb_applications`، `it_component_compliance_reviews`، `network_devices`، `servers`
- الاستدعاءات الظاهرة: `z.enum(reviewTypes).safeParse`، `z.enum`، `reviewInput.safeParse`، `res.status(400).json`، `res.status`، `res.status(401).json`، `["hardware_asset", "endpoint_device", "endpoint_protection", "software_asset", "installed_software", "license_asset"].includes`، `storage.getAssets`، `db.select({ id: servers.id }).from(servers).where(eq(servers.id, componentId)).limit`، `db.select({ id: servers.id }).from(servers).where`، `db.select({ id: servers.id }).from`، `db.select`، `eq`، `db.select({ id: cmdbApplications.id }).from(cmdbApplications).where(eq(cmdbApplications.id, componentId)).limit`، `db.select({ id: cmdbApplications.id }).from(cmdbApplications).where`، `db.select({ id: cmdbApplications.id }).from`، `db.select({ id: networkDevices.id }).from(networkDevices).where(eq(networkDevices.id, componentId)).limit`، `db.select({ id: networkDevices.id }).from(networkDevices).where`، `db.select({ id: networkDevices.id }).from`، `Boolean`، `assetsForValidation?.some`، `res.status(404).json`، `new Date().toISOString().slice`، `new Date().toISOString`، `db.transaction`، `tx.select().from(itComponentComplianceReviews).where(and( eq(itComponentComplianceReviews.componentType, componentType), eq(itComponentComplianceReviews.componentId, componentId), )).for`، `tx.select().from(itComponentComplianceReviews).where`، `tx.select().from`، `tx.select`، `and`، `tx.insert(itComponentComplianceReviews).values({ componentType, componentId, ...input.data, lastReviewedAt: reviewedAt, reviewedById: req.user!.id, updatedAt: new Date(), }).onConflictDoUpdate({ target: [itComponentComplianceReviews.componentType, itComponentComplianceReviews.componentId], set: { ...input.data, lastReviewedAt: reviewedAt, reviewedById: req.user!.id, updatedAt: new Date(), }, }).returning`، `tx.insert(itComponentComplianceReviews).values({ componentType, componentId, ...input.data, lastReviewedAt: reviewedAt, reviewedById: req.user!.id, updatedAt: new Date(), }).onConflictDoUpdate`، `tx.insert(itComponentComplianceReviews).values`، `tx.insert`، `tx.insert(auditLogs).values`، `JSON.stringify`، `req.get`، `res.json`، `console.error`، `res.status(500).json`

## GET `/api/reports/kb-articles`

- المصدر: server/knowledge-governance.ts:233
- سلسلة الوسطاء/المعالج: `requireAuth` → `list()`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `list`

## GET `/api/reports/lifecycle`

- المصدر: server/routes.ts:8378
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `storage.getAssets`، `assets.forEach`، `today.getTime`، `purchaseDate.getTime`، `warrantyEnd.getTime`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/maintenance`

- المصدر: server/routes.ts:8540
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `storage.getMaintenanceSchedules`، `storage.getAssets`، `assets.map`، `assetMap.get`، `schedules.map`، `allSchedules.filter`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/maintenance-schedule`

- المصدر: server/routes.ts:8135
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getMaintenanceSchedulesWithDetails`، `storage.getMaintenanceRecordsWithDetails`، `schedules.filter((s: any) => { const nextDate = new Date(s.nextMaintenanceDate); return nextDate > today; }).sort`، `schedules.filter`، `new Date(a.nextMaintenanceDate).getTime`، `new Date(b.nextMaintenanceDate).getTime`، `records.reduce`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/missing-data`

- المصدر: server/routes.ts:8501
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `storage.getAssets`، `assets .map((a: any) => { const rules = MISSING_DATA_FIELDS[a.type] \|\| MISSING_DATA_FIELDS.other; const missingFields = rules .filter((f) => { const value = a[f.key]; return value === null \|\| value === undefined \|\| String(value).trim() === ""; }) .map((f) => f.label); return { id: a.id, name: a.name, assetTag: a.assetTag \|\| null, type: a.type \|\| "other", status: a.status \|\| "available", missingFields, }; }) .filter`، `assets .map`، `rules .filter((f) => { const value = a[f.key]; return value === null \|\| value === undefined \|\| String(value).trim() === ""; }) .map`، `rules .filter`، `String(value).trim`، `String`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/personnel`

- المصدر: server/personnel-report.ts:24
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `assignments`، `departments`، `employee_access_rights`، `employee_offboarding_clearances`، `employees`، `incidents`، `locations`، `project_tasks`، `service_requests`، `tickets`، `users`
- الاستدعاءات الظاهرة: `Promise.all`، `db .select({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, department: sql<string \| null>'coalesce(${departments.name}, ${employees.department})', position: employees.position, location: locations.name, status: employees.status, startDate: employees.startDate, }) .from(employees) .leftJoin(departments, eq(employees.departmentId, departments.id)) .leftJoin(locations, eq(employees.locationId, locations.id)) .where(eq(employees.status, "active")) .orderBy`، `db .select({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, department: sql<string \| null>'coalesce(${departments.name}, ${employees.department})', position: employees.position, location: locations.name, status: employees.status, startDate: employees.startDate, }) .from(employees) .leftJoin(departments, eq(employees.departmentId, departments.id)) .leftJoin(locations, eq(employees.locationId, locations.id)) .where`، `db .select({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, department: sql<string \| null>'coalesce(${departments.name}, ${employees.department})', position: employees.position, location: locations.name, status: employees.status, startDate: employees.startDate, }) .from(employees) .leftJoin(departments, eq(employees.departmentId, departments.id)) .leftJoin`، `db .select({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, department: sql<string \| null>'coalesce(${departments.name}, ${employees.department})', position: employees.position, location: locations.name, status: employees.status, startDate: employees.startDate, }) .from(employees) .leftJoin`، `db .select({ id: employees.id, employeeId: employees.employeeId, firstName: employees.firstName, lastName: employees.lastName, department: sql<string \| null>'coalesce(${departments.name}, ${employees.department})', position: employees.position, location: locations.name, status: employees.status, startDate: employees.startDate, }) .from`، `db .select`، `eq`، `asc`، `db .select({ active: sql<number>'count(*) filter (where ${employeeAccessRights.status} = 'active')', expiring: sql<number>'count(*) filter ( where ${employeeAccessRights.status} = 'active' and ${employeeAccessRights.expiresAt} >= current_date and ${employeeAccessRights.expiresAt} <= current_date + interval '30 days' )', expired: sql<number>'count(*) filter ( where ${employeeAccessRights.status} = 'expired' or (${employeeAccessRights.status} = 'active' and ${employeeAccessRights.expiresAt} < current_date) )', }) .from`، `db .select({ recentStarts: sql<number>'count(*) filter ( where ${employees.startDate} >= current_date - interval '30 days' )', recentOffboardings: sql<number>'count(*) filter ( where ${employees.offboardedDate} >= current_date - interval '30 days' )', }) .from`، `db .select({ recentSignoffs: sql<number>'count(*) filter ( where ${employeeOffboardingClearances.signedAt} >= now() - interval '30 days' )', }) .from`، `isFeatureEnabled`، `db.select({ employeeId: assignments.employeeId, total: sql<number>'count(*)' }) .from(assignments) .where(isNull(assignments.returnedDate)) .groupBy`، `db.select({ employeeId: assignments.employeeId, total: sql<number>'count(*)' }) .from(assignments) .where`، `db.select({ employeeId: assignments.employeeId, total: sql<number>'count(*)' }) .from`، `db.select`، `isNull`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from(projectTasks) .innerJoin(users, eq(projectTasks.assigneeId, users.id)) .innerJoin(employees, sql'lower(${users.email}) = lower(${employees.email})') .where(sql'${projectTasks.status} <> 'Done'') .groupBy`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from(projectTasks) .innerJoin(users, eq(projectTasks.assigneeId, users.id)) .innerJoin(employees, sql'lower(${users.email}) = lower(${employees.email})') .where`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from(projectTasks) .innerJoin(users, eq(projectTasks.assigneeId, users.id)) .innerJoin`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from(projectTasks) .innerJoin`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from(incidents) .innerJoin(users, sql'${users.id} = coalesce(${incidents.assigneeId}, ${incidents.assignedToId})') .innerJoin(employees, sql'lower(${users.email}) = lower(${employees.email})') .where(sql'lower(${incidents.status}) not in ('closed', 'resolved')') .groupBy`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from(incidents) .innerJoin(users, sql'${users.id} = coalesce(${incidents.assigneeId}, ${incidents.assignedToId})') .innerJoin(employees, sql'lower(${users.email}) = lower(${employees.email})') .where`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from(incidents) .innerJoin(users, sql'${users.id} = coalesce(${incidents.assigneeId}, ${incidents.assignedToId})') .innerJoin`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from(incidents) .innerJoin`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from(serviceRequests) .innerJoin(users, sql'${users.id} = coalesce(${serviceRequests.assignedToId}, ${serviceRequests.assigneeId})') .innerJoin(employees, sql'lower(${users.email}) = lower(${employees.email})') .where(sql'lower(${serviceRequests.fulfillmentStatus}) not in ('closed', 'completed', 'cancelled', 'fulfilled')') .groupBy`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from(serviceRequests) .innerJoin(users, sql'${users.id} = coalesce(${serviceRequests.assignedToId}, ${serviceRequests.assigneeId})') .innerJoin(employees, sql'lower(${users.email}) = lower(${employees.email})') .where`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from(serviceRequests) .innerJoin(users, sql'${users.id} = coalesce(${serviceRequests.assignedToId}, ${serviceRequests.assigneeId})') .innerJoin`، `db.select({ employeeId: employees.id, total: sql<number>'count(*)' }) .from(serviceRequests) .innerJoin`، `allocationByEmployee.get`، `Number`، `allocationByEmployee.set`، `addAllocations`، `res.json`، `directory.map`، `'${employee.firstName} ${employee.lastName}'.trim`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/reports/problems`

- المصدر: server/routes.ts:11275
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `res.json`، `storage.getProblems`، `res.status(500).json`، `res.status`

## GET `/api/reports/procurement-finance`

- المصدر: server/routes.ts:7382
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `departments`، `purchase_invoice_items`، `purchase_invoice_payments`، `purchase_invoices`، `purchase_order_items`، `purchase_orders`، `purchase_returns`، `vendor_quotations`، `vendors`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `Promise.all`، `db.select().from`، `db.select`، `db.select().from(purchaseInvoices).where`، `db.select().from(purchaseReturns).where`، `eq`، `db.select({ id: vendors.id, name: vendors.name }).from`، `vendorRows.map`، `poRows.map`، `invoicePayments.set`، `invoicePayments.get`، `Number`، `approvedCreditsByInvoice.set`، `approvedCreditsByInvoice.get`، `spendByVendor.get`، `vendorName.get`، `spendByVendor.set`، `payableByMethod.get`، `Math.max`، `payableByMethod.set`، `db.select({ invoiceId: purchaseInvoiceItems.invoiceId, totalPrice: purchaseInvoiceItems.totalPrice, itemType: purchaseOrderItems.itemType, assetType: purchaseOrderItems.assetType, consumableCategory: purchaseOrderItems.consumableCategory, departmentId: purchaseOrders.departmentId, }).from(purchaseInvoiceItems) .innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.invoiceId, purchaseInvoices.id)) .innerJoin(purchaseOrderItems, eq(purchaseInvoiceItems.purchaseOrderItemId, purchaseOrderItems.id)) .innerJoin(purchaseOrders, eq(purchaseInvoices.purchaseOrderId, purchaseOrders.id)) .where`، `db.select({ invoiceId: purchaseInvoiceItems.invoiceId, totalPrice: purchaseInvoiceItems.totalPrice, itemType: purchaseOrderItems.itemType, assetType: purchaseOrderItems.assetType, consumableCategory: purchaseOrderItems.consumableCategory, departmentId: purchaseOrders.departmentId, }).from(purchaseInvoiceItems) .innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.invoiceId, purchaseInvoices.id)) .innerJoin(purchaseOrderItems, eq(purchaseInvoiceItems.purchaseOrderItemId, purchaseOrderItems.id)) .innerJoin`، `db.select({ invoiceId: purchaseInvoiceItems.invoiceId, totalPrice: purchaseInvoiceItems.totalPrice, itemType: purchaseOrderItems.itemType, assetType: purchaseOrderItems.assetType, consumableCategory: purchaseOrderItems.consumableCategory, departmentId: purchaseOrders.departmentId, }).from(purchaseInvoiceItems) .innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.invoiceId, purchaseInvoices.id)) .innerJoin`، `db.select({ invoiceId: purchaseInvoiceItems.invoiceId, totalPrice: purchaseInvoiceItems.totalPrice, itemType: purchaseOrderItems.itemType, assetType: purchaseOrderItems.assetType, consumableCategory: purchaseOrderItems.consumableCategory, departmentId: purchaseOrders.departmentId, }).from(purchaseInvoiceItems) .innerJoin`، `db.select({ invoiceId: purchaseInvoiceItems.invoiceId, totalPrice: purchaseInvoiceItems.totalPrice, itemType: purchaseOrderItems.itemType, assetType: purchaseOrderItems.assetType, consumableCategory: purchaseOrderItems.consumableCategory, departmentId: purchaseOrders.departmentId, }).from`، `invoiceRows.map`، `db.select({ id: departments.id, name: departments.name }).from`، `departmentNames.map`، `invoiceCurrency.get`، `categoryTotals.get`، `categoryTotals.set`، `departmentTotals.get`، `departmentName.get`، `departmentTotals.set`، `Array.from`، `payableByMethod.values`، `returnRows.map`، `poById.get`، `spendByCurrency.set`، `spendByCurrency.get`، `returnsByCurrency.set`، `returnsByCurrency.get`، `paidByCurrency.set`، `paidByCurrency.get`، `res.json`، `Array.from(spendByCurrency.entries()).map`، `spendByCurrency.entries`، `spendByVendor.values`، `categoryTotals.values`، `departmentTotals.values`، `invoiceRows.filter`، `Array.from(paidByCurrency.entries()).map`، `paidByCurrency.entries`، `Array.from(returnsByCurrency.entries()).map`، `returnsByCurrency.entries`، `quotations.filter`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/reports/project-allocations`

- المصدر: server/project-workspace.ts:679
- سلسلة الوسطاء/المعالج: `requireAuth` → `enabled` → `inline handler`
- جداول مشار إليها مباشرة: `project_managers`، `project_tasks`، `project_team_members`، `projects`، `users`
- الاستدعاءات الظاهرة: `res.status(401).json`، `res.status`، `access`، `res.status(403).json`، `Promise.all`، `db.select({ projectId: projectTeamMembers.projectId, projectTitle: projects.title, userId: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, roleTitle: projectTeamMembers.roleTitle, }).from(projectTeamMembers) .innerJoin(projects, eq(projectTeamMembers.projectId, projects.id)) .innerJoin`، `db.select({ projectId: projectTeamMembers.projectId, projectTitle: projects.title, userId: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, roleTitle: projectTeamMembers.roleTitle, }).from(projectTeamMembers) .innerJoin`، `db.select({ projectId: projectTeamMembers.projectId, projectTitle: projects.title, userId: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, roleTitle: projectTeamMembers.roleTitle, }).from`، `db.select`، `eq`، `db.select({ projectId: projectManagers.projectId, projectTitle: projects.title, userId: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, }).from(projectManagers) .innerJoin(projects, eq(projectManagers.projectId, projects.id)) .innerJoin`، `db.select({ projectId: projectManagers.projectId, projectTitle: projects.title, userId: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, }).from(projectManagers) .innerJoin`، `db.select({ projectId: projectManagers.projectId, projectTitle: projects.title, userId: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, }).from`، `db.select({ projectId: projectTasks.projectId, projectTitle: projects.title, userId: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, taskCount: count(projectTasks.id), estimatedHours: sql<string>'coalesce(sum(${projectTasks.estimatedHours}), 0)', loggedHours: sql<string>'coalesce(sum(${projectTasks.loggedHours}), 0)', }).from(projectTasks) .innerJoin(projects, eq(projectTasks.projectId, projects.id)) .innerJoin(users, eq(projectTasks.assigneeId, users.id)) .groupBy`، `db.select({ projectId: projectTasks.projectId, projectTitle: projects.title, userId: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, taskCount: count(projectTasks.id), estimatedHours: sql<string>'coalesce(sum(${projectTasks.estimatedHours}), 0)', loggedHours: sql<string>'coalesce(sum(${projectTasks.loggedHours}), 0)', }).from(projectTasks) .innerJoin(projects, eq(projectTasks.projectId, projects.id)) .innerJoin`، `db.select({ projectId: projectTasks.projectId, projectTitle: projects.title, userId: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, taskCount: count(projectTasks.id), estimatedHours: sql<string>'coalesce(sum(${projectTasks.estimatedHours}), 0)', loggedHours: sql<string>'coalesce(sum(${projectTasks.loggedHours}), 0)', }).from(projectTasks) .innerJoin`، `db.select({ projectId: projectTasks.projectId, projectTitle: projects.title, userId: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, taskCount: count(projectTasks.id), estimatedHours: sql<string>'coalesce(sum(${projectTasks.estimatedHours}), 0)', loggedHours: sql<string>'coalesce(sum(${projectTasks.loggedHours}), 0)', }).from`، `count`، `allocations.get`، `reportName`، `allocations.set`، `user.projects.get`، `user.projects.set`، `ensure`، `Number`، `text(req.query.search, 120).toLowerCase`، `text`، `Array.from(allocations.values()).map(user => { const projects = Array.from(user.projects.values()).sort((a, b) => a.projectTitle.localeCompare(b.projectTitle)); return { userId: user.userId, name: user.name, username: user.username, projectCount: projects.length, taskCount: projects.reduce((total, project) => total + project.taskCount, 0), estimatedHours: projects.reduce((total, project) => total + project.estimatedHours, 0), loggedHours: projects.reduce((total, project) => total + project.loggedHours, 0), projects, }; }).filter(user => !search \|\| '${user.name} ${user.username} ${user.projects.map(project => project.projectTitle).join(" ")}'.toLowerCase().includes(search)) .sort`، `Array.from(allocations.values()).map(user => { const projects = Array.from(user.projects.values()).sort((a, b) => a.projectTitle.localeCompare(b.projectTitle)); return { userId: user.userId, name: user.name, username: user.username, projectCount: projects.length, taskCount: projects.reduce((total, project) => total + project.taskCount, 0), estimatedHours: projects.reduce((total, project) => total + project.estimatedHours, 0), loggedHours: projects.reduce((total, project) => total + project.loggedHours, 0), projects, }; }).filter`، `Array.from(allocations.values()).map`، `Array.from`، `allocations.values`، `Array.from(user.projects.values()).sort`، `user.projects.values`، `a.projectTitle.localeCompare`، `projects.reduce`، `'${user.name} ${user.username} ${user.projects.map(project => project.projectTitle).join(" ")}'.toLowerCase().includes`، `'${user.name} ${user.username} ${user.projects.map(project => project.projectTitle).join(" ")}'.toLowerCase`، `user.projects.map(project => project.projectTitle).join`، `user.projects.map`، `a.name.localeCompare`، `res.json`، `new Date().toISOString`، `sendError`

## GET `/api/reports/purchase-orders`

- المصدر: server/routes.ts:8173
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_orders`
- الاستدعاءات الظاهرة: `storage.getPurchaseOrdersWithDetails`، `pos.reduce`، `parseFloat`، `pos.filter`، `pos.slice(0, 50).map`، `pos.slice`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/purchase-orders-v2`

- المصدر: server/routes.ts:8955
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_orders`
- الاستدعاءات الظاهرة: `storage.getPurchaseOrdersWithDetails`، `pos.reduce`، `parseFloat`، `pos.filter`، `pos.slice(0, 20).map`، `pos.slice`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/released-assets`

- المصدر: server/routes.ts:8796
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getAssignmentsWithDetails`، `allAssignments.filter`، `returned.map((a: any) => { const assignedDate = a.assignedDate ? new Date(a.assignedDate) : null; const returnedDate = a.returnedDate ? new Date(a.returnedDate) : null; const durationDays = assignedDate && returnedDate ? Math.max(0, Math.floor((returnedDate.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24))) : null; return { id: a.id, assetTag: (a.asset as any)?.assetTag \|\| a.asset?.id?.slice(0, 8).toUpperCase() \|\| "N/A", assetName: a.asset?.name \|\| "N/A", assetType: a.asset?.type \|\| "N/A", serialNumber: (a.asset as any)?.serialNumber \|\| "N/A", employeeName: a.employee ? '${a.employee.firstName} ${a.employee.lastName}' : "N/A", employeeId: a.employee?.id \|\| null, department: a.employee?.department \|\| "N/A", assignedDate: a.assignedDate \|\| null, returnedDate: a.returnedDate \|\| null, durationDays, notes: a.notes \|\| null, }; }).sort`، `returned.map`، `Math.max`، `Math.floor`، `returnedDate.getTime`، `assignedDate.getTime`، `a.asset?.id?.slice(0, 8).toUpperCase`، `a.asset?.id?.slice`، `new Date(y.returnedDate).getTime`، `new Date(x.returnedDate).getTime`، `records.filter`، `Math.round`، `withDuration.reduce`، `d.getFullYear`، `now.getFullYear`، `d.getMonth`، `now.getMonth`، `records.forEach`، `Object.entries(deptCounts).sort`، `Object.entries`، `res.json`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/reports/summary`

- المصدر: server/routes.ts:8355
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `storage.getAssets`، `assets.forEach`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/tickets`

- المصدر: server/routes.ts:2633
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `requirePermission('ticket_view_all')` → `inline handler`
- جداول مشار إليها مباشرة: `tickets`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.getTickets`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/vendor-analysis`

- المصدر: server/routes.ts:8322
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `purchase_orders`، `vendors`
- الاستدعاءات الظاهرة: `storage.getVendors`، `storage.getAssets`، `storage.getPurchaseOrdersWithDetails`، `vendors.map`، `assets.filter`، `purchaseOrders.filter`، `vendorPOs.reduce`، `parseFloat`، `res.json`، `vendorAnalysis.sort`، `res.status(500).json`، `res.status`

## GET `/api/reports/vendors`

- المصدر: server/routes.ts:8923
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_orders`
- الاستدعاءات الظاهرة: `storage.getVendors`، `storage.getPurchaseOrdersWithDetails`، `vendorsList.map`، `(purchaseOrders as any[]).filter`، `vPOs.reduce`، `parseFloat`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/reports/warranties`

- المصدر: server/routes.ts:8663
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `assets`
- الاستدعاءات الظاهرة: `storage.getAssets`، `assets.map((a: any) => { const warrantyDate = a.warrantyExpiry \|\| a.warrantyEndDate; let warrantyStatus = "No Warranty"; let daysUntilExpiry = null; if (warrantyDate) { const end = new Date(warrantyDate); daysUntilExpiry = Math.floor((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); if (end < today) { warrantyStatus = "Expired"; expired++; } else if (daysUntilExpiry <= 90) { warrantyStatus = "Expiring Soon"; expiring++; } else { warrantyStatus = "Active"; active++; } } return { id: a.id, assetTag: a.assetTag \|\| a.id?.slice(0, 8).toUpperCase(), assetType: a.type \|\| a.assetType \|\| "Hardware", name: a.name, warrantyDate, daysUntilExpiry, warrantyStatus, }; }).filter`، `assets.map`، `Math.floor`، `end.getTime`، `today.getTime`، `a.id?.slice(0, 8).toUpperCase`، `a.id?.slice`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/risk-users`

- المصدر: server/routes.ts:10123
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("change_manage")` → `requireModule("risk_management")` → `inline handler`
- جداول مشار إليها مباشرة: `users`
- الاستدعاءات الظاهرة: `requirePermission`، `requireModule`، `res.json`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName }) .from(users).where`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName }) .from`، `db.select`، `eq`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/risks`

- المصدر: server/routes.ts:10133
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("risk_management")` → `inline handler`
- جداول مشار إليها مباشرة: `changes`، `risk_register`، `users`
- الاستدعاءات الظاهرة: `requireModule`، `db.select({ risk: risks, linkedOwnerId: users.id, linkedOwnerUsername: users.username, linkedOwnerFirstName: users.firstName, linkedOwnerLastName: users.lastName, linkedChangeId: changes.id, linkedChangeNumber: changes.changeNumber, linkedChangeTitle: changes.title, }).from(risks) .leftJoin(users, eq(risks.ownerId, users.id)) .leftJoin`، `db.select({ risk: risks, linkedOwnerId: users.id, linkedOwnerUsername: users.username, linkedOwnerFirstName: users.firstName, linkedOwnerLastName: users.lastName, linkedChangeId: changes.id, linkedChangeNumber: changes.changeNumber, linkedChangeTitle: changes.title, }).from(risks) .leftJoin`، `db.select({ risk: risks, linkedOwnerId: users.id, linkedOwnerUsername: users.username, linkedOwnerFirstName: users.firstName, linkedOwnerLastName: users.lastName, linkedChangeId: changes.id, linkedChangeNumber: changes.changeNumber, linkedChangeTitle: changes.title, }).from`، `db.select`، `eq`، `getChangeImpactSummaries`، `rows.flatMap`، `res.json`، `rows.map`، `impactSummaries.get`، `console.error`، `res.status(500).json`، `res.status`

## POST `/api/risks`

- المصدر: server/routes.ts:10167
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("change_manage")` → `requireModule("risk_management")` → `inline handler`
- جداول مشار إليها مباشرة: `risk_register`
- الاستدعاءات الظاهرة: `requirePermission`، `requireModule`، `z.object`، `z.string().trim().min(1).max`، `z.string().trim().min`، `z.string().trim`، `z.string`، `z.string().nullable().optional`، `z.string().nullable`، `z.string().max(5000).nullable().optional`، `z.string().max(5000).nullable`، `z.string().max`، `z.enum`، `z.number().int().min(1).max`، `z.number().int().min`، `z.number().int`، `z.number`، `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional`، `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable`، `z.string().regex`، `z.number().int().min(1).max(5).nullable().optional`، `z.number().int().min(1).max(5).nullable`، `z.enum(["identified", "mitigating", "accepted", "closed"]).optional`، `z.string().max(2000).nullable().optional`، `z.string().max(2000).nullable`، `bodySchema.safeParse`، `res.status(400).json`، `res.status`، `parsed.error.flatten`، `parsed.data.acceptanceReason?.trim`، `db.insert(risks).values({ ...parsed.data, riskScore: parsed.data.impact * parsed.data.likelihood, createdById: user.id, }).returning`، `db.insert(risks).values`، `db.insert`، `logAudit`، `res.status(201).json`، `console.error`، `res.status(500).json`

## PUT `/api/risks/:riskId`

- المصدر: server/routes.ts:10204
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("change_manage")` → `requireModule("risk_management")` → `inline handler`
- جداول مشار إليها مباشرة: `risk_register`
- الاستدعاءات الظاهرة: `requirePermission`، `requireModule`، `db.select().from(risks).where`، `db.select().from`، `db.select`، `eq`، `res.status(404).json`، `res.status`، `z.object`، `z.string().trim().min(1).max(200).optional`، `z.string().trim().min(1).max`، `z.string().trim().min`، `z.string().trim`، `z.string`، `z.string().nullable().optional`، `z.string().nullable`، `z.string().max(5000).nullable().optional`، `z.string().max(5000).nullable`، `z.string().max`، `z.enum(["security", "availability", "data", "schedule", "operational", "compliance", "vendor", "other"]).optional`، `z.enum`، `z.number().int().min(1).max(5).optional`، `z.number().int().min(1).max`، `z.number().int().min`، `z.number().int`، `z.number`، `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional`، `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable`، `z.string().regex`، `z.number().int().min(1).max(5).nullable().optional`، `z.number().int().min(1).max(5).nullable`، `z.enum(["identified", "mitigating", "accepted", "closed"]).optional`، `z.string().max(2000).nullable().optional`، `z.string().max(2000).nullable`، `bodySchema.safeParse`، `res.status(400).json`، `parsed.error.flatten`، `nextReason?.trim`، `db.update(risks).set({ ...parsed.data, riskScore: nextImpact * nextLikelihood, updatedAt: new Date(), }) .where(eq(risks.id, req.params.riskId)).returning`، `db.update(risks).set({ ...parsed.data, riskScore: nextImpact * nextLikelihood, updatedAt: new Date(), }) .where`، `db.update(risks).set`، `db.update`، `logAudit`، `res.json`، `console.error`، `res.status(500).json`

## GET `/api/roles`

- المصدر: server/routes.ts:895
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('role_view')` → `inline handler`
- جداول مشار إليها مباشرة: `roles`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getRolesWithDetails`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/roles`

- المصدر: server/routes.ts:916
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('role_create')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertRoleSchema.parse`، `storage.createRole`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## DELETE `/api/roles/:id`

- المصدر: server/routes.ts:957
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('role_delete')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getRole`، `storage.deleteRole`، `res.status(404).json`، `res.status`، `logAudit`، `res.status(204).send`، `res.status(500).json`

## GET `/api/roles/:id`

- المصدر: server/routes.ts:904
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('role_view')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getRole`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/roles/:id`

- المصدر: server/routes.ts:933
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('role_update')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertRoleSchema.partial().parse`، `insertRoleSchema.partial`، `storage.getRole`، `storage.updateRole`، `res.status(404).json`، `res.status`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## GET `/api/servers`

- المصدر: server/routes.ts:3604
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requireAnyPermission("asset_update", "cmdb_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `servers`
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `cmdbPageFilters.extend({ osPlatform: z.string().trim().max(120).optional(), environment: z.enum(["all", "production", "staging", "development"]).default("all"), status: z.enum(["all", "online", "maintenance", "offline"]).default("all"), }).safeParse`، `cmdbPageFilters.extend`، `z.string().trim().max(120).optional`، `z.string().trim().max`، `z.string().trim`، `z.string`، `z.enum(["all", "production", "staging", "development"]).default`، `z.enum`، `z.enum(["all", "online", "maintenance", "offline"]).default`، `res.status(400).json`، `res.status`، `conditions.push`، `eq`، `or`، `ilike`، `and`، `Promise.all`، `db.select().from(servers).where(where) .orderBy(desc(servers.updatedAt), desc(servers.hostname)) .limit(pageSize).offset`، `db.select().from(servers).where(where) .orderBy(desc(servers.updatedAt), desc(servers.hostname)) .limit`، `db.select().from(servers).where(where) .orderBy`، `db.select().from(servers).where`، `db.select().from`، `db.select`، `desc`، `db.select({ total: sql<number>'count(*)::int' }).from(servers).where`، `db.select({ total: sql<number>'count(*)::int' }).from`، `res.json`، `res.status(500).json`

## POST `/api/servers`

- المصدر: server/routes.ts:3641
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requirePermission("asset_create")` → `inline handler`
- جداول مشار إليها مباشرة: `servers`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertServerSchema.parse`، `applicationIdListSchema.default([]).parse`، `applicationIdListSchema.default`، `hasActiveDropdownValue`، `res.status(400).json`، `res.status`، `db.transaction`، `tx.insert(servers).values(input).returning`، `tx.insert(servers).values`، `tx.insert`، `syncServerApplications`، `logAudit`، `res.status(201).json`، `res.status(409).json`، `res.status(500).json`

## PUT `/api/servers/:id`

- المصدر: server/routes.ts:3662
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requirePermission("asset_update")` → `inline handler`
- جداول مشار إليها مباشرة: `servers`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertServerSchema.partial().parse`، `insertServerSchema.partial`، `Object.prototype.hasOwnProperty.call`، `applicationIdListSchema.parse`، `hasActiveDropdownValue`، `res.status(400).json`، `res.status`، `db.select().from(servers).where`، `db.select().from`، `db.select`، `eq`، `res.status(404).json`، `db.transaction`، `tx.update(servers).set({ ...input, updatedAt: new Date() }) .where(eq(servers.id, req.params.id)).returning`، `tx.update(servers).set({ ...input, updatedAt: new Date() }) .where`، `tx.update(servers).set`، `tx.update`، `syncServerApplications`، `logAudit`، `res.json`، `res.status(409).json`، `res.status(500).json`

## GET `/api/servers/:id/applications`

- المصدر: server/routes.ts:3689
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requireAnyPermission("asset_update", "cmdb_view", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `application_server_links`، `cmdb_applications`، `servers`
- الاستدعاءات الظاهرة: `requireModule`، `requireAnyPermission`، `db.select({ id: servers.id }).from(servers).where`، `db.select({ id: servers.id }).from`، `db.select`، `eq`، `res.status(404).json`، `res.status`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, category: cmdbApplications.category, status: cmdbApplications.status, }).from(applicationServerLinks).innerJoin(cmdbApplications, eq(cmdbApplications.id, applicationServerLinks.applicationId)) .where(eq(applicationServerLinks.serverId, server.id)) .orderBy`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, category: cmdbApplications.category, status: cmdbApplications.status, }).from(applicationServerLinks).innerJoin(cmdbApplications, eq(cmdbApplications.id, applicationServerLinks.applicationId)) .where`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, category: cmdbApplications.category, status: cmdbApplications.status, }).from(applicationServerLinks).innerJoin`، `db.select({ id: cmdbApplications.id, name: cmdbApplications.name, category: cmdbApplications.category, status: cmdbApplications.status, }).from`، `asc`، `res.json`، `res.status(500).json`

## GET `/api/servers/:id/documents`

- المصدر: server/routes.ts:3967
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requirePermission("asset_update")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `listConfigurationDocuments`، `res.status(500).json`، `res.status`

## POST `/api/servers/:id/documents`

- المصدر: server/routes.ts:3971
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requirePermission("asset_update")` → `diskUpload.single("file")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `diskUpload.single`، `uploadConfigurationDocument`

## GET `/api/servers/:id/documents/:documentId`

- المصدر: server/routes.ts:3974
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("cmdb")` → `requirePermission("asset_update")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `downloadConfigurationDocument`، `res.status(500).json`، `res.status`

## GET `/api/service-catalog/approvals`

- المصدر: server/service-catalog.ts:169
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (_req, res, user) => { const roles = serviceApprovalRoles(user); if (!roles.length) throw new CatalogError(403, "Approver access required"); const rows = await db.select({ ...getTableColumns(serviceRequestsApprovals), requestNumber: serviceRequests.requestNumber,`
- جداول مشار إليها مباشرة: `roles`، `service_catalog_items`، `service_requests`، `service_requests_approvals`، `users`
- الاستدعاءات الظاهرة: `handle`، `serviceApprovalRoles`، `db.select({ ...getTableColumns(serviceRequestsApprovals), requestNumber: serviceRequests.requestNumber, title: serviceRequests.title, requesterName: sql<string>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', catalogTitle: serviceCatalogItems.title, description: serviceRequests.description, customFieldValues: serviceRequests.customFieldValues, catalogSchemaSnapshot: serviceRequests.catalogSchemaSnapshot, }).from(serviceRequestsApprovals) .innerJoin(serviceRequests, eq(serviceRequests.id, serviceRequestsApprovals.ticketId)) .innerJoin(users, eq(users.id, serviceRequests.requesterId)) .innerJoin(serviceCatalogItems, eq(serviceCatalogItems.id, serviceRequests.serviceCatalogItemId)) .where(and(eq(serviceRequestsApprovals.status, "Pending"), inArray(serviceRequestsApprovals.approverRole, roles), eq(serviceRequests.fulfillmentStage, "Pending Approval"), ne(serviceRequests.requesterId, user.id))) .orderBy`، `db.select({ ...getTableColumns(serviceRequestsApprovals), requestNumber: serviceRequests.requestNumber, title: serviceRequests.title, requesterName: sql<string>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', catalogTitle: serviceCatalogItems.title, description: serviceRequests.description, customFieldValues: serviceRequests.customFieldValues, catalogSchemaSnapshot: serviceRequests.catalogSchemaSnapshot, }).from(serviceRequestsApprovals) .innerJoin(serviceRequests, eq(serviceRequests.id, serviceRequestsApprovals.ticketId)) .innerJoin(users, eq(users.id, serviceRequests.requesterId)) .innerJoin(serviceCatalogItems, eq(serviceCatalogItems.id, serviceRequests.serviceCatalogItemId)) .where`، `db.select({ ...getTableColumns(serviceRequestsApprovals), requestNumber: serviceRequests.requestNumber, title: serviceRequests.title, requesterName: sql<string>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', catalogTitle: serviceCatalogItems.title, description: serviceRequests.description, customFieldValues: serviceRequests.customFieldValues, catalogSchemaSnapshot: serviceRequests.catalogSchemaSnapshot, }).from(serviceRequestsApprovals) .innerJoin(serviceRequests, eq(serviceRequests.id, serviceRequestsApprovals.ticketId)) .innerJoin(users, eq(users.id, serviceRequests.requesterId)) .innerJoin`، `db.select({ ...getTableColumns(serviceRequestsApprovals), requestNumber: serviceRequests.requestNumber, title: serviceRequests.title, requesterName: sql<string>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', catalogTitle: serviceCatalogItems.title, description: serviceRequests.description, customFieldValues: serviceRequests.customFieldValues, catalogSchemaSnapshot: serviceRequests.catalogSchemaSnapshot, }).from(serviceRequestsApprovals) .innerJoin(serviceRequests, eq(serviceRequests.id, serviceRequestsApprovals.ticketId)) .innerJoin`، `db.select({ ...getTableColumns(serviceRequestsApprovals), requestNumber: serviceRequests.requestNumber, title: serviceRequests.title, requesterName: sql<string>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', catalogTitle: serviceCatalogItems.title, description: serviceRequests.description, customFieldValues: serviceRequests.customFieldValues, catalogSchemaSnapshot: serviceRequests.catalogSchemaSnapshot, }).from(serviceRequestsApprovals) .innerJoin`، `db.select({ ...getTableColumns(serviceRequestsApprovals), requestNumber: serviceRequests.requestNumber, title: serviceRequests.title, requesterName: sql<string>'coalesce(nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), ''), ${users.username})', catalogTitle: serviceCatalogItems.title, description: serviceRequests.description, customFieldValues: serviceRequests.customFieldValues, catalogSchemaSnapshot: serviceRequests.catalogSchemaSnapshot, }).from`، `db.select`، `getTableColumns`، `eq`، `and`، `inArray`، `ne`، `asc`، `res.json`

## POST `/api/service-catalog/approvals/:id/decision`

- المصدر: server/service-catalog.ts:186
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (req, res, user) => { if (!serviceApprovalRoles(user).length) throw new CatalogError(403, "Approver access required"); const input = catalogDecisionInput.parse(req.body); const result = await db.transaction(async tx => { const [reference] = await tx.select({ ticketId:`
- جداول مشار إليها مباشرة: `catalog_items`، `service_request_activities`، `service_requests`، `service_requests_approvals`
- الاستدعاءات الظاهرة: `handle`، `serviceApprovalRoles`، `catalogDecisionInput.parse`، `db.transaction`، `tx.select({ ticketId: serviceRequestsApprovals.ticketId }) .from(serviceRequestsApprovals).where`، `tx.select({ ticketId: serviceRequestsApprovals.ticketId }) .from`، `tx.select`، `eq`، `tx.select().from(serviceRequests).where(eq(serviceRequests.id, reference.ticketId)).for`، `tx.select().from(serviceRequests).where`، `tx.select().from`، `tx.select().from(serviceRequestsApprovals).where(eq(serviceRequestsApprovals.id, req.params.id)).for`، `tx.select().from(serviceRequestsApprovals).where`، `serviceApprovalRoles(user).includes`، `tx.update(serviceRequestsApprovals).set({ status: input.decision, comments: input.comments, approverId: user.id, decidedAt: new Date(), }).where(eq(serviceRequestsApprovals.id, approval.id)).returning`، `tx.update(serviceRequestsApprovals).set({ status: input.decision, comments: input.comments, approverId: user.id, decidedAt: new Date(), }).where`، `tx.update(serviceRequestsApprovals).set`، `tx.update`، `tx.select({ fulfillmentTeam: catalogItems.fulfillmentTeam }).from(catalogItems).where`، `tx.select({ fulfillmentTeam: catalogItems.fulfillmentTeam }).from`، `tx.update(serviceRequests).set({ approvalStatus: input.decision.toLowerCase(), fulfillmentStage: input.decision, fulfillmentStatus: input.decision, assignmentGroup: input.decision === "Approved" ? legacy?.fulfillmentTeam ?? null : null, updatedAt: new Date(), }).where`، `tx.update(serviceRequests).set`، `input.decision.toLowerCase`، `tx.insert(serviceRequestActivities).values`، `tx.insert`، `audit`، `res.json`

## GET `/api/service-catalog/items`

- المصدر: server/service-catalog.ts:118
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (req, res, user) => { const includeInactive = req.query.includeInactive === "true" && canManageServiceCatalog(user); res.json(await db.select({ ...getTableColumns(serviceCatalogItems), consumableId: catalogItems.consumableId, fulfillmentTeam: catalogItems.fulfillmentTeam })`
- جداول مشار إليها مباشرة: `catalog_items`، `service_catalog_items`
- الاستدعاءات الظاهرة: `handle`، `canManageServiceCatalog`، `res.json`، `db.select({ ...getTableColumns(serviceCatalogItems), consumableId: catalogItems.consumableId, fulfillmentTeam: catalogItems.fulfillmentTeam }) .from(serviceCatalogItems).innerJoin(catalogItems, eq(catalogItems.id, serviceCatalogItems.id)) .where(includeInactive ? undefined : eq(serviceCatalogItems.status, "Active")).orderBy`، `db.select({ ...getTableColumns(serviceCatalogItems), consumableId: catalogItems.consumableId, fulfillmentTeam: catalogItems.fulfillmentTeam }) .from(serviceCatalogItems).innerJoin(catalogItems, eq(catalogItems.id, serviceCatalogItems.id)) .where`، `db.select({ ...getTableColumns(serviceCatalogItems), consumableId: catalogItems.consumableId, fulfillmentTeam: catalogItems.fulfillmentTeam }) .from(serviceCatalogItems).innerJoin`، `db.select({ ...getTableColumns(serviceCatalogItems), consumableId: catalogItems.consumableId, fulfillmentTeam: catalogItems.fulfillmentTeam }) .from`، `db.select`، `getTableColumns`، `eq`

## GET `/api/service-catalog/items/:id`

- المصدر: server/service-catalog.ts:124
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (req, res, user) => { const [item] = await db.select({ ...getTableColumns(serviceCatalogItems), consumableId: catalogItems.consumableId, fulfillmentTeam: catalogItems.fulfillmentTeam }) .from(serviceCatalogItems).innerJoin(catalogItems, eq(catalogItems.id, serviceCatalogItems.`
- جداول مشار إليها مباشرة: `catalog_items`، `service_catalog_items`
- الاستدعاءات الظاهرة: `handle`، `db.select({ ...getTableColumns(serviceCatalogItems), consumableId: catalogItems.consumableId, fulfillmentTeam: catalogItems.fulfillmentTeam }) .from(serviceCatalogItems).innerJoin(catalogItems, eq(catalogItems.id, serviceCatalogItems.id)).where`، `db.select({ ...getTableColumns(serviceCatalogItems), consumableId: catalogItems.consumableId, fulfillmentTeam: catalogItems.fulfillmentTeam }) .from(serviceCatalogItems).innerJoin`، `db.select({ ...getTableColumns(serviceCatalogItems), consumableId: catalogItems.consumableId, fulfillmentTeam: catalogItems.fulfillmentTeam }) .from`، `db.select`، `getTableColumns`، `eq`، `canManageServiceCatalog`، `res.json`

## POST `/api/service-catalog/items/:id/request`

- المصدر: server/service-catalog.ts:168
- سلسلة الوسطاء/المعالج: `requireAuth` → `catalogRequestHandler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## GET `/api/service-catalog/options`

- المصدر: server/service-catalog.ts:112
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (_req, res, user) => { const categories = await db.select({ value: dropdownOptions.value, label: dropdownOptions.label }) .from(dropdownOptions).where(and(eq(dropdownOptions.category, "service_category"), eq(dropdownOptions.isActive, true))) .orderBy(dropdownOptions.disp`
- جداول مشار إليها مباشرة: `dropdown_options`
- الاستدعاءات الظاهرة: `handle`، `db.select({ value: dropdownOptions.value, label: dropdownOptions.label }) .from(dropdownOptions).where(and(eq(dropdownOptions.category, "service_category"), eq(dropdownOptions.isActive, true))) .orderBy`، `db.select({ value: dropdownOptions.value, label: dropdownOptions.label }) .from(dropdownOptions).where`، `db.select({ value: dropdownOptions.value, label: dropdownOptions.label }) .from`، `db.select`، `and`، `eq`، `res.json`، `canManageServiceCatalog`، `serviceApprovalRoles`

## GET `/api/service-requests`

- المصدر: server/routes.ts:1695
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `catalog_items`، `employees`، `projects`، `users`
- الاستدعاءات الظاهرة: `requireModule`، `storage.getServiceRequests`، `canViewAllItsmRecords`، `loadCatalogViewer`، `serviceApprovalRoles`، `(canViewAll ? rows : rows.filter(row => row.requesterId === req.user.id)) .filter`، `rows.filter`، `Promise.all`، `isFeatureEnabled("project_management").then`، `isFeatureEnabled`، `db.select({ id: projects.id, name: projects.name }).from`، `db.select`، `db.select({ id: users.id, username: users.username, firstName: users.firstName, lastName: users.lastName, email: users.email }).from`، `db.select({ id: catalogItems.id, name: catalogItems.name, consumableId: catalogItems.consumableId }).from`، `isFeatureEnabled("asset_management").then`، `db.select({ email: employees.email, phone: employees.phone, mobile: employees.mobile }).from`، `projectRows.map`، `userRows.map`، `[user.firstName, user.lastName].filter(Boolean).join`، `[user.firstName, user.lastName].filter`، `employeeRows.map`، `employee.email.toLowerCase`، `catalogRows.map`، `res.json`، `visible.map`، `projectNames.get`، `catalogNames.get`، `catalogConsumables.get`، `userDetails.get`، `employeeContacts.get`، `userDetails.get(row.requesterId)?.email.toLowerCase`، `res.status(500).json`، `res.status`

## POST `/api/service-requests`

- المصدر: server/routes.ts:1825
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `projects`، `service_request_activities`
- الاستدعاءات الظاهرة: `requireModule`، `isStructuredCatalogItem`، `res.status(400).json`، `res.status`، `canViewAllItsmRecords`، `storage.getUser`، `insertServiceRequestSchema.parse`، `Number.isFinite`، `isFeatureEnabled`، `sendFeatureNotEnabled`، `db.select({ id: projects.id }).from(projects).where`، `db.select({ id: projects.id }).from`، `db.select`، `eq`، `storage.createServiceRequest`، `db.insert(serviceRequestActivities).values`، `db.insert`، `res.status(201).json`، `res.status(500).json`

## GET `/api/service-requests/:id`

- المصدر: server/routes.ts:1738
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `(await storage.getServiceRequests()).find`، `storage.getServiceRequests`، `res.status(404).json`، `res.status`، `canViewAllItsmRecords`، `res.status(403).json`، `res.json`، `res.status(500).json`

## PUT `/api/service-requests/:id`

- المصدر: server/routes.ts:2038
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("ticket_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `catalog_items`، `projects`، `service_request_activities`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertServiceRequestSchema.partial().omit({ requesterId: true, creatorId: true, completedAt: true, serviceCatalogItemId: true, customFieldValues: true, catalogSchemaSnapshot: true }).parse`، `insertServiceRequestSchema.partial().omit`، `insertServiceRequestSchema.partial`، `isFeatureEnabled`، `sendFeatureNotEnabled`، `db.select({ id: projects.id }).from(projects).where`، `db.select({ id: projects.id }).from`، `db.select`، `eq`، `res.status(400).json`، `res.status`، `Number.isFinite`، `["Submitted", "Approved", "Fulfilling", "Completed", "Rejected"].includes`، `["Submitted", "Pending Approval", "Approved", "In Procurement", "Ready for Delivery", "Completed", "Rejected"].includes`، `["pending", "approved", "rejected"].includes`، `(await storage.getServiceRequests()).find`، `storage.getServiceRequests`، `res.status(404).json`، `catalogMutationError`، `res.status(409).json`، `db.select({ consumableId: catalogItems.consumableId }).from(catalogItems).where`، `db.select({ consumableId: catalogItems.consumableId }).from`، `storage.updateServiceRequest`، `db.insert(serviceRequestActivities).values`، `db.insert`، `res.json`، `res.status(500).json`

## GET `/api/service-requests/:id/activity`

- المصدر: server/routes.ts:1805
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `service_request_activities`، `users`
- الاستدعاءات الظاهرة: `requireModule`، `(await storage.getServiceRequests()).find`، `storage.getServiceRequests`، `res.status(404).json`، `res.status`، `canViewAllItsmRecords`، `res.status(403).json`، `db.select({ id: serviceRequestActivities.id, action: serviceRequestActivities.action, details: serviceRequestActivities.details, createdAt: serviceRequestActivities.createdAt, actorName: users.username, }).from(serviceRequestActivities) .leftJoin(users, eq(users.id, serviceRequestActivities.actorId)) .where`، `db.select({ id: serviceRequestActivities.id, action: serviceRequestActivities.action, details: serviceRequestActivities.details, createdAt: serviceRequestActivities.createdAt, actorName: users.username, }).from(serviceRequestActivities) .leftJoin`، `db.select({ id: serviceRequestActivities.id, action: serviceRequestActivities.action, details: serviceRequestActivities.details, createdAt: serviceRequestActivities.createdAt, actorName: users.username, }).from`، `db.select`، `eq`، `res.json`، `res.status(500).json`

## PATCH `/api/service-requests/:id/approval`

- المصدر: server/routes.ts:1869
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("ticket_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `service_request_activities`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `z.object({ decision: z.enum(["approved", "rejected"]) }).parse`، `z.object`، `z.enum`، `(await storage.getServiceRequests()).find`، `storage.getServiceRequests`، `res.status(404).json`، `res.status`، `res.status(409).json`، `storage.updateServiceRequest`، `db.insert(serviceRequestActivities).values`، `db.insert`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## PATCH `/api/service-requests/:id/assignment`

- المصدر: server/routes.ts:1890
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("ticket_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `service_request_activities`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `z.object({ assignmentGroup: z.string().trim().max(120).nullable().optional(), assigneeId: z.string().uuid().nullable().optional(), }).parse`، `z.object`، `z.string().trim().max(120).nullable().optional`، `z.string().trim().max(120).nullable`، `z.string().trim().max`، `z.string().trim`، `z.string`، `z.string().uuid().nullable().optional`، `z.string().uuid().nullable`، `z.string().uuid`، `(await storage.getServiceRequests()).find`، `storage.getServiceRequests`، `res.status(404).json`، `res.status`، `storage.getUser`، `res.status(400).json`، `storage.updateServiceRequest`، `db.insert(serviceRequestActivities).values`، `db.insert`، `logAudit`، `res.json`، `res.status(500).json`

## GET `/api/service-requests/:id/attachments`

- المصدر: server/routes.ts:3707
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `ticket_attachments`
- الاستدعاءات الظاهرة: `requireModule`، `(await storage.getServiceRequests()).find`، `storage.getServiceRequests`، `res.status(404).json`، `res.status`، `canViewAllItsmRecords`، `res.status(403).json`، `db.select().from(ticketAttachments).where`، `db.select().from`، `db.select`، `eq`، `res.json`، `rows.map`، `res.status(500).json`

## POST `/api/service-requests/:id/attachments`

- المصدر: server/routes.ts:3721
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler` → `diskUpload.single("file")` → `inline handler`
- جداول مشار إليها مباشرة: `service_request_activities`، `ticket_attachments`
- الاستدعاءات الظاهرة: `requireModule`، `(await storage.getServiceRequests()).find`، `storage.getServiceRequests`، `res.status(404).json`، `res.status`، `canManageAllTickets`، `res.status(403).json`، `next`، `res.status(500).json`، `diskUpload.single`، `res.status(400).json`، `insertTicketAttachmentSchema.parse`، `db.insert(ticketAttachments).values(values).returning`، `db.insert(ticketAttachments).values`، `db.insert`، `db.insert(serviceRequestActivities).values`، `res.status(201).json`، `import`، `fs.unlinkSync`

## GET `/api/service-requests/:id/attachments/:attachId`

- المصدر: server/routes.ts:3768
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `inline handler`
- جداول مشار إليها مباشرة: `ticket_attachments`
- الاستدعاءات الظاهرة: `requireModule`، `(await storage.getServiceRequests()).find`، `storage.getServiceRequests`، `res.status(404).json`، `res.status`، `canViewAllItsmRecords`، `res.status(403).json`، `db.select().from(ticketAttachments).where`، `db.select().from`، `db.select`، `and`، `eq`، `res.download`، `res.status(500).json`

## GET `/api/service-requests/:id/catalog-approval`

- المصدر: server/service-catalog.ts:216
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (req, res, user) => { const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, req.params.id)); if (!request) throw new CatalogError(404, "Service request not found"); if (request.requesterId !== user.id && !user.permissions.includes("ticket_man`
- جداول مشار إليها مباشرة: `permissions`، `service_requests`، `service_requests_approvals`، `users`
- الاستدعاءات الظاهرة: `handle`، `db.select().from(serviceRequests).where`، `db.select().from`، `db.select`، `eq`، `user.permissions.includes`، `canManageServiceCatalog`، `db.select({ ...getTableColumns(serviceRequestsApprovals), approverName: users.username, }).from(serviceRequestsApprovals).leftJoin(users, eq(users.id, serviceRequestsApprovals.approverId)) .where`، `db.select({ ...getTableColumns(serviceRequestsApprovals), approverName: users.username, }).from(serviceRequestsApprovals).leftJoin`، `db.select({ ...getTableColumns(serviceRequestsApprovals), approverName: users.username, }).from`، `getTableColumns`، `res.json`

## PATCH `/api/service-requests/:id/close`

- المصدر: server/routes.ts:1848
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("ticket_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `service_request_activities`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `z.object({ closureNote: z.string().trim().min(1).max(4000) }).parse`، `z.object`، `z.string().trim().min(1).max`، `z.string().trim().min`، `z.string().trim`، `z.string`، `(await storage.getServiceRequests()).find`، `storage.getServiceRequests`، `res.status(404).json`، `res.status`، `["Completed", "Cancelled", "Rejected"].includes`، `res.status(409).json`، `storage.updateServiceRequest`، `db.insert(serviceRequestActivities).values`، `db.insert`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## GET `/api/service-requests/:id/consumable-options`

- المصدر: server/routes.ts:1751
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requireModule("asset_management")` → `requirePermission("ticket_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `catalog_items`، `consumable_dispatch_log`، `consumables`، `users`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `(await storage.getServiceRequests()).find`، `storage.getServiceRequests`، `res.status(404).json`، `res.status`، `res.json`، `db.select().from(catalogItems).where`، `db.select().from`، `db.select`، `eq`، `db.select().from(consumables).where`، `db.select({ id: consumables.id, name: consumables.name, modelPartNumber: consumables.modelPartNumber, quantityInStock: consumables.quantityInStock, warehouseLocationId: consumables.warehouseLocationId, warehouseName: warehouseLocations.name, warehouseCode: warehouseLocations.code, storageRoom: warehouseLocations.storageRoom, }).from(consumables) .innerJoin(warehouseLocations, eq(warehouseLocations.id, consumables.warehouseLocationId)) .where`، `db.select({ id: consumables.id, name: consumables.name, modelPartNumber: consumables.modelPartNumber, quantityInStock: consumables.quantityInStock, warehouseLocationId: consumables.warehouseLocationId, warehouseName: warehouseLocations.name, warehouseCode: warehouseLocations.code, storageRoom: warehouseLocations.storageRoom, }).from(consumables) .innerJoin`، `db.select({ id: consumables.id, name: consumables.name, modelPartNumber: consumables.modelPartNumber, quantityInStock: consumables.quantityInStock, warehouseLocationId: consumables.warehouseLocationId, warehouseName: warehouseLocations.name, warehouseCode: warehouseLocations.code, storageRoom: warehouseLocations.storageRoom, }).from`، `and`، `stock.filter`، `item.name.toLocaleLowerCase`، `master.name.toLocaleLowerCase`، `(item.modelPartNumber ?? "").toLocaleLowerCase`، `(master.modelPartNumber ?? "").toLocaleLowerCase`، `db.select({ id: consumableDispatchLog.id, quantity: consumableDispatchLog.quantity, dispatchedAt: consumableDispatchLog.dispatchedAt, requesterId: consumableDispatchLog.requesterId, agentId: consumableDispatchLog.agentId, warehouseName: warehouseLocations.name, consumableName: consumables.name, }).from(consumableDispatchLog) .innerJoin(warehouseLocations, eq(warehouseLocations.id, consumableDispatchLog.warehouseLocationId)) .innerJoin(consumables, eq(consumables.id, consumableDispatchLog.consumableId)) .where`، `db.select({ id: consumableDispatchLog.id, quantity: consumableDispatchLog.quantity, dispatchedAt: consumableDispatchLog.dispatchedAt, requesterId: consumableDispatchLog.requesterId, agentId: consumableDispatchLog.agentId, warehouseName: warehouseLocations.name, consumableName: consumables.name, }).from(consumableDispatchLog) .innerJoin(warehouseLocations, eq(warehouseLocations.id, consumableDispatchLog.warehouseLocationId)) .innerJoin`، `db.select({ id: consumableDispatchLog.id, quantity: consumableDispatchLog.quantity, dispatchedAt: consumableDispatchLog.dispatchedAt, requesterId: consumableDispatchLog.requesterId, agentId: consumableDispatchLog.agentId, warehouseName: warehouseLocations.name, consumableName: consumables.name, }).from(consumableDispatchLog) .innerJoin`، `db.select({ id: consumableDispatchLog.id, quantity: consumableDispatchLog.quantity, dispatchedAt: consumableDispatchLog.dispatchedAt, requesterId: consumableDispatchLog.requesterId, agentId: consumableDispatchLog.agentId, warehouseName: warehouseLocations.name, consumableName: consumables.name, }).from`، `db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username }) .from(users).where`، `db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username }) .from`، `inArray`، `people.map`، `[person.firstName, person.lastName].filter(Boolean).join`، `[person.firstName, person.lastName].filter`، `names.get`، `res.status(500).json`

## POST `/api/service-requests/:id/fulfill-consumable`

- المصدر: server/routes.ts:1959
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requireModule("asset_management")` → `requirePermission("ticket_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `catalog_items`، `consumable_dispatch_log`، `consumable_stock_movements`، `consumables`، `service_request_activities`، `service_requests`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `z.object({ warehouseLocationId: z.string().uuid() }).parse`، `z.object`، `z.string().uuid`، `z.string`، `db.transaction`، `tx.select().from(serviceRequests).where(eq(serviceRequests.id, req.params.id)).for`، `tx.select().from(serviceRequests).where`، `tx.select().from`، `tx.select`، `eq`، `Object.assign`، `tx.select({ id: warehouseLocations.id }).from(warehouseLocations) .where(and(eq(warehouseLocations.id, warehouseLocationId), eq(warehouseLocations.isActive, true))).for`، `tx.select({ id: warehouseLocations.id }).from(warehouseLocations) .where`، `tx.select({ id: warehouseLocations.id }).from`، `and`، `tx.select().from(catalogItems).where`، `tx.select({ id: consumableDispatchLog.id }).from(consumableDispatchLog) .where`، `tx.select({ id: consumableDispatchLog.id }).from`، `tx.select().from(consumables).where`، `tx.select().from(consumables) .where(eq(consumables.warehouseLocationId, warehouseLocationId)).for`، `tx.select().from(consumables) .where`، `locationStock.find`، `row.name.toLocaleLowerCase`، `catalogStock.name.toLocaleLowerCase`، `(row.modelPartNumber ?? "").toLocaleLowerCase`، `(catalogStock.modelPartNumber ?? "").toLocaleLowerCase`، `tx.update(consumables).set({ quantityInStock: stock.quantityInStock - quantity, updatedAt: now, }).where(eq(consumables.id, stock.id)).returning`، `tx.update(consumables).set({ quantityInStock: stock.quantityInStock - quantity, updatedAt: now, }).where`، `tx.update(consumables).set`، `tx.update`، `tx.insert(consumableDispatchLog).values({ consumableId: stock.id, warehouseLocationId, serviceRequestId: request.id, serviceRequestNumber: request.requestNumber, requesterId: request.requesterId, agentId: req.user.id, quantity, dispatchedAt: now, }).returning`، `tx.insert(consumableDispatchLog).values`، `tx.insert`، `tx.insert(consumableStockMovements).values`، `tx.update(serviceRequests).set({ fulfillmentStage: "Completed", fulfillmentStatus: "Completed", completedAt: now, }).where(eq(serviceRequests.id, request.id)).returning`، `tx.update(serviceRequests).set({ fulfillmentStage: "Completed", fulfillmentStatus: "Completed", completedAt: now, }).where`، `tx.update(serviceRequests).set`، `tx.insert(serviceRequestActivities).values`، `res.json`، `res.status(400).json`، `res.status`، `res.status(status).json`، `res.status(500).json`

## PATCH `/api/service-requests/:id/stage`

- المصدر: server/routes.ts:1917
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("itsm")` → `requirePermission("ticket_manage")` → `inline handler`
- جداول مشار إليها مباشرة: `assets`، `catalog_items`، `service_request_activities`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `z.object({ stage: z.enum(["Submitted", "Pending Approval", "Approved", "In Procurement", "Ready for Delivery", "Completed", "Rejected"]), fulfilledAssetId: z.string().uuid().nullable().optional(), }).parse`، `z.object`، `z.enum`، `z.string().uuid().nullable().optional`، `z.string().uuid().nullable`، `z.string().uuid`، `z.string`، `(await storage.getServiceRequests()).find`، `storage.getServiceRequests`، `res.status(404).json`، `res.status`، `catalogMutationError`، `res.status(409).json`، `["In Procurement", "Ready for Delivery", "Completed"].includes`، `db.select({ consumableId: catalogItems.consumableId }).from(catalogItems).where`، `db.select({ consumableId: catalogItems.consumableId }).from`، `db.select`، `eq`، `isFeatureEnabled`، `sendFeatureNotEnabled`، `db.select({ id: assets.id, status: assets.status }).from(assets).where`، `db.select({ id: assets.id, status: assets.status }).from`، `storage.updateServiceRequest`، `db.insert(serviceRequestActivities).values`، `db.insert`، `logAudit`، `res.json`، `res.status(400).json`، `error.message.includes`، `res.status(500).json`

## GET `/api/settings/:key`

- المصدر: server/routes.ts:9028
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getSetting`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/settings/:key`

- المصدر: server/routes.ts:9040
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `res.status(400).json`، `res.status`، `storage.updateSetting`، `res.json`، `res.status(500).json`

## GET `/api/sla-policies`

- المصدر: server/routes.ts:9937
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getSlaPolicies`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/sla-policies`

- المصدر: server/routes.ts:9946
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.createSlaPolicy`، `res.status(201).json`، `res.status`، `res.status(500).json`

## DELETE `/api/sla-policies/:id`

- المصدر: server/routes.ts:9965
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.deleteSlaPolicy`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/sla-policies/:id`

- المصدر: server/routes.ts:9955
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.updateSlaPolicy`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## GET `/api/system-settings`

- المصدر: server/routes.ts:2855
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('system_admin')` → `inline handler`
- جداول مشار إليها مباشرة: `settings`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getSystemSettings`، `allSettings.find`، `parseInt`، `res.json`، `res.status(500).json`، `res.status`

## PUT `/api/system-settings`

- المصدر: server/routes.ts:2872
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('system_admin')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `z.object({ assetIdPrefix: z.string().min(1).max(10), assetIdStartingNumber: z.number().int().min(1), dateFormat: z.literal("DD-MM-YYYY") }).parse`، `z.object`، `z.string().min(1).max`، `z.string().min`، `z.string`، `z.number().int().min`، `z.number().int`، `z.number`، `z.literal`، `storage.updateSystemSetting`، `validatedData.assetIdStartingNumber.toString`، `res.json`، `res.status(400).json`، `res.status`، `res.status(500).json`

## POST `/api/system/clear-data`

- المصدر: server/system-clear-data-route.ts:19
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAdmin` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `res.status(400).json`، `res.status`، `res.status(401).json`، `storage.getUser`، `res.status(403).json`، `comparePasswords`، `storage.clearAllData`، `req.get("user-agent")?.slice`، `req.get`، `res.status(500).json`، `res.json`، `new Date().toISOString`، `console.error`

## USE `/api/system/clear-data`

- المصدر: server/index.ts:58
- سلسلة الوسطاء/المعالج: `clearSystemDataRateLimit`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: 

## POST `/api/system/seed-data`

- المصدر: server/routes.ts:2946
- سلسلة الوسطاء/المعالج: `inline handler`
- جداول مشار إليها مباشرة: `permissions`، `roles`، `system_settings`، `users`
- الاستدعاءات الظاهرة: `import`، `storage.getUsers`، `res.status(400).json`، `res.status`، `Array.from`، `(await storage.getPermissions()).map`، `storage.getPermissions`، `existingPermissionMap.get`، `storage.createPermission`، `createdPermissions.set`، `Array.from(createdPermissions.values()).map`، `createdPermissions.values`، `[ 'asset_view', 'asset_create', 'asset_update', 'asset_delete', 'compliance_view', 'employee_create', 'employee_update', 'employee_delete', 'assignment_create', 'assignment_update', 'assignment_delete', 'assignment_return', 'location_create', 'location_update', 'location_delete', 'department_create', 'department_update', 'department_delete', 'vendor_create', 'vendor_update', 'vendor_delete', 'purchase_order_create', 'purchase_order_update', 'purchase_order_delete', 'budget_create', 'budget_update', 'budget_delete', 'maintenance_create', 'maintenance_update', 'maintenance_delete' ].map`، `createdPermissions.get`، `[ 'asset_view', 'asset_create', 'asset_update', 'compliance_view', 'employee_create', 'employee_update', 'assignment_create', 'assignment_update', 'assignment_return', 'location_create', 'location_update', 'department_create', 'department_update', 'maintenance_create', 'maintenance_update' ].map`، `[ 'compliance_view' ].map`، `storage.createRole`، `createdRoles.set`، `storage.assignRolePermission`، `hashPassword`، `storage.createUser`، `createdRoles.get`، `storage.assignUserRole`، `ensurePersonaRoles`، `storage.createSystemSetting`، `console.log`، `new Date().toISOString`، `res.json`، `console.error`، `res.status(500).json`

## POST `/api/system/seed-itsm`

- المصدر: server/routes.ts:11340
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `catalog_items`، `changes`، `kb_articles`، `problems`، `tickets`، `users`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getUsers`، `res.status(400).json`، `res.status`، `users.find`، `createdCatalogItems.push`، `storage.createCatalogItem`، `storage.createKbArticle`، `now.getTime`، `storage.createTicket`، `createdTickets.push`، `[createdTickets[3]?.id, createdTickets[4]?.id, createdTickets[6]?.id, createdTickets[10]?.id].filter`، `storage.updateTicket`، `createdProblems.push`، `storage.createProblem`، `storage.linkIncidentToProblem`، `console.error`، `daysAgo`، `createdChanges.push`، `storage.createChange`، `storage.createChangeApproval`، `res.json`، `res.status(500).json`، `String`

## GET `/api/system/status`

- المصدر: server/routes.ts:2929
- سلسلة الوسطاء/المعالج: `inline handler`
- جداول مشار إليها مباشرة: `users`
- الاستدعاءات الظاهرة: `storage.getUsers`، `res.json`، `console.error`، `res.status(500).json`، `res.status`

## GET `/api/system/update-check`

- المصدر: server/routes.ts:2910
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `process.env.UPDATE_AVAILABLE_VERSION?.trim`، `compareAppVersions`، `res.json`، `new Date().toISOString`، `res.status(500).json`، `res.status`

## GET `/api/system/version`

- المصدر: server/routes.ts:2896
- سلسلة الوسطاء/المعالج: `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getModuleSettings`، `new Date().toISOString`، `res.json`، `modules.filter((module) => module.enabled).map`، `modules.filter`، `res.status(500).json`، `res.status`

## GET `/api/tickets`

- المصدر: server/routes.ts:2379
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `canManageAllTickets`، `res.status(403).json`، `res.status`، `res.json`، `storage.getTickets`، `res.status(500).json`

## POST `/api/tickets`

- المصدر: server/routes.ts:2448
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `requirePermission('ticket_manage')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertTicketSchema.parse`، `storage.createTicket`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## USE `/api/tickets`

- المصدر: server/routes.ts:2372
- سلسلة الوسطاء/المعالج: `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `["POST", "PUT", "PATCH", "DELETE"].includes`، `res.status(410).json`، `res.status`، `next`

## DELETE `/api/tickets/:id`

- المصدر: server/routes.ts:2581
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `requirePermission('ticket_manage')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `storage.getTicket`، `res.status(404).json`، `res.status`، `storage.deleteTicket`، `logAudit`، `res.json`، `res.status(500).json`

## GET `/api/tickets/:id`

- المصدر: server/routes.ts:2433
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getTicket`، `res.status(404).json`، `res.status`، `canManageAllTickets`، `res.status(403).json`، `res.json`، `res.status(500).json`

## PUT `/api/tickets/:id`

- المصدر: server/routes.ts:2461
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getTicket`، `res.status(404).json`، `res.status`، `canManageTicket`، `res.status(403).json`، `["open", "in_progress", "resolved", "closed"].includes`، `res.status(400).json`، `insertTicketSchema.partial().parse`، `insertTicketSchema.partial`، `storage.updateTicket`، `logAudit`، `res.json`، `res.status(500).json`

## GET `/api/tickets/:id/attachments`

- المصدر: server/routes.ts:3980
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: `ticket_attachments`
- الاستدعاءات الظاهرة: `requireModule`، `storage.getTicket`، `res.status(404).json`، `res.status`، `canManageAllTickets`، `res.status(403).json`، `db.select().from(ticketAttachments).where`، `db.select().from`، `db.select`، `eq`، `res.json`، `console.error`، `res.status(500).json`

## POST `/api/tickets/:id/attachments`

- المصدر: server/routes.ts:3997
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler` → `diskUpload.single('file')` → `inline handler`
- جداول مشار إليها مباشرة: `ticket_attachments`
- الاستدعاءات الظاهرة: `requireModule`، `storage.getTicket`، `res.status(404).json`، `res.status`، `canManageAllTickets`، `res.status(403).json`، `next`، `res.status(500).json`، `diskUpload.single`، `res.status(400).json`، `insertTicketAttachmentSchema.parse`، `db.insert(ticketAttachments).values(validatedData).returning`، `db.insert(ticketAttachments).values`، `db.insert`، `logAudit`، `res.status(201).json`، `console.error`

## DELETE `/api/tickets/:id/attachments/:attachId`

- المصدر: server/routes.ts:4039
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: `ticket_attachments`
- الاستدعاءات الظاهرة: `requireModule`، `storage.getTicket`، `res.status(404).json`، `res.status`، `canManageTicket`، `res.status(403).json`، `db.delete(ticketAttachments) .where(and(eq(ticketAttachments.id, req.params.attachId), eq(ticketAttachments.ticketId, req.params.id))) .returning`، `db.delete(ticketAttachments) .where`، `db.delete`، `and`، `eq`، `import`، `fs.unlinkSync`، `logAudit`، `res.status(204).send`، `console.error`، `res.status(500).json`

## POST `/api/tickets/:id/cancel-request`

- المصدر: server/routes.ts:2526
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getTicket`، `res.status(404).json`، `res.status`، `res.status(403).json`، `["open", "in_progress", "resolved"].includes`، `res.status(400).json`، `z.object({ reason: z.string().trim().max(2000).optional() }).parse`، `z.object`، `z.string().trim().max(2000).optional`، `z.string().trim().max`، `z.string().trim`، `z.string`، `storage.cancelTicketForRequester`، `res.status(409).json`، `logAudit`، `res.json`، `res.status(500).json`

## POST `/api/tickets/:id/close-request`

- المصدر: server/routes.ts:2506
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getTicket`، `res.status(404).json`، `res.status`، `res.status(403).json`، `res.status(400).json`، `storage.updateTicket`، `logAudit`، `res.json`، `res.status(500).json`

## GET `/api/tickets/:id/comments`

- المصدر: server/routes.ts:2594
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getTicket`، `res.status(404).json`، `res.status`، `canManageAllTickets`، `res.status(403).json`، `storage.getTicketComments`، `res.json`، `comments.filter`، `res.status(500).json`

## POST `/api/tickets/:id/comments`

- المصدر: server/routes.ts:2611
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getTicket`، `res.status(404).json`، `res.status`، `canManageAllTickets`، `res.status(403).json`، `canManageTicket`، `insertTicketCommentSchema.parse`، `storage.createTicketComment`، `logAudit`، `res.status(201).json`، `res.status(400).json`، `res.status(500).json`

## POST `/api/tickets/:id/reopen-request`

- المصدر: server/routes.ts:2553
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getTicket`، `res.status(404).json`، `res.status`، `res.status(403).json`، `["resolved", "closed"].includes`، `res.status(400).json`، `z.object({ reason: z.string().trim().min(5).max(2000) }).parse`، `z.object`، `z.string().trim().min(5).max`، `z.string().trim().min`، `z.string().trim`، `z.string`، `storage.updateTicket`، `storage.createTicketComment`، `logAudit`، `res.json`، `res.status(500).json`

## GET `/api/tickets/my-assigned`

- المصدر: server/routes.ts:2391
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getTickets`، `res.json`، `all.filter`، `res.status(500).json`، `res.status`

## GET `/api/tickets/my-requests`

- المصدر: server/routes.ts:2401
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `storage.getTickets`، `res.json`، `all.filter`، `res.status(500).json`، `res.status`

## POST `/api/tickets/my-requests`

- المصدر: server/routes.ts:2411
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule('itsm')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `insertTicketSchema.parse`، `storage.createTicket`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## GET `/api/uploads/:filename`

- المصدر: server/routes.ts:4063
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `asset_attachments`، `ticket_attachments`
- الاستدعاءات الظاهرة: `import`، `path.basename`، `filename.startsWith`، `res.status(400).json`، `res.status`، `db.select().from(ticketAttachments).where(eq(ticketAttachments.fileName, filename)).limit`، `db.select().from(ticketAttachments).where`، `db.select().from`، `db.select`، `eq`، `db.select().from(assetAttachments).where(eq(assetAttachments.fileName, filename)).limit`، `db.select().from(assetAttachments).where`، `res.status(404).json`، `storage.getTicket`، `canManageAllTickets`، `path.join`، `process.cwd`، `filePath.startsWith`، `res.status(403).json`، `fs.existsSync`، `res.setHeader`، `res.download`

## GET `/api/user`

- المصدر: server/auth.ts:176
- سلسلة الوسطاء/المعالج: `inline handler`
- جداول مشار إليها مباشرة: `permissions`، `roles`
- الاستدعاءات الظاهرة: `req.isAuthenticated`، `res.sendStatus`، `storage.getUserRoles`، `storage.getUserPermissions`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/users`

- المصدر: server/routes.ts:753
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('user_view')` → `inline handler`
- جداول مشار إليها مباشرة: `users`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getUsersWithDetails`، `users.map`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/users`

- المصدر: server/routes.ts:778
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('user_create')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertUserSchema.parse`، `hashPassword`، `storage.createUser`، `logAudit`، `res.status(201).json`، `res.status`، `console.error`، `res.status(400).json`، `res.status(500).json`

## DELETE `/api/users/:id`

- المصدر: server/routes.ts:872
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('user_delete')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getUser`، `storage.deleteUser`، `res.status(404).json`، `res.status`، `logAudit`، `res.status(204).send`، `res.status(500).json`

## GET `/api/users/:id`

- المصدر: server/routes.ts:764
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('user_view')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getUser`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/users/:id`

- المصدر: server/routes.ts:804
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('user_update')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertUserSchema.partial().parse`، `insertUserSchema.partial`، `storage.getUser`، `hashPassword`، `withUserSessionLock`، `invalidateUserSessions`، `/^[A-Za-z][A-Za-z0-9]{0,63}$/.test`، `/^[A-Z0-9]{5}$/.test`، `console.error`، `storage.updateUser`، `res.status(404).json`، `res.status`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## GET `/api/users/:id/permissions`

- المصدر: server/routes.ts:2845
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('user_view')` → `inline handler`
- جداول مشار إليها مباشرة: `permissions`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getUserPermissions`، `res.json`، `res.status(500).json`، `res.status`

## GET `/api/users/:id/roles`

- المصدر: server/routes.ts:2836
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('user_view')` → `inline handler`
- جداول مشار إليها مباشرة: `roles`
- الاستدعاءات الظاهرة: `requirePermission`، `storage.getUserRoles`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/users/:userId/roles`

- المصدر: server/routes.ts:2802
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('user_role_assign')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `insertUserRoleSchema.parse`، `storage.assignUserRole`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(500).json`

## DELETE `/api/users/:userId/roles/:roleId`

- المصدر: server/routes.ts:2823
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('user_role_assign')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `storage.removeUserRole`، `res.status(404).json`، `res.status`، `res.status(204).send`، `res.status(500).json`

## GET `/api/vendor-contracts`

- المصدر: server/vendor-contracts.ts:267
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (_req, res) => { res.json(await contractRows()); })`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `handle`، `res.json`، `contractRows`

## PUT `/api/vendor-management/certifications/:id`

- المصدر: server/vendor-contracts.ts:233
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (req, res, user) => { if (!vendorPermissions(user).canUpdateVendor) throw new VendorError(403, "Vendor update permission required"); const input = vendorCertificationInput.parse(req.body); const saved = await db.transaction(async tx => { const [old] = await tx.select()`
- جداول مشار إليها مباشرة: `vendor_certifications`
- الاستدعاءات الظاهرة: `handle`، `vendorPermissions`، `vendorCertificationInput.parse`، `db.transaction`، `tx.select().from(vendorCertifications).where(eq(vendorCertifications.id, req.params.id)).for`، `tx.select().from(vendorCertifications).where`، `tx.select().from`، `tx.select`، `eq`، `tx.update(vendorCertifications).set({ ...input, documentUrl: input.documentUrl \|\| null, updatedAt: new Date(), updatedBy: user.id, }).where(eq(vendorCertifications.id, old.id)).returning`، `tx.update(vendorCertifications).set({ ...input, documentUrl: input.documentUrl \|\| null, updatedAt: new Date(), updatedBy: user.id, }).where`، `tx.update(vendorCertifications).set`، `tx.update`، `audit`، `certificationLifecycle`، `res.json`

## GET `/api/vendor-management/options`

- المصدر: server/vendor-contracts.ts:122
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (_req, res, user) => { const [options, assetOptions, poOptions, serverOptions] = await Promise.all([ db.select().from(dropdownOptions).where(and(inArray(dropdownOptions.category, ["vendor_category", "contract_type"]), eq(dropdownOptions.isActive, true))).orderBy(asc(dropdownOp`
- جداول مشار إليها مباشرة: `assets`، `dropdown_options`، `purchase_orders`، `servers`
- الاستدعاءات الظاهرة: `handle`، `Promise.all`، `db.select().from(dropdownOptions).where(and(inArray(dropdownOptions.category, ["vendor_category", "contract_type"]), eq(dropdownOptions.isActive, true))).orderBy`، `db.select().from(dropdownOptions).where`، `db.select().from`، `db.select`، `and`، `inArray`، `eq`، `asc`، `db.select({ id: assets.id, name: assets.name, assetTag: assets.assetTag, type: assets.type }).from`، `db.select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber }).from`، `db.select({ id: servers.id, hostname: servers.hostname, ipAddress: servers.ipAddress, environment: servers.environment }).from`، `res.json`، `vendorPermissions`، `options.filter`

## GET `/api/vendor-management/vendors`

- المصدر: server/vendor-contracts.ts:132
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (_req, res) => { const [rows, counts, purchaseOrderCounts, assetCounts] = await Promise.all([ db.select().from(vendors).orderBy(asc(vendors.name)), db.select({ vendorId: vendorContracts.vendorId, total: sql<number>'count(*)::int' }).from(vendorContracts) .where(s`
- جداول مشار إليها مباشرة: `assets`، `purchase_orders`، `vendor_contracts`، `vendors`
- الاستدعاءات الظاهرة: `handle`، `Promise.all`، `db.select().from(vendors).orderBy`، `db.select().from`، `db.select`، `asc`، `db.select({ vendorId: vendorContracts.vendorId, total: sql<number>'count(*)::int' }).from(vendorContracts) .where(sql'${vendorContracts.status} <> 'Terminated' AND ${vendorContracts.startDate} <= CURRENT_DATE AND ${vendorContracts.endDate} >= CURRENT_DATE').groupBy`، `db.select({ vendorId: vendorContracts.vendorId, total: sql<number>'count(*)::int' }).from(vendorContracts) .where`، `db.select({ vendorId: vendorContracts.vendorId, total: sql<number>'count(*)::int' }).from`، `db.select({ vendorId: purchaseOrders.vendorId, vendorName: purchaseOrders.vendor, total: sql<number>'count(*)::int', }).from(purchaseOrders).groupBy`، `db.select({ vendorId: purchaseOrders.vendorId, vendorName: purchaseOrders.vendor, total: sql<number>'count(*)::int', }).from`، `db.select({ vendorId: assets.primaryVendorId, total: sql<number>'count(*)::int' }).from(assets) .where(sql'${assets.primaryVendorId} IS NOT NULL').groupBy`، `db.select({ vendorId: assets.primaryVendorId, total: sql<number>'count(*)::int' }).from(assets) .where`، `db.select({ vendorId: assets.primaryVendorId, total: sql<number>'count(*)::int' }).from`، `counts.map`، `byPurchaseOrderVendorId.set`، `byPurchaseOrderVendorId.get`، `byPurchaseOrderVendorName.set`، `row.vendorName.trim().toLowerCase`، `row.vendorName.trim`، `byPurchaseOrderVendorName.get`، `assetCounts.map`، `res.json`، `rows.map`، `byVendor.get`، `row.name.trim().toLowerCase`، `row.name.trim`، `byAssetVendor.get`

## GET `/api/vendor-management/vendors/:id`

- المصدر: server/vendor-contracts.ts:159
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (req, res) => { const [vendor] = await db.select().from(vendors).where(eq(vendors.id, req.params.id)); if (!vendor) throw new VendorError(404, "Vendor not found"); const [linkedAssets, linkedContracts, linkedPurchaseOrders, certifications, incidentMetrics] = await Promise.al`
- جداول مشار إليها مباشرة: `assets`، `contracts`، `incidents`، `purchase_orders`، `vendor_certifications`، `vendors`
- الاستدعاءات الظاهرة: `handle`، `db.select().from(vendors).where`، `db.select().from`، `db.select`، `eq`، `Promise.all`، `db.select({ id: assets.id, name: assets.name, type: assets.type, assetTag: assets.assetTag, serialNumber: assets.serialNumber, status: assets.status, warrantyExpiry: assets.warrantyExpiry, manufacturer: assets.manufacturer, model: assets.model, }).from(assets).where(sql'${assets.primaryVendorId} = ${vendor.id} OR EXISTS ( SELECT 1 FROM vendor_contract_assets vca INNER JOIN vendor_contracts vc ON vc.id = vca.contract_id WHERE vca.asset_id = ${assets.id} AND vc.vendor_id = ${vendor.id} )').orderBy`، `db.select({ id: assets.id, name: assets.name, type: assets.type, assetTag: assets.assetTag, serialNumber: assets.serialNumber, status: assets.status, warrantyExpiry: assets.warrantyExpiry, manufacturer: assets.manufacturer, model: assets.model, }).from(assets).where`، `db.select({ id: assets.id, name: assets.name, type: assets.type, assetTag: assets.assetTag, serialNumber: assets.serialNumber, status: assets.status, warrantyExpiry: assets.warrantyExpiry, manufacturer: assets.manufacturer, model: assets.model, }).from`، `asc`، `contractRows`، `db.select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber, orderDate: purchaseOrders.orderDate, status: purchaseOrders.status, totalAmount: purchaseOrders.totalAmount, }).from(purchaseOrders).where(eq(purchaseOrders.vendorId, vendor.id)).orderBy`، `db.select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber, orderDate: purchaseOrders.orderDate, status: purchaseOrders.status, totalAmount: purchaseOrders.totalAmount, }).from(purchaseOrders).where`، `db.select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber, orderDate: purchaseOrders.orderDate, status: purchaseOrders.status, totalAmount: purchaseOrders.totalAmount, }).from`، `db.select().from(vendorCertifications).where(eq(vendorCertifications.vendorId, vendor.id)).orderBy`، `db.select().from(vendorCertifications).where`، `db.select({ incidentCount: sql<number>'count(*)::int', resolvedIncidentCount: sql<number>'count(*) FILTER (WHERE ${incidents.resolvedAt} IS NOT NULL)::int', averageResolutionHours: sql<number>'round(avg(extract(epoch FROM (${incidents.resolvedAt} - ${incidents.createdAt})) / 3600) FILTER (WHERE ${incidents.resolvedAt} IS NOT NULL), 1)', slaBreachCount: sql<number>'count(*) FILTER ( WHERE ${incidents.resolveDueAt} IS NOT NULL AND ( (${incidents.resolvedAt} IS NOT NULL AND ${incidents.resolvedAt} > ${incidents.resolveDueAt}) OR (${incidents.resolvedAt} IS NULL AND ${incidents.resolveDueAt} < now()) ) )::int', }).from(incidents).innerJoin(assets, eq(incidents.assetId, assets.id)) .where`، `db.select({ incidentCount: sql<number>'count(*)::int', resolvedIncidentCount: sql<number>'count(*) FILTER (WHERE ${incidents.resolvedAt} IS NOT NULL)::int', averageResolutionHours: sql<number>'round(avg(extract(epoch FROM (${incidents.resolvedAt} - ${incidents.createdAt})) / 3600) FILTER (WHERE ${incidents.resolvedAt} IS NOT NULL), 1)', slaBreachCount: sql<number>'count(*) FILTER ( WHERE ${incidents.resolveDueAt} IS NOT NULL AND ( (${incidents.resolvedAt} IS NOT NULL AND ${incidents.resolvedAt} > ${incidents.resolveDueAt}) OR (${incidents.resolvedAt} IS NULL AND ${incidents.resolveDueAt} < now()) ) )::int', }).from(incidents).innerJoin`، `db.select({ incidentCount: sql<number>'count(*)::int', resolvedIncidentCount: sql<number>'count(*) FILTER (WHERE ${incidents.resolvedAt} IS NOT NULL)::int', averageResolutionHours: sql<number>'round(avg(extract(epoch FROM (${incidents.resolvedAt} - ${incidents.createdAt})) / 3600) FILTER (WHERE ${incidents.resolvedAt} IS NOT NULL), 1)', slaBreachCount: sql<number>'count(*) FILTER ( WHERE ${incidents.resolveDueAt} IS NOT NULL AND ( (${incidents.resolvedAt} IS NOT NULL AND ${incidents.resolvedAt} > ${incidents.resolveDueAt}) OR (${incidents.resolvedAt} IS NULL AND ${incidents.resolveDueAt} < now()) ) )::int', }).from`، `Number`، `certifications.map`، `certificationLifecycle`، `res.json`، `vendorPerformanceStatus`، `linkedAssets.filter`، `certificationRows.filter`

## POST `/api/vendor-management/vendors/:id/certifications`

- المصدر: server/vendor-contracts.ts:218
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (req, res, user) => { if (!vendorPermissions(user).canUpdateVendor) throw new VendorError(403, "Vendor update permission required"); const input = vendorCertificationInput.parse(req.body); const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id`
- جداول مشار إليها مباشرة: `vendor_certifications`، `vendors`
- الاستدعاءات الظاهرة: `handle`، `vendorPermissions`، `vendorCertificationInput.parse`، `db.select({ id: vendors.id }).from(vendors).where`، `db.select({ id: vendors.id }).from`، `db.select`، `eq`، `db.transaction`، `tx.insert(vendorCertifications).values({ ...input, vendorId: vendor.id, documentUrl: input.documentUrl \|\| null, updatedBy: user.id, }).returning`، `tx.insert(vendorCertifications).values`، `tx.insert`، `audit`، `certificationLifecycle`، `res.status(201).json`، `res.status`

## GET `/api/vendor-quotations`

- المصدر: server/routes.ts:6628
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireAnyPermission("finance_view", "purchase_order_create", "purchase_order_update", "system_admin")` → `inline handler`
- جداول مشار إليها مباشرة: `vendor_quotation_items`، `vendor_quotations`
- الاستدعاءات الظاهرة: `requireAnyPermission`، `db.select().from(vendorQuotations).orderBy`، `db.select().from`، `db.select`، `desc`، `Promise.all`، `rows.map`، `db.select().from(vendorQuotationItems).where`، `eq`، `res.json`، `console.error`، `res.status(500).json`، `res.status`

## POST `/api/vendor-quotations`

- المصدر: server/routes.ts:6676
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("purchase_order_create")` → `inline handler`
- جداول مشار إليها مباشرة: `consumables`، `vendor_quotation_items`، `vendor_quotations`، `warehouse_locations`
- الاستدعاءات الظاهرة: `requirePermission`، `getDefaultFinancialProfile`، `insertVendorQuotationSchema.safeParse`، `res.status(400).json`، `res.status`، `items.some`، `calculateDocumentTotals`، `items.map`، `Number`، `Math.abs`، `db.transaction`، `reserveFinancialDocumentNumber`، `tx.select({ id: warehouseLocations.id }).from(warehouseLocations) .where`، `tx.select({ id: warehouseLocations.id }).from`، `tx.select`، `and`، `eq`، `Object.assign`، `tx.select({ id: consumables.id, warehouseLocationId: consumables.warehouseLocationId, }).from(consumables).where`، `tx.select({ id: consumables.id, warehouseLocationId: consumables.warehouseLocationId, }).from`، `tx.insert(vendorQuotations).values({ ...quotationInput, quoteNumber, status: "submitted", documentDiscountValue: Number(quotationInput.documentDiscountValue ?? 0).toFixed(2), subtotal: totals.subtotal.toFixed(2), taxAmount: totals.taxAmount.toFixed(2), totalAmount: totals.grandTotal.toFixed(2), documentDiscountAmount: totals.documentDiscountAmount.toFixed(2), createdBy: req.user!.id, }).returning`، `tx.insert(vendorQuotations).values`، `tx.insert`، `Number(quotationInput.documentDiscountValue ?? 0).toFixed`، `totals.subtotal.toFixed`، `totals.taxAmount.toFixed`، `totals.grandTotal.toFixed`، `totals.documentDiscountAmount.toFixed`، `tx.insert(vendorQuotationItems).values`، `normalizedItems.map`، `line.unitPrice.toFixed`، `Number(line.discountValue).toFixed`، `line.discountAmount.toFixed`، `Number(line.taxRate).toFixed`، `Number(line.totalPrice).toFixed`، `logAudit`، `res.status(201).json`، `res.status((error as any).status).json`، `res.status(409).json`، `console.error`، `res.status(500).json`

## DELETE `/api/vendor-quotations/:id`

- المصدر: server/routes.ts:6673
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("purchase_order_update")` → `deleteVendorQuotation`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`

## POST `/api/vendor-quotations/:id/convert-to-po`

- المصدر: server/routes.ts:6791
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("purchase_order_create")` → `inline handler`
- جداول مشار إليها مباشرة: `purchase_order_items`، `purchase_orders`، `vendor_quotation_items`، `vendor_quotations`، `vendors`
- الاستدعاءات الظاهرة: `requirePermission`، `db.transaction`، `tx.select().from(vendorQuotations).where(eq(vendorQuotations.id, req.params.id)).for`، `tx.select().from(vendorQuotations).where`، `tx.select().from`، `tx.select`، `eq`، `Object.assign`، `tx.select().from(vendorQuotationItems).where`، `reserveFinancialDocumentNumber`، `tx.insert(purchaseOrders).values({ poNumber, vendorId: quotation.vendorId, vendor: (await tx.select({ name: vendors.name }).from(vendors).where(eq(vendors.id, quotation.vendorId)))[0]?.name ?? null, quotationId: quotation.id, reference: 'Quotation ${quotation.quoteNumber}', orderDate: toDateInputValue(new Date()), expectedDelivery: req.body?.expectedDelivery ?? null, actualDelivery: null, totalAmount: quotation.totalAmount, currency: quotation.currency, subtotal: quotation.subtotal, taxRate: quotation.taxRate, taxMode: quotation.taxMode, documentDiscountType: quotation.documentDiscountType, documentDiscountValue: quotation.documentDiscountValue, documentDiscountAmount: quotation.documentDiscountAmount, taxAmount: quotation.taxAmount, status: "pending", departmentId: req.body?.departmentId \|\| null, notes: quotation.notes, assetsCreated: false, }).returning`، `tx.insert(purchaseOrders).values`، `tx.insert`، `tx.select({ name: vendors.name }).from(vendors).where`، `tx.select({ name: vendors.name }).from`، `toDateInputValue`، `tx.insert(purchaseOrderItems).values`، `quotationItems.map`، `tx.update(vendorQuotations).set({ status: "converted", updatedAt: new Date() }).where`، `tx.update(vendorQuotations).set`، `tx.update`، `logAudit`، `res.status(201).json`، `res.status`، `res.status(status).json`، `res.status(400).json`، `res.status(500).json`

## PUT `/api/vendor-quotations/:id/status`

- المصدر: server/routes.ts:6775
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission("purchase_order_update")` → `inline handler`
- جداول مشار إليها مباشرة: `vendor_quotations`
- الاستدعاءات الظاهرة: `requirePermission`، `z.enum(["submitted", "accepted", "rejected", "expired"]).parse`، `z.enum`، `db.select().from(vendorQuotations).where`، `db.select().from`، `db.select`، `eq`، `res.status(404).json`، `res.status`، `res.status(409).json`، `db.update(vendorQuotations).set({ status, updatedAt: new Date() }).where(and(eq(vendorQuotations.id, quotation.id), sql'${vendorQuotations.status} <> 'converted'')).returning`، `db.update(vendorQuotations).set({ status, updatedAt: new Date() }).where`، `db.update(vendorQuotations).set`، `db.update`، `and`، `logAudit`، `res.json`، `res.status(400).json`، `res.status(500).json`

## GET `/api/vendors`

- المصدر: server/routes.ts:5547
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: `vendors`
- الاستدعاءات الظاهرة: `storage.getVendorsWithDetails`، `res.json`، `res.status(500).json`، `res.status`

## POST `/api/vendors`

- المصدر: server/routes.ts:5556
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('vendor_create')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `normalizeVendorContacts`، `insertVendorSchema.parse`، `storage.createVendor`، `logAudit`، `vendor.id.toString`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(409).json`، `res.status(500).json`

## DELETE `/api/vendors/:id`

- المصدر: server/routes.ts:5611
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('vendor_delete')` → `inline handler`
- جداول مشار إليها مباشرة: `vendor_contracts`
- الاستدعاءات الظاهرة: `requirePermission`، `db.select({ id: vendorContracts.id }).from(vendorContracts).where`، `db.select({ id: vendorContracts.id }).from`، `db.select`، `eq`، `res.status(409).json`، `res.status`، `storage.getVendor`، `storage.deleteVendor`، `res.status(404).json`، `logAudit`، `vendor.id.toString`، `res.status(204).send`، `res.status(500).json`

## GET `/api/vendors/:id`

- المصدر: server/routes.ts:5574
- سلسلة الوسطاء/المعالج: `requireAuth` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `storage.getVendor`، `res.status(404).json`، `res.status`، `res.json`، `res.status(500).json`

## PUT `/api/vendors/:id`

- المصدر: server/routes.ts:5586
- سلسلة الوسطاء/المعالج: `requireAuth` → `requirePermission('vendor_update')` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requirePermission`، `normalizeVendorContacts`، `insertVendorSchema.partial().parse`، `insertVendorSchema.partial`، `storage.getVendor`، `storage.updateVendor`، `res.status(404).json`، `res.status`، `logAudit`، `vendor.id.toString`، `res.json`، `res.status(400).json`، `res.status(409).json`، `res.status(500).json`

## GET `/api/warehouse-locations`

- المصدر: server/routes.ts:5636
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `inline handler`
- جداول مشار إليها مباشرة: `warehouse_locations`
- الاستدعاءات الظاهرة: `requireModule`، `res.json`، `db.select().from(warehouseLocations).orderBy`، `db.select().from`، `db.select`، `res.status(500).json`، `res.status`

## POST `/api/warehouse-locations`

- المصدر: server/routes.ts:5644
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("asset_create")` → `inline handler`
- جداول مشار إليها مباشرة: `warehouse_locations`
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `insertWarehouseLocationSchema.parse`، `db.insert(warehouseLocations).values(input).returning`، `db.insert(warehouseLocations).values`، `db.insert`، `res.status(201).json`، `res.status`، `res.status(400).json`، `res.status(409).json`، `res.status(500).json`

## PATCH `/api/warehouse-locations/:id`

- المصدر: server/routes.ts:5672
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("asset_update")` → `inline handler`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`، `updateWarehouseLocation`

## PUT `/api/warehouse-locations/:id`

- المصدر: server/routes.ts:5675
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("asset_update")` → `updateWarehouseLocation`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`

## PUT `/api/warehouses/:id`

- المصدر: server/routes.ts:5676
- سلسلة الوسطاء/المعالج: `requireAuth` → `requireModule("asset_management")` → `requirePermission("asset_update")` → `updateWarehouseLocation`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `requireModule`، `requirePermission`

## GET `'/api/${kind}/:id/kb-articles'`

- المصدر: server/knowledge-governance.ts:504
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (req, res, user) => { requireEditor(user); const [ticket] = await db.select({ id: ticketTable.id }).from(ticketTable).where(eq(ticketTable.id, req.params.id)); if (!ticket) throw new KnowledgeError(404, "Ticket not found"); res.json(await db.select({ id: k`
- جداول مشار إليها مباشرة: `kb_articles`، `kb_ticket_links`
- الاستدعاءات الظاهرة: `route`، `requireEditor`، `db.select({ id: ticketTable.id }).from(ticketTable).where`، `db.select({ id: ticketTable.id }).from`، `db.select`، `eq`، `res.json`، `db.select({ id: kbTicketLinks.id, articleId: kbTicketLinks.articleId, articleVersion: kbTicketLinks.articleVersion, createdAt: kbTicketLinks.createdAt, title: kbArticles.title, category: kbArticles.category, status: kbArticles.status, version: kbArticles.version, }).from(kbTicketLinks).innerJoin(kbArticles, eq(kbTicketLinks.articleId, kbArticles.id)) .where(eq(targetColumn, req.params.id)).orderBy`، `db.select({ id: kbTicketLinks.id, articleId: kbTicketLinks.articleId, articleVersion: kbTicketLinks.articleVersion, createdAt: kbTicketLinks.createdAt, title: kbArticles.title, category: kbArticles.category, status: kbArticles.status, version: kbArticles.version, }).from(kbTicketLinks).innerJoin(kbArticles, eq(kbTicketLinks.articleId, kbArticles.id)) .where`، `db.select({ id: kbTicketLinks.id, articleId: kbTicketLinks.articleId, articleVersion: kbTicketLinks.articleVersion, createdAt: kbTicketLinks.createdAt, title: kbArticles.title, category: kbArticles.category, status: kbArticles.status, version: kbArticles.version, }).from(kbTicketLinks).innerJoin`، `db.select({ id: kbTicketLinks.id, articleId: kbTicketLinks.articleId, articleVersion: kbTicketLinks.articleVersion, createdAt: kbTicketLinks.createdAt, title: kbArticles.title, category: kbArticles.category, status: kbArticles.status, version: kbArticles.version, }).from`، `desc`

## POST `'/api/${kind}/:id/kb-articles'`

- المصدر: server/knowledge-governance.ts:515
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (req, res, user) => { requireEditor(user); const { articleId } = z.object({ articleId: z.string().min(1) }).strict().parse(req.body); const result = await db.transaction(async tx => { const [article] = await tx.select().from(kbArticles).where(eq(kbArticles.id, a`
- جداول مشار إليها مباشرة: `audit_logs`، `incident_activities`، `kb_articles`، `kb_ticket_links`، `service_request_activities`
- الاستدعاءات الظاهرة: `route`، `requireEditor`، `z.object({ articleId: z.string().min(1) }).strict().parse`، `z.object({ articleId: z.string().min(1) }).strict`، `z.object`، `z.string().min`، `z.string`، `db.transaction`، `tx.select().from(kbArticles).where(eq(kbArticles.id, articleId)).for`، `tx.select().from(kbArticles).where`، `tx.select().from`، `tx.select`، `eq`، `tx.select({ id: ticketTable.id }).from(ticketTable) .where(eq(ticketTable.id, req.params.id)).for`، `tx.select({ id: ticketTable.id }).from(ticketTable) .where`، `tx.select({ id: ticketTable.id }).from`، `tx.insert(kbTicketLinks).values({ articleId, articleVersion: article.version, linkedById: user.id, incidentId: isIncident ? ticket.id : null, serviceRequestId: isIncident ? null : ticket.id, }).onConflictDoNothing().returning`، `tx.insert(kbTicketLinks).values({ articleId, articleVersion: article.version, linkedById: user.id, incidentId: isIncident ? ticket.id : null, serviceRequestId: isIncident ? null : ticket.id, }).onConflictDoNothing`، `tx.insert(kbTicketLinks).values`، `tx.insert`، `tx.select().from(kbTicketLinks).where`، `and`، `tx.insert(incidentActivities).values`، `tx.insert(serviceRequestActivities).values`، `tx.insert(auditLogs).values`، `JSON.stringify`، `req.get`، `res.status(result.created ? 201 : 200).json`، `res.status`

## POST `'/api/kb/articles/:id/${action}'`

- المصدر: server/knowledge-governance.ts:312
- سلسلة الوسطاء/المعالج: `requireAuth` → `route(async (req, res, user) => { res.json(await updateArticle(req, user, transition)); })`
- جداول مشار إليها مباشرة: لا توجد مراجع جدول مباشرة؛ افحص المعالج أو الخدمة المستدعاة.
- الاستدعاءات الظاهرة: `route`، `res.json`، `updateArticle`

## DYNAMIC[method] `'/api/service-catalog/items${method === "put" ? "/:id" : ""}'`

- المصدر: server/service-catalog.ts:131
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (req, res, user) => { if (!canManageServiceCatalog(user)) throw new CatalogError(403, "Catalog manager access required"); const input = structuredCatalogInput.parse(req.body); const item = await db.transaction(async tx => { const previous = method === "put" ? (`
- جداول مشار إليها مباشرة: `catalog_items`، `consumables`، `dropdown_options`، `service_catalog_items`
- الاستدعاءات الظاهرة: `app[method]`، `handle`، `canManageServiceCatalog`، `structuredCatalogInput.parse`، `db.transaction`، `tx.select().from(serviceCatalogItems).where(eq(serviceCatalogItems.id, req.params.id)).for`، `tx.select().from(serviceCatalogItems).where`، `tx.select().from`، `tx.select`، `eq`، `tx.select({ id: dropdownOptions.id }).from(dropdownOptions).where`، `tx.select({ id: dropdownOptions.id }).from`، `and`، `tx.select({ id: consumables.id }).from(consumables).where`، `tx.select({ id: consumables.id }).from`، `input.category.toLowerCase`، `tx.insert(catalogItems).values(legacyInput).returning`، `tx.insert(catalogItems).values`، `tx.insert`، `tx.update(catalogItems).set(legacyInput).where`، `tx.update(catalogItems).set`، `tx.update`، `tx.insert(serviceCatalogItems).values({ id, ...values }).returning`، `tx.insert(serviceCatalogItems).values`، `tx.update(serviceCatalogItems).set(values).where(eq(serviceCatalogItems.id, id)).returning`، `tx.update(serviceCatalogItems).set(values).where`، `tx.update(serviceCatalogItems).set`، `audit`، `res.status(method === "post" ? 201 : 200).json`، `res.status`

## DYNAMIC[method] `method === "post" ? "/api/vendor-contracts" : "/api/vendor-contracts/:id"`

- المصدر: server/vendor-contracts.ts:268
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (req, res, user) => { if (!vendorPermissions(user).canManageContracts) throw new VendorError(403, "Only IT managers and administrators may manage SLA contracts"); const input = vendorContractInput.parse(req.body); const saved = await db.transaction(async tx => { const`
- جداول مشار إليها مباشرة: `contracts`، `vendor_contract_assets`، `vendor_contract_purchase_orders`، `vendor_contract_servers`، `vendor_contracts`، `vendors`
- الاستدعاءات الظاهرة: `app[method]`، `handle`، `vendorPermissions`، `vendorContractInput.parse`، `db.transaction`، `randomUUID`، `tx.select({ id: contracts.id }).from(contracts).where(eq(contracts.id, id)).for`، `tx.select({ id: contracts.id }).from(contracts).where`، `tx.select({ id: contracts.id }).from`، `tx.select`، `eq`، `tx.select().from(vendorContracts).where(eq(vendorContracts.id, id)).for`، `tx.select().from(vendorContracts).where`، `tx.select().from`، `tx.select().from(vendors).where(eq(vendors.id, input.vendorId)).for`، `tx.select().from(vendors).where`، `vendor.status?.toLowerCase`، `lookup`، `contractLifecycle`، `input.cost.toFixed`، `new Date(Date.parse('${input.endDate}T00:00:00Z') - input.renewalNoticeDays * 86400000).toISOString().slice`، `new Date(Date.parse('${input.endDate}T00:00:00Z') - input.renewalNoticeDays * 86400000).toISOString`، `Date.parse`، `tx.update(contracts).set(financialValues).where`، `tx.update(contracts).set`، `tx.update`، `tx.insert(contracts).values`، `tx.insert`، `tx.update(vendorContracts).set(values).where(eq(vendorContracts.id, id)).returning`، `tx.update(vendorContracts).set(values).where`، `tx.update(vendorContracts).set`، `tx.insert(vendorContracts).values({ id, ...values }).returning`، `tx.insert(vendorContracts).values`، `(await tx.select({ id: vendorContractAssets.assetId }).from(vendorContractAssets).where(eq(vendorContractAssets.contractId, id))).map`، `tx.select({ id: vendorContractAssets.assetId }).from(vendorContractAssets).where`، `tx.select({ id: vendorContractAssets.assetId }).from`، `(await tx.select({ id: vendorContractPurchaseOrders.purchaseOrderId }).from(vendorContractPurchaseOrders).where(eq(vendorContractPurchaseOrders.contractId, id))).map`، `tx.select({ id: vendorContractPurchaseOrders.purchaseOrderId }).from(vendorContractPurchaseOrders).where`، `tx.select({ id: vendorContractPurchaseOrders.purchaseOrderId }).from`، `(await tx.select({ id: vendorContractServers.serverId }).from(vendorContractServers).where(eq(vendorContractServers.contractId, id))).map`، `tx.select({ id: vendorContractServers.serverId }).from(vendorContractServers).where`، `tx.select({ id: vendorContractServers.serverId }).from`، `saveLinks`، `audit`، `res.status(method === "post" ? 201 : 200).json`، `res.status`

## DYNAMIC[method] `method === "post" ? "/api/vendor-management/vendors" : "/api/vendor-management/vendors/:id"`

- المصدر: server/vendor-contracts.ts:247
- سلسلة الوسطاء/المعالج: `requireAuth` → `handle(async (req, res, user) => { const permissions = vendorPermissions(user); if (!(method === "post" ? permissions.canCreateVendor : permissions.canUpdateVendor)) throw new VendorError(403, "Vendor modification permission required"); const input = managedVendorInput.parse(req.body);`
- جداول مشار إليها مباشرة: `permissions`، `vendors`
- الاستدعاءات الظاهرة: `app[method]`، `handle`، `vendorPermissions`، `managedVendorInput.parse`، `db.transaction`، `tx.select().from(vendors).where(eq(vendors.id, req.params.id)).for`، `tx.select().from(vendors).where`، `tx.select().from`، `tx.select`، `eq`، `lookup`، `normalizeVendorContacts`، `input.performanceRating.toFixed`، `tx.update(vendors).set(values).where(eq(vendors.id, old.id)).returning`، `tx.update(vendors).set(values).where`، `tx.update(vendors).set`، `tx.update`، `tx.insert(vendors).values({ ...values, name: input.name, createdBy: user.id }).returning`، `tx.insert(vendors).values`، `tx.insert`، `audit`، `res.status(method === "post" ? 201 : 200).json`، `res.status`

