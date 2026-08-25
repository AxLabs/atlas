/**
 * Reference capability registry — app-owned source of truth for runtime coverage.
 *
 * Powers the Overview capability map. Keep entries aligned with real routes and behavior.
 */

export type ReferenceCapabilityStatus = "demonstrated" | "infrastructure" | "external";

export type ReferenceCapabilityGroup =
  | "application-architecture"
  | "data-and-forms"
  | "identity-and-access"
  | "platform";

export interface ReferenceCapability {
  id: string;
  label: string;
  description: string;
  group: ReferenceCapabilityGroup;
  route?: string;
  status: ReferenceCapabilityStatus;
}

export const REFERENCE_CAPABILITY_GROUPS: Record<
  ReferenceCapabilityGroup,
  { title: string; description: string }
> = {
  "application-architecture": {
    title: "Application architecture",
    description: "App Router, feature ownership, shell, and presentation foundations.",
  },
  "data-and-forms": {
    title: "Data & forms",
    description: "Typed API contracts, React Query, forms, and UI state handling.",
  },
  "identity-and-access": {
    title: "Identity & access",
    description: "Authentication, authorization, and resource policy enforcement.",
  },
  platform: {
    title: "Platform",
    description: "Cross-cutting runtime infrastructure and diagnostics.",
  },
};

export const REFERENCE_CAPABILITIES: ReferenceCapability[] = [
  {
    id: "app-router",
    label: "App Router",
    description: "Thin route shells compose feature modules under src/app.",
    group: "application-architecture",
    route: "/users",
    status: "demonstrated",
  },
  {
    id: "feature-modules",
    label: "Feature-owned modules",
    description: "Domain logic, queries, and UI live in src/features with public index exports.",
    group: "application-architecture",
    route: "/users",
    status: "demonstrated",
  },
  {
    id: "responsive-shell",
    label: "Responsive shell",
    description: "Desktop sidebar and mobile Sheet navigation with shared route list.",
    group: "application-architecture",
    route: "/",
    status: "demonstrated",
  },
  {
    id: "breadcrumbs",
    label: "Breadcrumbs",
    description: "Route-aware breadcrumb tree for nested navigation context.",
    group: "application-architecture",
    route: "/users/new",
    status: "demonstrated",
  },
  {
    id: "theming",
    label: "Theming",
    description: "Light, dark, and system preference via @atlas/ui theme infrastructure.",
    group: "application-architecture",
    route: "/settings",
    status: "demonstrated",
  },
  {
    id: "openapi",
    label: "OpenAPI",
    description: "Generated contracts drive typed api.users.* client methods.",
    group: "data-and-forms",
    route: "/users",
    status: "demonstrated",
  },
  {
    id: "react-query",
    label: "React Query",
    description: "Query key factories, mutations, and cache invalidation in feature modules.",
    group: "data-and-forms",
    route: "/users",
    status: "demonstrated",
  },
  {
    id: "ui-states",
    label: "Loading / empty / error / success",
    description: "Skeleton, EmptyState, and ErrorFallback for async data surfaces.",
    group: "data-and-forms",
    route: "/users",
    status: "demonstrated",
  },
  {
    id: "forms",
    label: "Zod + React Hook Form",
    description: "useZodForm, FormField, and applyServerFieldErrors for create/edit flows.",
    group: "data-and-forms",
    route: "/users/new",
    status: "demonstrated",
  },
  {
    id: "server-validation",
    label: "Server validation",
    description: "Harness validation scenario maps API field errors to form fields.",
    group: "data-and-forms",
    route: "/users/new",
    status: "demonstrated",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "notify abstraction for successful CRUD actions and mutation errors.",
    group: "data-and-forms",
    route: "/users",
    status: "demonstrated",
  },
  {
    id: "authentication",
    label: "Authentication",
    description: "Deterministic reference personas share the production session contract.",
    group: "identity-and-access",
    route: "/profile",
    status: "demonstrated",
  },
  {
    id: "authorization",
    label: "Authorization",
    description: "Client Can gates and server requirePermission enforcement.",
    group: "identity-and-access",
    route: "/authorization",
    status: "demonstrated",
  },
  {
    id: "resource-policy",
    label: "Resource policy",
    description: "Protected admin persona blocked by resource policy despite global permission.",
    group: "identity-and-access",
    route: "/authorization",
    status: "demonstrated",
  },
  {
    id: "feature-flags",
    label: "Feature flags",
    description: "useFlag, useKillSwitch, and FeatureGuard with dev override UI.",
    group: "platform",
    route: "/platform",
    status: "demonstrated",
  },
  {
    id: "kill-switches",
    label: "Kill switches",
    description: "kill_example_feature forcibly disables gated capabilities.",
    group: "platform",
    route: "/platform",
    status: "demonstrated",
  },
  {
    id: "runtime-config",
    label: "Runtime config",
    description: "Validated config facade — no raw process.env in application code.",
    group: "platform",
    route: "/platform",
    status: "demonstrated",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Vendor-agnostic analytics.track contract with consent gating.",
    group: "platform",
    route: "/platform",
    status: "demonstrated",
  },
  {
    id: "consent",
    label: "Consent",
    description: "@atlas/consent integration wires analytics consent state.",
    group: "platform",
    route: "/settings",
    status: "demonstrated",
  },
  {
    id: "observability",
    label: "Observability",
    description: "Controlled failures expose user-safe errors and correlation IDs.",
    group: "platform",
    route: "/platform",
    status: "demonstrated",
  },
  {
    id: "web-vitals",
    label: "Web Vitals",
    description: "WebVitalsReporter configuration and optional local measurements.",
    group: "platform",
    route: "/platform",
    status: "demonstrated",
  },
  {
    id: "sentry",
    label: "Sentry",
    description: "SDK initialization state without requiring credentials in reference mode.",
    group: "platform",
    route: "/platform",
    status: "infrastructure",
  },
  {
    id: "security-headers",
    label: "Security headers / CSP",
    description: "Baseline headers and opt-in CSP mode from runtime configuration.",
    group: "platform",
    route: "/platform",
    status: "demonstrated",
  },
  {
    id: "google-oauth",
    label: "Google OAuth",
    description: "Real OAuth/PKCE integration — configured separately from reference personas.",
    group: "identity-and-access",
    status: "external",
  },
  {
    id: "i18n",
    label: "i18n conventions",
    description: "t() string lookup convention; locale switching not implemented.",
    group: "application-architecture",
    route: "/settings",
    status: "infrastructure",
  },
  {
    id: "accessibility",
    label: "Accessibility conventions",
    description: "Semantic navigation, labels, and focus patterns in real surfaces.",
    group: "application-architecture",
    route: "/users",
    status: "demonstrated",
  },
  {
    id: "responsive",
    label: "Responsive behavior",
    description: "Mobile Sheet navigation and responsive layouts at 390px and desktop widths.",
    group: "application-architecture",
    route: "/",
    status: "demonstrated",
  },
];

export function getCapabilitiesByGroup(): {
  group: ReferenceCapabilityGroup;
  title: string;
  description: string;
  capabilities: ReferenceCapability[];
}[] {
  return (Object.keys(REFERENCE_CAPABILITY_GROUPS) as ReferenceCapabilityGroup[]).map((group) => ({
    group,
    title: REFERENCE_CAPABILITY_GROUPS[group].title,
    description: REFERENCE_CAPABILITY_GROUPS[group].description,
    capabilities: REFERENCE_CAPABILITIES.filter((cap) => cap.group === group),
  }));
}
