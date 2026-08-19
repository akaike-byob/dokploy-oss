import {
	collectOrigins,
	originOf,
	registeredIssuerOrigins,
	registrationOrigins,
} from "@dokploy/server/lib/sso-trusted-origins";
import { describe, expect, it } from "vitest";

describe("originOf", () => {
	it("reduces an issuer that carries a path to its origin", () => {
		// The portal's issuer is https://portal.akaike.ai/api/auth: trusting the whole URL as
		// given would never match, since better-auth compares origins.
		expect(originOf("https://portal.akaike.ai/api/auth")).toBe(
			"https://portal.akaike.ai",
		);
	});

	it("ignores a trailing slash", () => {
		expect(originOf("https://portal.akaike.ai/")).toBe(
			"https://portal.akaike.ai",
		);
	});

	it("keeps a non-default port, which is part of the origin", () => {
		expect(originOf("https://idp.internal:8443/realms/main")).toBe(
			"https://idp.internal:8443",
		);
	});

	it("returns null rather than a bogus origin for an unparseable issuer", () => {
		// A malformed issuer must not widen the allowlist with a garbage entry.
		expect(originOf("portal.akaike.ai")).toBeNull();
		expect(originOf("")).toBeNull();
		expect(originOf(null)).toBeNull();
		expect(originOf(undefined)).toBeNull();
	});
});

describe("collectOrigins", () => {
	it("deduplicates URLs that share an origin", () => {
		expect(
			collectOrigins([
				"https://portal.akaike.ai/api/auth",
				"https://portal.akaike.ai/.well-known/openid-configuration",
			]),
		).toEqual(["https://portal.akaike.ai"]);
	});

	it("drops entries with no origin and keeps the rest", () => {
		expect(
			collectOrigins([null, "not a url", "https://portal.akaike.ai/api/auth"]),
		).toEqual(["https://portal.akaike.ai"]);
	});
});

describe("registeredIssuerOrigins", () => {
	it("trusts nothing when no provider is registered", () => {
		expect(registeredIssuerOrigins([])).toEqual([]);
	});

	it("trusts each registered issuer", () => {
		expect(
			registeredIssuerOrigins([
				{ issuer: "https://portal.akaike.ai/api/auth", oidcConfig: null },
				{ issuer: "https://accounts.google.com", oidcConfig: null },
			]),
		).toEqual(["https://portal.akaike.ai", "https://accounts.google.com"]);
	});

	it("also trusts a discovery endpoint hosted away from the issuer", () => {
		expect(
			registeredIssuerOrigins([
				{
					issuer: "https://idp.example.com",
					oidcConfig: JSON.stringify({
						discoveryEndpoint:
							"https://discovery.example.net/.well-known/openid-configuration",
					}),
				},
			]),
		).toEqual(["https://idp.example.com", "https://discovery.example.net"]);
	});

	it("survives an oidcConfig that is not the JSON object it should be", () => {
		// The column is free-form text, so a corrupt row must not take every SSO request down.
		expect(
			registeredIssuerOrigins([
				{ issuer: "https://idp.example.com", oidcConfig: "{ not json" },
				{ issuer: "https://other.example.com", oidcConfig: "null" },
			]),
		).toEqual(["https://idp.example.com", "https://other.example.com"]);
	});
});

describe("registrationOrigins", () => {
	it("trusts the issuer named by the registration being served", () => {
		// The provider row does not exist yet at this point, so registration would otherwise be
		// the one call that can never pass the discovery check.
		expect(
			registrationOrigins({ issuer: "https://portal.akaike.ai/api/auth" }),
		).toEqual(["https://portal.akaike.ai"]);
	});

	it("trusts an explicitly supplied discovery endpoint too", () => {
		expect(
			registrationOrigins({
				issuer: "https://idp.example.com",
				oidcConfig: {
					discoveryEndpoint:
						"https://discovery.example.net/.well-known/openid-configuration",
				},
			}),
		).toEqual(["https://idp.example.com", "https://discovery.example.net"]);
	});

	it("trusts nothing for a body that names no usable issuer", () => {
		expect(registrationOrigins(undefined)).toEqual([]);
		expect(registrationOrigins({})).toEqual([]);
		expect(registrationOrigins({ issuer: 42 })).toEqual([]);
		expect(registrationOrigins("https://portal.akaike.ai")).toEqual([]);
	});
});
