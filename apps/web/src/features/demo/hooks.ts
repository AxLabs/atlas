/**
 * Demo API React Query Hooks
 *
 * React Query hooks for the demo API endpoints.
 * Demonstrates proper query key patterns, mutations, and invalidation.
 *
 * NOTE: These hooks use direct fetch() calls instead of useApiClient because
 * the demo API routes are hosted on the same Next.js app (not an external API).
 * For external APIs, use useApiClient which handles base URL configuration.
 *
 * @module features/demo/hooks
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api";
import { CORRELATION_ID_HEADER, generateCorrelationId } from "@/lib/api/correlation";
import { createQueryKeys } from "@/lib/react-query/keys";

import type { CreateDemoItemRequest, DemoItem, DemoItemsListResponse, DemoMode } from "./types";

// Query key factory for demo items
export const demoItemsKeys = createQueryKeys("demo-items");

/**
 * Internal helper to make API calls to demo routes.
 * Uses direct fetch since demo routes are on the same origin.
 */
async function demoFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const correlationId = generateCorrelationId();

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      [CORRELATION_ID_HEADER]: correlationId,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = null;
    }

    if (errorBody && typeof errorBody === "object" && "code" in errorBody) {
      throw new ApiError(
        {
          code: errorBody.code as string,
          message: errorBody.message as string,
          userMessage: errorBody.userMessage as string | undefined,
          correlationId: errorBody.correlationId ?? correlationId,
          details: errorBody.details,
        },
        response.status
      );
    }

    throw new ApiError(
      {
        code: `HTTP_${response.status}`,
        message: `HTTP ${response.status}: ${response.statusText}`,
        userMessage: "An unexpected error occurred. Please try again.",
        correlationId,
      },
      response.status
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Hook to fetch demo items with mode switching.
 *
 * @param mode - The demo mode (success, empty, error, slow)
 */
export function useDemoItems(mode: DemoMode = "success") {
  return useQuery({
    queryKey: demoItemsKeys.list({ mode }),
    queryFn: async () => {
      return demoFetch<DemoItemsListResponse>(`/api/demo/items?mode=${mode}`);
    },
    // Don't retry on error mode - it's intentional
    retry: mode === "error" ? false : 2,
    // Keep previous data while fetching to reduce flickering
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Hook to create a new demo item.
 */
export function useCreateDemoItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDemoItemRequest) => {
      return demoFetch<DemoItem>("/api/demo/items", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate all list queries to refresh
      queryClient.invalidateQueries({ queryKey: demoItemsKeys.lists() });
    },
  });
}

/**
 * Hook to toggle demo item status.
 */
export function useToggleDemoItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return demoFetch<DemoItem>(`/api/demo/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "toggle" }),
      });
    },
    // Optimistic update for better UX
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: demoItemsKeys.lists() });

      // Snapshot previous value for rollback
      const previousQueries = queryClient.getQueriesData<DemoItemsListResponse>({
        queryKey: demoItemsKeys.lists(),
      });

      // Optimistically update matching queries
      queryClient.setQueriesData<DemoItemsListResponse>(
        { queryKey: demoItemsKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((item) =>
              item.id === id
                ? { ...item, status: item.status === "open" ? "closed" : "open" }
                : item
            ),
          };
        }
      );

      return { previousQueries };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: demoItemsKeys.lists() });
    },
  });
}
