import { recentAuditLogs } from "@dokploy/server/services/proprietary/audit-log";
import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const auditLogRouter = createTRPCRouter({
	all: protectedProcedure.query(({ ctx }) =>
		recentAuditLogs(ctx.session.activeOrganizationId),
	),
});
