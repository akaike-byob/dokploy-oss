import {
	resolvesSocialProvider,
	withStoredCredentials,
} from "@dokploy/server/lib/social-auth-providers";
import type { OAuthProvider } from "better-auth/oauth2";
import { describe, expect, it } from "vitest";

const providerOf = (id: string) => ({ id }) as OAuthProvider;

const clientIdOf = (providers: OAuthProvider[], id: string) => {
	const provider = providers.find((candidate) => candidate.id === id);
	return (provider as unknown as { options?: { clientId?: string } })?.options
		?.clientId;
};

describe("resolvesSocialProvider", () => {
	it("covers the endpoints that look a provider up", () => {
		for (const path of [
			"/sign-in/social",
			"/link-social",
			"/callback/google",
			"/account/unlink-account",
		]) {
			expect(resolvesSocialProvider(path)).toBe(true);
		}
	});

	it("leaves every other endpoint alone", () => {
		for (const path of [
			"/get-session",
			"/sign-in/email",
			"/sso/callback/akaike-portal",
			undefined,
		]) {
			expect(resolvesSocialProvider(path)).toBe(false);
		}
	});
});

describe("withStoredCredentials", () => {
	it("replaces a configured provider with the stored client", () => {
		const merged = withStoredCredentials(
			[providerOf("google"), providerOf("github")],
			{ google: { clientId: "from-panel", clientSecret: "secret" } },
		);

		expect(merged.map((provider) => provider.id).sort()).toEqual([
			"github",
			"google",
		]);
		expect(clientIdOf(merged, "google")).toBe("from-panel");
	});

	it("adds a provider that was never configured through the environment", () => {
		const merged = withStoredCredentials([], {
			google: { clientId: "from-panel", clientSecret: "secret" },
		});

		expect(merged).toHaveLength(1);
		expect(clientIdOf(merged, "google")).toBe("from-panel");
	});

	it("keeps the configured providers when nothing is stored", () => {
		const configured = [providerOf("google")];
		expect(withStoredCredentials(configured, {})).toEqual(configured);
	});
});
