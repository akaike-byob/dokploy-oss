import {
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/utils/api";

/**
 * Recent audit entries for the active organization. Entries are written by
 * `packages/server/src/services/proprietary/audit-log.ts` into the `audit_log` table.
 */
export const ShowAuditLogs = () => {
	const { data: auditEntries, isLoading } = api.auditLog.all.useQuery();

	return (
		<>
			<CardHeader>
				<CardTitle className="text-xl">Audit Logs</CardTitle>
				<CardDescription>
					Recent activity across this organization.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<p className="text-sm text-muted-foreground">Loading...</p>
				) : !auditEntries?.length ? (
					<p className="text-sm text-muted-foreground">
						No activity recorded yet.
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>When</TableHead>
								<TableHead>User</TableHead>
								<TableHead>Action</TableHead>
								<TableHead>Resource</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{auditEntries.map((entry) => (
								<TableRow key={entry.id}>
									<TableCell className="whitespace-nowrap">
										{new Date(entry.createdAt).toLocaleString()}
									</TableCell>
									<TableCell>{entry.userEmail}</TableCell>
									<TableCell>{entry.action}</TableCell>
									<TableCell>
										{entry.resourceName
											? `${entry.resourceType}: ${entry.resourceName}`
											: entry.resourceType}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</>
	);
};
