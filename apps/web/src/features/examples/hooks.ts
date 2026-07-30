/**
 * React Query hooks for the reference example API.
 *
 * @module features/examples/hooks
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { createQueryKeys } from "@/lib/react-query/keys";

import type {
  CreateExampleItemRequest,
  ExampleItem,
  ExampleItemsListResponse,
  ExampleMode,
} from "./types";

export const exampleItemsKeys = createQueryKeys("example-items");

export function useExampleItems(mode: ExampleMode = "success") {
  return useQuery({
    queryKey: exampleItemsKeys.list({ mode }),
    queryFn: async () => {
      return apiGet<ExampleItemsListResponse>(`/api/examples/items?mode=${mode}`, {
        skipAuth: true,
        skipRetry: mode === "error",
      });
    },
    retry: mode === "error" ? false : 2,
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateExampleItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExampleItemRequest) => {
      return apiPost<ExampleItem>("/api/examples/items", data, { skipAuth: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exampleItemsKeys.lists() });
    },
  });
}

export function useToggleExampleItemStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiPatch<ExampleItem>(
        `/api/examples/items/${id}`,
        { action: "toggle" },
        { skipAuth: true }
      );
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: exampleItemsKeys.lists() });

      const previousQueries = queryClient.getQueriesData<ExampleItemsListResponse>({
        queryKey: exampleItemsKeys.lists(),
      });

      queryClient.setQueriesData<ExampleItemsListResponse>(
        { queryKey: exampleItemsKeys.lists() },
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
      if (context?.previousQueries) {
        for (const [queryKey, data] of context.previousQueries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: exampleItemsKeys.lists() });
    },
  });
}
