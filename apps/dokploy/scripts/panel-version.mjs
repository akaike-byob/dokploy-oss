/**
 * Version stamped onto a build of this fork.
 *
 * The panel decides an update exists by semver-comparing the version it reports against the
 * newest published tag, so each build has to sort above every earlier one AND above the plain
 * upstream base an installation may already be reporting.
 *
 * A prerelease sorts BELOW its own base: `0.29.14-akaike.1` < `0.29.14`. Building straight from
 * the base would therefore be invisible to a panel reporting `0.29.14`. The patch is bumped
 * first so the prerelease hangs off the next version up, which outranks the base while still
 * ordering the builds among themselves by run number.
 *
 * @param {string} baseVersion Upstream base this fork sits on, with or without a leading v.
 * @param {number|string} runNumber Monotonic CI run number.
 * @returns {string} A semver release such as `0.29.15-akaike.42`.
 */
export const nextPanelVersion = (baseVersion, runNumber) => {
	const core = String(baseVersion).trim().replace(/^v/, "").split("-")[0] ?? "";
	const parts = core.split(".").map(Number);
	const [major, minor, patch] = parts;

	if (
		parts.length !== 3 ||
		major === undefined ||
		minor === undefined ||
		patch === undefined ||
		parts.some((part) => !Number.isInteger(part) || part < 0)
	) {
		throw new Error(`Base version is not a semver release: ${baseVersion}`);
	}

	const run = Number(runNumber);
	if (!Number.isInteger(run) || run < 1) {
		throw new Error(`Run number must be a positive integer: ${runNumber}`);
	}

	return `${major}.${minor}.${patch + 1}-akaike.${run}`;
};

// Called by CI as: node panel-version.mjs <base> <run>
if (process.argv[1]?.endsWith("panel-version.mjs")) {
	process.stdout.write(
		nextPanelVersion(process.argv[2] ?? "", process.argv[3] ?? ""),
	);
}
