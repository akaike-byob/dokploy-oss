import type { apiCreateBackup } from "@dokploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";

/**
 * A web-server backup holds the whole panel and restoring one replaces it, and the row names no
 * service a member could be granted. So only the roles that may reload the panel may touch one.
 */
export const assertCanManageWebServerBackup = (ctx: {
	user: { role: string };
}) => {
	if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Only an owner or admin can manage web server backups",
		});
	}
};

/**
 * A destination is shared across services, so a member could otherwise restore another team's dump
 * into their own database and read it. A compose service's folder is `<appName>_<serviceName>`.
 * Owners and admins may restore across services, which a migration needs.
 */
export const assertBackupFileInServiceFolder = (
	ctx: { user: { role: string } },
	appName: string,
	backupFile: string,
) => {
	if (ctx.user.role === "owner" || ctx.user.role === "admin") {
		return;
	}
	if (
		!backupFile.startsWith(`${appName}/`) &&
		!backupFile.startsWith(`${appName}_`)
	) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: `Only an owner or admin can restore a file outside the ${appName} folder`,
		});
	}
};

const BACKUP_SERVICE_ID_FIELDS = [
	"postgresId",
	"mysqlId",
	"mariadbId",
	"mongoId",
	"libsqlId",
	"composeId",
] as const;

/**
 * The dump reads the service `databaseType` names, so a grant check on any other id on the row
 * would authorize one service and dump another. Returns null for a web-server backup.
 */
export const resolveBackupTarget = (input: z.infer<typeof apiCreateBackup>) => {
	const namedFields = BACKUP_SERVICE_ID_FIELDS.filter((field) => input[field]);
	if (input.databaseType === "web-server") {
		if (namedFields.length > 0) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "A web-server backup names no service",
			});
		}
		return null;
	}
	const expectedField =
		input.backupType === "compose"
			? "composeId"
			: (`${input.databaseType}Id` as const);
	if (namedFields.length !== 1 || namedFields[0] !== expectedField) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `This backup must name ${expectedField} and no other service`,
		});
	}
	return input[expectedField] as string;
};

/**
 * The schedule picks its job from `databaseType` alone and never looks at the service ids, so a
 * row naming a service with type `web-server` would dump the panel past the service-less guard.
 */
export const assertBackupTypeMatchesTarget = (
	serviceId: string | null | undefined,
	databaseType: string,
) => {
	if (Boolean(serviceId) === (databaseType === "web-server")) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"A web-server backup names no service, and every other backup names one",
		});
	}
};
