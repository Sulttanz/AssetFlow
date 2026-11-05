---
title: Universal Bulk Data Import Engine
category: Getting Started & Platform Overview
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.0.0
audience: internal
---

# Universal Bulk Data Import Engine

The platform provides a wizard-based bulk import engine for CSV and Microsoft Excel (`.xlsx`) files. It has 15 module-specific templates to support enterprise data onboarding. The wizard shows only templates whose feature modules are enabled for the tenant.

## Supported Import Templates

1. **Employees & Access Governance** (Asset Management). Employee directory records only; imports do not create login accounts or access grants.
2. **Project Tasks** (Project Management).
3. **Project Milestones** (Project Management).
4. **Risk Register** (Risk Management).
5. **Incidents** (ITSM).
6. **Service Requests** (ITSM).
7. **Assets & IT Components** (Asset Management), including hardware and software inventory fields.
8. **Consumables & Spare Parts** (Asset Management).
9. **Applications & CMDB** (CMDB). This template imports application records; it does not create application-to-server dependency links.
10. **Servers & Infrastructure** (CMDB).
11. **Network Topology** (CMDB), including devices and zones. Firewall rules are deliberately not imported.
12. **Backup Schedules** (CMDB). Imports describe schedules; they do not run backup jobs or restore tests.
13. **Vendors & Contracts** (Asset Management).
14. **Purchase Orders & Budgets** (Asset Management).
15. **Knowledge Base & Policies**. Imported articles are drafts. The Knowledge Base is available globally, while its import template currently follows the ITSM feature gate.

## Import Workflow and Validation

Imports are restricted to authorized managers and administrators. Each template specifies required columns, field types, supported values, and reference formats.

### 1. Download a template

Download the module-specific Excel template from the Import Center. Templates include required and optional fields, sample values, and valid enum values. Date columns accept `DD-MM-YYYY` or `YYYY-MM-DD`.

### 2. Preview and validate

CSV and XLSX uploads are limited to **10 MB** and **5,000 data rows**. Before any data is written, the preview validates:

- Required, duplicate, and unexpected column headers.
- Required values, data types, date formats, and module-specific enum values.
- Referenced records such as employees, projects, assets, vendors, catalog items, and dropdown options.
- Duplicate identifiers within the upload and identifiers already present in the system.

The preview reports counts for the full file and shows up to the first 100 rows with row-specific validation errors. Users can import the valid rows while invalid rows are skipped, or correct the source file and preview it again.

### 3. Confirm the import

Preview data is staged temporarily and belongs to the user who uploaded it. It expires after one hour. The server checks the module license and authorization again at commit time.

Commit uses a database transaction with a savepoint per row. A failed row is rolled back and recorded without preventing other valid rows from importing. The final result and an audit record report imported, failed, and invalid row counts.

## Workflow and Governance Protections

- Imported incidents start in **New**; the normal incident lifecycle controls assignment, resolution, and SLA timestamps.
- Service requests start in **Submitted**. If the catalog item requires approval, the approval record is created as **Pending**.
- Purchase orders remain pending normal approval; spreadsheet data does not approve them.
- Tasks and milestones use supported non-terminal initial states; completed terminal states cannot be imported.
- Knowledge Base articles are created as **Drafts** and must go through normal review before publication.
- Employee imports populate directory data only; they do not create accounts, access grants, or approval decisions.
- Imports are additive onboarding, not a bypass for module licensing, approval, publication, or access-control workflows.
