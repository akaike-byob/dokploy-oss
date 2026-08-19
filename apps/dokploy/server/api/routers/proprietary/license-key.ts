import { createTRPCRouter, protectedProcedure } from "../../trpc";

/**
 * This fork has no licensing tier. The UI uses this flag to decide whether to offer features
 * upstream sells; here they are simply available, so it is constant.
 */
export const licenseKeyRouter = createTRPCRouter({
	haveValidLicenseKey: protectedProcedure.query(() => true),
});
