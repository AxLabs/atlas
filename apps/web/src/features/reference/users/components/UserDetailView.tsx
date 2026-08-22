"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorFallback,
  Skeleton,
} from "@atlas/ui";

import { useDeleteUser, useUser } from "@/features/reference/users";
import { ApiError } from "@/lib/api";
import { getUserFacingMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/auth";
import { Can, hasClientPermission, permissions } from "@/lib/authz";
import { notify, notifyApiError } from "@/lib/notifications";
import { PROTECTED_REFERENCE_USER_ID } from "@/lib/reference/auth/personas";

import { ReferenceAuthRequired } from "../../components/ReferenceAuthRequired";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface UserDetailViewProps {
  userId: string;
}

export function UserDetailView({ userId }: UserDetailViewProps) {
  const router = useRouter();
  const session = useSession();
  const { status, permissions: sessionPermissions } = session;
  const { data: user, error, isLoading, isError, refetch } = useUser(userId);
  const deleteUser = useDeleteUser();

  const handleDelete = useCallback(async () => {
    try {
      await deleteUser.mutateAsync(userId);
      notify.success("User deleted");
      router.push("/reference/users");
    } catch (mutationError) {
      notifyApiError(mutationError);
    }
  }, [deleteUser, router, userId]);

  if (status === "loading") {
    return <p className="text-muted-foreground text-sm">Loading session…</p>;
  }

  if (status === "unauthenticated") {
    return <ReferenceAuthRequired />;
  }

  const canRead = hasClientPermission(sessionPermissions, permissions.users.read);
  const correlationId = error instanceof ApiError ? error.shape.correlationId : undefined;
  const isProtected = userId === PROTECTED_REFERENCE_USER_ID;

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (isError) {
    return (
      <ErrorFallback
        title="Failed to load user"
        description={getUserFacingMessage(error)}
        correlationId={correlationId}
        onRetry={() => refetch()}
      />
    );
  }

  if (!user) {
    return (
      <ErrorFallback
        title="User not found"
        description="The requested user could not be found."
        onRetry={() => router.push("/reference/users")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/reference/users" />}>
            Back to list
          </Button>
          <Can permission={permissions.users.update} grantedPermissions={sessionPermissions}>
            <Button render={<Link href={`/reference/users/${userId}/edit`} />}>Edit</Button>
          </Can>
          <Can permission={permissions.users.delete} grantedPermissions={sessionPermissions}>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive" />}>
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete user?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the user from the in-memory reference store. It cannot be undone in
                    reference mode.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteUser.isPending}
                  >
                    {deleteUser.isPending ? "Deleting…" : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Can>
        </div>
      </div>

      {!canRead ? (
        <Alert variant="destructive">
          <AlertTitle>Permission denied</AlertTitle>
          <AlertDescription>Your session does not include users.read.</AlertDescription>
        </Alert>
      ) : null}

      {isProtected ? (
        <Alert>
          <AlertTitle>Resource policy</AlertTitle>
          <AlertDescription>
            This admin persona is protected from updates by the reference resource policy, even when
            <code> users.update</code> is granted globally.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <DetailRow label="ID" value={user.id} />
          <DetailRow
            label="Role"
            value={<Badge variant="secondary">{user.role ?? "user"}</Badge>}
          />
          <DetailRow label="Created" value={formatDate(user.createdAt)} />
          <DetailRow label="Updated" value={formatDate(user.updatedAt)} />
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
