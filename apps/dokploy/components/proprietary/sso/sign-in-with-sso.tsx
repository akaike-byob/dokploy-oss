import type { ReactNode } from "react";
import { AlertBlock } from "@/components/shared/alert-block";

/**
 * OIDC/SAML SSO is an upstream enterprise feature this fork does not implement, so the normal
 * login content is always what renders. Google sign-in is separate and lives in
 * `../auth/sign-in-with-google`.
 */
export const SignInWithSSO = ({
	enforce,
	children,
}: {
	enforce?: boolean;
	children?: ReactNode;
}) => {
	if (enforce) {
		return (
			<AlertBlock type="warning">
				This panel is set to require SSO, which this fork does not implement.
				Turn the setting off to sign in with a password or Google.
			</AlertBlock>
		);
	}

	return <>{children}</>;
};
