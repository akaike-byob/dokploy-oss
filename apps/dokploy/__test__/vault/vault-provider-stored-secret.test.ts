import type { VaultProviderConfig } from "@dokploy/server/db/schema";
import { describe, expect, it, vi } from "vitest";

vi.mock("@dokploy/server/db", () => ({ db: {} }));

const { mergeVaultProviderConfig, VAULT_SECRET_MASK } = await import(
	"@dokploy/server/services/vault-provider"
);

const hashicorp = {
	providerType: "hashicorp",
	url: "https://vault.example.com",
	token: "stored-token",
	mount: "secret",
} as VaultProviderConfig;

describe("reusing a stored vault secret", () => {
	it("refuses a masked secret with a new URL, which would send it to that host", () => {
		expect(() =>
			mergeVaultProviderConfig(
				{
					...hashicorp,
					url: "https://attacker.example",
					token: VAULT_SECRET_MASK,
				} as VaultProviderConfig,
				hashicorp,
			),
		).toThrow("again");
	});

	it("refuses a masked AWS secret with a new region", () => {
		const aws = {
			providerType: "aws",
			region: "eu-west-1",
			accessKeyId: "id",
			secretAccessKey: "stored",
		} as VaultProviderConfig;

		expect(() =>
			mergeVaultProviderConfig(
				{
					...aws,
					region: "attacker.example#",
					secretAccessKey: VAULT_SECRET_MASK,
				} as VaultProviderConfig,
				aws,
			),
		).toThrow("again");
	});

	it("refuses a masked Phase token with a new API URL", () => {
		const phase = {
			providerType: "phase",
			token: "stored",
			apiUrl: "https://console.phase.dev",
		} as VaultProviderConfig;

		expect(() =>
			mergeVaultProviderConfig(
				{
					...phase,
					apiUrl: "https://attacker.example",
					token: VAULT_SECRET_MASK,
				} as VaultProviderConfig,
				phase,
			),
		).toThrow("again");
	});

	it("restores the stored secret when the destination stays", () => {
		const merged = mergeVaultProviderConfig(
			{
				...hashicorp,
				mount: "other",
				token: VAULT_SECRET_MASK,
			} as VaultProviderConfig,
			hashicorp,
		);

		expect(merged).toMatchObject({ token: "stored-token", mount: "other" });
	});

	it("accepts a new URL that arrives with a new secret", () => {
		const merged = mergeVaultProviderConfig(
			{
				...hashicorp,
				url: "https://vault2.example.com",
				token: "new-token",
			} as VaultProviderConfig,
			hashicorp,
		);

		expect(merged).toMatchObject({ token: "new-token" });
	});
});
