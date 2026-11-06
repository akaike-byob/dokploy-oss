import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	hasSsoProvider: vi.fn(),
	updateWebServerSettings: vi.fn(),
	registerSSOProvider: vi.fn(),
	removedProviders: vi.fn(async () => [] as { providerId: string }[]),
	deleteAccounts: vi.fn(async () => undefined),
}));

vi.mock("@dokploy/server/db", async () => {
	const { account } = await vi.importActual<
		typeof import("@dokploy/server/db/schema")
	>("@dokploy/server/db/schema");
	return {
		db: {
			delete: (table: unknown) =>
				table === account
					? { where: mocks.deleteAccounts }
					: { where: () => ({ returning: mocks.removedProviders }) },
		},
	};
});

vi.mock("@dokploy/server/lib/auth", () => ({
	auth: { registerSSOProvider: mocks.registerSSOProvider },
	validateRequest: vi.fn(),
}));

vi.mock("@dokploy/server/services/proprietary/sso", () => ({
	hasSsoProvider: mocks.hasSsoProvider,
}));

vi.mock("@dokploy/server/services/web-server-settings", () => ({
	updateWebServerSettings: mocks.updateWebServerSettings,
}));

vi.mock("@dokploy/server/services/social-auth", () => ({
	isSocialProviderConfigured: vi.fn(),
	removeSocialAuthCredentials: vi.fn(),
	saveSocialAuthCredentials: vi.fn(),
	socialAuthClientId: vi.fn(),
}));

const { ssoRouter } = await import("@/server/api/routers/proprietary/sso");

const owner = ssoRouter.createCaller({
	req: { headers: {} },
	session: { activeOrganizationId: "org-1" },
	user: { id: "user-1", role: "owner" },
} as unknown as Parameters<typeof ssoRouter.createCaller>[0]);

const provider = {
	providerId: "entra",
	issuer: "https://idp.example.com",
	domain: "example.com",
	clientId: "client",
	clientSecret: "secret",
};

describe("enforce SSO across provider changes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("clears the flag when the last provider goes, so a later registration cannot re-arm it", async () => {
		mocks.hasSsoProvider.mockResolvedValue(false);

		await owner.remove({ providerId: "entra" });

		expect(mocks.updateWebServerSettings).toHaveBeenCalledWith({
			enforceSSO: false,
		});
	});

	it("keeps the flag while another provider remains", async () => {
		mocks.hasSsoProvider.mockResolvedValue(true);

		await owner.remove({ providerId: "entra" });

		expect(mocks.updateWebServerSettings).not.toHaveBeenCalled();
	});

	it("clears a stored flag on the first registration, which has not proved a login works", async () => {
		mocks.hasSsoProvider.mockResolvedValue(false);

		await owner.create(provider);

		expect(mocks.registerSSOProvider).toHaveBeenCalledTimes(1);
		expect(mocks.updateWebServerSettings).toHaveBeenCalledWith({
			enforceSSO: false,
		});
	});

	it("deletes the provider's account links, because a re-registered id would otherwise reuse them", async () => {
		mocks.hasSsoProvider.mockResolvedValue(true);
		mocks.removedProviders.mockResolvedValue([{ providerId: "entra" }]);

		await owner.remove({ providerId: "entra" });

		expect(mocks.deleteAccounts).toHaveBeenCalledTimes(1);
	});

	it("leaves account links alone when another organization owns the provider", async () => {
		mocks.hasSsoProvider.mockResolvedValue(true);
		mocks.removedProviders.mockResolvedValue([]);

		await owner.remove({ providerId: "entra" });

		expect(mocks.deleteAccounts).not.toHaveBeenCalled();
	});

	it.each(["credential", "google", "github", "scim"])(
		"refuses the provider id %s, which would sign in to accounts of that method",
		async (providerId) => {
			await expect(
				owner.create({ ...provider, providerId }),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(mocks.registerSSOProvider).not.toHaveBeenCalled();
		},
	);

	it("keeps the flag when a provider already exists", async () => {
		mocks.hasSsoProvider.mockResolvedValue(true);

		await owner.create(provider);

		expect(mocks.updateWebServerSettings).not.toHaveBeenCalled();
	});
});
