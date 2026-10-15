import { ResetForm } from "@/components/ResetForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password — learnai", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetForm token={typeof token === "string" ? token : ""} />;
}
