import type { ReactNode } from "react";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
	title: string;
	children?: ReactNode;
}

/**
 * Panel shown where upstream Dokploy offers a feature sold under its enterprise licence.
 * That code is not part of this fork, so the surrounding page stays reachable and says so
 * rather than failing to render. Each message names what to do instead where there is a
 * self-hosted answer, and says plainly that there is none where there is not.
 */
export const FeatureUnavailable = ({ title, children }: Props) => (
	<CardHeader>
		<CardTitle className="text-xl">{title}</CardTitle>
		<CardDescription>
			{children ?? "This feature is not part of this fork."}
		</CardDescription>
	</CardHeader>
);
