import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getWebServerSettings: vi.fn(),
	updateWebServerSettings: vi.fn(),
	hasSsoProvider: vi.fn(),
	hasSsoSignIn: vi.fn(),
}));

const noop = vi.fn();

vi.mock("@dokploy/server", () => ({
	CLEANUP_CRON_JOB: "0 0 * * *",
	DEFAULT_UPDATE_DATA: { latestVersion: null, updateAvailable: false },
	IS_CLOUD: false,
	getDockerResourceType: noop,
	getDokployImageTag: () => "canary",
	getUpdateData: noop,
	getWebServerSettings: mocks.getWebServerSettings,
	hasSsoProvider: mocks.hasSsoProvider,
	hasSsoSignIn: mocks.hasSsoSignIn,
	paths: () => ({
		MAIN_TRAEFIK_PATH: "/tmp",
		LOGS_PATH: "/tmp",
		MONITORING_PATH: "/tmp",
		DYNAMIC_TRAEFIK_PATH: "/tmp",
	}),
	hasValidLicense: vi.fn(async () => true),
	spawnAsync: noop,
	updateWebServerSettings: mocks.updateWebServerSettings,
}));

vi.mock("@dokploy/server/lib/auth", () => ({
	validateRequest: vi.fn(),
}));

vi.mock("@/server/api/root", () => ({
	appRouter: {},
}));

vi.mock("@/server/api/utils/audit", () => ({
	audit: vi.fn(async () => undefined),
}));

vi.mock("@/server/queues/queueSetup", () => ({
	cleanAllDeploymentQueue: vi.fn(),
}));

vi.mock("@/server/utils/backup", () => ({
	removeJob: vi.fn(),
	schedule: vi.fn(),
}));

const { settingsRouter } = await import("@/server/api/routers/settings");

const callerWithRole = (role: string) =>
	settingsRouter.createCaller({
		session: { activeOrganizationId: "org-1" },
		user: { id: "user-1", email: "user@example.com", role },
	} as Parameters<typeof settingsRouter.createCaller>[0]);

const storedSettings = {
	remoteServersOnly: true,
	sshPrivateKey: "-----BEGIN OPENSSH PRIVATE KEY-----",
	metricsConfig: {
		server: { type: "Dokploy", token: "metrics-token", port: 4500 },
		containers: { refreshRate: 60 },
	},
};

describe("settings.getWebServerSettings", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getWebServerSettings.mockResolvedValue(storedSettings);
	});

	it("hides the panel's secrets from a member", async () => {
		const settings = await callerWithRole("member").getWebServerSettings();

		expect(settings?.sshPrivateKey).toBeNull();
		expect(settings?.metricsConfig.server.token).toBe("");
		expect(settings?.remoteServersOnly).toBe(true);
	});

	it("returns them to an admin", async () => {
		const settings = await callerWithRole("admin").getWebServerSettings();

		expect(settings?.sshPrivateKey).toBe(storedSettings.sshPrivateKey);
		expect(settings?.metricsConfig.server.token).toBe("metrics-token");
	});
});

describe("settings.updateEnforceSSO", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.hasSsoProvider.mockResolvedValue(true);
		mocks.hasSsoSignIn.mockResolvedValue(true);
	});

	it("refuses to enforce SSO with no provider to sign in through", async () => {
		mocks.hasSsoProvider.mockResolvedValue(false);

		await expect(
			callerWithRole("owner").updateEnforceSSO({ enforceSSO: true }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(mocks.updateWebServerSettings).not.toHaveBeenCalled();
	});

	it("enforces SSO for an owner who signs in through a provider", async () => {
		await callerWithRole("owner").updateEnforceSSO({ enforceSSO: true });

		expect(mocks.hasSsoSignIn).toHaveBeenCalledWith("user-1");
		expect(mocks.updateWebServerSettings).toHaveBeenCalledWith({
			enforceSSO: true,
		});
	});

	it("refuses an admin, because enforcement locks the owner out of password sign-in", async () => {
		await expect(
			callerWithRole("admin").updateEnforceSSO({ enforceSSO: true }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mocks.updateWebServerSettings).not.toHaveBeenCalled();
	});

	it("refuses an owner with no SSO sign-in, who would lock themselves out", async () => {
		mocks.hasSsoSignIn.mockResolvedValue(false);

		await expect(
			callerWithRole("owner").updateEnforceSSO({ enforceSSO: true }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(mocks.updateWebServerSettings).not.toHaveBeenCalled();
	});

	it.each(["owner", "admin"])(
		"lets an %s turn enforcement off, with or without a provider",
		async (role) => {
			mocks.hasSsoProvider.mockResolvedValue(false);
			mocks.hasSsoSignIn.mockResolvedValue(false);

			await callerWithRole(role).updateEnforceSSO({ enforceSSO: false });

			expect(mocks.updateWebServerSettings).toHaveBeenCalledWith({
				enforceSSO: false,
			});
		},
	);
});
