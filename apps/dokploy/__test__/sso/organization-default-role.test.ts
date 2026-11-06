import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rows: vi.fn() }));

vi.mock("@dokploy/server/db", () => ({
	db: {
		select: () => ({
			from: () => ({ leftJoin: () => ({ where: mocks.rows }) }),
		}),
	},
}));

const { resolveOrganizationDefaultRole } = await import(
	"@dokploy/server/services/proprietary/license-key"
);

describe("the role of a member who joins through SSO or SCIM", () => {
	beforeEach(() => {
		mocks.rows.mockReset();
	});

	it.each([
		["a missing organization", [], "member"],
		["an unset default", [{ configured: null, customRoleId: null }], "member"],
		["member", [{ configured: "member", customRoleId: null }], "member"],
		["admin", [{ configured: "admin", customRoleId: null }], "admin"],
		["owner", [{ configured: "owner", customRoleId: null }], "member"],
		[
			"a custom role row named owner",
			[{ configured: "owner", customRoleId: "role-1" }],
			"member",
		],
		[
			"an existing custom role",
			[{ configured: "support", customRoleId: "role-1" }],
			"support",
		],
		[
			"a deleted custom role",
			[{ configured: "support", customRoleId: null }],
			"member",
		],
	])("resolves %s", async (_case, rows, expected) => {
		mocks.rows.mockResolvedValue(rows);

		expect(await resolveOrganizationDefaultRole("org-1")).toBe(expected);
	});
});
