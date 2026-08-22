import posthog from "posthog-js";
import { Button } from "../../../../../../../packages/ui/src/components/ui/button";

void posthog;
void Button;

export function GET() {
  return fetch("https://example.com");
}
