/**
 * User Mutations
 *
 * React Query mutation hooks for user data modifications.
 * Uses runtime-configured typed OpenAPI client via useTypedApiClient.
 */

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { normalizeApiError } from "@/lib/api/errors";
import { useTypedApiClient } from "@/lib/api/hooks";

import { userKeys } from "./keys";

import type { components, paths } from "@/lib/api/contracts";
import type { ApiError } from "@/lib/api/errors";

type User = components["schemas"]["User"];
type CreateUserRequest = paths["/users"]["post"]["requestBody"]["content"]["application/json"];
type UpdateUserRequest =
  paths["/users/{userId}"]["patch"]["requestBody"]["content"]["application/json"];

export function useCreateUser() {
  const queryClient = useQueryClient();
  const api = useTypedApiClient();

  return useMutation<User, ApiError, CreateUserRequest>({
    mutationFn: async (data) => {
      try {
        return await api.users.create(data);
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
  const api = useTypedApiClient();

  return useMutation<User, ApiError, { userId: string; data: UpdateUserRequest }>({
    mutationFn: async ({ userId, data }) => {
      try {
        return await api.users.update(userId, data);
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
  const api = useTypedApiClient();

  return useMutation<void, ApiError, string>({
    mutationFn: async (userId) => {
      try {
        return await api.users.delete(userId);
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
