import {
	calculateCpuUsage,
	parseCpuTimes,
} from "@dokploy/server/monitoring/host-cpu";
import { describe, expect, it } from "vitest";

describe("host CPU metrics", () => {
	it("calculates host CPU usage from proc stat deltas", () => {
		const previous = parseCpuTimes("cpu  100 0 50 800 50 0 0 0 0 0\n");
		const current = parseCpuTimes("cpu  130 0 70 840 60 0 0 0 0 0\n");

		expect(previous).not.toBeNull();
		expect(current).not.toBeNull();
		expect(calculateCpuUsage(previous!, current!)).toBeCloseTo(50);
	});

	it("rejects invalid proc stat data", () => {
		expect(parseCpuTimes("cpu0 100 0 50 800 50\n")).toBeNull();
	});
});
