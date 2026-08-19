import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "../../trpc";

/** The fields the panel reads when branding is customized. */
interface Whitelabeling {
	appName: string | null;
	appDescription: string | null;
	logoUrl: string | null;
	loginLogoUrl: string | null;
	footerText: string | null;
	docsUrl: string | null;
	supportUrl: string | null;
	errorPageTitle: string | null;
	errorPageDescription: string | null;
}

/**
 * Whitelabeling is an upstream enterprise feature this fork does not implement. Returning null
 * makes every consumer fall back to the stock branding, which is what they already do when the
 * config is absent.
 */
export const whitelabelingRouter = createTRPCRouter({
	get: protectedProcedure.query((): Whitelabeling | null => null),
	getPublic: publicProcedure.query((): Whitelabeling | null => null),
});
