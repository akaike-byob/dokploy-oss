import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	scheduleJob: vi.fn(),
	findBackupById: vi.fn(),
	runPostgresBackup: vi.fn(),
	keepLatestNBackups: vi.fn(),
	logError: vi.fn(),
}));

vi.mock("@dokploy/server/lib/logger", () => ({
	logger: { info: vi.fn(), error: mocks.logError },
}));

vi.mock("node-schedule", () => ({
	scheduleJob: mocks.scheduleJob,
	scheduledJobs: {},
}));

vi.mock("@dokploy/server/services/backup", () => ({
	findBackupById: mocks.findBackupById,
}));

vi.mock("@dokploy/server/utils/backups/postgres", () => ({
	runPostgresBackup: mocks.runPostgresBackup,
}));

vi.mock("@dokploy/server/utils/backups", () => ({
	keepLatestNBackups: mocks.keepLatestNBackups,
}));

const { scheduleBackup } = await import("@dokploy/server/utils/backups/utils");

const backupOn = (serverId: string) => ({
	backupId: "backup-1",
	schedule: "0 0 * * *",
	backupType: "database",
	databaseType: "postgres",
	postgres: { appName: "pg", serverId },
});

describe("a scheduled backup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("runs on the server the service moved to, because a transfer does not re-register the job", async () => {
		scheduleBackup(backupOn("old-server") as never);
		const runJob = mocks.scheduleJob.mock.calls[0]?.[2] as () => Promise<void>;
		const moved = backupOn("new-server");
		mocks.findBackupById.mockResolvedValue(moved);

		await runJob();

		expect(mocks.findBackupById).toHaveBeenCalledWith("backup-1");
		expect(mocks.runPostgresBackup).toHaveBeenCalledWith(moved.postgres, moved);
		expect(mocks.keepLatestNBackups).toHaveBeenCalledWith(moved, "new-server");
	});

	it("logs a failed run, because node-schedule rethrows a rejected job as an unhandled rejection", async () => {
		scheduleBackup(backupOn("old-server") as never);
		const runJob = mocks.scheduleJob.mock.calls[0]?.[2] as () => Promise<void>;
		mocks.findBackupById.mockRejectedValue(new Error("database is down"));

		await expect(runJob()).resolves.toBeUndefined();

		expect(mocks.logError).toHaveBeenCalledTimes(1);
	});
});
