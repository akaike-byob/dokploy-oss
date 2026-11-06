import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	transferService: vi.fn(),
	getWebServerSettings: vi.fn(),
	getAccessibleServerIds: vi.fn(),
}));

vi.mock("@dokploy/server", () => ({
	IS_CLOUD: false,
	getAccessibleServerIds: mocks.getAccessibleServerIds,
	getWebServerSettings: mocks.getWebServerSettings,
	transferService: mocks.transferService,
}));

vi.mock("@dokploy/server/services/permission", () => ({
	checkPermission: vi.fn(async () => undefined),
	checkServicePermissionAndAccess: vi.fn(async () => undefined),
}));

vi.mock("@dokploy/server/lib/auth", () => ({
	validateRequest: vi.fn(),
}));

vi.mock("@/server/api/utils/audit", () => ({
	audit: vi.fn(async () => undefined),
}));

const { transferRouter } = await import("@/server/api/routers/transfer");

const caller = transferRouter.createCaller({
	session: { activeOrganizationId: "org-1" },
	user: { id: "user-1", email: "user@example.com", role: "owner" },
} as Parameters<typeof transferRouter.createCaller>[0]);

const toControlPlane = {
	serviceType: "application" as const,
	serviceId: "app-1",
	targetServerId: null,
	removeSourceData: false,
};

const drain = async (stream: unknown) => {
	for await (const _ of stream as AsyncIterable<string>) {
	}
};

describe("transfer.start honours remoteServersOnly", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.transferService.mockResolvedValue({ appName: "app" });
	});

	it("refuses the control plane when the operator kept it empty", async () => {
		mocks.getWebServerSettings.mockResolvedValue({ remoteServersOnly: true });

		const stream = await caller.start(toControlPlane);

		await expect(drain(stream)).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(mocks.transferService).not.toHaveBeenCalled();
	});

	it("allows the control plane otherwise", async () => {
		mocks.getWebServerSettings.mockResolvedValue({ remoteServersOnly: false });

		const stream = await caller.start(toControlPlane);
		await drain(stream);

		expect(mocks.transferService).toHaveBeenCalledTimes(1);
	});
});
