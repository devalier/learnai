import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return <AuthForm mode="login" />;
}
