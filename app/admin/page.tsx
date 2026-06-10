import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Nav from "@/components/Nav";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

// --- Server Action: bir üyenin onay durumunu değiştir ---
async function setApproval(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Çağıran admin mi? (service role'dan önce DOĞRULA)
  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) throw new Error("Yetkisiz");

  const targetId = String(formData.get("id"));
  const approve = String(formData.get("approve")) === "true";

  const admin = createAdminClient();
  await admin.from("profiles").update({ approved: approve }).eq("id", targetId);
  revalidatePath("/admin");
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user!.id)
    .single();
  if (!me?.is_admin) redirect("/");

  // Tüm profilleri service role ile çek (admin görür)
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name, avatar_url, approved, is_admin")
    .order("created_at", { ascending: true });

  const list = (profiles ?? []) as Profile[];
  const pending = list.filter((p) => !p.approved);
  const approved = list.filter((p) => p.approved);

  return (
    <main className="min-h-dvh">
      <Nav isAdmin />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-6 font-display text-3xl font-700 uppercase tracking-wide">
          Üye Yönetimi
        </h1>

        <Section title={`Onay bekleyenler (${pending.length})`} highlight>
          {pending.length === 0 && <Empty>Bekleyen yok.</Empty>}
          {pending.map((p) => (
            <Row key={p.id} p={p}>
              <form action={setApproval}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="approve" value="true" />
                <button className="rounded-full bg-gold px-4 py-1.5 font-display text-sm font-600 uppercase text-pitch-deep hover:bg-gold/90">
                  Onayla
                </button>
              </form>
            </Row>
          ))}
        </Section>

        <Section title={`Aile üyeleri (${approved.length})`}>
          {approved.map((p) => (
            <Row key={p.id} p={p}>
              {p.is_admin ? (
                <span className="rounded-full bg-tr-red/20 px-3 py-1 text-xs font-600 text-tr-red">
                  Yönetici
                </span>
              ) : (
                <form action={setApproval}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="approve" value="false" />
                  <button className="rounded-full border border-line px-4 py-1.5 font-display text-sm uppercase text-cream/60 hover:text-tr-red">
                    Çıkar
                  </button>
                </form>
              )}
            </Row>
          ))}
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  highlight,
  children,
}: {
  title: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2
        className={`mb-3 font-display text-lg uppercase tracking-wide ${
          highlight ? "text-gold" : "text-cream/50"
        }`}
      >
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ p, children }: { p: Profile; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-pitch-deep/60 px-4 py-3">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.avatar_url ? (
          <img src={p.avatar_url} alt="" className="h-9 w-9 rounded-full" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-cream/10" />
        )}
        <div>
          <div className="font-600">{p.full_name ?? "—"}</div>
          <div className="text-xs text-cream/50">{p.email}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-1 text-sm text-cream/50">{children}</div>;
}
