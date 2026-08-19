import { eq } from "drizzle-orm";
import { db } from "../../db";
import { organization } from "../../db/schema";

export const getOrganizationOwnerId = async (organizationId: string) => {
	const org = await db.query.organization.findFirst({
		where: eq(organization.id, organizationId),
		columns: { ownerId: true },
	});

	return org?.ownerId ?? null;
};
