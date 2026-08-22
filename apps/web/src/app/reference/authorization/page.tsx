import { PermissionDenied } from "@/components/authz/PermissionDenied";
import { requirePermission } from "@/lib/application/authz";
import { AuthenticationRequiredError, PermissionDeniedError } from "@/lib/authz";
import { permissions } from "@/lib/authz/permissions";

export const metadata = {
  title: "Protected route — Authorization",
  description: "Server-enforced permission check demonstration",
};

/**
 * Server-protected page — requires users.update permission.
 * reference-user sees PermissionDenied; reference-admin succeeds.
 */
export default async function ReferenceAuthorizationPage() {
  try {
    await requirePermission(permissions.users.update);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return (
        <PermissionDenied
          title="Authentication required"
          description="Sign in with a reference persona to access this page."
        />
      );
    }

    if (error instanceof PermissionDeniedError) {
      return (
        <PermissionDenied description="This page requires the users.update permission. Try reference-admin." />
      );
    }

    throw error;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Authorization</h1>
        <p className="text-muted-foreground text-sm">
          Server-enforced permission check — direct navigation cannot bypass this gate.
        </p>
      </div>
      <h2 className="text-xl font-semibold">Server-protected content</h2>
      <p className="text-muted-foreground text-sm">
        You reached this page because the server verified <code>users.update</code> before
        rendering.
      </p>
    </div>
  );
}
