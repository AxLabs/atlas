import { UserForm } from "@/features/reference/users";

export const metadata = {
  title: "Edit user — Reference application",
};

interface ReferenceEditUserPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReferenceEditUserPage({ params }: ReferenceEditUserPageProps) {
  const { id } = await params;
  return <UserForm mode="edit" userId={id} />;
}
