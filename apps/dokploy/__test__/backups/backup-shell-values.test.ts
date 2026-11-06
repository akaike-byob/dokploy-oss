import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	apiCreateBackup,
	createVolumeBackupSchema,
} from "@dokploy/server/db/schema";
import { logger } from "@dokploy/server/lib/logger";
import { quote } from "shell-quote";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
	execAsync: vi.fn(),
	findDestinationById: vi.fn(),
}));

vi.mock("@dokploy/server/utils/process/execAsync", () => ({
	execAsync: mocks.execAsync,
	execAsyncRemote: mocks.execAsync,
	execAsyncStream: vi.fn(),
}));

vi.mock("@dokploy/server/services/destination", () => ({
	findDestinationById: mocks.findDestinationById,
}));

vi.mock("@dokploy/server/services/compose", async (importOriginal) => ({
	...(await importOriginal<object>()),
	findComposeById: async () => ({
		appName: "app",
		composeType: "stack",
		serverId: null,
	}),
}));

const { keepLatestNBackups } = await import("@dokploy/server/utils/backups");
const { getBackupCommand, getComposeContainerCommand } = await import(
	"@dokploy/server/utils/backups/utils"
);
const { backupVolume } = await import(
	"@dokploy/server/utils/volume-backups/backup"
);
const { cleanupOldVolumeBackups } = await import(
	"@dokploy/server/utils/volume-backups/utils"
);

const MARKER = "injected-ran";
const PAYLOAD = `a$(echo ${MARKER} >&2);echo ${MARKER} >&2;b`;

// Stubs live on PATH because the retention pipeline runs rclone through xargs, which no shell
// function reaches. They print to stdout, so stderr holds only what an injected command wrote.
let stubDirectory: string;

beforeAll(() => {
	stubDirectory = mkdtempSync(join(tmpdir(), "backup-shell-stubs-"));
	const stubs = {
		rclone: `#!/bin/bash
if [ "$1" = lsf ]; then printf 'time1;older.sql.gz\\ntime2;newer.sql.gz\\n'; else printf '%s\\n' "$@"; fi
`,
		docker: `#!/bin/bash
printf '%s\\n' "$@"
`,
	};
	for (const [name, script] of Object.entries(stubs)) {
		writeFileSync(join(stubDirectory, name), script, { mode: 0o755 });
	}
});

afterAll(() => {
	rmSync(stubDirectory, { recursive: true });
});

const runWithStubs = (command: string) =>
	spawnSync("bash", ["-c", `rm() { :; }\n${command}`], {
		encoding: "utf8",
		input: "",
		env: { ...process.env, PATH: `${stubDirectory}:${process.env.PATH}` },
	});

describe("a stored prefix or service name reaches the shell as one word", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findDestinationById.mockResolvedValue({
			bucket: "bucket",
			accessKey: "key",
			secretAccessKey: "secret",
			region: "region",
			endpoint: "https://s3.example.com",
			provider: null,
		});
		mocks.execAsync.mockResolvedValue({ stdout: "", stderr: "" });
	});

	it("runs nothing from the prefix when pruning database backups", async () => {
		await keepLatestNBackups(
			{
				keepLatestCount: 2,
				destinationId: "destination",
				databaseType: "postgres",
				backupType: "database",
				prefix: PAYLOAD,
				postgres: { appName: "pg" },
			} as never,
			undefined,
		);

		const result = runWithStubs(mocks.execAsync.mock.calls[0]?.[0] as string);
		expect(result.stderr).not.toContain(MARKER);
	});

	it("keeps the listed file name appended to the quoted folder", async () => {
		await keepLatestNBackups(
			{
				keepLatestCount: 1,
				destinationId: "destination",
				databaseType: "postgres",
				backupType: "database",
				prefix: "my daily",
				postgres: { appName: "pg" },
			} as never,
			undefined,
		);

		const { stdout } = runWithStubs(
			mocks.execAsync.mock.calls[0]?.[0] as string,
		);

		expect(stdout).toContain(":s3:bucket/pg/my daily/older.sql.gz");
		expect(stdout).not.toContain("newer.sql.gz");
	});

	it("keeps the database password out of the panel log", () => {
		const logged = vi.spyOn(logger, "info").mockImplementation(() => undefined);

		getBackupCommand(
			{
				backupType: "database",
				databaseType: "mysql",
				database: "db",
				mysql: {
					appName: "mysql",
					databaseRootPassword: "stored-password",
				},
			} as never,
			[],
			":s3:bucket/mysql/dump.sql.gz",
			"/logs/backup.log",
		);

		expect(logged).toHaveBeenCalled();
		expect(JSON.stringify(logged.mock.calls)).not.toContain("stored-password");
	});

	it("quotes the upload destination of a database backup", () => {
		const destination = `:s3:bucket/app/${PAYLOAD}/dump.sql.gz`;
		const command = getBackupCommand(
			{
				backupType: "database",
				databaseType: "libsql",
				database: "db",
				libsql: { appName: "libsql" },
			} as never,
			[],
			destination,
			"/logs/backup.log",
		);

		expect(command).toContain(`rclone rcat  ${quote([destination])}`);
		expect(command).toContain(`rclone deletefile  ${quote([destination])}`);
	});

	it.each(["docker-compose", "stack"] as const)(
		"runs nothing from a compose service name on a %s project",
		(composeType) => {
			const result = runWithStubs(
				getComposeContainerCommand("app", PAYLOAD, composeType),
			);

			expect(result.stderr).not.toContain(MARKER);
		},
	);

	it("runs nothing from the prefix or service name of a volume backup", async () => {
		const command = await backupVolume({
			turnOff: true,
			serviceType: "compose",
			volumeName: "data",
			prefix: PAYLOAD,
			appName: "volume-backup",
			destinationId: "destination",
			serviceName: PAYLOAD,
			compose: { appName: "app", composeType: "stack", serverId: null },
		} as never);

		// Takes the mkdir branch of the lock on every platform, and leaves no lock behind to wait on.
		const lockStubs = "command() { return 1; }\nmkdir() { return 0; }\n";
		expect(runWithStubs(`${lockStubs}${command}`).stderr).not.toContain(MARKER);
	});

	it("runs nothing from the prefix when pruning volume backups", async () => {
		await cleanupOldVolumeBackups(
			{
				keepLatestCount: 2,
				destinationId: "destination",
				volumeName: "data",
				prefix: PAYLOAD,
				appName: "volume-backup",
			} as never,
			undefined,
		);

		const result = runWithStubs(mocks.execAsync.mock.calls[0]?.[0] as string);
		expect(result.stderr).not.toContain(MARKER);
	});
});

describe("backup inputs refuse values no bucket path or compose service uses", () => {
	const backup = {
		schedule: "0 0 * * *",
		prefix: "/",
		destinationId: "destination",
		database: "db",
		databaseType: "postgres",
		postgresId: "pg-1",
	};
	const volumeBackup = {
		name: "data",
		volumeName: "data",
		prefix: "daily/",
		cronExpression: "0 0 * * *",
		destinationId: "destination",
		applicationId: "app-1",
	};

	it.each([
		"/",
		"daily",
		"daily/eu-1",
		"my daily/",
		"a.b_c-d",
		"team@prod/",
		"client=acme/",
		"a+b,c/",
		"sauvegardes-été/",
		"my-app/vol-2025-09-01T10:00:00.000Z.tar",
	])(
		"accepts the prefix %s",
		(prefix) => {
			expect(apiCreateBackup.safeParse({ ...backup, prefix }).success).toBe(
				true,
			);
			expect(
				createVolumeBackupSchema.safeParse({ ...volumeBackup, prefix }).success,
			).toBe(true);
		},
	);

	it.each([PAYLOAD, "`id`", "a;b", "a|b", "a'b", '"', "../other", "a/../b"])(
		"refuses the prefix %s",
		(prefix) => {
			expect(apiCreateBackup.safeParse({ ...backup, prefix }).success).toBe(
				false,
			);
			expect(
				createVolumeBackupSchema.safeParse({ ...volumeBackup, prefix }).success,
			).toBe(false);
		},
	);

	it("refuses a compose service name holding shell syntax", () => {
		expect(
			apiCreateBackup.safeParse({ ...backup, serviceName: PAYLOAD }).success,
		).toBe(false);
		expect(
			createVolumeBackupSchema.safeParse({
				...volumeBackup,
				serviceName: PAYLOAD,
			}).success,
		).toBe(false);
	});

	it("accepts the empty service name the volume backup form sends", () => {
		expect(
			createVolumeBackupSchema.safeParse({ ...volumeBackup, serviceName: "" })
				.success,
		).toBe(true);
	});
});
