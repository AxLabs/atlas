"use client";

import { Circle, CircleCheck, Plus, RefreshCw, ToggleLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorFallback,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonList,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@atlas/ui";

import { useExampleItems, useToggleExampleItemStatus } from "@/features/examples";
import { ApiError } from "@/lib/api";

import type { ExampleItemsListResponse, ExampleMode } from "@/features/examples";
import type { UseMutationResult } from "@tanstack/react-query";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DataContent({
  isLoading,
  isError,
  error,
  data,
  correlationId,
  refetch,
  toggleStatus,
}: {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  data: ExampleItemsListResponse | undefined;
  correlationId: string | undefined;
  refetch: () => void;
  toggleStatus: UseMutationResult<unknown, Error, string, unknown>;
}) {
  if (isLoading) {
    return <SkeletonList count={4} className="space-y-3" />;
  }

  if (isError) {
    return (
      <ErrorFallback
        title="Failed to load items"
        description={
          error instanceof ApiError ? error.shape.userMessage : "An unexpected error occurred"
        }
        correlationId={correlationId}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data?.data.length) {
    return (
      <EmptyState
        title="No items yet"
        description="Create an item from the form example."
        actions={
          <Button
            onClick={() => {
              window.location.assign("/examples/form");
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create item
          </Button>
        }
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">Status</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-24 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.data.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              {item.status === "closed" ? (
                <CircleCheck className="text-primary h-5 w-5" />
              ) : (
                <Circle className="text-muted-foreground h-5 w-5" />
              )}
            </TableCell>
            <TableCell>
              <div>
                <p
                  className={
                    item.status === "closed" ? "text-muted-foreground line-through" : "font-medium"
                  }
                >
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-muted-foreground max-w-md truncate text-xs">
                    {item.description}
                  </p>
                )}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleStatus.mutate(item.id)}
                disabled={toggleStatus.isPending}
              >
                <ToggleLeft className="mr-1 h-4 w-4" />
                Toggle
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function DataExamplePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as ExampleMode) || "success";

  const { data, isLoading, isError, error, refetch, isFetching } = useExampleItems(mode);
  const toggleStatus = useToggleExampleItemStatus();

  const correlationId = error instanceof ApiError ? error.shape.correlationId : undefined;

  const handleModeChange = (newMode: ExampleMode) => {
    router.push(`/examples/data?mode=${newMode}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Data fetching</h1>
        <p className="text-muted-foreground">
          React Query with typed hooks and intentional loading, empty, error, and success states.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mode</CardTitle>
          <CardDescription>
            Switch modes via query param to exercise each UI state without backend changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <Select
              value={mode}
              onValueChange={(value) => {
                if (value) {
                  handleModeChange(value as ExampleMode);
                }
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="empty">Empty</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="slow">Slow</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refetch
            </Button>
            <Badge variant="secondary">{data?.meta.total ?? 0} items</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <DataContent
            isLoading={isLoading}
            isError={isError}
            error={error}
            data={data}
            correlationId={correlationId}
            refetch={refetch}
            toggleStatus={toggleStatus}
          />
        </CardContent>
      </Card>
    </div>
  );
}
