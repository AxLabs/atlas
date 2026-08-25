"use client";

import { Download, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  buttonVariants,
  EmptyState,
  ErrorFallback,
  SkeletonList,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@atlas/ui";

import { useUserList } from "@/features/users";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { Can, hasClientPermission, permissions } from "@/lib/authz";
import { FeatureFlags, FeatureGuard } from "@/lib/feature-flags";
import { notify } from "@/lib/notifications";

import { ReferenceAuthRequired } from "../../components/ReferenceAuthRequired";
import { ReferenceLoadingState } from "../../components/ReferenceLoadingState";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function UserListView() {
  const session = useSession();
  const { status, permissions: sessionPermissions } = session;
  const { data, error, isLoading, isError, isFetching, refetch } = useUserList();

  if (status === "loading") {
    return <ReferenceLoadingState />;
  }

  if (status === "unauthenticated") {
    return <ReferenceAuthRequired />;
  }

  const canRead = hasClientPermission(sessionPermissions, permissions.users.read);
  const correlationId = error instanceof ApiError ? error.shape.correlationId : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Typed OpenAPI resource with React Query — scenarios controlled via the harness.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Retry
          </Button>
          <Can permission={permissions.users.create} grantedPermissions={sessionPermissions}>
            <Link href="/users/new" className={buttonVariants({ size: "sm" })}>
              <Plus className="mr-2 h-4 w-4" />
              New user
            </Link>
          </Can>
          <FeatureGuard
            feature={FeatureFlags.EXAMPLE_FEATURE}
            fallback={null}
            killedFallback={
              <Button variant="outline" size="sm" disabled>
                Export (killed)
              </Button>
            }
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                notify.info("Export started", {
                  description:
                    "Example feature flag enabled — no file is produced in reference mode.",
                });
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </FeatureGuard>
        </div>
      </div>

      {!canRead ? (
        <Alert variant="destructive">
          <AlertTitle>Permission denied</AlertTitle>
          <AlertDescription>
            Your session does not include users.read. Switch to a signed-in persona in the harness.
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? <SkeletonList count={4} className="space-y-3" /> : null}

      {isError ? (
        <ErrorFallback
          title="Failed to load users"
          description={
            error instanceof ApiError ? error.shape.userMessage : "An unexpected error occurred"
          }
          correlationId={correlationId}
          onRetry={() => refetch()}
        />
      ) : null}

      {!isLoading && !isError && data && data.data.length === 0 ? (
        <EmptyState
          title="No users"
          description="The current API scenario returned an empty list, or all users were removed."
          actions={
            <Can permission={permissions.users.create} grantedPermissions={sessionPermissions}>
              <Link href="/users/new" className={buttonVariants()}>
                <Plus className="mr-2 h-4 w-4" />
                Create user
              </Link>
            </Can>
          }
        />
      ) : null}

      {!isLoading && !isError && data && data.data.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <Link href={`/users/${user.id}`} className="hover:underline">
                    {user.name}
                  </Link>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{user.role ?? "user"}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(user.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
