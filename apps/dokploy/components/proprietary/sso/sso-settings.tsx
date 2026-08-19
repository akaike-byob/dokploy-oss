import { FeatureUnavailable } from "../feature-unavailable";

export const SSOSettings = () => (
	<FeatureUnavailable title="Enterprise SSO">
		OIDC and SAML single sign-on are part of Dokploy's commercial edition. This
		fork signs in with a password, a passkey, or Google.
	</FeatureUnavailable>
);
