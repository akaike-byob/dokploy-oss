import http from "node:http";
import type { AddressInfo } from "node:net";
import { paths } from "@dokploy/server/constants";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

const mocks = vi.hoisted(() => ({
	findDeployment: vi.fn(),
	checkServicePermissionAndAccess: vi.fn(),
	findMemberByUserId: vi.fn(),
	hasPermission: vi.fn(),
	getAccessibleServerIds: vi.fn(),
	validateRequest: vi.fn(),
	spawn: vi.fn(),
}));

vi.mock("@dokploy/server/db", () => ({
	db: { query: { deployments: { findFirst: mocks.findDeployment } } },
}));

vi.mock("@dokploy/server/services/permission", () => ({
	checkServicePermissionAndAccess: mocks.checkServicePermissionAndAccess,
	findMemberByUserId: mocks.findMemberByUserId,
	hasPermission: mocks.hasPermission,
}));

vi.mock("@dokploy/server", () => ({
	IS_CLOUD: false,
	findServerById: vi.fn(),
	getAccessibleServerIds: mocks.getAccessibleServerIds,
	validateRequest: mocks.validateRequest,
}));

vi.mock("node:child_process", async (importOriginal) => ({
	...(await importOriginal<object>()),
	spawn: mocks.spawn,
}));

const { canReadDeploymentLogOverWss } = await import(
	"@/server/wss/deployment-log-access"
);
const { setupDeploymentLogsWebSocketServer } = await import(
	"@/server/wss/listen-deployment"
);

const USER = { id: "user-1" };
const SESSION = { activeOrganizationId: "org-1" };
const LOG_PATH = "/etc/dokploy/logs/app/app-2026.log";

const canRead = () => canReadDeploymentLogOverWss(USER, SESSION, LOG_PATH);

describe("canReadDeploymentLogOverWss", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.checkServicePermissionAndAccess.mockResolvedValue(undefined);
		mocks.findMemberByUserId.mockResolvedValue({ role: "member" });
		mocks.hasPermission.mockResolvedValue(true);
		mocks.getAccessibleServerIds.mockResolvedValue(new Set());
	});

	it("refuses a path no deployment recorded, such as a key file under the base path", async () => {
		mocks.findDeployment.mockResolvedValue(undefined);

		expect(await canRead()).toBe(false);
	});

	it("refuses a missing session", async () => {
		expect(await canReadDeploymentLogOverWss(null, SESSION, LOG_PATH)).toBe(
			false,
		);
		expect(await canReadDeploymentLogOverWss(USER, null, LOG_PATH)).toBe(false);
		expect(mocks.findDeployment).not.toHaveBeenCalled();
	});

	it.each([
		["application", { applicationId: "svc" }],
		["compose", { composeId: "svc" }],
		["preview", { previewDeployment: { applicationId: "svc" } }],
		["schedule", { schedule: { composeId: "svc" } }],
		["backup", { backup: { postgresId: "svc" } }],
		["volume backup", { volumeBackup: { redisId: "svc" } }],
	])("requires the service grant for a %s log", async (_kind, deployment) => {
		mocks.findDeployment.mockResolvedValue(deployment);
		expect(await canRead()).toBe(true);
		expect(mocks.checkServicePermissionAndAccess).toHaveBeenCalledWith(
			expect.objectContaining({ user: USER }),
			"svc",
			{ deployment: ["read"] },
		);

		mocks.checkServicePermissionAndAccess.mockRejectedValue(new Error("denied"));
		expect(await canRead()).toBe(false);
	});

	it.each([
		["server setup", { serverId: "server-1" }],
		["server schedule", { schedule: { serverId: "server-1" } }],
	])("requires access to the server for a %s log", async (_kind, deployment) => {
		mocks.findDeployment.mockResolvedValue(deployment);
		expect(await canRead()).toBe(false);

		mocks.getAccessibleServerIds.mockResolvedValue(new Set(["server-1"]));
		expect(await canRead()).toBe(true);

		mocks.hasPermission.mockResolvedValue(false);
		expect(await canRead()).toBe(false);
	});

	it.each([
		["web server backup", { backup: { backupId: "backup-1" } }],
		["panel schedule", { schedule: { scheduleId: "schedule-1" } }],
	])("limits a %s log to owners and admins", async (_kind, deployment) => {
		mocks.findDeployment.mockResolvedValue(deployment);
		expect(await canRead()).toBe(false);

		mocks.findMemberByUserId.mockResolvedValue({ role: "admin" });
		expect(await canRead()).toBe(true);
	});
});

describe("the deployment log socket", () => {
	let server: http.Server;
	const logPath = `${paths().BASE_PATH}/ssh/id_rsa`;

	const closeAfterConnecting = async () => {
		const { port } = server.address() as AddressInfo;
		const socket = new WebSocket(
			`ws://127.0.0.1:${port}/listen-deployment?logPath=${encodeURIComponent(logPath)}`,
		);
		return new Promise<void>((resolve) => {
			socket.on("close", () => resolve());
			socket.on("error", () => resolve());
		});
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		mocks.validateRequest.mockResolvedValue({ user: USER, session: SESSION });
		mocks.findDeployment.mockResolvedValue(undefined);
		server = http.createServer();
		setupDeploymentLogsWebSocketServer(server);
		await new Promise<void>((resolve) => server.listen(0, resolve));
	});

	afterEach(async () => {
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	});

	it("reads no file for a path no deployment recorded", async () => {
		await closeAfterConnecting();

		expect(mocks.findDeployment).toHaveBeenCalledTimes(1);
		expect(mocks.spawn).not.toHaveBeenCalled();
	});
});
