/**
 * Reference harness queries.
 */

"use client";

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { normalizeApiError } from "@/lib/api/errors";
import { useApiClient } from "@/lib/api/hooks";

import { referenceKeys } from "./keys";

import type { components } from "@/lib/api/contracts";
import type { ApiError } from "@/lib/api/errors";

interface ReferenceStatus {
  enabled: boolean;
  disclosure?: string;
  personas?: { id: string; email: string; name: string | null; roles: string[] }[];
  usersScenarios?: string[];
  apiBasePath?: string;
}

type UserListResponse = components["schemas"]["UserListResponse"];

export function useReferenceStatus() {
  return useQuery<ReferenceStatus, ApiError>({
    queryKey: referenceKeys.custom("status"),
    queryFn: async () => {
      try {
        return await apiGet<ReferenceStatus>("/api/status", { skipAuth: true });
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
    staleTime: 30_000,
  });
}

export function useReferenceUserList(scenario?: string) {
  const api = useApiClient();

  return useQuery<UserListResponse, ApiError>({
    queryKey: referenceKeys.custom("users", { scenario }),
    queryFn: async () => {
      try {
        const query = scenario ? `?scenario=${encodeURIComponent(scenario)}` : "";
        return await api.get<UserListResponse>(`/users${query}`, { skipAuth: true });
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
    enabled: Boolean(scenario),
  });
}
