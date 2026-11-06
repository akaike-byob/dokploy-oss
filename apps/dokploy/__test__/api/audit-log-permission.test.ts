import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	checkPermission: vi.fn(),
	recentAuditLogs: vi.fn(),
}));

vi.mock("@dokploy/server/lib/auth", () => ({ validateRequest: vi.fn() }));

vi.mock("@dokploy/server/services/permission", () => ({
	checkPermission: mocks.checkPermission,
}));

vi.mock("@dokploy/server/services/proprietary/audit-log", () => ({
	recentAuditLogs: mocks.recentAuditLogs,
}));

const { auditLogRouter } = await import(
	"@/server/api/routers/proprietary/audit-log"
);

const member = auditLogRouter.createCaller({
	session: { activeOrganizationId: "org-1" },
	user: { id: "user-1", role: "member" },
} as Parameters<typeof auditLogRouter.createCaller>[0]);

describe("auditLog.all", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("refuses a caller without auditLog read, because rows hold user emails and actions", async () => {
		mocks.checkPermission.mockRejectedValue(new Error("denied"));

		await expect(member.all()).rejects.toBeDefined();
		expect(mocks.checkPermission).toHaveBeenCalledWith(expect.anything(), {
			auditLog: ["read"],
		});
		expect(mocks.recentAuditLogs).not.toHaveBeenCalled();
	});
});
