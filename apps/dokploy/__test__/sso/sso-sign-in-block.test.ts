import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isSsoEnforced: vi.fn() }));

vi.mock("@dokploy/server/db", () => ({
	db: {
		select: () => ({ from: () => ({ innerJoin: async () => [] }) }),
		query: {
			webServerSettings: { findFirst: async () => null },
		},
	},
}));

vi.mock("@dokploy/server/services/proprietary/sso", () => ({
	isSsoEnforced: mocks.isSsoEnforced,
}));

const { auth } = await import("@dokploy/server/lib/auth");

const signInWithPassword = async () => {
	const response = await auth.handler(
		new Request("http://localhost:3000/api/auth/sign-in/email", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "a@example.com", password: "password1" }),
		}),
	);
	return { status: response.status, body: await response.text() };
};

describe("password sign-in under enforced SSO", () => {
	beforeEach(() => {
		mocks.isSsoEnforced.mockReset();
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	it("reaches the password check when the stored flag has no provider behind it", async () => {
		mocks.isSsoEnforced.mockResolvedValue(false);

		const { body } = await signInWithPassword();

		expect(mocks.isSsoEnforced).toHaveBeenCalledTimes(1);
		expect(body).not.toContain("SSO is enforced");
	});

	it("is refused when SSO is enforced", async () => {
		mocks.isSsoEnforced.mockResolvedValue(true);

		const { status, body } = await signInWithPassword();

		expect(status).toBe(403);
		expect(body).toContain("SSO is enforced");
	});
});
