import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	checkServicePermissionAndAccess: vi.fn(),
	createVolumeBackup: vi.fn(),
	findApplicationById: vi.fn(),
	findComposeById: vi.fn(),
	findVolumeBackupById: vi.fn(),
	updateVolumeBackup: vi.fn(),
	findDestinationRow: vi.fn(),
	findServerById: vi.fn(),
	findDestinationById: vi.fn(),
}));

vi.mock("@dokploy/server/db", () => ({
	db: { query: { destinations: { findFirst: mocks.findDestinationRow } } },
}));

vi.mock("@dokploy/server/services/permission", () => ({
	checkPermission: vi.fn(async () => undefined),
	checkServicePermissionAndAccess: mocks.checkServicePermissionAndAccess,
}));

vi.mock("@dokploy/server", () => ({
	IS_CLOUD: false,
	createVolumeBackup: mocks.createVolumeBackup,
	findApplicationById: mocks.findApplicationById,
	findComposeById: mocks.findComposeById,
	findDestinationById: mocks.findDestinationById,
	findVolumeBackupById: mocks.findVolumeBackupById,
	updateVolumeBackup: mocks.updateVolumeBackup,
	scheduleVolumeBackup: vi.fn(),
	removeVolumeBackupJob: vi.fn(),
	removeVolumeBackup: vi.fn(),
	restoreVolume: vi.fn(),
	runVolumeBackup: vi.fn(),
}));

vi.mock("@dokploy/server/lib/auth", () => ({
	validateRequest: vi.fn(),
}));

vi.mock("@dokploy/server/services/server", () => ({
	findServerById: mocks.findServerById,
}));

vi.mock("@dokploy/server/utils/process/execAsync", () => ({
	execAsyncRemote: vi.fn(),
	execAsyncStream: vi.fn(),
}));

vi.mock("@/server/api/utils/audit", () => ({
	audit: vi.fn(async () => undefined),
}));

vi.mock("@/server/api/utils/plan-limits", () => ({
	assertVolumeBackupLimit: vi.fn(),
}));

vi.mock("@/server/utils/backup", () => ({
	removeJob: vi.fn(),
	schedule: vi.fn(),
	updateJob: vi.fn(),
}));

const { volumeBackupsRouter } = await import(
	"@/server/api/routers/volume-backups"
);

const caller = volumeBackupsRouter.createCaller({
	session: { activeOrganizationId: "org-a" },
	user: { id: "user-1", email: "user@example.com", role: "member" },
} as Parameters<typeof volumeBackupsRouter.createCaller>[0]);

const restoreInput = {
	backupFileName: "app/daily/data-2026-11-06T10-00-00-000Z.tar",
	destinationId: "dest-a",
	volumeName: "data",
	id: "app-1",
	serviceType: "application" as const,
};

const createInput = {
	name: "data",
	volumeName: "data",
	prefix: "/",
	cronExpression: "0 0 * * *",
	destinationId: "dest-a",
	enabled: false,
};

describe("volume backup router guards", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.checkServicePermissionAndAccess.mockResolvedValue(undefined);
		mocks.findDestinationById.mockResolvedValue({ organizationId: "org-a" });
		mocks.findDestinationRow.mockResolvedValue({
			destinationId: "dest-a",
			organizationId: "org-a",
		});
		mocks.findApplicationById.mockResolvedValue({
			applicationId: "app-1",
			appName: "app",
			serverId: "server-a",
		});
		mocks.findServerById.mockResolvedValue({ organizationId: "org-a" });
		mocks.createVolumeBackup.mockResolvedValue({
			volumeBackupId: "vb-1",
			enabled: false,
		});
		mocks.updateVolumeBackup.mockResolvedValue({
			volumeBackupId: "vb-1",
			enabled: false,
		});
		mocks.findVolumeBackupById.mockResolvedValue({
			volumeBackupId: "vb-1",
			applicationId: "app-1",
		});
	});

	describe("restore", () => {
		it("checks the service grant", async () => {
			mocks.checkServicePermissionAndAccess.mockRejectedValue(
				new Error("You don't have access to this service"),
			);

			await expect(
				caller.restoreVolumeBackupWithLogs({
					...restoreInput,
					serverId: "server-a",
				}),
			).rejects.toThrow("access to this service");
			expect(mocks.checkServicePermissionAndAccess).toHaveBeenCalledWith(
				expect.anything(),
				"app-1",
				{ volumeBackup: ["restore"] },
			);
		});

		it.each([
			"x$(id).tar",
			"x`id`.tar",
			'x".tar',
			"x;id.tar",
			"../../../etc/passwd",
			"a/../../b.tar",
		])("refuses the file name %s", async (backupFileName) => {
			await expect(
				caller.restoreVolumeBackupWithLogs({
					...restoreInput,
					backupFileName,
					serverId: "server-a",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});

		it("refuses a server the service does not run on", async () => {
			await expect(
				caller.restoreVolumeBackupWithLogs({
					...restoreInput,
					serverId: "server-b",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});

		it("refuses a member restoring another service's file", async () => {
			await expect(
				caller.restoreVolumeBackupWithLogs({
					...restoreInput,
					backupFileName: "another-team/data.tar",
					serverId: "server-a",
				}),
			).rejects.toThrow("folder");
		});

		it("accepts a file listed from the service folder", async () => {
			await expect(
				caller.restoreVolumeBackupWithLogs({
					...restoreInput,
					serverId: "server-a",
				}),
			).resolves.toBeDefined();
		});
	});

	describe("create", () => {
		it("refuses a row naming no service", async () => {
			await expect(caller.create(createInput)).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
			expect(mocks.createVolumeBackup).not.toHaveBeenCalled();
		});

		it("refuses a row naming a second service the grant check never saw", async () => {
			await expect(
				caller.create({
					...createInput,
					applicationId: "app-1",
					composeId: "compose-of-another-team",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(mocks.createVolumeBackup).not.toHaveBeenCalled();
		});

		it("refuses a service type that differs from the named service", async () => {
			await expect(
				caller.create({
					...createInput,
					serviceType: "compose",
					applicationId: "app-1",
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});

		it("stores the type of the named service and generates the app name", async () => {
			await caller.create({
				...createInput,
				composeId: "compose-1",
				serviceType: "compose",
				appName: "$(id)",
			} as never);

			const stored = mocks.createVolumeBackup.mock.calls[0]?.[0];
			expect(stored).toMatchObject({
				composeId: "compose-1",
				serviceType: "compose",
			});
			expect(stored).not.toHaveProperty("appName");
			expect(mocks.checkServicePermissionAndAccess).toHaveBeenCalledWith(
				expect.anything(),
				"compose-1",
				{ volumeBackup: ["create"] },
			);
		});
	});

	describe("update", () => {
		it("keeps the row on its service and its generated app name", async () => {
			await caller.update({
				...createInput,
				volumeBackupId: "vb-1",
				composeId: "compose-of-another-team",
				postgresId: "pg-of-another-team",
				appName: "$(id)",
			} as never);

			const stored = mocks.updateVolumeBackup.mock.calls[0]?.[1];
			expect(stored).not.toHaveProperty("composeId");
			expect(stored).not.toHaveProperty("postgresId");
			expect(stored).not.toHaveProperty("appName");
		});
	});
});
