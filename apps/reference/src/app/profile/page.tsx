import { ReferenceProfileView } from "@/features";

export const metadata = {
  title: "Profile — Reference application",
  description: "Current session and resolved permissions from the standard auth contract",
};

export default function ReferenceProfilePage() {
  return <ReferenceProfileView />;
}
