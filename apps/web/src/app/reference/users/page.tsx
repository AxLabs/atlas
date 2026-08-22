import { UserListView } from "@/features/reference/users";

export const metadata = {
  title: "Users — Reference application",
  description: "Typed OpenAPI users resource with React Query state handling",
};

export default function ReferenceUsersPage() {
  return <UserListView />;
}
