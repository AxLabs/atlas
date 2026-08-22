/**
 * User Mutations
 *
 * React Query mutation hooks for user data modifications.
 * Uses runtime-configured API base URL via useApiClient.
 */

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { normalizeApiError } from "@/lib/api/errors";
import { useApiClient } from "@/lib/api/hooks";

import { userKeys } from "./keys";

import type { components, paths } from "@/lib/api/contracts";
import type { ApiError } from "@/lib/api/errors";

type User = components["schemas"]["User"];
type CreateUserRequest = paths["/users"]["post"]["requestBody"]["content"]["application/json"];
type UpdateUserRequest =
  paths["/users/{userId}"]["patch"]["requestBody"]["content"]["application/json"];

export function useCreateUser() {
  const queryClient = useQueryClient();
  const api = useApiClient();

  return useMutation<User, ApiError, CreateUserRequest>({
    mutationFn: async (data) => {
      try {
        return await api.post<User>("/users", data);
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: userKeys.lists(),
      });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const api = useApiClient();

  return useMutation<User, ApiError, { userId: string; data: UpdateUserRequest }>({
    mutationFn: async ({ userId, data }) => {
      try {
        return await api.patch<User>(`/users/${userId}`, data);
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
    onSuccess: (updatedUser) => {
      void queryClient.invalidateQueries({
        queryKey: userKeys.detail(updatedUser.id),
      });
      void queryClient.invalidateQueries({
        queryKey: userKeys.lists(),
      });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  const api = useApiClient();

  return useMutation<void, ApiError, string>({
    mutationFn: async (userId) => {
      try {
        return await api.delete<void>(`/users/${userId}`);
      } catch (error) {
        throw normalizeApiError(error);
      }
    },
    onSuccess: (_data, userId) => {
      queryClient.removeQueries({
        queryKey: userKeys.detail(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: userKeys.lists(),
      });
    },
  });
}
