/**
 * Breadcrumb tree for the Atlas reference application.
 *
 * @module breadcrumbs/tree
 */

import { staticResolver } from "./builder";

import type { BreadcrumbNode } from "./types";

export const breadcrumbTree: BreadcrumbNode[] = [
  {
    segment: "users",
    resolver: staticResolver("Users"),
    children: [
      {
        segment: "new",
        resolver: staticResolver("New user"),
      },
    ],
  },
  {
    segment: "profile",
    resolver: staticResolver("Profile"),
  },
  {
    segment: "settings",
    resolver: staticResolver("Settings"),
  },
  {
    segment: "authorization",
    resolver: staticResolver("Authorization"),
  },
  {
    segment: "platform",
    resolver: staticResolver("Platform"),
  },
  {
    segment: "harness",
    resolver: staticResolver("Harness"),
  },
];
