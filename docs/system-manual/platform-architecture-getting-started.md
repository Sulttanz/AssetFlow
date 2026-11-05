---
title: Platform Architecture & Getting Started
category: Getting Started & Platform Overview
author: Sulttanz
owner: Sulttanz
is_system_guide: true
version: 1.0.0
audience: internal
---

# Platform Architecture & Getting Started

Welcome to the Enterprise IT & Governance Platform. This platform is engineered as a high-performance **Modular Monolith**, delivering unified operational governance across ITIL, PMP/PMI RMP, ITAM, and GRC frameworks within a single, secure database deployment.

## Core Architectural Design

The platform operates on a single codebase and database model, utilizing role-based access control (RBAC) and strict feature gating to isolate functionality per organization license.

### Independent Module Licensing
Modules can be enabled or disabled independently without disrupting system stability or deleting underlying data:
- **Core Platform Services**: User management, RBAC authorization, audit logging, and global system manuals are permanently active.
- **Project Management (PMP/RMP)**: Independent execution workspace for projects, baselines, tasks, and risk registers.
- **IT Service Management (ITSM)**: Incident lifecycles (P1–P4), Change Enablement (CAB), and Service Catalog.
- **IT Asset Management (ITAM)**: Hardware asset tracking, consumable dispatches, and inventory lifecycle.
- **Configuration Management Database (CMDB)**: Infrastructure dependency mapping connecting applications to physical server clusters.
- **Governance, Risk & Compliance (GRC)**: Organizational risk tracking and ISO/NCA control frameworks.

Disabled modules strictly enforce **403 Feature Not Enabled** responses on direct API routes while cleanly removing corresponding sidebar links and dashboard widgets.

## Navigation & Workspaces

Upon signing in with your assigned corporate credentials:
1. **Dynamic Workspace Layout**: Your navigation menu automatically adapts to show only the tools licensed by your organization and permitted by your assigned role.
2. **Global Search**: Search across records, knowledge base articles, and assets using the top navigation search bar.
3. **Audit Readiness**: Every record modification, approval, status transition, and data clearance event is automatically written to immutable system audit logs.

## Security & Access Control

Access is governed strictly by organizational roles:
- **System Administrator**: Full administrative access, tenant configuration, module toggle management, baseline locks, and system guide deletion privileges.
- **Department Manager / Project Manager**: Operational lead access including baseline approvals, task assignments, risk ownership, and CAB vote participation.
- **Standard User / Employee**: Self-service portal access, service catalog submissions, assigned task execution, and read access to global knowledge base articles.
