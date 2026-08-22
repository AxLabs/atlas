/**
 * User Queries
 *
 * React Query hooks for fetching user data.
 * Uses runtime-configured typed OpenAPI client via useTypedApiClient.
 */

"use client";

import { useQuery } from "@tanstack/react-query";

import { normalizeApiError } from "@/lib/api/errors";
import { useTypedApiClient } from "@/lib/api/hooks";

import { userKeys } from "./keys";

import type { components } from "@/lib/api/contracts";
import type { ApiError } from "@/lib/api/errors";

type User = components["schemas"]["User"];
type UserListResponse = components["schemas"]["UserListResponse"];

export function useUserList(params?: { page?: number; pageSize?: number; search?: string }) {
  const api = useTypedApiClient();

  return useQuery<UserListResponse, ApiError>({
    queryKey: userKeys.list(params),
    queryFn: async () => {
      try {
        return await api.users.list(params);
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
  });
}

export function useUser(userId: string) {
  const api = useTypedApiClient();

  return useQuery<User, ApiError>({
    queryKey: userKeys.detail(userId),
    queryFn: async () => {
      try {
        return await api.users.get(userId);
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
    enabled: Boolean(userId),
  });
}
