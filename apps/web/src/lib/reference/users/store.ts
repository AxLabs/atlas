/**
 * In-memory store for reference users API.
 *
 * @module lib/reference/users/store
 */

import { createReferenceUserSeed } from "./seed";

import type { components } from "@/lib/api/contracts";

type User = components["schemas"]["User"];
type CreateUserRequest = components["schemas"]["CreateUserRequest"];

let users: User[] = createReferenceUserSeed();
let nextId = 100;

export function getReferenceUsers(): User[] {
  return [...users];
}

export function getReferenceUser(userId: string): User | undefined {
  return users.find((user) => user.id === userId);
}

export function createReferenceUser(data: CreateUserRequest): User {
  const newUser: User = {
    id: `reference-user-${nextId++}`,
    email: data.email,
    name: data.name,
    avatarUrl: data.avatarUrl ?? null,
    role: data.role ?? "user",
    createdAt: "2024-02-01T12:00:00Z",
    updatedAt: "2024-02-01T12:00:00Z",
  };

  users.push(newUser);
  return newUser;
}

export function updateReferenceUser(
  userId: string,
  updates: Partial<Pick<User, "name" | "avatarUrl" | "role">>
): User | null {
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) return null;

  const existing = users[index];
  if (!existing) return null;

  const updated: User = {
    ...existing,
    ...updates,
    updatedAt: "2024-02-01T12:00:00Z",
  };

  users[index] = updated;
  return updated;
}

export function deleteReferenceUser(userId: string): boolean {
  const index = users.findIndex((user) => user.id === userId);
  if (index === -1) return false;

  users.splice(index, 1);
  return true;
}

export function resetReferenceUsersStore(): void {
  users = createReferenceUserSeed();
  nextId = 100;
}
