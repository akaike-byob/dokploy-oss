import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	execAsync: vi.fn(),
	scheduleJob: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs")>();
	return {
		...actual,
		default: { ...actual, existsSync: () => true },
		existsSync: () => true,
	};
});

vi.mock("node-schedule", () => ({
	scheduledJobs: {},
	scheduleJob: mocks.scheduleJob,
}));

vi.mock("@dokploy/server/services/web-server-settings", () => ({
	getWebServerSettings: vi.fn(),
	updateWebServerSettings: vi.fn(),
}));

vi.mock("@dokploy/server/utils/process/execAsync", () => ({
	execAsync: mocks.execAsync,
}));

const { startLogCleanup } = await import(
	"@dokploy/server/utils/access-log/handler"
);

describe("access log cleanup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.execAsync.mockResolvedValue({ stdout: "", stderr: "" });
	});

	it("keeps the inode, because a container file-binding access.log reads it", async () => {
		await startLogCleanup("0 0 * * *");
		const runCleanup = mocks.scheduleJob.mock.calls[0]?.[2];

		await runCleanup();

		const rewrite = mocks.execAsync.mock.calls[0]?.[0] as string;
		expect(rewrite).toContain("tail -n 1000");
		expect(rewrite).not.toMatch(/\bmv\b/);
	});
});
