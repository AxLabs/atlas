import { UserDetailView } from "@/features/reference/users";

export const metadata = {
  title: "User detail — Reference application",
};

interface ReferenceUserDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReferenceUserDetailPage({ params }: ReferenceUserDetailPageProps) {
  const { id } = await params;
  return <UserDetailView userId={id} />;
}
