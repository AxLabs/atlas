/**
 * Cookie-scoped access to the in-memory users store.
 *
 * @module lib/users/store-scope
 */

import "server-only";

import { cookies } from "next/headers";

import {
  allocateUsersStoreId,
  DEFAULT_USERS_STORE_ID,
  discardUsersStore,
  REFERENCE_USERS_STORE_COOKIE,
  resetReferenceUsersStore,
} from "./store";

const STORE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

/**
 * Return the users-store id for this browser, allocating and persisting one if needed.
 */
export async function resolveReferenceUsersStoreId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(REFERENCE_USERS_STORE_COOKIE)?.value;
  if (existing) {
    return existing;
  }

  const storeId = allocateUsersStoreId();
  cookieStore.set(REFERENCE_USERS_STORE_COOKIE, storeId, STORE_COOKIE_OPTIONS);
  return storeId;
}

/**
 * Replace this browser's users store with a fresh seed and a new store id.
 */
export async function resetReferenceUsersStoreForRequest(): Promise<void> {
  const cookieStore = await cookies();
  const previous = cookieStore.get(REFERENCE_USERS_STORE_COOKIE)?.value;
  if (previous && previous !== DEFAULT_USERS_STORE_ID) {
    discardUsersStore(previous);
  }

  const storeId = allocateUsersStoreId();
  cookieStore.set(REFERENCE_USERS_STORE_COOKIE, storeId, STORE_COOKIE_OPTIONS);
  resetReferenceUsersStore(storeId);
}
