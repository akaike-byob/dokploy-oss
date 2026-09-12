import { readFile } from "node:fs/promises";

const HOST_PROC_PATH = "/host/proc/stat";
const SAMPLE_INTERVAL_MS = 1_000;

interface CpuTimes {
	idle: number;
	total: number;
}

let latestUsage = 0;
let previousTimes: CpuTimes | undefined;
let sampledAtMs = 0;
let pendingSample: Promise<number | null> | undefined;

export const parseCpuTimes = (stat: string): CpuTimes | null => {
	const cpuLine = stat.split("\n").find((line) => line.startsWith("cpu "));
	if (!cpuLine) return null;

	const values = cpuLine.split(/\s+/).slice(1).map(Number);
	if (values.length < 5 || values.some(Number.isNaN)) return null;
	const idle = values[3];
	const ioWait = values[4];
	if (idle === undefined || ioWait === undefined) return null;

	return {
		idle: idle + ioWait,
		total: values.reduce((sum, value) => sum + value, 0),
	};
};

export const calculateCpuUsage = (
	previous: CpuTimes,
	current: CpuTimes,
): number | null => {
	const totalDelta = current.total - previous.total;
	const idleDelta = current.idle - previous.idle;
	if (totalDelta <= 0 || idleDelta < 0 || idleDelta > totalDelta) return null;

	return ((totalDelta - idleDelta) / totalDelta) * 100;
};

const sampleHostCpuUsage = async (): Promise<number | null> => {
	try {
		const stat = await readFile(HOST_PROC_PATH, "utf8");
		const currentTimes = parseCpuTimes(stat);
		if (!currentTimes) return null;

		if (previousTimes) {
			const usage = calculateCpuUsage(previousTimes, currentTimes);
			if (usage !== null) latestUsage = usage;
		}
		previousTimes = currentTimes;
		sampledAtMs = Date.now();
		return latestUsage;
	} catch {
		return null;
	}
};

export const getHostCpuUsage = async (): Promise<number | null> => {
	if (Date.now() - sampledAtMs < SAMPLE_INTERVAL_MS) return latestUsage;
	if (!pendingSample) {
		pendingSample = sampleHostCpuUsage().finally(() => {
			pendingSample = undefined;
		});
	}
	return pendingSample;
};
