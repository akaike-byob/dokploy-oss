import { FeatureUnavailable } from "../feature-unavailable";

export const ManageCustomRoles = () => (
	<FeatureUnavailable title="Custom Roles">
		Defining additional organization roles is part of Dokploy's commercial
		edition. The built-in owner, admin and member roles, and their per-resource
		permissions, work as normal.
	</FeatureUnavailable>
);
