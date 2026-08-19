import { createTRPCRouter, publicProcedure } from "../../trpc";

export const ssoRouter = createTRPCRouter({
	/**
	 * OIDC/SAML SSO providers are an upstream enterprise feature that this fork does not
	 * implement, so the login page never offers the SSO form.
	 */
	showSignInWithSSO: publicProcedure.query(() => false),

	/**
	 * Whether the panel is configured to offer "Continue with Google". The credentials are read
	 * server-side by better-auth (`packages/server/src/lib/auth.ts`); this only reports whether
	 * they are present so the login page can hide the button when they are not.
	 */
	isGoogleEnabled: publicProcedure.query(
		() =>
			Boolean(process.env.GOOGLE_CLIENT_ID) &&
			Boolean(process.env.GOOGLE_CLIENT_SECRET),
	),

	isGithubEnabled: publicProcedure.query(
		() =>
			Boolean(process.env.GITHUB_CLIENT_ID) &&
			Boolean(process.env.GITHUB_CLIENT_SECRET),
	),
});
