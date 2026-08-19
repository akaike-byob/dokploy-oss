import { createTRPCRouter, protectedProcedure } from "../../trpc";

interface CustomRole {
	role: string;
}

/**
 * Custom organization roles are an upstream enterprise feature this fork does not implement.
 * The built-in owner/admin/member roles come from the Apache-licensed access-control module.
 */
export const customRoleRouter = createTRPCRouter({
	all: protectedProcedure.query((): CustomRole[] => []),
});
