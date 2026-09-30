import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/campaigns/page-guard";
import { roleHome } from "@/lib/nav/roles";

export const dynamic = "force-dynamic";

/** "My dashboard": sends each signed-in user to the workspace for their role (signed out goes to /login). */
export default async function DashboardIndex() {
  const { user } = await requirePageUser();
  redirect(roleHome(user.role));
}
