import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_COOKIE, authenticateToken, operatorConfig } from "../../../server/operator/auth.mjs";
import { getDatabasePool } from "../../../server/database.mjs";
import LoginForm from "./login-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Operator sign in", robots: { index: false, follow: false } };
export default async function LoginPage() {
  try { if (await authenticateToken((await cookies()).get(OPERATOR_COOKIE)?.value, operatorConfig(), getDatabasePool())) redirect("/operator/requests"); } catch {}
  return <main className="min-h-screen bg-slate-950 p-6 text-white grid place-items-center"><LoginForm /></main>;
}
