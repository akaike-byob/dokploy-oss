import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	findBackupById: vi.fn(),
	findServerById: vi.fn(),
	execAsyncRemote: vi.fn(),
}));

vi.mock("@dokploy/server/db", () => ({
	db: {
		query: { deployments: { findMany: async () => [] } },
		insert: () => ({
			values: () => ({
				returning: async () => [{ deploymentId: "deployment-1" }],
			}),
		}),
	},
}));

vi.mock("@dokploy/server/services/backup", () => ({
	findBackupById: mocks.findBackupById,
}));

vi.mock("@dokploy/server/services/server", () => ({
	findServerById: mocks.findServerById,
}));

vi.mock("@dokploy/server/utils/process/execAsync", () => ({
	execAsync: vi.fn(),
	execAsyncRemote: mocks.execAsyncRemote,
}));

const { createDeploymentBackup } = await import(
	"@dokploy/server/services/deployment"
);

describe("the deployment of a libsql backup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findServerById.mockResolvedValue({ serverId: "server-b" });
		mocks.findBackupById.mockResolvedValue({
			backupId: "backup-1",
			appName: "backup-app",
			backupType: "database",
			libsql: { serverId: "server-b" },
		});
	});

	it("creates its log folder on the server that runs the backup", async () => {
		await createDeploymentBackup({
			backupId: "backup-1",
			title: "Backup",
			description: "",
		});

		expect(mocks.execAsyncRemote).toHaveBeenCalledWith(
			"server-b",
			expect.stringContaining("mkdir -p"),
		);
	});
});
