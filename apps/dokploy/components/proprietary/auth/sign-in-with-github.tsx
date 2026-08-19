import { Github } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { api } from "@/utils/api";

/**
 * Panel sign-in through GitHub, backed by the better-auth GitHub provider configured in
 * `packages/server/src/lib/auth.ts`. Renders nothing unless GITHUB_CLIENT_ID and
 * GITHUB_CLIENT_SECRET are set on the server.
 */
export const SignInWithGithub = () => {
	const { data: isGithubEnabled } = api.sso.isGithubEnabled.useQuery();
	const [isRedirecting, setIsRedirecting] = useState(false);

	if (!isGithubEnabled) {
		return null;
	}

	const startGithubSignIn = async () => {
		setIsRedirecting(true);
		try {
			await authClient.signIn.social({
				provider: "github",
				callbackURL: "/dashboard/home",
			});
		} catch {
			toast.error("Could not start GitHub sign-in");
			setIsRedirecting(false);
		}
	};

	return (
		<Button
			variant="outline"
			className="w-full gap-2"
			type="button"
			isLoading={isRedirecting}
			onClick={startGithubSignIn}
		>
			{!isRedirecting && <Github className="size-4" />}
			Continue with GitHub
		</Button>
	);
};
