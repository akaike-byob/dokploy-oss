import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/utils/api";

const emptyClient = { clientId: "", clientSecret: "" };

/**
 * Registers the Google OAuth client the panel signs in against. Credentials saved here take
 * effect on the next sign-in, so a panel that was started without GOOGLE_CLIENT_ID gains the
 * button without a restart.
 */
export const GoogleAuthSettings = () => {
	const utils = api.useUtils();
	const { data: client, isLoading } = api.sso.googleClient.useQuery();
	const { mutateAsync: save, isPending: isSaving } =
		api.sso.saveGoogleClient.useMutation();
	const { mutateAsync: remove } = api.sso.removeGoogleClient.useMutation();
	const [draft, setDraft] = useState(emptyClient);

	const set = (field: keyof typeof emptyClient, value: string) =>
		setDraft((current) => ({ ...current, [field]: value }));

	const redirectUri =
		typeof window === "undefined"
			? "/api/auth/callback/google"
			: `${window.location.origin}/api/auth/callback/google`;

	const refresh = async () => {
		await utils.sso.googleClient.invalidate();
		await utils.sso.isGoogleEnabled.invalidate();
	};

	const submit = async () => {
		try {
			await save(draft);
			toast.success("Google sign-in configured");
			setDraft(emptyClient);
			await refresh();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Could not save the Google client",
			);
		}
	};

	const removeClient = async () => {
		try {
			await remove();
			toast.success("Google client removed");
			await refresh();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Could not remove the Google client",
			);
		}
	};

	return (
		<>
			<CardHeader>
				<CardTitle className="text-xl">Google Sign-In</CardTitle>
				<CardDescription>
					Offer "Continue with Google" on the login page. A Google identity
					signs in to the account with the same email address.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{isLoading ? (
					<p className="text-sm text-muted-foreground">Loading...</p>
				) : client ? (
					<div className="flex items-center justify-between rounded-lg border p-3">
						<div className="flex flex-col">
							<span className="text-sm font-medium break-all">
								{client.clientId}
							</span>
							<span className="text-xs text-muted-foreground">
								{client.source === "panel"
									? "Configured here"
									: "Configured through GOOGLE_CLIENT_ID, and overridden by anything saved here"}
							</span>
						</div>
						{client.source === "panel" && (
							<Button variant="ghost" onClick={removeClient}>
								Remove
							</Button>
						)}
					</div>
				) : (
					<p className="text-sm text-muted-foreground">
						No Google client configured yet.
					</p>
				)}

				<div className="grid gap-4 md:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="google-client-id">Client ID</Label>
						<Input
							id="google-client-id"
							placeholder="1234567890-abc.apps.googleusercontent.com"
							value={draft.clientId}
							onChange={(event) => set("clientId", event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="google-client-secret">Client secret</Label>
						<Input
							id="google-client-secret"
							type="password"
							value={draft.clientSecret}
							onChange={(event) => set("clientSecret", event.target.value)}
						/>
					</div>
				</div>

				<div className="rounded-lg border p-3">
					<p className="text-xs text-muted-foreground">
						Register this redirect URI with the Google OAuth client:
					</p>
					<code className="text-xs break-all">{redirectUri}</code>
				</div>

				<Button
					className="w-fit"
					isLoading={isSaving}
					onClick={submit}
					disabled={!draft.clientId || !draft.clientSecret}
				>
					{client?.source === "panel" ? "Replace client" : "Save client"}
				</Button>
			</CardContent>
		</>
	);
};
