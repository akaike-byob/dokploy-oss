import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	execAsync: vi.fn(),
	execAsyncRemote: vi.fn(),
	pipeBetweenServers: vi.fn(),
	findApplicationById: vi.fn(),
	findComposeById: vi.fn(),
	findServerById: vi.fn(),
	stopCompose: vi.fn(),
	removeCompose: vi.fn(),
	updateCompose: vi.fn(),
	deployCompose: vi.fn(),
	findDeployment: vi.fn(),
}));

vi.mock("@dokploy/server/db", () => ({
	db: { query: { deployments: { findFirst: mocks.findDeployment } } },
}));

vi.mock("@dokploy/server/utils/process/execAsync", () => ({
	execAsync: mocks.execAsync,
	execAsyncRemote: mocks.execAsyncRemote,
	ExecError: class ExecError extends Error {},
}));

vi.mock("@dokploy/server/utils/process/remoteStream", () => ({
	pipeBetweenServers: mocks.pipeBetweenServers,
}));

vi.mock("@dokploy/server/services/application", async (importOriginal) => ({
	...(await importOriginal<object>()),
	findApplicationById: mocks.findApplicationById,
}));

vi.mock("@dokploy/server/services/compose", async (importOriginal) => ({
	...(await importOriginal<object>()),
	findComposeById: mocks.findComposeById,
	stopCompose: mocks.stopCompose,
	removeCompose: mocks.removeCompose,
	updateCompose: mocks.updateCompose,
	deployCompose: mocks.deployCompose,
}));

vi.mock("@dokploy/server/services/server", async (importOriginal) => ({
	...(await importOriginal<object>()),
	findServerById: mocks.findServerById,
}));

const { transferService } = await import("@dokploy/server/services/transfer");

const project = { project: { organizationId: "org-1" } };

const composeService = {
	composeId: "compose-1",
	appName: "stack-app",
	composeType: "docker-compose",
	serverId: "server-a",
	server: { name: "source" },
	mounts: [],
	environment: project,
};

const composeTransfer = {
	serviceType: "compose" as const,
	serviceId: "compose-1",
	targetServerId: "server-b",
	organizationId: "org-1",
	removeSourceData: true,
};

const remoteCommands = () =>
	mocks.execAsyncRemote.mock.calls.map(([, command]) => command as string);

describe("transferService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findServerById.mockResolvedValue({
			serverId: "server-b",
			name: "target",
			organizationId: "org-1",
			serverStatus: "active",
			serverType: "deploy",
		});
		mocks.findComposeById.mockResolvedValue(composeService);
		mocks.execAsyncRemote.mockImplementation(
			async (_serverId: string, command: string) => ({
				stdout: command.startsWith("[ -d") ? "yes" : "",
				stderr: "",
			}),
		);
		mocks.pipeBetweenServers.mockResolvedValue(1);
	});

	it("refuses an uploaded application before it stops anything", async () => {
		mocks.findApplicationById.mockResolvedValue({
			applicationId: "app-1",
			appName: "app",
			sourceType: "drop",
			serverId: "server-a",
			mounts: [],
			environment: project,
		});

		await expect(
			transferService(
				{ ...composeTransfer, serviceType: "application", serviceId: "app-1" },
				vi.fn(),
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(mocks.execAsyncRemote).not.toHaveBeenCalled();
	});

	it("copies the compose files directory before the source cleanup deletes it", async () => {
		await transferService(composeTransfer, vi.fn());

		const copied = mocks.pipeBetweenServers.mock.calls.map(
			([options]) => options.source.command as string,
		);
		expect(copied.some((command) => command.includes("stack-app/files"))).toBe(
			true,
		);
		const copiedAt = Math.max(
			...mocks.pipeBetweenServers.mock.invocationCallOrder,
		);
		expect(mocks.removeCompose.mock.invocationCallOrder[0]).toBeGreaterThan(
			copiedAt,
		);
	});

	it("refuses a compose project with a writable bind the transfer would lose", async () => {
		mocks.execAsyncRemote.mockImplementation(
			async (_serverId: string, command: string) => ({
				stdout: command.includes("{{.Source}}")
					? "/etc/dokploy/compose/stack-app/code/data\n"
					: "",
				stderr: "",
			}),
		);

		await expect(
			transferService(composeTransfer, vi.fn()),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining("code/data"),
		});
		expect(mocks.stopCompose).not.toHaveBeenCalled();
	});

	it("ignores the Docker socket and the files directory the transfer already moves", async () => {
		mocks.execAsyncRemote.mockImplementation(
			async (_serverId: string, command: string) => ({
				stdout: command.includes("{{.Source}}")
					? "/var/run/docker.sock\n/etc/dokploy/compose/stack-app/files/conf\n"
					: "",
				stderr: "",
			}),
		);

		await transferService(composeTransfer, vi.fn());

		expect(mocks.stopCompose).toHaveBeenCalledTimes(1);
		expect(remoteCommands().some((c) => c.includes("docker inspect"))).toBe(
			true,
		);
	});

	it("refuses a compose project using a volume outside its label set, such as an external one", async () => {
		mocks.execAsyncRemote.mockImplementation(
			async (_serverId: string, command: string) => ({
				stdout: command.includes("{{.Name}}")
					? `shared-data\nstack-app_cache\n${"a".repeat(64)}\n`
					: command.startsWith("docker volume ls")
						? "stack-app_cache\n"
						: "",
				stderr: "",
			}),
		);

		await expect(
			transferService(composeTransfer, vi.fn()),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining("shared-data"),
		});
		expect(mocks.stopCompose).not.toHaveBeenCalled();
	});

	it("refuses a compose project with an anonymous volume, which no transfer can recreate by name", async () => {
		const anonymousVolume = "a".repeat(64);
		mocks.execAsyncRemote.mockImplementation(
			async (_serverId: string, command: string) => ({
				stdout: command.includes("{{.Name}}") ? `${anonymousVolume}\n` : "",
				stderr: "",
			}),
		);

		await expect(
			transferService(composeTransfer, vi.fn()),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining(anonymousVolume),
		});
		expect(mocks.stopCompose).not.toHaveBeenCalled();
	});

	it("copies a project volume with no labels, because an earlier transfer created it unlabelled", async () => {
		mocks.findDeployment.mockResolvedValue(undefined);
		mocks.execAsyncRemote.mockImplementation(
			async (_serverId: string, command: string) => ({
				stdout: command.includes("{{.Name}}")
					? "stack-app_db\n"
					: command.includes("--filter name=")
						? "stack-app_db\nold-stack-app_db\n"
						: "",
				stderr: "",
			}),
		);

		await transferService(composeTransfer, vi.fn());

		const copied = JSON.stringify(mocks.pipeBetweenServers.mock.calls);
		expect(copied).toContain("stack-app_db");
		expect(copied).not.toContain("old-stack-app_db");
	});

	it("refuses a stack volume seen only in its service spec, because its task runs on another node", async () => {
		mocks.findComposeById.mockResolvedValue({
			...composeService,
			composeType: "stack",
		});
		mocks.execAsyncRemote.mockImplementation(
			async (_serverId: string, command: string) => ({
				stdout:
					command.includes("docker service inspect") &&
					command.includes('eq .Type "volume"')
						? "worker-data\n"
						: "",
				stderr: "",
			}),
		);

		await expect(
			transferService(composeTransfer, vi.fn()),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining("worker-data"),
		});
	});

	it("refuses a deployed project with no containers, because Docker cannot name its binds", async () => {
		mocks.findDeployment.mockResolvedValue({ deploymentId: "deployment-1" });

		await expect(
			transferService(composeTransfer, vi.fn()),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining("Deploy"),
		});
		expect(mocks.stopCompose).not.toHaveBeenCalled();
	});

	it("moves a project that was never deployed, because it holds no data", async () => {
		mocks.findDeployment.mockResolvedValue(undefined);

		await transferService(composeTransfer, vi.fn());

		expect(mocks.stopCompose).toHaveBeenCalledTimes(1);
	});

	it("reads the binds of a stack from its service spec, because its tasks may run on another node", async () => {
		mocks.findComposeById.mockResolvedValue({
			...composeService,
			composeType: "stack",
		});
		mocks.execAsyncRemote.mockImplementation(
			async (_serverId: string, command: string) => ({
				stdout: command.includes("docker service inspect")
					? "/mnt/stack-data\n"
					: "",
				stderr: "",
			}),
		);

		await expect(
			transferService(composeTransfer, vi.fn()),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining("/mnt/stack-data"),
		});
	});
});
