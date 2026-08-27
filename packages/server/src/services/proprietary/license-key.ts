import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { organization, organizationRole } from "../../db/schema";

/**
 * This fork has no licensing tier, so every organization has access to every feature.
 *
 * The features these checks guard (custom roles, multi-server deployment, git provider
 * assignment) are implemented in the Apache-2.0 portion of the codebase, which permits use
 * and modification. Only upstream's license-key validation itself was source-available, and
 * it is not present here.
 */
export const hasValidLicense = async (_organizationId?: string | null) => true;

export const haveValidLicenseKey = async (_organizationId?: string | null) =>
	true;

/**
 * Role given to a member who joins through SCIM or SSO rather than an invitation.
 *
 * `organization.defaultRole` is free text, so a value naming a deleted custom role, or
 * naming `owner`, would hand out access the organization never configured. Anything that
 * does not resolve to a built-in role or to a row in `organizationRole` falls back to
 * `member`.
 */
export const resolveOrganizationDefaultRole = async (
	organizationId: string,
): Promise<string> => {
	const org = await db.query.organization.findFirst({
		where: eq(organization.id, organizationId),
		columns: { defaultRole: true },
	});

	const defaultRole = org?.defaultRole;

	if (!defaultRole || defaultRole === "owner") {
		return "member";
	}

	if (defaultRole === "admin" || defaultRole === "member") {
		return defaultRole;
	}

	const customRole = await db.query.organizationRole.findFirst({
		where: and(
			eq(organizationRole.organizationId, organizationId),
			eq(organizationRole.role, defaultRole),
		),
		columns: { id: true },
	});

	return customRole ? defaultRole : "member";
};
