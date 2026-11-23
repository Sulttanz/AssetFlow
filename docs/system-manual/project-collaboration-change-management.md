---
title: Project Collaboration & Project Change Management
category: Project Management & Governance
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.0.0
audience: all_authenticated
---

# Project Collaboration & Project Change Management

This guide describes project membership, project-scoped visibility, and the approved change-to-task workflow.

## Assigned Projects define project access

System Administrators and authorized User Managers maintain **Assigned Projects** on the user account. These memberships are stored in the project team membership table and returned as `assignedProjectIds` in the signed-in user context. They scope project workspaces, project catalogs, project tickets, and project change requests. A project being visible in a general directory does not grant membership.

The four End User account patterns are:

1. **Linked employee, no assigned projects** (`employeeId` is set; project list is empty): Can use employee self-service, view personal tickets and assigned assets, read Knowledge Base articles, submit global incidents and service requests, and cannot submit a project change.
2. **Linked employee with assigned projects**: Receives the linked-employee self-service access plus project-scoped incident and service-request access and project change submission for assigned projects.
3. **External project user** (`employeeId` is empty; one or more projects assigned): Uses project-scoped tickets, catalogs, and project change requests only for assigned projects. Internal employee assets and custody receipts are not exposed.
4. **Unlinked general user** (`employeeId` is empty; no projects assigned): Can submit global incidents and service requests and view personal tickets and published Knowledge Base guides. My Assigned Assets and Change Requests are unavailable.

For project incident intake, a single assigned project is selected automatically. The project selector is offered only when the user has multiple eligible projects. A user without project membership cannot submit project-scoped work.

## Project Change Request lifecycle

1. An assigned project user opens **Project Change Request** and selects one of their assigned projects. They describe the requested change and its implementation, testing, rollback, and schedule details as applicable.
2. The request is submitted to review. If no active approvers are configured, the request is not created and the user is told to contact an administrator.
3. Active **System Administrators**, **IT Managers**, and **CAB Members** receive approval records. Each assigned reviewer votes on their own approval record and may add a review note.
4. The change becomes approved only when all assigned active approvers approve. A rejection prevents approval. Normal CAB lifecycle protections and audit records apply.
5. On final approval, the system creates one **Project Task** in the linked project's task workspace and stores the Change Request reference on that task. The Change Request detail displays the linked task.

This workflow does not create a duplicate ITSM Incident or Service Request. The Change Request remains in Change Management for its approval and audit history; the linked implementation work is tracked in the project task workspace.

## Working with project delivery

Project members use project details, task boards, milestones, linked assets, baselines, and project risks according to their permissions. Task assignees can update their allowed work fields; project managers and administrators manage broader project records. Record links and page availability may also depend on Project Management, ITSM, Asset Management, or CMDB feature gates.
