import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const journal: { entries: { idx: number; when: number; tag: string }[] } =
	JSON.parse(
		readFileSync(
			resolve(__dirname, "../../drizzle/meta/_journal.json"),
			"utf8",
		),
	);

const FORK_TAG = "0199_loud_carmella_unuscione";
const FORK_WHEN = 1787171678956;

// Drizzle runs an entry only when its `when` exceeds the newest stamp the panel holds, so a released
// image's stamps can never be lowered. Each row is what that image's database holds after boot.
const releasedImages = [
	{
		tag: "v0.29.15-akaike.17",
		lastIdx: 180,
		hasFork: false,
		newest: 1786132623336,
	},
	{
		tag: "v0.29.15-akaike.18",
		lastIdx: 180,
		hasFork: true,
		newest: FORK_WHEN,
	},
	{
		tag: "v0.30.3-akaike.20",
		lastIdx: 185,
		hasFork: true,
		newest: 1787171678961,
	},
	{
		tag: "v0.30.6-akaike.21",
		lastIdx: 190,
		hasFork: true,
		newest: 1788300390648,
	},
];

describe("migration journal", () => {
	it.each(releasedImages)(
		"applies every missing migration to a panel on $tag",
		({ lastIdx, hasFork, newest }) => {
			const missing = journal.entries.filter((entry) =>
				entry.tag === FORK_TAG ? !hasFork : entry.idx > lastIdx,
			);
			const skipped = missing.filter((entry) => entry.when <= newest);

			expect(skipped.map((entry) => entry.tag)).toEqual([]);
		},
	);

	it("keeps this fork's migration last with its generated timestamp", () => {
		const last = journal.entries.at(-1);

		expect(last?.tag).toBe(FORK_TAG);
		expect(last?.when).toBe(FORK_WHEN);
	});
});
