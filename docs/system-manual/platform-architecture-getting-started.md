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

The product is a TypeScript modular monolith: a React client, an Express/Node.js server, PostgreSQL persistence through Drizzle ORM, a shared schema, and a single deployment. Modules share infrastructure but have independent feature gates. This is not a collection of separately deployable microservices.

## Core platform and module gates

The Knowledge Base / System Manual, authentication, role checks, and audit infrastructure are core services. The current feature registry contains:

- **Asset Management** — employees, hardware and software assets, assignments, handovers, maintenance, consumables, vendors, financial and asset reports.
- **CMDB & Infrastructure** — applications, servers, network topology, configuration documents, and backup governance.
- **ITSM** — incidents, service requests, catalogs, problems, and change/CAB workflows.
- **Risk Management** — the standalone organizational risk register.
- **Project Management** — project teams, tasks, milestones, baselines, project risks, and project-scoped changes.

Feature gates hide disabled-module pages and reject disabled-module API requests. Cross-module links are optional where supported; a feature being disabled does not mean its stored records are deleted. Some combined views require both linked modules—for example, change impact analysis requires ITSM and CMDB.

## Sign-in and navigation

Users sign in with their username or, when one is present, their email address. The landing page, sidebar links, portal sections, and API access are filtered by assigned roles, permissions, linked employee status, assigned projects, and enabled modules. A hidden link is not a substitute for server-side authorization; protected routes enforce access independently.

Repository Markdown under `docs/system-manual/` is synchronized at server startup into protected, published Knowledge Base articles. Every authenticated role can read these published system guides; ordinary article authors cannot edit or publish them. Authorized IT staff and managers govern custom articles, and only System Administrators can modify or archive repository-owned system guides.

## Data, audit, and compliance boundaries

Operational changes and approvals are audit logged in the relevant workflows. Audit logs support investigation; they do not by themselves establish certification or guarantee compliance with ITIL, PMI, ISO, NCA, or other standards. Use the relevant process owner and control framework to determine the organization's required procedures.

Only authorized administrators should change system configuration or use data-clearance controls. System manuals are repository-managed and protected from business-data reset.
