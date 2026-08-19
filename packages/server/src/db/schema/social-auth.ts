import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

/**
 * The social identity providers whose OAuth client can be configured from the panel. Every
 * entry here has to be wired into better-auth's `socialProviders` as well
 * (`packages/server/src/lib/auth.ts`), since the stored credentials replace the ones read
 * from the environment rather than introducing a provider on their own.
 */
export const socialAuthProviderId = pgEnum("socialAuthProviderId", [
	"google",
	"github",
]);

export const socialAuthProviderIds = socialAuthProviderId.enumValues;
export type SocialAuthProviderId = (typeof socialAuthProviderIds)[number];

/**
 * OAuth client credentials for a social provider, held here so an admin can register them
 * from the panel instead of restarting the container with new environment variables. One row
 * per provider: a panel talks to a single OAuth client per identity provider.
 */
export const socialAuthProvider = pgTable("socialAuthProvider", {
	providerId: socialAuthProviderId("providerId").primaryKey(),
	clientId: text("clientId").notNull(),
	clientSecret: text("clientSecret").notNull(),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
	updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const socialAuthCredentialsSchema = z.object({
	providerId: z.enum(socialAuthProviderIds),
	clientId: z.string().min(1),
	clientSecret: z.string().min(1),
});
