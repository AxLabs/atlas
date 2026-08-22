/**
 * User Queries
 *
 * React Query hooks for fetching user data.
 * Uses runtime-configured API base URL via useApiClient.
 */

"use client";

import { useQuery } from "@tanstack/react-query";

import { normalizeApiError } from "@/lib/api/errors";
import { useApiClient } from "@/lib/api/hooks";

import { userKeys } from "./keys";

import type { components } from "@/lib/api/contracts";
import type { ApiError } from "@/lib/api/errors";

type User = components["schemas"]["User"];
type UserListResponse = components["schemas"]["UserListResponse"];

function buildUsersListEndpoint(params?: { page?: number; pageSize?: number; search?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params?.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  return query ? `/users?${query}` : "/users";
}

export function useUserList(params?: { page?: number; pageSize?: number; search?: string }) {
  const api = useApiClient();

  return useQuery<UserListResponse, ApiError>({
    queryKey: userKeys.list(params),
    queryFn: async () => {
      try {
        return await api.get<UserListResponse>(buildUsersListEndpoint(params));
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
  });
}

export function useUser(userId: string) {
  const api = useApiClient();

  return useQuery<User, ApiError>({
    queryKey: userKeys.detail(userId),
    queryFn: async () => {
      try {
        return await api.get<User>(`/users/${userId}`);
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
    enabled: Boolean(userId),
  });
}
