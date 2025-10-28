# Overview

This is a comprehensive IT Asset Management System built as a full-stack web application. The system allows organizations to track and manage their IT assets (laptops, desktops, monitors, phones, software), employees, asset assignments, budgets, maintenance schedules, and purchase orders. It provides a comprehensive dashboard with statistics, full CRUD operations for all entities, and complete relationship management between assets, employees, budgets, and maintenance tracking.

The application follows a modern web development architecture with a React-based frontend using shadcn/ui components for a professional interface, an Express.js backend with RESTful APIs, and PostgreSQL for data persistence using Drizzle ORM.

## Core Features
- **Asset Management**: Complete lifecycle tracking for IT equipment
- **Employee Management**: Staff records with department and location tracking  
- **Budget Management**: Financial planning with spending progress and department allocation
- **Maintenance Management**: Preventive maintenance scheduling and maintenance record tracking
- **Purchase Orders**: Procurement workflow with vendor and approval management
- **Assignment Tracking**: Asset-to-employee relationships with temporal data
- **Dashboard Analytics**: Real-time statistics and insights across all modules
- **Reports Module**: 10 dedicated report pages with filters, Excel/PDF export, and print functionality

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Build Tool**: Vite for fast development and optimized production builds

The frontend uses a component-based architecture with pages organized by feature (assets, employees, assignments, dashboard, reports). Form components are reusable and handle both create and edit operations. The layout includes a persistent sidebar navigation with collapsible submenus and header components.

### Reports Module
The Reports module consists of 10 individual report pages, each with dedicated routes:
1. **Asset Summary** (/reports/asset-summary) - Overview of all assets by status and type with filters for status and asset type
2. **Lifecycle Analysis** (/reports/lifecycle) - Asset age groups and warranty status tracking
3. **Hardware Inventory** (/reports/hardware-inventory) - Detailed hardware specifications with search and type filters
4. **Assignments** (/reports/assignments) - Current and historical asset assignments with status and search filters
5. **Maintenance** (/reports/maintenance) - Scheduled and overdue maintenance tasks
6. **Purchase Orders** (/reports/purchase-orders) - Purchase order analytics and status tracking
7. **Budget Analysis** (/reports/budget) - Department budgets and spending trends
8. **Department** (/reports/department) - Asset allocation by department
9. **Warranties** (/reports/warranties) - Warranty status and expiration tracking
10. **Vendor Analysis** (/reports/vendor-analysis) - Vendor performance analytics

Each report page includes:
- **Client-side filtering**: Custom filters specific to each report type (fully implemented for Hardware Inventory and Assignments reports; Asset Summary displays aggregated data only without filters)
- **Excel export**: Export report data to Excel spreadsheets using ExcelJS library
- **PDF export**: Generate PDF reports using jsPDF with jspdf-autotable for tables
- **Print functionality**: Print reports using react-to-print library
- **Data visualization**: Interactive charts using recharts library (pie charts, bar charts)

The sidebar navigation includes a collapsible "Reports" menu in the Analytics section that expands to show all 10 report types.

## Backend Architecture
- **Framework**: Express.js with TypeScript for the REST API
- **Database Layer**: Drizzle ORM for type-safe database operations
- **Storage Pattern**: Repository pattern with an IStorage interface
- **API Design**: RESTful endpoints following standard HTTP conventions
- **Error Handling**: Centralized error handling middleware
- **Development**: Hot reloading with Vite middleware integration

The backend implements a clean separation between routes (API endpoints), storage (data access), and business logic. The storage layer uses an interface pattern allowing for different implementations (currently includes in-memory storage for development/testing).

## Database Schema
- **Assets**: Core entity storing IT equipment details including type, status, purchase info, and specifications
- **Employees**: User entity with personal and organizational information (includes employeeId field for user-defined identifiers)
- **Assignments**: Junction entity linking assets to employees with temporal data (assigned/returned dates)
- **Relationships**: Foreign key constraints ensuring referential integrity between assignments and both assets/employees

The schema supports asset lifecycle tracking (available, assigned, maintenance, retired) and maintains historical assignment records even after assets are returned.

## Authentication & Authorization
The application implements comprehensive authentication and authorization using Passport.js with local strategy. Features include:
- **User Authentication**: Username/password authentication with bcrypt password hashing
- **Session Management**: Persistent sessions using PostgreSQL session store (connect-pg-simple)
- **Role-Based Access Control (RBAC)**: Complete role and permission system with granular permissions
- **Protected Routes**: Frontend and backend routes protected by permission requirements
- **Role Management**: Admin interface for creating roles and assigning permissions
- **Permission Management**: 38 system permissions across all resource types (users, assets, roles, etc.)

## Production Deployment
The application is configured for deployment on Replit Cloud Run with the following setup:

### Required Environment Variables
- **DATABASE_URL**: PostgreSQL connection string (automatically provided by Replit)
- **SESSION_SECRET**: Secret key for session encryption (automatically managed by Replit)
- **NODE_ENV**: Set to "production" for production deployments (optional, defaults to "development")
- **PORT**: Server port (automatically provided by Cloud Run, defaults to 5000)
- **HOST**: Server host address (optional, defaults to 0.0.0.0)

### Deployment Features
- **Error Handling**: Process-level error handlers for uncaught exceptions and unhandled rejections
- **Graceful Shutdown**: Proper handling of SIGTERM and SIGINT signals
- **Database Connectivity Check**: Early database connection validation during startup
- **Startup Logging**: Comprehensive logging for deployment diagnostics
- **Cloud Run Compatibility**: Explicit port/host configuration for containerized deployment
- **Production Error Handling**: Non-crashing error handlers in production environment

## Development Environment
- **Hot Reloading**: Vite dev server with Express middleware integration
- **Database Migrations**: Drizzle Kit for schema management and migrations
- **Type Safety**: Full TypeScript coverage across client, server, and shared schema
- **Code Organization**: Monorepo structure with shared types and utilities

# External Dependencies

## Database
- **PostgreSQL**: Primary database using Neon Database serverless PostgreSQL
- **Connection**: @neondatabase/serverless for optimized serverless connections
- **ORM**: Drizzle ORM for type-safe database operations and migrations

## UI Framework
- **Radix UI**: Comprehensive set of accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Icon library for consistent iconography
- **Fonts**: Google Fonts integration for Inter, Architects Daughter, DM Sans, and Fira Code

## Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Type checking and enhanced developer experience
- **ESBuild**: Fast bundling for production builds
- **PostCSS**: CSS processing with Tailwind and Autoprefixer

## Runtime Libraries
- **React Query**: Server state management and caching
- **React Hook Form**: Form state management and validation
- **Zod**: Runtime type validation and schema definition
- **Date-fns**: Date manipulation utilities
- **Class Variance Authority**: Utility for component variant management