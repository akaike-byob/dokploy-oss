import { createEnvFileCommand } from "@dokploy/server/utils/builders/utils";
import { getHerokuCommand } from "@dokploy/server/utils/builders/heroku";
import { getNixpacksCommand } from "@dokploy/server/utils/builders/nixpacks";
import { getPaketoCommand } from "@dokploy/server/utils/builders/paketo";
import { getRailpackCommand } from "@dokploy/server/utils/builders/railpack";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execAsync: vi.fn() }));

vi.mock("@dokploy/server/utils/process/execAsync", async (importOriginal) => ({
	...(await importOriginal<object>()),
	execAsync: mocks.execAsync,
}));

const { removeFileOrDirectory } = await import(
	"@dokploy/server/utils/filesystem/directory"
);

const INJECTION = "$(id)";

const application = {
	appName: "app-name",
	sourceType: "github",
	buildPath: `sub${INJECTION}`,
	env: null,
	buildArgs: null,
	buildSecrets: null,
	publishDirectory: null,
	cleanCache: false,
	serverId: null,
	buildServerId: null,
	railpackVersion: "0.15.0",
	herokuVersion: "24",
	environment: { env: null, project: { env: null } },
	// biome-ignore lint/suspicious/noExplicitAny: the builders only read these fields
} as any;

describe("a build path reaches the shell as one word", () => {
	it.each([
		["heroku", getHerokuCommand],
		["nixpacks", getNixpacksCommand],
		["paketo", getPaketoCommand],
		["railpack", getRailpackCommand],
	])("in the %s command", (_builder, getCommand) => {
		expect(getCommand(application)).not.toContain(INJECTION);
	});

	it("in the env file command", () => {
		expect(createEnvFileCommand(`/code/sub${INJECTION}/Dockerfile`, "A=1")).not.toContain(
			INJECTION,
		);
	});

	it("keeps an ordinary env file path usable", () => {
		expect(createEnvFileCommand("/code/sub dir/Dockerfile", "A=1")).toContain(
			"'/code/sub dir/.env'",
		);
	});
});

describe("removing a file mount", () => {
	it("passes its path as one word", async () => {
		mocks.execAsync.mockResolvedValue({ stdout: "", stderr: "" });

		await removeFileOrDirectory("/etc/dokploy/files/a b;id");

		expect(mocks.execAsync).toHaveBeenCalledWith(
			"rm -rf '/etc/dokploy/files/a b;id'",
		);
	});
});
