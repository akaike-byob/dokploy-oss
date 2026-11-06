import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const installScript = readFileSync(
	resolve(__dirname, "../../../../install.sh"),
	"utf8",
);

describe("the published image", () => {
	it("carries the licence and NOTICE, as Apache-2.0 section 4 requires", () => {
		const dockerfile = readFileSync(
			resolve(__dirname, "../../../../Dockerfile"),
			"utf8",
		);

		expect(dockerfile).toContain("COPY LICENSE.MD NOTICE ./");
	});
});

describe("the steps install.sh runs", () => {
	const installSteps = [
		"require_root",
		"require_linux",
		"require_free_ports",
		"install_docker",
		"init_swarm",
		"init_network",
		"run_bootstrap",
		"init_postgres",
		"deploy_panel",
	];

	const runMain = (dockerExit: number) => {
		const functions = installScript.replace(/\nmain "\$@"\s*$/, "\n");
		return spawnSync(
			"bash",
			[
				"-c",
				[
					functions,
					"set +e",
					`docker() { return ${dockerExit}; }`,
					"detect_ip() { echo 203.0.113.1; }",
					...installSteps.map((step) => `${step}() { echo "STEP ${step}"; }`),
					"main",
				].join("\n"),
			],
			{ encoding: "utf8" },
		);
	};

	const stepsRun = (stdout: string) =>
		stdout
			.split("\n")
			.filter((line) => line.startsWith("STEP "))
			.map((line) => line.replace("STEP ", ""));

	it("runs every step on a first install", () => {
		const { status, stdout } = runMain(1);

		expect(status).toBe(0);
		expect(stepsRun(stdout)).toEqual(installSteps);
	});

	it("only updates the panel on a re-run, because the host bootstrap would recreate Traefik", () => {
		const { status, stdout } = runMain(0);

		expect(status).toBe(0);
		expect(stepsRun(stdout)).toEqual([
			"require_root",
			"require_linux",
			"deploy_panel",
		]);
		expect(stdout).not.toContain("create the first account");
	});
});

describe("the port check on a first install", () => {
	it("stops when another process holds a port", () => {
		const check = installScript.match(
			/require_free_ports\(\) \{[\s\S]*?\n\}\n/,
		)?.[0];
		const { status, stdout } = spawnSync(
			"bash",
			[
				"-c",
				[
					"PANEL_PORT=3000",
					"ss() { printf ':80 \\n'; }",
					'die() { echo "DIED $1"; exit 1; }',
					'ok() { echo "OK $1"; }',
					check,
					"require_free_ports",
				].join("\n"),
			],
			{ encoding: "utf8" },
		);

		expect(status).toBe(1);
		expect(stdout).toContain("Port 80 is already in use");
	});
});

describe("install.sh", () => {
	it("generates the auth secret, because the panel otherwise falls back to a public constant", () => {
		expect(installScript).toContain(
			'openssl rand -hex 32 | tr -d "\\n" | docker secret create "$AUTH_SECRET" -',
		);
	});

	it("passes that secret to the panel service", () => {
		const panelService = installScript.slice(
			installScript.indexOf("--name dokploy \\"),
		);

		expect(panelService).toContain('--secret "$AUTH_SECRET"');
		expect(panelService).toContain(
			'--env BETTER_AUTH_SECRET_FILE="/run/secrets/${AUTH_SECRET}"',
		);
	});
});
