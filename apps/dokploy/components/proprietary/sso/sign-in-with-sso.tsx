import { KeyRound } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { api } from "@/utils/api";

/** "portal" reads as "Continue with Portal"; an id is lowercase and hyphenated by validation. */
const providerLabel = (providerId: string) =>
	providerId
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

/**
 * Sign-in through an OIDC provider registered under Settings -> SSO. Each registered provider
 * gets its own button and is named directly, so nothing has to be typed: better-auth can route
 * by email domain, but the domain only ever selects a provider the panel already knows about.
 *
 * `enforce` renders the SSO route on its own, for panels configured to require it. Otherwise
 * the usual login form is rendered alongside.
 */
export const SignInWithSSO = ({
	enforce,
	children,
}: {
	enforce?: boolean;
	children?: ReactNode;
}) => {
	const { data: providers } = api.sso.signInOptions.useQuery();
	const [redirectingTo, setRedirectingTo] = useState<string | null>(null);

	const startSSOSignIn = async (providerId: string) => {
		setRedirectingTo(providerId);
		try {
			const { error } = await authClient.signIn.sso({
				providerId,
				callbackURL: "/dashboard/home",
			});
			if (error) {
				toast.error(error.message || "Could not start SSO sign-in");
				setRedirectingTo(null);
			}
		} catch {
			toast.error("Could not start SSO sign-in");
			setRedirectingTo(null);
		}
	};

	const buttons = (providers ?? []).map((provider) => (
		<Button
			key={provider.providerId}
			type="button"
			variant="outline"
			className="w-full gap-2"
			isLoading={redirectingTo === provider.providerId}
			onClick={() => startSSOSignIn(provider.providerId)}
		>
			<KeyRound className="size-4" />
			Continue with {providerLabel(provider.providerId)}
		</Button>
	));

	if (enforce) {
		return <div className="flex flex-col gap-2">{buttons}</div>;
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">{buttons}</div>
			{children}
		</div>
	);
};
