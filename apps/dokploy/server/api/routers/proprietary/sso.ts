import { db } from "@dokploy/server/db";
import {
	socialAuthCredentialsSchema,
	ssoProvider,
} from "@dokploy/server/db/schema";
import { auth } from "@dokploy/server/lib/auth";
import {
	isSocialProviderConfigured,
	removeSocialAuthCredentials,
	saveSocialAuthCredentials,
	socialAuthClientId,
} from "@dokploy/server/services/social-auth";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "../../trpc";

const oidcProviderInput = z.object({
	providerId: z
		.string()
		.min(1)
		.regex(
			/^[a-z0-9-]+$/,
			"Use lowercase letters, numbers and hyphens: it appears in the callback URL",
		),
	issuer: z.string().url(),
	domain: z
		.string()
		.min(1)
		.describe("Email domain routed to this provider, e.g. akaike.ai"),
	clientId: z.string().min(1),
	clientSecret: z.string().min(1),
	discoveryEndpoint: z.string().url().optional(),
	scopes: z.array(z.string()).optional(),
});

const requireAdmin = (role: string) => {
	if (role !== "owner" && role !== "admin") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only an owner or admin can manage sign-in providers",
		});
	}
};

export const ssoRouter = createTRPCRouter({
	/** Whether the login page should offer the SSO route at all. */
	showSignInWithSSO: publicProcedure.query(async () => {
		const provider = await db.query.ssoProvider.findFirst({
			columns: { id: true },
		});
		return Boolean(provider);
	}),

	/**
	 * The providers the login page offers, so signing in is one click rather than typing an
	 * address to be routed by its domain. Only the provider id is exposed: it already appears
	 * in the callback URL registered with the identity provider, whereas the issuer, the email
	 * domain and the organization it belongs to are not public.
	 */
	signInOptions: publicProcedure.query(() =>
		db.query.ssoProvider.findMany({
			columns: { providerId: true },
			orderBy: ssoProvider.createdAt,
		}),
	),

	all: protectedProcedure.query(({ ctx }) =>
		db.query.ssoProvider.findMany({
			where: eq(ssoProvider.organizationId, ctx.session.activeOrganizationId),
			columns: {
				id: true,
				providerId: true,
				issuer: true,
				domain: true,
				createdAt: true,
			},
		}),
	),

	create: protectedProcedure
		.input(oidcProviderInput)
		.mutation(async ({ ctx, input }) => {
			requireAdmin(ctx.user.role);

			try {
				await auth.registerSSOProvider({
					body: {
						providerId: input.providerId,
						issuer: input.issuer,
						domain: input.domain,
						organizationId: ctx.session.activeOrganizationId,
						oidcConfig: {
							clientId: input.clientId,
							clientSecret: input.clientSecret,
							discoveryEndpoint: input.discoveryEndpoint,
							scopes: input.scopes ?? ["openid", "email", "profile"],
							pkce: true,
						},
					},
					headers: new Headers({
						cookie: ctx.req.headers.cookie || "",
					}),
				});
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						error instanceof Error
							? error.message
							: "Could not register the SSO provider",
				});
			}

			return { providerId: input.providerId };
		}),

	remove: protectedProcedure
		.input(z.object({ providerId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			requireAdmin(ctx.user.role);

			await db
				.delete(ssoProvider)
				.where(
					and(
						eq(ssoProvider.providerId, input.providerId),
						eq(ssoProvider.organizationId, ctx.session.activeOrganizationId),
					),
				);

			return { removed: input.providerId };
		}),

	/**
	 * Whether the panel is configured to offer "Continue with Google", from either an OAuth
	 * client registered below or one supplied through the environment. Only the answer is
	 * public: the login page uses it to decide whether to render the button.
	 */
	isGoogleEnabled: publicProcedure.query(() =>
		isSocialProviderConfigured("google"),
	),

	isGithubEnabled: publicProcedure.query(() =>
		isSocialProviderConfigured("github"),
	),

	/**
	 * The OAuth client the panel authenticates Google sign-in with, and where it came from.
	 * The client secret is never returned: it is write-only from here on.
	 */
	googleClient: protectedProcedure.query(({ ctx }) => {
		requireAdmin(ctx.user.role);
		return socialAuthClientId("google");
	}),

	saveGoogleClient: protectedProcedure
		.input(socialAuthCredentialsSchema.omit({ providerId: true }))
		.mutation(async ({ ctx, input }) => {
			requireAdmin(ctx.user.role);
			await saveSocialAuthCredentials({ providerId: "google", ...input });
			return { providerId: "google" as const };
		}),

	removeGoogleClient: protectedProcedure.mutation(async ({ ctx }) => {
		requireAdmin(ctx.user.role);
		await removeSocialAuthCredentials("google");
		return { providerId: "google" as const };
	}),
});
