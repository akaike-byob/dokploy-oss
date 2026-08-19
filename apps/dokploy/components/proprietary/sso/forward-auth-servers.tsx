import { FeatureUnavailable } from "../feature-unavailable";

export const ForwardAuthServers = () => (
	<FeatureUnavailable title="Application Authentication">
		Putting deployed applications behind an SSO gate is part of Dokploy's
		commercial edition. Run an auth proxy in front of the application instead.
	</FeatureUnavailable>
);
