import semver from "semver";
import { describe, expect, it } from "vitest";
import { nextPanelVersion } from "../../scripts/panel-version.mjs";

describe("nextPanelVersion", () => {
	it("outranks the plain upstream base an existing installation reports", () => {
		// The case that matters: a panel already running reports the stable base. Building the
		// prerelease off that base would sort BELOW it and the update would never be offered.
		const base = "0.29.14";
		const generated = nextPanelVersion(base, 1);

		expect(semver.gt(generated, base)).toBe(true);
		expect(semver.gt(`${base}-akaike.1`, base)).toBe(false);
	});

	it("orders successive builds by run number", () => {
		const earlier = nextPanelVersion("0.29.14", 9);
		const later = nextPanelVersion("0.29.14", 10);

		expect(semver.gt(later, earlier)).toBe(true);
	});

	it("outranks every earlier build after a sync raises the base", () => {
		const beforeSync = nextPanelVersion("0.29.14", 500);
		const afterSync = nextPanelVersion("0.29.15", 1);

		expect(semver.gt(afterSync, beforeSync)).toBe(true);
	});

	it("outranks a build made from the base it bumped to", () => {
		// A sync to the version this fork already bumped past must still move forward.
		const generated = nextPanelVersion("0.29.14", 3);
		expect(semver.gt(nextPanelVersion("0.29.15", 1), generated)).toBe(true);
	});

	it("produces a valid semver and tolerates a leading v", () => {
		expect(semver.valid(nextPanelVersion("v0.29.14", 2))).not.toBeNull();
		expect(nextPanelVersion("v0.29.14", 2)).toBe("0.29.15-akaike.2");
	});

	it("rejects a base or run number it cannot order", () => {
		expect(() => nextPanelVersion("not-a-version", 1)).toThrow();
		expect(() => nextPanelVersion("0.29", 1)).toThrow();
		expect(() => nextPanelVersion("0.29.14", 0)).toThrow();
		expect(() => nextPanelVersion("0.29.14", "abc")).toThrow();
	});
});
