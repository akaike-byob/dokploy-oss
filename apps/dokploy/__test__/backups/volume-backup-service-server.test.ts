import { describe, expect, it, vi } from "vitest";

vi.mock("@dokploy/server/db", () => ({ db: {} }));

const { getVolumeServiceServerId } = await import(
	"@dokploy/server/utils/volume-backups/backup"
);

describe("the server of a volume backup", () => {
	it.each([
		"application",
		"compose",
		"postgres",
		"mysql",
		"mariadb",
		"mongo",
		"redis",
		"libsql",
	])("is the server of its %s service", (serviceType) => {
		expect(
			getVolumeServiceServerId({
				[serviceType]: { serverId: "server-b" },
			} as never),
		).toBe("server-b");
	});

	it("is the panel host for a service with no server", () => {
		expect(
			getVolumeServiceServerId({ postgres: { serverId: null } } as never),
		).toBeFalsy();
	});
});
