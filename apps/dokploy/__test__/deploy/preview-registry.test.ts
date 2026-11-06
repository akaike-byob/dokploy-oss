import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@dokploy/server/db", () => {
	const chain: any = {
		set: vi.fn(() => chain),
		values: vi.fn(() => chain),
		where: vi.fn(() => chain),
		returning: vi.fn().mockResolvedValue([{ deploymentId: "dep-1" }]),
	};
	return {
		db: {
			insert: vi.fn(() => chain),
			update: vi.fn(() => chain),
			delete: vi.fn(() => chain),
			query: {
				applications: { findFirst: vi.fn() },
				previewDeployments: { findFirst: vi.fn() },
				deployments: { findMany: vi.fn().mockResolvedValue([]) },
			},
		},
	};
});

vi.mock("@dokploy/server/utils/process/execAsync", () => ({
	execAsync: vi.fn(),
	execAsyncRemote: vi.fn(),
	ExecError: class ExecError extends Error {},
}));

vi.mock("@dokploy/server/services/server", () => ({
	findServerById: vi.fn(async (serverId: string) => ({ serverId })),
}));

vi.mock("@dokploy/server/services/github", () => ({
	issueCommentExists: vi.fn().mockResolvedValue(true),
	createPreviewDeploymentComment: vi.fn(),
	getIssueComment: vi.fn().mockReturnValue(""),
	updateIssueComment: vi.fn(),
	findGithubById: vi.fn(),
}));

vi.mock("@dokploy/server/utils/providers/github", async () => {
	const actual = await vi.importActual<
		typeof import("@dokploy/server/utils/providers/github")
	>("@dokploy/server/utils/providers/github");
	return {
		...actual,
		cloneGithubRepository: vi.fn().mockResolvedValue("clone;"),
	};
});

vi.mock("@dokploy/server/utils/builders", async () => {
	const actual = await vi.importActual<
		typeof import("@dokploy/server/utils/builders")
	>("@dokploy/server/utils/builders");
	return {
		...actual,
		getBuildCommand: vi.fn().mockResolvedValue("build;"),
		mechanizeDockerContainer: vi.fn(),
	};
});

import { db } from "@dokploy/server/db";
import {
	deployPreviewApplication,
	rebuildPreviewApplication,
} from "@dokploy/server/services/application";
import {
	getBuildCommand,
	mechanizeDockerContainer,
} from "@dokploy/server/utils/builders";

const buildRegistry = { registryId: "build-reg" };
const registry = { registryId: "swarm-reg" };

const setup = (overrides: Record<string, unknown> = {}) => {
	const application = {
		applicationId: "app-1",
		name: "App",
		appName: "app-abc",
		sourceType: "github",
		owner: "Dokploy",
		repository: "examples",
		githubId: "gh-1",
		serverId: "deploy-server",
		buildServerId: "build-server",
		buildRegistry,
		registry,
		rollbackRegistry: { registryId: "rollback-reg" },
		rollbackActive: true,
		previewEnv: "",
		previewBuildArgs: "",
		previewBuildSecrets: "",
		environment: { project: {} },
		...overrides,
	};
	vi.mocked(db.query.applications.findFirst).mockResolvedValue(
		application as any,
	);
	vi.mocked(db.query.previewDeployments.findFirst).mockResolvedValue({
		previewDeploymentId: "preview-1",
		applicationId: application.applicationId,
		appName: "preview-app-abc-xyz",
		branch: "feature",
		pullRequestNumber: "1",
		pullRequestCommentId: "1",
		domain: { host: "preview.example.com", https: false },
		application: {
			applicationId: application.applicationId,
			serverId: application.serverId,
			buildServerId: application.buildServerId,
		},
	} as any);
};

const previewInput = {
	applicationId: "app-1",
	titleLog: "Preview",
	descriptionLog: "",
	previewDeploymentId: "preview-1",
};

beforeEach(() => {
	vi.clearAllMocks();
});

// Pull request code must not reach a registry the operator configured for releases, unless a
// build server makes the registry the only way to carry the image to the deploy server.
describe("preview deployments without a build server", () => {
	it("deploys without pushing to the application's registries", async () => {
		setup({ buildServerId: null });

		await deployPreviewApplication(previewInput);

		const built = vi.mocked(getBuildCommand).mock.calls[0]?.[0];
		expect(built).toMatchObject({ registry: null, buildRegistry: null });
		const deployed = vi.mocked(mechanizeDockerContainer).mock.calls[0]?.[0];
		expect(deployed).toMatchObject({ registry: null, buildRegistry: null });
	});

	it("rebuilds without pushing to the application's registries", async () => {
		setup({ buildServerId: null });

		await rebuildPreviewApplication(previewInput);

		const built = vi.mocked(getBuildCommand).mock.calls[0]?.[0];
		expect(built).toMatchObject({ registry: null, buildRegistry: null });
	});
});

describe("preview deployments with a build server", () => {
	it("keeps the registries that carry the image to the deploy server", async () => {
		setup();

		await deployPreviewApplication(previewInput);

		const built = vi.mocked(getBuildCommand).mock.calls[0]?.[0];
		expect(built).toMatchObject({ buildRegistry, registry });
	});
});
