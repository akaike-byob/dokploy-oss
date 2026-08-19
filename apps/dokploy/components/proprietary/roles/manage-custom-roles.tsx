import { FeatureUnavailable } from "../feature-unavailable";

export const ManageCustomRoles = () => (
	<FeatureUnavailable title="Custom Roles">
		Defining additional organization roles is not part of this fork. The
		built-in owner, admin and member roles, and their per-resource permissions,
		work as normal.
	</FeatureUnavailable>
);
