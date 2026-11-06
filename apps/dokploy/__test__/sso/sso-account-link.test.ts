import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	findProvider: vi.fn(),
	findProviders: vi.fn(),
	findMemberships: vi.fn(),
}));

vi.mock("@dokploy/server/db", () => ({
	db: {
		select: () => ({ from: () => ({ innerJoin: async () => [] }) }),
		query: {
			ssoProvider: {
				findFirst: mocks.findProvider,
				findMany: mocks.findProviders,
			},
			member: { findMany: mocks.findMemberships },
			webServerSettings: { findFirst: async () => null },
		},
	},
}));

const { assertSsoAccountLinkAllowed } = await import(
	"@dokploy/server/services/proprietary/sso"
);
const { auth } = await import("@dokploy/server/lib/auth");

const provider = { organizationId: "org-a", userId: "registrant" };
const victim = { providerId: "attacker-idp", userId: "victim" };

describe("linking an account to an SSO provider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findProvider.mockResolvedValue(provider);
		mocks.findMemberships.mockResolvedValue([]);
	});

	it("allows Google and password accounts without looking at memberships", async () => {
		mocks.findProvider.mockResolvedValue(undefined);

		await expect(
			assertSsoAccountLinkAllowed({ providerId: "google", userId: "victim" }),
		).resolves.toBeUndefined();
		expect(mocks.findMemberships).not.toHaveBeenCalled();
	});

	it("allows a new user, who has no membership yet", async () => {
		await expect(assertSsoAccountLinkAllowed(victim)).resolves.toBeUndefined();
	});

	it("allows a member of the provider's organization", async () => {
		mocks.findMemberships.mockResolvedValue([
			{ organizationId: "org-a", role: "member" },
		]);

		await expect(assertSsoAccountLinkAllowed(victim)).resolves.toBeUndefined();
	});

	it("refuses the panel owner, when another admin registered the provider", async () => {
		mocks.findMemberships.mockResolvedValue([
			{ organizationId: "org-a", role: "owner" },
		]);

		await expect(assertSsoAccountLinkAllowed(victim)).rejects.toThrow();
	});

	it("refuses a user in another organization", async () => {
		mocks.findMemberships.mockResolvedValue([
			{ organizationId: "org-a", role: "member" },
			{ organizationId: "org-b", role: "admin" },
		]);

		await expect(assertSsoAccountLinkAllowed(victim)).rejects.toThrow();
	});

	it("allows the owner who registered the provider", async () => {
		mocks.findMemberships.mockResolvedValue([
			{ organizationId: "org-a", role: "owner" },
		]);

		await expect(
			assertSsoAccountLinkAllowed({
				providerId: "attacker-idp",
				userId: "registrant",
			}),
		).resolves.toBeUndefined();
	});

	it("runs before better-auth creates an account row", async () => {
		mocks.findMemberships.mockResolvedValue([
			{ organizationId: "org-b", role: "owner" },
		]);
		const { databaseHooks } = (
			globalThis as unknown as { betterAuthInstance: { options: AuthOptions } }
		).betterAuthInstance.options;

		await expect(databaseHooks.account.create.before(victim)).rejects.toThrow();
	});
});

type AuthOptions = {
	databaseHooks: {
		account: {
			create: { before: (account: typeof victim) => Promise<unknown> };
		};
	};
};

describe("trusting a sign-in provider", () => {
	it("does not name GitHub or Google, so an unverified address from either links no account", async () => {
		mocks.findProviders.mockResolvedValue([{ providerId: "entra" }]);
		const { accountLinking } = (
			globalThis as unknown as {
				betterAuthInstance: {
					options: {
						account: {
							accountLinking: { trustedProviders: () => Promise<string[]> };
						};
					};
				};
			}
		).betterAuthInstance.options.account;

		expect(await accountLinking.trustedProviders()).toEqual(["entra"]);
	});
});

describe("better-auth's own routes that change a provider", () => {
	it.each(["update-provider", "delete-provider"])(
		"are closed for %s, which would keep account links while changing the issuer",
		async (route) => {
			const response = await auth.handler(
				new Request(`http://localhost:3000/api/auth/sso/${route}`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ providerId: "entra" }),
				}),
			);

			expect(response.status).toBe(404);
		},
	);
});

describe("an SSO provider named after a built-in sign-in method", () => {
	it.each(["credential", "google", "github", "scim"])(
		"refuses the callback of %s, where the identity provider picks the account id",
		async (providerId) => {
			vi.spyOn(console, "error").mockImplementation(() => undefined);

			const response = await auth.handler(
				new Request(
					`http://localhost:3000/api/auth/sso/callback/${providerId}?code=c&state=s`,
				),
			);

			expect(response.status).toBe(403);
		},
	);
});
