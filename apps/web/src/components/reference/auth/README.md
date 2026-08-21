# Reference: Google OAuth auth UI

**Classification:** reference implementation — demonstrates wiring `useSession` to UI.

These components integrate with the **platform auth session contract** (`@/lib/auth`) but are
**Google-specific** in their sign-in flow (`/api/auth/google/start`). They are not the universal
Atlas authentication model.

| Component      | Purpose                      |
| -------------- | ---------------------------- |
| `SignInButton` | Starts Google OAuth flow     |
| `UserMenu`     | Avatar dropdown with logout  |
| `AuthGuard`    | Client-side route protection |

**Not mounted** in the current app. The coherent reference application (#39) will consume these or
replace them with consumer-chosen IdP UI.

For server-side protection, use `getServerSession()` / `requireSession()` from `@/lib/auth/server`.
