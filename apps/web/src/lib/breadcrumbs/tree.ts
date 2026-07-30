/**
 * Breadcrumb Tree Definition
 *
 * @module breadcrumbs/tree
 */

import { i18nResolver, staticResolver } from "./builder";

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
    segment: "settings",
    resolver: i18nResolver("nav.settings", "Settings"),
    children: [
      {
        segment: "profile",
        resolver: i18nResolver("nav.profile", "Profile"),
      },
    ],
  },
];

export function getBreadcrumbTree(): BreadcrumbNode[] {
  return breadcrumbTree;
}
