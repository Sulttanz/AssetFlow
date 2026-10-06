# Overview

This project is a full-stack IT Asset Management System designed to help organizations track and manage their IT assets, employees, assignments, budgets, maintenance, and purchase orders. It provides a comprehensive dashboard, full CRUD operations, and robust relationship management.

The system aims to streamline IT operations, enhance financial planning, and improve asset lifecycle management. It leverages a modern web development stack including React with shadcn/ui for the frontend, Express.js for the backend, and PostgreSQL with Drizzle ORM for data persistence. Key capabilities include:

-   **Comprehensive Asset Tracking**: Full lifecycle management of IT equipment.
-   **Financial Oversight**: Budget and purchase order management with automated syncing.
-   **Maintenance & Assignment Management**: Scheduling, tracking, and linking assets to employees.
-   **Advanced Features**: Reporting, data import/export, alerts, depreciation, software licensing, disposal workflows, asset booking, contract management, asset audits, request portals, QR code generation, and asset-to-asset relationships.
-   **Security & Scalability**: Implements robust authentication with RBAC and is configured for scalable cloud deployment.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built with React 18 and TypeScript, utilizing Wouter for routing and TanStack Query for server state management. UI components are crafted with shadcn/ui (based on Radix UI) and styled using Tailwind CSS. Forms are managed with React Hook Form and Zod validation. Vite handles fast development and optimized production builds.

The deployment runs `npm run build`, which explicitly runs `npm run audit:security` before compiling, blocking publication if the audit fails even when npm lifecycle scripts are disabled. The registered `security-audit` validation step is also available for local checks. It audits all locked dependencies, including development dependencies, and fails on high or critical vulnerabilities. Low and moderate findings are reported but do not block release; there are no package-specific exceptions. Resolve high/critical findings in the lockfile rather than suppressing the audit.

-   **UI/UX**: Professional interface with shadcn/ui components, component-based architecture, and a persistent sidebar navigation.
-   **Pagination**: Client-side pagination (10 items per page) is consistently implemented across all major list pages (e.g., Assets, Employees, Purchase Orders) to optimize performance and user experience, featuring navigation controls, item counts, and automatic state adjustments.
-   **Reports Module**: Features 13 dedicated report pages (e.g., Asset Summary, Lifecycle Analysis, Budget Analysis, Released Assets, Depreciation, Assignment History) with client-side filtering, Excel/PDF export, print functionality, and data visualization using recharts. Each report utilizes dedicated API endpoints for efficient data retrieval. The Assignment History report (`/reports/assignment-history`) shows every asset assignment and return event with duration tracking, status badges, and filters by status/type/department.
-   **Asset Depreciation**: Full depreciation tracking supporting straight-line and declining-balance methods. Calculates current book value, accumulated depreciation, and generates year-by-year schedules. Accessible via the Depreciation Report page (with chart, filters, schedule modal per asset) and inline within the asset form's Financial tab (expandable schedule table).
-   **Dashboard Customization**: Allows users to customize widget visibility, with preferences saved locally.
-   **Two-Factor Authentication (2FA)**: TOTP-based 2FA setup is available in settings, using speakeasy and InputOTP for a secure verification flow.

## Backend Architecture

The backend is an Express.js application written in TypeScript, providing RESTful APIs. It uses Drizzle ORM for type-safe database interactions and follows a repository pattern with an `IStorage` interface for data access. Centralized error handling middleware ensures robustness.

-   **Core Features**: Implements full CRUD operations for all entities, relationship management, and complex business logic for features like asset depreciation, software license tracking, and various workflow management (disposal, booking, audit, request).
-   **Alerts & Notifications**: Real-time alerts for warranty expiry, overdue maintenance, budget thresholds, and software license usage.
-   **File Management**: Supports file attachments (invoices, photos) up to 20MB, stored on the server, with download and delete capabilities.
-   **Bulk Operations**: Functionality for bulk updating asset properties.
-   **Data Import**: Handles bulk data import for Assets, Employees, and Assignments via Excel files, including row-by-row error handling and audit logging.
-   **QR Code Generation**: Generates scannable QR codes for individual assets with print and download options.

## Database Schema

The PostgreSQL database schema includes core entities like Assets, Employees, Assignments, Budgets, Maintenance, and Purchase Orders. It enforces referential integrity and supports complex relationships, including temporal data for assignments and manager roles within departments. The schema is designed for asset lifecycle tracking and historical data retention.

## Authentication & Authorization

The system features comprehensive authentication and authorization using Passport.js with a local strategy.

-   **Authentication**: Username/password authentication with bcrypt hashing and persistent session management via PostgreSQL.
-   **Authorization**: Role-Based Access Control (RBAC) with granular permissions across 38 system permissions, managed through an admin interface.
-   **Security**: Protected frontend and backend routes, ensuring secure access based on user roles and permissions.

## Production Deployment

The application is configured for deployment on Replit Cloud Run, requiring specific environment variables for database connection, session secret, and server configuration. It includes robust error handling, graceful shutdown procedures, database connectivity checks, and comprehensive startup logging optimized for containerized environments.

# External Dependencies

## Database

-   **PostgreSQL**: Primary data store, utilizing Neon Database for serverless PostgreSQL.
-   **Connection**: `@neondatabase/serverless` for optimized serverless connections.
-   **ORM**: Drizzle ORM for type-safe database interactions and migrations.

## UI Framework

-   **Radix UI**: Accessible UI primitives.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **Lucide React**: Icon library.
-   **Google Fonts**: Inter, Architects Daughter, DM Sans, Fira Code.

## Development Tools

-   **Vite**: Build tool and development server.
-   **TypeScript**: For type safety across the stack.
-   **ESBuild**: Fast bundling.
-   **PostCSS**: CSS processing.

## Runtime Libraries

-   **TanStack Query (React Query)**: Server state management and caching.
-   **React Hook Form**: Form state management and validation.
-   **Zod**: Runtime type validation and schema definition.
-   **Date-fns**: Date manipulation utilities.
-   **Class Variance Authority**: Utility for component variant management.
-   **ExcelJS**: For Excel file parsing and generation.
-   **jsPDF** with **jspdf-autotable**: For PDF report generation.
-   **recharts**: For data visualization in reports.
-   **react-to-print**: For print functionality.
-   **Multer**: For file upload handling on the backend.
-   **Passport.js**: For authentication.
-   **bcrypt**: For password hashing.
-   **speakeasy**: For TOTP-based 2FA backend.