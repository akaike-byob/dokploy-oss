import { eq } from "drizzle-orm";
import { db } from "../db";
import {
	type SocialAuthProviderId,
	socialAuthProvider,
} from "../db/schema/social-auth";
import type {
	OAuthClientCredentials,
	StoredSocialCredentials,
} from "../lib/social-auth-providers";

const environmentCredentials: Record<
	SocialAuthProviderId,
	() => OAuthClientCredentials | null
> = {
	google: () =>
		process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
			? {
					clientId: process.env.GOOGLE_CLIENT_ID,
					clientSecret: process.env.GOOGLE_CLIENT_SECRET,
				}
			: null,
	github: () =>
		process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
			? {
					clientId: process.env.GITHUB_CLIENT_ID,
					clientSecret: process.env.GITHUB_CLIENT_SECRET,
				}
			: null,
};

/** The credentials registered from the panel, keyed by provider. */
export const storedSocialCredentials =
	async (): Promise<StoredSocialCredentials> => {
		const rows = await db.query.socialAuthProvider.findMany();
		return Object.fromEntries(
			rows.map((row) => [
				row.providerId,
				{ clientId: row.clientId, clientSecret: row.clientSecret },
			]),
		);
	};

/**
 * Whether the login page can offer this provider: it needs an OAuth client either registered
 * from the panel or supplied through the environment.
 */
export const isSocialProviderConfigured = async (
	providerId: SocialAuthProviderId,
) => {
	const stored = await db.query.socialAuthProvider.findFirst({
		where: eq(socialAuthProvider.providerId, providerId),
		columns: { providerId: true },
	});
	return Boolean(stored) || Boolean(environmentCredentials[providerId]());
};

/** The client id in use, so the panel can show which client it will authenticate against. */
export const socialAuthClientId = async (providerId: SocialAuthProviderId) => {
	const stored = await db.query.socialAuthProvider.findFirst({
		where: eq(socialAuthProvider.providerId, providerId),
		columns: { clientId: true },
	});
	if (stored) {
		return { clientId: stored.clientId, source: "panel" as const };
	}
	const fromEnvironment = environmentCredentials[providerId]();
	return fromEnvironment
		? { clientId: fromEnvironment.clientId, source: "environment" as const }
		: null;
};

export const saveSocialAuthCredentials = async (
	credentials: OAuthClientCredentials & { providerId: SocialAuthProviderId },
) => {
	await db
		.insert(socialAuthProvider)
		.values(credentials)
		.onConflictDoUpdate({
			target: socialAuthProvider.providerId,
			set: {
				clientId: credentials.clientId,
				clientSecret: credentials.clientSecret,
				updatedAt: new Date(),
			},
		});
};

export const removeSocialAuthCredentials = async (
	providerId: SocialAuthProviderId,
) => {
	await db
		.delete(socialAuthProvider)
		.where(eq(socialAuthProvider.providerId, providerId));
};
