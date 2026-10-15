import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ForgotForm } from "@/components/ResetForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Forgot password — learnai" };

export default async function Page() {
  if (await getSession()) redirect("/");
  return <ForgotForm />;
}
