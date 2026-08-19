import type { ReactNode } from "react";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LockedProps {
	title: string;
	description: string;
	ctaLabel?: string;
	compact?: boolean;
}

/**
 * This fork has no licence tier, so nothing is gated: the gate renders its children and the
 * decision of what a feature does lives in the feature itself.
 */
export const EnterpriseFeatureGate = ({
	children,
}: {
	lockedProps?: LockedProps;
	children: ReactNode;
}) => <>{children}</>;

/**
 * Rendered by upstream code on the unlicensed branch. Nothing reaches it here, since every
 * licence check in this fork reports access, but it must exist and stay honest if one does.
 */
export const EnterpriseFeatureLocked = ({
	title,
	description,
}: LockedProps) => (
	<CardHeader className="p-0">
		<CardTitle className="text-base">{title}</CardTitle>
		<CardDescription>{description}</CardDescription>
	</CardHeader>
);
