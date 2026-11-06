import type { createVolumeBackupSchema } from "@dokploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";

const VOLUME_BACKUP_SERVICE_TYPES = [
	"application",
	"postgres",
	"mysql",
	"mariadb",
	"mongo",
	"redis",
	"libsql",
	"compose",
] as const;

/**
 * The job copies volumes of whichever service the row names, so a row naming none would skip the
 * grant check and a row naming two would pass it for only one.
 */
export const resolveVolumeBackupTarget = (
	input: z.infer<typeof createVolumeBackupSchema>,
) => {
	const namedTypes = VOLUME_BACKUP_SERVICE_TYPES.filter(
		(type) => input[`${type}Id`],
	);
	const [serviceType] = namedTypes;
	if (
		!serviceType ||
		namedTypes.length > 1 ||
		(input.serviceType && input.serviceType !== serviceType)
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "A volume backup must name exactly one service, of its type",
		});
	}
	return { serviceType, serviceId: input[`${serviceType}Id`] as string };
};
