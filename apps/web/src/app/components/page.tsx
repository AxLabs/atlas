import dynamic from "next/dynamic";

import { Separator } from "@atlas/ui";

const ButtonsSection = dynamic(() =>
  import("./sections/buttons-section").then((mod) => mod.ButtonsSection)
);
const CardsSection = dynamic(() =>
  import("./sections/cards-section").then((mod) => mod.CardsSection)
);
const FormsSection = dynamic(() =>
  import("./sections/forms-section").then((mod) => mod.FormsSection)
);
const BadgesAlertsSection = dynamic(() =>
  import("./sections/badges-alerts-section").then((mod) => mod.BadgesAlertsSection)
);
const TabsSection = dynamic(() => import("./sections/tabs-section").then((mod) => mod.TabsSection));
const AccordionSection = dynamic(() =>
  import("./sections/accordion-section").then((mod) => mod.AccordionSection)
);
const TableSection = dynamic(() =>
  import("./sections/table-section").then((mod) => mod.TableSection)
);
const SkeletonSection = dynamic(() =>
  import("./sections/skeleton-section").then((mod) => mod.SkeletonSection)
);

export default function ComponentsPage() {
  return (
    <div className="container mx-auto space-y-8 p-8">
      <div>
        <h1 className="mb-2 text-4xl font-bold">shadcn/ui Components</h1>
        <p className="text-muted-foreground">
          A showcase of all installed shadcn/ui components compatible with Next.js 16
        </p>
      </div>

      <Separator />

      <ButtonsSection />
      <Separator />
      <CardsSection />
      <Separator />
      <FormsSection />
      <Separator />
      <BadgesAlertsSection />
      <Separator />
      <TabsSection />
      <Separator />
      <AccordionSection />
      <Separator />
      <TableSection />
      <Separator />
      <SkeletonSection />
    </div>
  );
}
