import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execAsync: vi.fn() }));

vi.mock("@dokploy/server/utils/process/execAsync", () => ({
	execAsync: mocks.execAsync,
	execAsyncRemote: vi.fn(),
}));

const { reloadDockerResource } = await import(
	"@dokploy/server/services/settings"
);

describe("reloadDockerResource", () => {
	beforeEach(() => {
		mocks.execAsync.mockReset();
		mocks.execAsync.mockResolvedValue({ stdout: "service", stderr: "" });
	});

	it("restarts the panel on the image it runs, because CI publishes no unprefixed version tag", async () => {
		await reloadDockerResource("dokploy");

		expect(mocks.execAsync).toHaveBeenLastCalledWith(
			"docker service update --force dokploy",
		);
	});
});
