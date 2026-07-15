import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, authenticateToken, operatorConfig } from "../../../server/operator/auth.mjs";
import { getDatabasePool } from "../../../server/database.mjs";
import OperatorInbox from "./operator-inbox";
export const dynamic = "force-dynamic";
export const metadata = { title: "Operator request inbox", robots: { index: false, follow: false } };
export default async function OperatorRequestsPage() {
  let valid = false; try { valid = Boolean(await authenticateToken((await cookies()).get(OPERATOR_COOKIE)?.value, operatorConfig(), getDatabasePool())); } catch { valid = false; }
  if (!valid) redirect("/operator/login");
  return <OperatorInbox />;
}
