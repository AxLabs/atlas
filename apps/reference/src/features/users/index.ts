/**
 * Reference: OpenAPI-backed users feature
 *
 * @classification reference — safe to delete or replace when building product.
 * @see ./README.md
 */

export { UserDetailView } from "./components/UserDetailView";
export { UserForm } from "./components/UserForm";
export { UserListView } from "./components/UserListView";
export { userKeys } from "./keys";
export { useCreateUser, useDeleteUser, useUpdateUser } from "./mutations";
export { useUser, useUserList } from "./queries";
