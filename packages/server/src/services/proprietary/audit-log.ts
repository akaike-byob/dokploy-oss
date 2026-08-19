import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import type { AuditAction, AuditResourceType } from "../../db/schema";
import { auditLog } from "../../db/schema";

interface AuditLogEntry {
	organizationId: string;
	userId: string;
	userEmail: string;
	userRole: string;
	action: AuditAction;
	resourceType: AuditResourceType;
	resourceId?: string;
	resourceName?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Audit logging must never break the action it records, so a failed write is logged and
 * swallowed rather than propagated. Callers sit in request paths and session hooks.
 */
export const createAuditLog = async (entry: AuditLogEntry) => {
	try {
		await db.insert(auditLog).values({
			organizationId: entry.organizationId,
			userId: entry.userId,
			userEmail: entry.userEmail,
			userRole: entry.userRole,
			action: entry.action,
			resourceType: entry.resourceType,
			resourceId: entry.resourceId ?? null,
			resourceName: entry.resourceName ?? null,
			metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
		});
	} catch (error) {
		console.error("Failed to write audit log entry", error);
	}
};

export const recentAuditLogs = async (organizationId: string, limit = 100) =>
	db.query.auditLog.findMany({
		where: eq(auditLog.organizationId, organizationId),
		orderBy: [desc(auditLog.createdAt)],
		limit,
	});

export const auditLogsForUser = async (
	organizationId: string,
	userId: string,
	limit = 100,
) =>
	db.query.auditLog.findMany({
		where: and(
			eq(auditLog.organizationId, organizationId),
			eq(auditLog.userId, userId),
		),
		orderBy: [desc(auditLog.createdAt)],
		limit,
	});
