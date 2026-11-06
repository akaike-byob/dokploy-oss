import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	createBackup: vi.fn(),
	findBackupById: vi.fn(),
	updateBackupById: vi.fn(),
	removeBackupById: vi.fn(),
	restoreWebServerBackup: vi.fn(),
	findDestinationRow: vi.fn(),
	checkServicePermissionAndAccess: vi.fn(),
	findPostgresById: vi.fn(),
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
	createBackup: mocks.createBackup,
	findBackupById: mocks.findBackupById,
	findPostgresById: mocks.findPostgresById,
	updateBackupById: mocks.updateBackupById,
	removeBackupById: mocks.removeBackupById,
	scheduleBackup: vi.fn(),
	removeScheduleBackup: vi.fn(),
}));

vi.mock("@dokploy/server/lib/auth", () => ({
	validateRequest: vi.fn(),
}));

vi.mock("@dokploy/server/utils/restore", () => ({
	restoreWebServerBackup: mocks.restoreWebServerBackup,
}));

vi.mock("@dokploy/server/utils/backups/compose", () => ({
	runComposeBackup: vi.fn(),
}));

vi.mock("@dokploy/server/utils/backups/utils", () => ({
	getS3Credentials: vi.fn(),
	normalizeS3Path: vi.fn(),
}));

vi.mock("@dokploy/server/utils/process/execAsync", () => ({
	execAsync: vi.fn(),
	execAsyncRemote: vi.fn(),
}));

vi.mock("@/server/api/utils/audit", () => ({
	audit: vi.fn(async () => undefined),
}));

vi.mock("@/server/api/utils/plan-limits", () => ({
	assertDatabaseBackupLimit: vi.fn(),
}));

vi.mock("@/server/utils/backup", () => ({
	removeJob: vi.fn(),
	schedule: vi.fn(),
	updateJob: vi.fn(),
}));

const { backupRouter } = await import("@/server/api/routers/backup");
const { assertBackupFileInServiceFolder } = await import(
	"@/server/api/utils/web-server-backup-access"
);

const callerWithRole = (role: string) =>
	backupRouter.createCaller({
		session: { activeOrganizationId: "org-a" },
		user: { id: "user-1", email: "user@example.com", role },
	} as Parameters<typeof backupRouter.createCaller>[0]);

const webServerRestore = {
	databaseType: "web-server" as const,
	backupType: "database" as const,
	databaseName: "dokploy",
	backupFile: "webserver-backup.zip",
	destinationId: "dest-a",
};

const drain = async (stream: unknown) => {
	for await (const _ of stream as AsyncIterable<string>) {
	}
};

const webServerSchedule = {
	backupId: "backup-1",
	destinationId: "dest-a",
	databaseType: "web-server",
	backupType: "database",
	enabled: false,
	schedule: "0 0 * * *",
};

describe("web-server backups belong to owners and admins", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findDestinationRow.mockResolvedValue({
			destinationId: "dest-a",
			organizationId: "org-a",
		});
		// The real check throws NOT_FOUND for an id naming no service, which is what a user id is.
		mocks.checkServicePermissionAndAccess.mockImplementation(
			async (_ctx: unknown, serviceId: string) => {
				if (serviceId !== "pg-1") {
					throw new TRPCError({ code: "NOT_FOUND" });
				}
			},
		);
		mocks.findBackupById.mockResolvedValue(webServerSchedule);
		mocks.createBackup.mockResolvedValue(webServerSchedule);
		mocks.removeBackupById.mockResolvedValue(webServerSchedule);
	});

	it("restores for an owner, whose user id arrives as databaseId from the settings page", async () => {
		const stream = await callerWithRole("owner").restoreBackupWithLogs({
			...webServerRestore,
			databaseId: "user-1",
		});
		await drain(stream);

		expect(mocks.restoreWebServerBackup).toHaveBeenCalledTimes(1);
	});

	it("refuses a member sending an empty databaseId", async () => {
		const stream = await callerWithRole("member").restoreBackupWithLogs({
			...webServerRestore,
			databaseId: "",
		});

		await expect(drain(stream)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(mocks.restoreWebServerBackup).not.toHaveBeenCalled();
	});

	it("refuses a member sending the id of a service they can access", async () => {
		const stream = await callerWithRole("member").restoreBackupWithLogs({
			...webServerRestore,
			databaseId: "pg-1",
		});

		await expect(drain(stream)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(mocks.restoreWebServerBackup).not.toHaveBeenCalled();
	});

	it("refuses a member creating a service-less schedule", async () => {
		await expect(
			callerWithRole("member").create({
				schedule: "0 0 * * *",
				prefix: "/",
				database: "dokploy",
				databaseType: "web-server",
				destinationId: "dest-a",
				enabled: false,
			}),
		).rejects.toBeDefined();
		expect(mocks.createBackup).not.toHaveBeenCalled();
	});

	it("refuses a member naming their service on a web-server schedule, which would dump the panel", async () => {
		await expect(
			callerWithRole("member").create({
				schedule: "* * * * *",
				prefix: "/",
				database: "dokploy",
				databaseType: "web-server",
				destinationId: "dest-a",
				enabled: true,
				postgresId: "pg-1",
			}),
		).rejects.toBeDefined();
		expect(mocks.createBackup).not.toHaveBeenCalled();
	});

	it("refuses a member turning their service's schedule into a web-server one", async () => {
		mocks.findBackupById.mockResolvedValue({
			...webServerSchedule,
			databaseType: "postgres",
			postgresId: "pg-1",
		});

		await expect(
			callerWithRole("member").update({
				backupId: "backup-1",
				schedule: "* * * * *",
				enabled: true,
				prefix: "/",
				destinationId: "dest-a",
				database: "dokploy",
				keepLatestCount: 1,
				serviceName: null,
				metadata: null,
				databaseType: "web-server",
			}),
		).rejects.toBeDefined();
		expect(mocks.updateBackupById).not.toHaveBeenCalled();
	});

	it("refuses an owner creating a service-less schedule of a service type", async () => {
		await expect(
			callerWithRole("owner").create({
				schedule: "0 0 * * *",
				prefix: "/",
				database: "dokploy",
				databaseType: "postgres",
				destinationId: "dest-a",
				enabled: false,
			}),
		).rejects.toBeDefined();
		expect(mocks.createBackup).not.toHaveBeenCalled();
	});

	it("refuses a member repointing a service-less schedule", async () => {
		await expect(
			callerWithRole("member").update({
				backupId: "backup-1",
				schedule: "0 0 * * *",
				enabled: false,
				prefix: "/",
				database: "dokploy",
				keepLatestCount: 0,
				serviceName: null,
				metadata: {},
				databaseType: "web-server",
				destinationId: "dest-b",
			}),
		).rejects.toBeDefined();
		expect(mocks.updateBackupById).not.toHaveBeenCalled();
	});

	it("refuses a member removing a service-less schedule", async () => {
		await expect(
			callerWithRole("member").remove({ backupId: "backup-1" }),
		).rejects.toBeDefined();
		expect(mocks.removeBackupById).not.toHaveBeenCalled();
	});

	it("lets an owner create a service-less schedule", async () => {
		await callerWithRole("owner").create({
			schedule: "0 0 * * *",
			prefix: "/",
			database: "dokploy",
			databaseType: "web-server",
			destinationId: "dest-a",
			enabled: false,
		});

		expect(mocks.createBackup).toHaveBeenCalledTimes(1);
	});
});

describe("the other web-server backup routes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findBackupById.mockResolvedValue(webServerSchedule);
	});

	it("refuses a member running one by hand", async () => {
		await expect(
			callerWithRole("member").manualBackupWebServer({ backupId: "backup-1" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("refuses a member reading one", async () => {
		await expect(
			callerWithRole("member").one({ backupId: "backup-1" }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("restoring a dump into a service", () => {
	it("refuses a member picking a file outside the service's folder", () => {
		expect(() =>
			assertBackupFileInServiceFolder(
				{ user: { role: "member" } },
				"my-postgres",
				"another-team/dump.sql.gz",
			),
		).toThrow("folder");
	});

	it.each([
		"my-postgres/dump.sql.gz",
		"my-postgres/daily/dump.sql.gz",
		"my-postgres_db/dump.sql.gz",
	])("lets a member restore %s", (backupFile) => {
		expect(() =>
			assertBackupFileInServiceFolder(
				{ user: { role: "member" } },
				"my-postgres",
				backupFile,
			),
		).not.toThrow();
	});

	it("does not take a longer app name for the service's own folder", () => {
		expect(() =>
			assertBackupFileInServiceFolder(
				{ user: { role: "member" } },
				"my-postgres",
				"my-postgres-2/dump.sql.gz",
			),
		).toThrow("folder");
	});

	it.each(["owner", "admin"])(
		"lets an %s restore across services, as a migration needs",
		(role) => {
			expect(() =>
				assertBackupFileInServiceFolder(
					{ user: { role } },
					"my-postgres",
					"another-team/dump.sql.gz",
				),
			).not.toThrow();
		},
	);

	it("reaches the route", async () => {
		vi.clearAllMocks();
		mocks.checkServicePermissionAndAccess.mockResolvedValue(undefined);
		mocks.findPostgresById.mockResolvedValue({ appName: "my-postgres" });

		await expect(
			drain(
				await callerWithRole("member").restoreBackupWithLogs({
					...webServerRestore,
					databaseId: "pg-1",
					databaseType: "postgres",
					backupFile: "another-team/dump.sql.gz",
				}),
			),
		).rejects.toThrow("folder");
	});
});

describe("a backup names exactly the service its grant check covers", () => {
	const schedule = {
		schedule: "0 0 * * *",
		prefix: "/",
		database: "db",
		destinationId: "dest-a",
		enabled: false,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.checkServicePermissionAndAccess.mockResolvedValue(undefined);
		mocks.findDestinationRow.mockResolvedValue({
			destinationId: "dest-a",
			organizationId: "org-a",
		});
		mocks.createBackup.mockResolvedValue({ backupId: "backup-1" });
		mocks.findBackupById.mockResolvedValue({
			backupId: "backup-1",
			enabled: false,
		});
	});

	it("refuses a second id the check would skip, which the dump would read", async () => {
		await expect(
			callerWithRole("member").create({
				...schedule,
				databaseType: "mysql",
				postgresId: "my-postgres",
				mysqlId: "mysql-of-another-team",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(mocks.createBackup).not.toHaveBeenCalled();
	});

	it("refuses an id that differs from the database type", async () => {
		await expect(
			callerWithRole("member").create({
				...schedule,
				databaseType: "mysql",
				postgresId: "my-postgres",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("refuses a database id on a compose backup", async () => {
		await expect(
			callerWithRole("member").create({
				...schedule,
				backupType: "compose",
				databaseType: "postgres",
				postgresId: "postgres-of-another-team",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("checks the grant on the id of the database type", async () => {
		await callerWithRole("member").create({
			...schedule,
			databaseType: "mysql",
			mysqlId: "my-mysql",
		});

		expect(mocks.checkServicePermissionAndAccess).toHaveBeenCalledWith(
			expect.anything(),
			"my-mysql",
			{ backup: ["create"] },
		);
		expect(mocks.createBackup).toHaveBeenCalledTimes(1);
	});

	it("accepts a compose backup naming its compose id", async () => {
		await callerWithRole("member").create({
			...schedule,
			backupType: "compose",
			databaseType: "postgres",
			composeId: "my-compose",
			serviceName: "db",
		});

		expect(mocks.checkServicePermissionAndAccess).toHaveBeenCalledWith(
			expect.anything(),
			"my-compose",
			{ backup: ["create"] },
		);
	});
});
