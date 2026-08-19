import { KeyRound } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

/**
 * Sign-in through an OIDC provider registered under Settings -> SSO. The email address picks
 * the provider: better-auth routes it by the email domain the provider was registered with.
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
	const [email, setEmail] = useState("");
	const [isRedirecting, setIsRedirecting] = useState(false);
	const [isPrompting, setIsPrompting] = useState(Boolean(enforce));

	const startSSOSignIn = async () => {
		if (!email.trim()) {
			toast.error("Enter your work email address");
			return;
		}

		setIsRedirecting(true);
		try {
			const { error } = await authClient.signIn.sso({
				email: email.trim(),
				callbackURL: "/dashboard/home",
			});
			if (error) {
				toast.error(
					error.message || "No SSO provider matches that email domain",
				);
				setIsRedirecting(false);
			}
		} catch {
			toast.error("Could not start SSO sign-in");
			setIsRedirecting(false);
		}
	};

	const prompt = (
		<div className="flex flex-col gap-2">
			<Label htmlFor="sso-email">Work email</Label>
			<Input
				id="sso-email"
				type="email"
				placeholder="you@example.com"
				value={email}
				onChange={(event) => setEmail(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						startSSOSignIn();
					}
				}}
			/>
			<Button
				type="button"
				className="w-full"
				isLoading={isRedirecting}
				onClick={startSSOSignIn}
			>
				Continue with SSO
			</Button>
		</div>
	);

	if (enforce) {
		return prompt;
	}

	return (
		<div className="flex flex-col gap-4">
			{isPrompting ? (
				prompt
			) : (
				<Button
					type="button"
					variant="outline"
					className="w-full gap-2"
					onClick={() => setIsPrompting(true)}
				>
					<KeyRound className="size-4" />
					Continue with SSO
				</Button>
			)}
			{children}
		</div>
	);
};
