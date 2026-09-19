/**
 * In-memory store for reference users API.
 *
 * Browser sessions are isolated by `atlas_reference_users_store` so concurrent
 * Playwright projects (Chromium + WebKit) can share one Next.js process without
 * `/api/reset` wiping another worker's created users.
 *
 * @module lib/users/store
 */

import { createReferenceUserSeed } from "./seed";

import type { components } from "@/lib/api/contracts";

type User = components["schemas"]["User"];
type CreateUserRequest = components["schemas"]["CreateUserRequest"];

export const REFERENCE_USERS_STORE_COOKIE = "atlas_reference_users_store";
export const DEFAULT_USERS_STORE_ID = "default";

interface UsersStoreState {
  users: User[];
  nextId: number;
}

const stores = new Map<string, UsersStoreState>();

function createStoreState(): UsersStoreState {
  return { users: createReferenceUserSeed(), nextId: 100 };
}

function getState(storeId: string = DEFAULT_USERS_STORE_ID): UsersStoreState {
  let state = stores.get(storeId);
  if (!state) {
    state = createStoreState();
    stores.set(storeId, state);
  }
  return state;
}

export function allocateUsersStoreId(): string {
  return globalThis.crypto.randomUUID();
}

export function getReferenceUsers(storeId: string = DEFAULT_USERS_STORE_ID): User[] {
  return [...getState(storeId).users];
}

export function getReferenceUser(
  userId: string,
  storeId: string = DEFAULT_USERS_STORE_ID
): User | undefined {
  return getState(storeId).users.find((user) => user.id === userId);
}

export function createReferenceUser(
  data: CreateUserRequest,
  storeId: string = DEFAULT_USERS_STORE_ID
): User {
  const state = getState(storeId);
  const newUser: User = {
    id: `reference-user-${state.nextId++}`,
    email: data.email,
    name: data.name,
    avatarUrl: data.avatarUrl ?? null,
    role: data.role ?? "user",
    createdAt: "2024-02-01T12:00:00Z",
    updatedAt: "2024-02-01T12:00:00Z",
  };

  state.users.push(newUser);
  return newUser;
}

export function updateReferenceUser(
  userId: string,
  updates: Partial<Pick<User, "name" | "avatarUrl" | "role">>,
  storeId: string = DEFAULT_USERS_STORE_ID
): User | null {
  const state = getState(storeId);
  const index = state.users.findIndex((user) => user.id === userId);
  if (index === -1) return null;

  const existing = state.users[index];
  if (!existing) return null;

  const updated: User = {
    ...existing,
    ...updates,
    updatedAt: "2024-02-01T12:00:00Z",
  };

  state.users[index] = updated;
  return updated;
}

export function deleteReferenceUser(
  userId: string,
  storeId: string = DEFAULT_USERS_STORE_ID
): boolean {
  const state = getState(storeId);
  const index = state.users.findIndex((user) => user.id === userId);
  if (index === -1) return false;

  state.users.splice(index, 1);
  return true;
}

export function resetReferenceUsersStore(storeId: string = DEFAULT_USERS_STORE_ID): void {
  stores.set(storeId, createStoreState());
}

export function discardUsersStore(storeId: string): void {
  stores.delete(storeId);
}
