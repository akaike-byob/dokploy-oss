import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	findBackupById: vi.fn(),
	findDeployments: vi.fn(),
}));

vi.mock("@dokploy/server/db", () => ({
	db: { query: { deployments: { findMany: mocks.findDeployments } } },
}));

vi.mock("@dokploy/server/services/permission", () => ({
	checkPermission: vi.fn(async () => undefined),
	checkServicePermissionAndAccess: vi.fn(async () => undefined),
	findMemberByUserId: vi.fn(),
}));

vi.mock("@dokploy/server", () => ({
	IS_CLOUD: false,
	findBackupById: mocks.findBackupById,
}));

vi.mock("@dokploy/server/lib/auth", () => ({
	validateRequest: vi.fn(),
}));

vi.mock("@/server/api/utils/audit", () => ({
	audit: vi.fn(async () => undefined),
}));

vi.mock("@/server/queues/queueSetup", () => ({
	myQueue: {},
}));

vi.mock("@/server/utils/deploy", () => ({
	fetchDeployApiJobs: vi.fn(),
}));

const { deploymentRouter } = await import("@/server/api/routers/deployment");

const callerWithRole = (role: string) =>
	deploymentRouter.createCaller({
		session: { activeOrganizationId: "org-1" },
		user: { id: "user-1", email: "user@example.com", role },
	} as Parameters<typeof deploymentRouter.createCaller>[0]);

describe("deployment.allByType for a web-server backup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findBackupById.mockResolvedValue({ backupId: "backup-1" });
		mocks.findDeployments.mockResolvedValue([]);
	});

	it("refuses a member, because the row names no service to scope the check to", async () => {
		await expect(
			callerWithRole("member").allByType({ id: "backup-1", type: "backup" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(mocks.findDeployments).not.toHaveBeenCalled();
	});

	it("lists them for an admin", async () => {
		await callerWithRole("admin").allByType({ id: "backup-1", type: "backup" });

		expect(mocks.findDeployments).toHaveBeenCalledTimes(1);
	});
});
