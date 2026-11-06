import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { organization, organizationRole } from "../../db/schema";

/**
 * This fork has no licensing tier, so every organization has every feature. This module replaces
 * upstream's source-available one: it holds only this fork's code, under this repository's licence.
 */
export const hasValidLicense = async (_organizationId?: string | null) => true;

export const haveValidLicenseKey = async (_organizationId?: string | null) =>
	true;

const JOIN_ROLES_NEEDING_NO_ROW = ["admin", "member"];
const FALLBACK_JOIN_ROLE = "member";

/**
 * Picks the role for someone joining through SSO or SCIM. The setting is free text that can name
 * a deleted role, and joining through an identity provider must never produce an owner.
 */
export const resolveOrganizationDefaultRole = async (
	organizationId: string,
): Promise<string> => {
	const [setting] = await db
		.select({
			configured: organization.defaultRole,
			customRoleId: organizationRole.id,
		})
		.from(organization)
		.leftJoin(
			organizationRole,
			and(
				eq(organizationRole.organizationId, organization.id),
				eq(organizationRole.role, organization.defaultRole),
			),
		)
		.where(eq(organization.id, organizationId));

	if (!setting?.configured || setting.configured === "owner") {
		return FALLBACK_JOIN_ROLE;
	}
	const isGrantable =
		JOIN_ROLES_NEEDING_NO_ROW.includes(setting.configured) ||
		setting.customRoleId !== null;
	return isGrantable ? setting.configured : FALLBACK_JOIN_ROLE;
};
