/**
 * Upstream puts application-level forward auth (oauth2-proxy in front of deployed apps)
 * behind its enterprise licence. This fork does not implement it.
 *
 * The panel's own Google sign-in is unrelated and lives in the better-auth config
 * (`packages/server/src/lib/auth.ts`) plus `components/proprietary/auth/sign-in-with-google`.
 */
export const isForwardAuthEnabled = async (_serverId?: string | null) => false;
