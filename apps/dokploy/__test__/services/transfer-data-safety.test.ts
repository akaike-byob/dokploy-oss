import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	execAsync: vi.fn(),
	execAsyncRemote: vi.fn(),
	pipeBetweenServers: vi.fn(),
}));

vi.mock("@dokploy/server/db", () => ({ db: {} }));

vi.mock("@dokploy/server/utils/process/execAsync", () => ({
	execAsync: mocks.execAsync,
	execAsyncRemote: mocks.execAsyncRemote,
	ExecError: class ExecError extends Error {},
}));

vi.mock("@dokploy/server/utils/process/remoteStream", () => ({
	pipeBetweenServers: mocks.pipeBetweenServers,
}));

const { findTransferBlocker, moveComposeFiles } = await import(
	"@dokploy/server/services/transfer"
);

// biome-ignore lint/suspicious/noExplicitAny: the guards read only the fields set here
const service = (fields: Record<string, unknown>): any => ({
	applicationId: "app-1",
	appName: "app",
	serverId: "server-a",
	sourceType: "github",
	mounts: [],
	...fields,
});

const bindMount = { type: "bind", hostPath: "/data/app" };

describe("findTransferBlocker", () => {
	it("refuses a drop application, whose code exists only on the source", () => {
		expect(
			findTransferBlocker(service({ sourceType: "drop" }), "server-b"),
		).toContain("uploaded");
	});

	it("refuses bind mounts leaving the panel host, which the panel container cannot see", () => {
		expect(
			findTransferBlocker(
				service({ serverId: null, mounts: [bindMount] }),
				"server-b",
			),
		).toContain("bind mount");
	});

	it("refuses bind mounts arriving on the panel host, which land in the container layer", () => {
		expect(
			findTransferBlocker(service({ mounts: [bindMount] }), null),
		).toContain("bind mount");
	});

	it("allows bind mounts between remote servers", () => {
		expect(
			findTransferBlocker(service({ mounts: [bindMount] }), "server-b"),
		).toBeNull();
	});

	it("allows a service with no bind mount to reach the panel host", () => {
		expect(findTransferBlocker(service({}), null)).toBeNull();
	});
});

describe("moveComposeFiles", () => {
	const compose = service({ appName: "stack", serverId: "server-a" });

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.pipeBetweenServers.mockResolvedValue(0);
	});

	it("copies the files directory that removing the compose project deletes", async () => {
		mocks.execAsyncRemote.mockResolvedValue({ stdout: "yes\n" });

		await moveComposeFiles(compose, "server-b", vi.fn());

		expect(mocks.pipeBetweenServers).toHaveBeenCalledTimes(1);
		const { source, target } = mocks.pipeBetweenServers.mock.calls[0]?.[0];
		expect(source.serverId).toBe("server-a");
		expect(source.command).toContain("/compose/stack/files");
		expect(target.serverId).toBe("server-b");
		expect(target.command).toContain("/compose/stack/files");
	});

	it("copies nothing when the stack has no files directory", async () => {
		mocks.execAsyncRemote.mockResolvedValue({ stdout: "no\n" });

		await moveComposeFiles(compose, "server-b", vi.fn());

		expect(mocks.pipeBetweenServers).not.toHaveBeenCalled();
	});
});
