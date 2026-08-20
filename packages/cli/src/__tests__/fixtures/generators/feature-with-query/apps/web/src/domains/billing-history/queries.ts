"use client";

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { normalizeApiError } from "@/lib/api/errors";

import { billingHistoryKeys } from "./keys";

import type { ApiError } from "@/lib/api/errors";

/**
 * Query hook scaffold for billing-history.
 *
 * Replace the endpoint and response type with product-specific API details.
 */
export function useBillingHistoryList() {
  return useQuery<unknown, ApiError>({
    queryKey: billingHistoryKeys.lists(),
    queryFn: async () => {
      try {
        // TODO: replace "/api/billing-history" with the product endpoint
        return await apiGet<unknown>("/api/billing-history");
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
  });
}
