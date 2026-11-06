import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ migrate: vi.fn() }));

vi.mock("@dokploy/server/db", () => ({ dbUrl: "postgres://panel" }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: vi.fn() }));
vi.mock("drizzle-orm/postgres-js/migrator", () => ({ migrate: mocks.migrate }));
vi.mock("postgres", () => ({ default: () => ({ end: vi.fn() }) }));

const runMigrationScript = async () => {
	vi.resetModules();
	await import("../../migration");
};

describe("migration script", () => {
	afterEach(() => {
		process.exitCode = 0;
		vi.restoreAllMocks();
	});

	it("exits non-zero on a failed migration, so the Dockerfile's && keeps the server down", async () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		mocks.migrate.mockRejectedValue(new Error("type does not exist"));

		await runMigrationScript();

		expect(process.exitCode).toBe(1);
	});

	it("leaves the exit code alone on success", async () => {
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		mocks.migrate.mockResolvedValue(undefined);

		await runMigrationScript();

		expect(process.exitCode).toBe(0);
	});
});
