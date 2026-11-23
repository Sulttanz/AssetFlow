---
title: IT Operations & Service Desk Guide
category: ITIL Service Operation & Change Management
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.0.0
audience: all_authenticated
---

# IT Operations & Service Desk Guide

For IT Agents, IT Managers, and CAB Members. The Knowledge Base is a core platform service: all authenticated roles can read published system manuals, while article governance is restricted to authorized staff.

## Incident Catalog versus Service Catalog

- **Incident Catalog** (`/incident-catalog`) holds break/fix templates. The template supplies operational defaults; it is not a request for a standard service.
- **Service Catalog** (`/service-catalog`) holds standard fulfillment items such as hardware, software, access, or other services. Catalog entries can use dynamic fields, approvals, and fulfillment timing.

Keep these catalogs separate so incident triage does not become mixed with standard request fulfillment.

## Incident Tracker triage

The **Incident Tracker** (`/incidents/tracker`) is the technician workbench. Review the description, requester, project scope, status, and SLA timing; then use the detail panel to triage:

- **Priority** (`P1`–`P4`)
- **Impact** and **Urgency**
- **Assignment Group** and **Assigned Engineer**
- **SLA Policy**
- Category and resolution code/notes for final resolution

The public intake does not expose these technical routing controls. The API validates the incident template and applies server-side defaults. Follow the allowed status pathway, enter the required resolution category/code/note before resolving or closing, and use accurate comments and assignment details.

## Request Tracker fulfillment

The **Request Tracker** (`/service-requests/tracker`) is for catalog-backed service requests. Review requester, catalog item, approval decision, assignment group, assignee, and fulfillment stage. Do not move a request into a stage that requires approval until the configured approval is approved. Record fulfillment notes and completion details in the request workflow.

## Change, CAB, and Problems

Change Management records RFCs, schedule and risk information, implementation/rollback plans, linked configuration items, and impact summaries when CMDB is enabled. CAB approvers review their assigned change approvals and record individual decisions. A CAB-required change cannot proceed to approval until all active assigned reviewers approve.

Problem Management is used to investigate underlying causes of recurring or high-impact incidents, capture analysis and workarounds, and track remediation. Keep problem investigation separate from incident restoration work; link related records when the workflow provides that relationship.

## Knowledge article governance

System manuals are synchronized from repository Markdown and cannot be edited through ordinary article forms. System Administrators may modify or archive repository-owned guides; IT Agents and IT Managers govern custom Knowledge Base content. Publishing a custom article requires the configured review workflow.
