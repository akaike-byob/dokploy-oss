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
