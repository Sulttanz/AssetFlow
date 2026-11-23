---
title: Employee Self-Service & Directory Management
category: Employee Support
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.0.0
audience: internal
---

# Employee Self-Service & Directory Management

Employee records and login accounts are separate. The shared employee directory supports personnel and governance workflows, but the Employee Management page, employee-list API, and employee import are currently gated by Asset Management. Employee management is not a separately toggleable core module.

## Employee Directory & Personnel Profiles

Employee profiles can store an employee ID, name, corporate email, department, job title, manager, location, start date, and active or disabled status. Offboarding history and access-entitlement records are maintained through their respective governance workflows.

Employee records can be referenced by asset custody and other operational workflows. Project task and ticket assignments use application user accounts; those views depend on their own modules and permissions. Importing an employee does not create a login account or grant system access.

## Self-Service Portal

The `/portal` page currently requires ITSM to be enabled. Its sections also depend on the relevant feature and access rules:

- **Service Catalog & Tickets**: Browse active catalog items, submit dynamic requests, and track personal incidents and service requests when ITSM is enabled.
- **Assigned Assets**: View active physical-asset custody receipts when Asset Management data and access are available.
- **Knowledge Base**: Search published employee-visible articles and repository-maintained system manuals. All authenticated roles can read published system guides, including operational and administrative guides; custom internal articles remain restricted to their authorized audience.

## Service Request Workflow

1. **Submission**: An employee submits an active catalog item. Authorized IT staff can submit on behalf of an active user.
2. **Approval Gate**: When the catalog item requires approval, the request and a pending role-based approval record are created together.
3. **Fulfillment Tracking**: The request's `fulfillmentDueAt` is calculated from the catalog SLA at submission. Approval updates the fulfillment stage and, when configured, assigns the fulfillment group.
4. **Completion**: Completing the fulfillment workflow stamps `completedAt` and records the action in request activity and audit history. This is separate from the SLA due timestamp.
