# Service Level & Support Contracts

`service_contracts` is a separate support-agreement register, not a replacement for financial `contracts` or vendor SLA contracts.

## Identifier and date contracts

- `id` is a generated serial integer.
- `projectId` and `slaPolicyId` are nullable varchar foreign keys because the existing parent primary keys are varchar UUIDs. Both use `ON DELETE SET NULL`.
- `clientId` is optional text; there is no customer-table foreign key.
- `startDate` and `endDate` use ISO calendar dates (`YYYY-MM-DD`) in API requests and PostgreSQL `date` columns.
- Contract numbers are unique after case folding and trimming.
- End dates must be on or after start dates. Renewal notice defaults to 60 days.

## Compatibility with the existing financial API

The application already uses `/api/contracts` for financial contracts. To preserve those clients:

- Unfiltered `GET /api/contracts` retains its existing financial-contract response.
- Use `GET /api/contracts?kind=service` for the complete service-contract register.
- Supplying `projectId`, `status`, or `nearExpiration` selects the service-contract register.
- A POST body containing `contractName` selects service-contract creation; legacy financial creation continues to use `name`.
- Numeric `/api/contracts/:id` paths address service contracts. Existing financial contract IDs are UUID strings.

Service-contract requests use the Asset Management feature gate. Reads require `asset_view`, `asset_update`, or `system_admin`; mutations require `asset_update` or `system_admin`. Financial requests retain their existing Asset Management gate and finance permissions; financial mutations remain restricted to `system_admin`.

## Endpoints

### List and filter

```http
GET /api/contracts?kind=service
GET /api/contracts?projectId=<project-uuid>&status=active
GET /api/contracts?kind=service&nearExpiration=true
```

Supported filters:

- `projectId`: exact project ID.
- `status`: `active`, `near_expiration`, `expired`, or `renewed`.
- `nearExpiration`: `true` or `false`.

Responses derive active/near-expiration/expired state from inclusive end dates and each contract's notice period. Explicit `renewed` status takes precedence. Reads do not write lifecycle changes back to the database.

### Read one

```http
GET /api/contracts/1
```

### Create

```http
POST /api/contracts
Content-Type: application/json

{
  "contractNumber": "CNT-2026-001",
  "contractName": "Managed Support Agreement",
  "projectId": null,
  "clientId": "CUSTOMER-001",
  "slaPolicyId": null,
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "renewalNoticeDays": 60,
  "status": "active",
  "notes": "Business-hours support"
}
```

### Update

```http
PUT /api/contracts/1
Content-Type: application/json

{
  "endDate": "2027-12-31",
  "notes": "Renewal approved"
}
```

Updates preserve omitted fields and validate date order against the existing record.

### Delete

```http
DELETE /api/contracts/1
```

Successful deletion returns `204`. Create, update, and delete actions write system audit events.

Validation errors return `400`; duplicate contract numbers return `409`; missing records return `404`.

## Migration

`migrations/onprem/20261124_service_contracts.sql` is additive and idempotent. The development database is synchronized through the existing `npm run db:push` process; the on-prem startup migration runner handles the checked-in migration.
