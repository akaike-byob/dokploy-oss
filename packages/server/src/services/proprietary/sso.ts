import { eq } from "drizzle-orm";
import { db } from "../../db";
import { account, member, organization, ssoProvider } from "../../db/schema";
import { getWebServerSettings } from "../web-server-settings";

export const hasSsoProvider = async () => {
	const provider = await db.query.ssoProvider.findFirst({
		columns: { id: true },
	});
	return !!provider;
};

export const hasSsoSignIn = async (userId: string) => {
	const ssoAccounts = await db
		.select({ id: account.id })
		.from(account)
		.innerJoin(ssoProvider, eq(account.providerId, ssoProvider.providerId))
		.where(eq(account.userId, userId))
		.limit(1);
	return ssoAccounts.length > 0;
};

/**
 * A stored flag with no provider behind it would refuse every sign-in, with SQL as the only way
 * back in. The provider can also have been deleted after the flag was set.
 */
export const isSsoEnforced = async () => {
	const settings = await getWebServerSettings();
	return !!settings?.enforceSSO && (await hasSsoProvider());
};

export const getOrganizationOwnerId = async (organizationId: string) => {
	const org = await db.query.organization.findFirst({
		where: eq(organization.id, organizationId),
		columns: { ownerId: true },
	});

	return org?.ownerId ?? null;
};

/**
 * An SSO provider vouches for any address, and a panel user belongs to every organization they
 * joined. So an organization admin's identity provider may sign in only people that organization
 * already fully governs. The person who registered the provider chose to trust it, so they may.
 */
export const assertSsoAccountLinkAllowed = async (account: {
	providerId: string;
	userId: string;
}) => {
	const provider = await db.query.ssoProvider.findFirst({
		where: eq(ssoProvider.providerId, account.providerId),
		columns: { organizationId: true, userId: true },
	});
	if (!provider || provider.userId === account.userId) {
		return;
	}
	const memberships = await db.query.member.findMany({
		where: eq(member.userId, account.userId),
		columns: { organizationId: true, role: true },
	});
	const isBeyondProvider = memberships.some(
		(membership) =>
			membership.role === "owner" ||
			membership.organizationId !== provider.organizationId,
	);
	if (isBeyondProvider) {
		throw new Error(
			`SSO provider ${account.providerId} cannot sign in a user who is an owner or belongs to another organization`,
		);
	}
};
