import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../trpc";

const notImplemented = () => {
	throw new TRPCError({
		code: "NOT_IMPLEMENTED",
		message:
			"Application authentication is not implemented in this fork. Put an auth proxy in front of the app instead.",
	});
};

/**
 * Upstream's "Application Authentication" puts deployed apps behind an OIDC gate. It is an
 * enterprise feature this fork does not implement; panel sign-in is unrelated and unaffected.
 */
export const forwardAuthRouter = createTRPCRouter({
	status: protectedProcedure
		.input(z.object({ domainId: z.string() }))
		.query(() => ({ enabled: false })),
	enable: protectedProcedure
		.input(z.object({ domainId: z.string() }))
		.mutation(notImplemented),
	disable: protectedProcedure
		.input(z.object({ domainId: z.string() }))
		.mutation(notImplemented),
});
