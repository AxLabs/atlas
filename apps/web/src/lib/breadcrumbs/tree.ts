/**
 * Breadcrumb Tree Definition
 *
 * Route segment tree for breadcrumb resolution. Extend this when adding product routes.
 * Reference routes only — consumers replace with their own tree.
 *
 * @module breadcrumbs/tree
 */

import { staticResolver } from "./builder";

import type { BreadcrumbNode } from "./types";

export const breadcrumbTree: BreadcrumbNode[] = [
  {
    segment: "examples",
    resolver: staticResolver("Examples"),
    children: [
      {
        segment: "data",
        resolver: staticResolver("Data"),
      },
      {
        segment: "form",
        resolver: staticResolver("Form"),
      },
    ],
  },
  {
    segment: "reference",
    resolver: staticResolver("Reference"),
    children: [
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
        segment: "authorization",
        resolver: staticResolver("Authorization"),
      },
      {
        segment: "harness",
        resolver: staticResolver("Harness"),
      },
    ],
  },
];
