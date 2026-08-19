import { FeatureUnavailable } from "../feature-unavailable";

export const ForwardAuthServers = () => (
	<FeatureUnavailable title="Application Authentication">
		Putting deployed applications behind an SSO gate is not part of this fork.
		Traefik already fronts every deployment, so attach a forwardAuth middleware
		to the application's router and back it with an auth proxy such as tinyauth
		or oauth2-proxy. Panel sign-in is unaffected: it is configured above.
	</FeatureUnavailable>
);
