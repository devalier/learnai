import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, requireAdmin } from "@/lib/auth";
import { aiStatus } from "@/lib/aisettings";
import { PROVIDERS, type ProviderId } from "@/lib/aiproviders";
import TopBar from "@/components/TopBar";
import AiSettingsForm, { type ProviderOption } from "@/components/AiSettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI provider — learnai admin" };

export default async function AiAdmin() {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?next=/admin/ai");
  }
  const session = await getSession();
  const providers: ProviderOption[] = (Object.keys(PROVIDERS) as ProviderId[]).map((id) => ({
    id,
    label: PROVIDERS[id].label,
    requiresKey: PROVIDERS[id].requiresKey,
    publicCatalog: PROVIDERS[id].publicCatalog,
    needsEndpoint: PROVIDERS[id].base === null,
    example: PROVIDERS[id].example,
    inEU: PROVIDERS[id].inEU,
  }));

  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        <div className="settings" style={{ maxWidth: 760 }}>
          <div className="kick" style={{ marginBottom: 6 }}><Link href="/admin">← Admin</Link></div>
          <h1 className="serif" style={{ fontSize: 28 }}>AI provider</h1>
          <p className="set-sub">
            The model that writes quizzes, answers questions and judges answers. The key is stored encrypted and is never shown
            again; only its last four characters are. If the server&rsquo;s AUTH_SECRET is ever changed, enter the key again.
          </p>
          <AiSettingsForm initial={await aiStatus()} providers={providers} />
        </div>
      </div>
    </>
  );
}
