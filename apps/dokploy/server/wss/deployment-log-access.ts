import { getAccessibleServerIds } from "@dokploy/server";
import { db } from "@dokploy/server/db";
import { deployments } from "@dokploy/server/db/schema";
import {
	checkServicePermissionAndAccess,
	findMemberByUserId,
	hasPermission,
} from "@dokploy/server/services/permission";
import { eq } from "drizzle-orm";

type WssUser = { id: string } | null | undefined;
type WssSession = { activeOrganizationId?: string | null } | null | undefined;

/**
 * The client names the file to tail, and the base path also holds SSH keys and Traefik's
 * certificates. So a path counts only when a deployment recorded it, and the caller needs the
 * access `deployment.allByType` asks for the service, server or panel behind that deployment.
 */
export const canReadDeploymentLogOverWss = async (
	user: WssUser,
	session: WssSession,
	logPath: string,
): Promise<boolean> => {
	if (!user || !session?.activeOrganizationId) return false;

	const deployment = await db.query.deployments.findFirst({
		where: eq(deployments.logPath, logPath),
		with: {
			previewDeployment: true,
			schedule: true,
			backup: true,
			volumeBackup: true,
		},
	});
	if (!deployment) return false;

	const { previewDeployment, schedule, backup, volumeBackup } = deployment;
	const serviceId =
		deployment.applicationId ||
		deployment.composeId ||
		previewDeployment?.applicationId ||
		schedule?.applicationId ||
		schedule?.composeId ||
		backup?.postgresId ||
		backup?.mysqlId ||
		backup?.mariadbId ||
		backup?.mongoId ||
		backup?.libsqlId ||
		backup?.composeId ||
		volumeBackup?.applicationId ||
		volumeBackup?.composeId ||
		volumeBackup?.postgresId ||
		volumeBackup?.mysqlId ||
		volumeBackup?.mariadbId ||
		volumeBackup?.mongoId ||
		volumeBackup?.redisId ||
		volumeBackup?.libsqlId;
	const ctx = {
		user: { id: user.id },
		session: { activeOrganizationId: session.activeOrganizationId },
	};

	if (serviceId) {
		try {
			await checkServicePermissionAndAccess(ctx, serviceId, {
				deployment: ["read"],
			});
			return true;
		} catch {
			return false;
		}
	}

	const serverId = deployment.serverId || schedule?.serverId;
	if (serverId) {
		const accessibleServerIds = await getAccessibleServerIds({
			userId: user.id,
			activeOrganizationId: session.activeOrganizationId,
		});
		return (
			accessibleServerIds.has(serverId) &&
			(await hasPermission(ctx, { deployment: ["read"] }))
		);
	}

	// A web-server backup or a schedule on the panel host names no service to grant.
	try {
		const member = await findMemberByUserId(
			user.id,
			session.activeOrganizationId,
		);
		return member?.role === "owner" || member?.role === "admin";
	} catch {
		return false;
	}
};
