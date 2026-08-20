"use client";

import { useQuery } from "@tanstack/react-query";

import { normalizeApiError } from "@/lib/api/errors";

import { billingHistoryKeys } from "./keys";

import type { ApiError } from "@/lib/api/errors";

async function fetchBillingHistoryList(): Promise<unknown> {
  throw new Error("Implement billing-history list fetching with the product API contract.");
}

/**
 * Query hook scaffold for billing-history.
 *
 * Replace fetchBillingHistoryList with the product-specific API contract.
 */
export function useBillingHistoryList() {
  return useQuery<unknown, ApiError>({
    queryKey: billingHistoryKeys.lists(),
    queryFn: async () => {
      try {
        return await fetchBillingHistoryList();
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
  });
}
