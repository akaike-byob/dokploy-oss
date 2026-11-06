import { recentAuditLogs } from "@dokploy/server/services/proprietary/audit-log";
import { createTRPCRouter, withPermission } from "../../trpc";

export const auditLogRouter = createTRPCRouter({
	all: withPermission("auditLog", "read").query(({ ctx }) =>
		recentAuditLogs(ctx.session.activeOrganizationId),
	),
});
