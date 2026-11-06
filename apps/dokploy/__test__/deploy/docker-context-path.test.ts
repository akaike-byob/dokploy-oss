import { paths } from "@dokploy/server/constants";
import { getDockerCommand } from "@dokploy/server/utils/builders/docker-file";
import { getDockerContextPath } from "@dokploy/server/utils/filesystem/directory";
import { describe, expect, it } from "vitest";

// An empty dockerContextPath means the Dockerfile's own directory. Every application configured
// before the field existed holds an empty value, so moving what COPY resolves against breaks their
// builds silently.

const { APPLICATIONS_PATH } = paths();
const codePath = `${APPLICATIONS_PATH}/app-name/code`;

const application = (overrides: Record<string, unknown> = {}) =>
	({
		appName: "app-name",
		buildType: "dockerfile",
		sourceType: "github",
		buildPath: "/",
		dockerfile: "deno/Dockerfile",
		dockerContextPath: "",
		env: null,
		buildArgs: null,
		buildSecrets: null,
		publishDirectory: null,
		dockerBuildStage: null,
		cleanCache: false,
		createEnvFile: false,
		serverId: null,
		buildServerId: null,
		environment: { env: null, project: { env: null } },
		...overrides,
		// biome-ignore lint/suspicious/noExplicitAny: the builders only read the fields set above
	}) as any;

describe("docker context path", () => {
	it("has no path of its own when dockerContextPath is empty", () => {
		expect(getDockerContextPath(application())).toBeNull();
	});

	it("builds from the Dockerfile's directory when dockerContextPath is empty", () => {
		const command = getDockerCommand(application());

		expect(command).toContain(`cd ${codePath}/deno/`);
		expect(command).not.toContain(`cd ${codePath}\n`);
	});

	it("builds from the repository root when the Dockerfile sits at the root", () => {
		const command = getDockerCommand(application({ dockerfile: "Dockerfile" }));

		expect(command).toContain(`cd ${codePath}/`);
	});

	it("builds from dockerContextPath when one is set", () => {
		const command = getDockerCommand(
			application({ dockerContextPath: "packages/api" }),
		);

		expect(command).toContain(`cd ${codePath}/packages/api`);
	});

	it("quotes the Dockerfile path and build stage, which reach the host shell", () => {
		const command = getDockerCommand(
			application({
				dockerfile: "my dir/Dockerfile",
				dockerBuildStage: "x; touch /tmp/pwned",
			}),
		);

		const buildLine = command
			.split("\n")
			.find((line: string) => line.includes("docker build"));
		expect(buildLine).toContain(`-f '${codePath}/my dir/Dockerfile'`);
		expect(buildLine).toContain("--target 'x; touch /tmp/pwned'");
	});

	it("passes the context as `.` after cd, which needs no quoting", () => {
		const command = getDockerCommand(
			application({ dockerContextPath: "my dir;touch /tmp/pwned" }),
		);

		const buildLine = command
			.split("\n")
			.find((line: string) => line.includes("docker build"));
		expect(buildLine).toMatch(/ \.( |$)/);
		expect(buildLine).not.toContain("my dir");
	});
});
