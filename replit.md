# Overview

This is an IT Asset Management System built as a full-stack web application. The system allows organizations to track and manage their IT assets (laptops, desktops, monitors, phones, software), employees, and asset assignments. It provides a comprehensive dashboard with statistics, CRUD operations for all entities, and relationship management between assets and employees through assignments.

The application follows a modern web development architecture with a React-based frontend using shadcn/ui components for a professional interface, an Express.js backend with RESTful APIs, and PostgreSQL for data persistence using Drizzle ORM.

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

The frontend uses a component-based architecture with pages organized by feature (assets, employees, assignments, dashboard). Form components are reusable and handle both create and edit operations. The layout includes a persistent sidebar navigation and header components.

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
- **Employees**: User entity with personal and organizational information
- **Assignments**: Junction entity linking assets to employees with temporal data (assigned/returned dates)
- **Relationships**: Foreign key constraints ensuring referential integrity between assignments and both assets/employees

The schema supports asset lifecycle tracking (available, assigned, maintenance, retired) and maintains historical assignment records even after assets are returned.

## Authentication & Authorization
Currently, the application does not implement authentication or authorization mechanisms. All endpoints are publicly accessible, making this suitable for internal network deployment or as a foundation for adding authentication later.

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