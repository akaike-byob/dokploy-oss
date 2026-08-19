import { Trash2 } from "lucide-react";
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

const emptyProvider = {
	providerId: "",
	issuer: "",
	domain: "",
	clientId: "",
	clientSecret: "",
	discoveryEndpoint: "",
};

/**
 * Registers OIDC providers for the active organization. Sign-in is routed by email domain,
 * so each provider owns the domain it is registered with.
 */
export const SSOSettings = () => {
	const utils = api.useUtils();
	const { data: providers, isLoading } = api.sso.all.useQuery();
	const { mutateAsync: create, isPending: isCreating } =
		api.sso.create.useMutation();
	const { mutateAsync: remove } = api.sso.remove.useMutation();
	const [draft, setDraft] = useState(emptyProvider);

	const set = (field: keyof typeof emptyProvider, value: string) =>
		setDraft((current) => ({ ...current, [field]: value }));

	const callbackUrl =
		typeof window === "undefined"
			? "/api/auth/sso/callback/<provider-id>"
			: `${window.location.origin}/api/auth/sso/callback/${draft.providerId || "<provider-id>"}`;

	const submit = async () => {
		try {
			await create({
				providerId: draft.providerId,
				issuer: draft.issuer,
				domain: draft.domain,
				clientId: draft.clientId,
				clientSecret: draft.clientSecret,
				...(draft.discoveryEndpoint
					? { discoveryEndpoint: draft.discoveryEndpoint }
					: {}),
			});
			toast.success("SSO provider registered");
			setDraft(emptyProvider);
			await utils.sso.all.invalidate();
			await utils.sso.showSignInWithSSO.invalidate();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Could not register the provider",
			);
		}
	};

	const removeProvider = async (providerId: string) => {
		try {
			await remove({ providerId });
			toast.success("SSO provider removed");
			await utils.sso.all.invalidate();
			await utils.sso.showSignInWithSSO.invalidate();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Could not remove the provider",
			);
		}
	};

	return (
		<>
			<CardHeader>
				<CardTitle className="text-xl">Single Sign-On</CardTitle>
				<CardDescription>
					Sign in through an OIDC provider. Users are matched by the email
					domain registered against each provider.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{isLoading ? (
					<p className="text-sm text-muted-foreground">Loading...</p>
				) : providers?.length ? (
					<div className="flex flex-col gap-2">
						{providers.map((provider) => (
							<div
								key={provider.id}
								className="flex items-center justify-between rounded-lg border p-3"
							>
								<div className="flex flex-col">
									<span className="text-sm font-medium">
										{provider.providerId}
									</span>
									<span className="text-xs text-muted-foreground">
										{provider.domain} - {provider.issuer}
									</span>
								</div>
								<Button
									variant="ghost"
									size="icon"
									aria-label={`Remove ${provider.providerId}`}
									onClick={() => removeProvider(provider.providerId)}
								>
									<Trash2 className="size-4" />
								</Button>
							</div>
						))}
					</div>
				) : (
					<p className="text-sm text-muted-foreground">
						No provider registered yet.
					</p>
				)}

				<div className="grid gap-4 md:grid-cols-2">
					<div className="flex flex-col gap-2">
						<Label htmlFor="sso-provider-id">Provider ID</Label>
						<Input
							id="sso-provider-id"
							placeholder="akaike-portal"
							value={draft.providerId}
							onChange={(event) => set("providerId", event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="sso-domain">Email domain</Label>
						<Input
							id="sso-domain"
							placeholder="akaike.ai"
							value={draft.domain}
							onChange={(event) => set("domain", event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-2 md:col-span-2">
						<Label htmlFor="sso-issuer">Issuer URL</Label>
						<Input
							id="sso-issuer"
							placeholder="https://portal.akaike.ai/api/auth"
							value={draft.issuer}
							onChange={(event) => set("issuer", event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="sso-client-id">Client ID</Label>
						<Input
							id="sso-client-id"
							value={draft.clientId}
							onChange={(event) => set("clientId", event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="sso-client-secret">Client secret</Label>
						<Input
							id="sso-client-secret"
							type="password"
							value={draft.clientSecret}
							onChange={(event) => set("clientSecret", event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-2 md:col-span-2">
						<Label htmlFor="sso-discovery">Discovery endpoint (optional)</Label>
						<Input
							id="sso-discovery"
							placeholder="https://portal.akaike.ai/.well-known/openid-configuration"
							value={draft.discoveryEndpoint}
							onChange={(event) => set("discoveryEndpoint", event.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Left empty, the issuer's own discovery document is used.
						</p>
					</div>
				</div>

				<div className="rounded-lg border p-3">
					<p className="text-xs text-muted-foreground">
						Register this redirect URI with the provider:
					</p>
					<code className="text-xs break-all">{callbackUrl}</code>
				</div>

				<Button
					className="w-fit"
					isLoading={isCreating}
					onClick={submit}
					disabled={
						!draft.providerId ||
						!draft.issuer ||
						!draft.domain ||
						!draft.clientId ||
						!draft.clientSecret
					}
				>
					Add provider
				</Button>
			</CardContent>
		</>
	);
};
