import { useAuth } from "@/hooks/use-auth";
import { useModules } from "@/hooks/use-modules";
import { Loader2, PackageX } from "lucide-react";
import { Redirect, Route } from "wouter";
import { canAccessItsmWorkbench } from "@/lib/itsm-access";
import { getPersonaHomePath, isPersonaPageAllowed } from "@shared/personas";

export function ProtectedRoute({
  path,
  component: Component,
  requiredPermission,
  requiredAnyPermission,
  requiredModule,
  requiresItsmWorkbench,
  allowLinkedEmployee,
}: {
  path: string;
  component: React.ComponentType;
  requiredPermission?: string;
  requiredAnyPermission?: string[];
  requiredModule?: string;
  requiresItsmWorkbench?: boolean;
  allowLinkedEmployee?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const { isModuleEnabled, isLoading: isModulesLoading } = useModules();

  if (isLoading || (requiredModule && isModulesLoading)) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Resolve feature access before persona/permission redirects so direct URLs
  // show the same disabled-feature state as API calls and navigation links.
  if (requiredModule && !isModuleEnabled(requiredModule)) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center" data-testid="module-not-enabled">
            <PackageX className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h1 className="text-2xl font-bold mb-2">Feature Not Enabled</h1>
            <p className="text-gray-600">This feature is not enabled for this customer.</p>
            <p className="text-sm text-gray-400 mt-2">Ask a system administrator to enable it in Settings.</p>
          </div>
        </div>
      </Route>
    );
  }

  const roleNames = user.roles?.map(role => role.name) ?? [];
  const permissions = user.permissions ?? [];
  if (!isPersonaPageAllowed(roleNames, permissions, path)) {
    return <Route path={path}><Redirect to={getPersonaHomePath(roleNames, permissions)} /></Route>;
  }

  if (requiresItsmWorkbench && !canAccessItsmWorkbench(user)) {
    return <Route path={path}><Redirect to="/portal" /></Route>;
  }

  // Check specific permission if required
  if (requiredPermission && !user.permissions?.includes(requiredPermission) && !(allowLinkedEmployee && user.employeeId)) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to access this page.</p>
            <p className="text-sm text-gray-400 mt-2">Required permission: {requiredPermission}</p>
          </div>
        </div>
      </Route>
    );
  }

  if (requiredAnyPermission && !requiredAnyPermission.some(permission => user.permissions?.includes(permission))) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      </Route>
    );
  }

  return <Route path={path}><Component /></Route>;
}

// Alternative permission-based route guard
export function RequirePermission({
  permission,
  children,
  fallback,
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  if (!user) {
    return fallback || <div>Please log in to view this content.</div>;
  }

  if (!user.permissions?.includes(permission)) {
    return fallback || <div>You don't have permission to view this content.</div>;
  }

  return <>{children}</>;
}