import { DashboardClient } from "./DashboardClient";

export default function DashboardPage({
  params,
}: {
  params: { projectId: string };
}) {
  return <DashboardClient projectId={params.projectId} />;
}
