import { UserForm } from "@/features/reference/users";

export const metadata = {
  title: "Create user — Reference application",
  description: "Create user form with Zod validation and server field error mapping",
};

export default function ReferenceCreateUserPage() {
  return <UserForm mode="create" />;
}
