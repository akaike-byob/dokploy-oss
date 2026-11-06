import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getWebServerSettings: vi.fn(),
	findProvider: vi.fn(),
}));

vi.mock("@dokploy/server/db", () => ({
	db: { query: { ssoProvider: { findFirst: mocks.findProvider } } },
}));

vi.mock("@dokploy/server/services/web-server-settings", () => ({
	getWebServerSettings: mocks.getWebServerSettings,
}));

const { isSsoEnforced } = await import(
	"@dokploy/server/services/proprietary/sso"
);

describe("isSsoEnforced", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not enforce a stored flag with no provider, which would lock everyone out", async () => {
		mocks.getWebServerSettings.mockResolvedValue({ enforceSSO: true });
		mocks.findProvider.mockResolvedValue(undefined);

		expect(await isSsoEnforced()).toBe(false);
	});

	it("enforces the flag when a provider exists", async () => {
		mocks.getWebServerSettings.mockResolvedValue({ enforceSSO: true });
		mocks.findProvider.mockResolvedValue({ id: "provider-1" });

		expect(await isSsoEnforced()).toBe(true);
	});

	it("does not enforce when the flag is off", async () => {
		mocks.getWebServerSettings.mockResolvedValue({ enforceSSO: false });
		mocks.findProvider.mockResolvedValue({ id: "provider-1" });

		expect(await isSsoEnforced()).toBe(false);
	});
});
