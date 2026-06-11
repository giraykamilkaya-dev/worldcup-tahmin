import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Nav from "@/components/Nav";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const GROUP_NAME: Record<number, string> = { 1: "Aile", 2: "QuitGang" };

// --- yetki kontrolü (ortak) ---
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) throw new Error("Yetkisiz");
}

// --- Server Action: onay durumu ---
async function setApproval(formData: FormData) {
  "use server";
  await requireAdmin();
  const targetId = String(formData.get("id"));
  const approve = String(formData.get("approve")) === "true";
  const admin = createAdminClient();
  await admin.from("profiles").update({ approved: approve }).eq("id", targetId);
  revalidatePath("/admin");
}

// --- Server Action: grup değiştir ---
async function setGroup(formData: FormData) {
  "use server";
  await requireAdmin();
  const targetId = String(formData.get("id"));
  const group = Number(formData.get("group"));
  if (group !== 1 && group !== 2) throw new Error("Geçersiz grup");
  const admin = createAdminClient();
  await admin.from("profiles").update({ group_no: group }).eq("id", targetId);
  revalidatePath("/admin");
}

// --- Server Action: takma ad (nick) ---
async function setNickname(formData: FormData) {
  "use server";
  await requireAdmin();
  const targetId = String(formData.get("id"));
  const raw = String(formData.get("nickname") ?? "").trim();
  const nickname = raw === "" ? null : raw.slice(0, 30); // boşsa temizle, en fazla 30 karakter
  const admin = createAdminClient();
  await admin.from("profiles").update({ nickname }).eq("id", targetId);
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

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name, avatar_url, approved, is_admin, group_no, nickname")
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

        <Section title={`Üyeler (${approved.length})`}>
          {approved.map((p) => (
            <Row key={p.id} p={p}>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <GroupSwitch p={p} />
                  {p.is_admin ? (
                    <span className="rounded-full bg-tr-red/20 px-3 py-1 text-xs font-600 text-tr-red">
                      Yönetici
                    </span>
                  ) : (
                    <form action={setApproval}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="approve" value="false" />
                      <button className="rounded-full border border-line px-3 py-1.5 font-display text-xs uppercase text-cream/60 hover:text-tr-red">
                        Çıkar
                      </button>
                    </form>
                  )}
                </div>
                <NicknameForm p={p} />
              </div>
            </Row>
          ))}
        </Section>
      </div>
    </main>
  );
}

// Takma ad: boş bırakınca gerçek ad görünür
function NicknameForm({ p }: { p: Profile }) {
  return (
    <form action={setNickname} className="flex w-full items-center gap-2 sm:w-auto">
      <input type="hidden" name="id" value={p.id} />
      <input
        type="text"
        name="nickname"
        defaultValue={p.nickname ?? ""}
        placeholder="Takma ad (boş = gerçek ad)"
        maxLength={30}
        className="w-full rounded-lg border border-line bg-pitch px-3 py-1.5 text-xs text-cream placeholder:text-cream/30 outline-none focus:border-gold sm:w-44"
      />
      <button className="shrink-0 rounded-full border border-line px-3 py-1.5 font-display text-xs uppercase text-cream/60 hover:text-gold">
        Kaydet
      </button>
    </form>
  );
}

// Grup değiştirme: aktif grup vurgulu, diğerine basınca taşır
function GroupSwitch({ p }: { p: Profile }) {
  const current = p.group_no ?? 1;
  return (
    <div className="flex shrink-0 overflow-hidden rounded-full border border-line">
      {[1, 2].map((g) => (
        <form action={setGroup} key={g}>
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="group" value={g} />
          <button
            className={`px-3 py-1.5 font-display text-xs uppercase ${current === g
              ? "bg-gold text-pitch-deep"
              : "text-cream/60 hover:text-cream"
              }`}
          >
            {GROUP_NAME[g]}
          </button>
        </form>
      ))}
    </div>
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
        className={`mb-3 font-display text-lg uppercase tracking-wide ${highlight ? "text-gold" : "text-cream/50"
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
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-pitch-deep/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.avatar_url ? (
          <img src={p.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full" />
        ) : (
          <div className="h-9 w-9 shrink-0 rounded-full bg-cream/10" />
        )}
        <div className="min-w-0">
          <div className="truncate font-600">{p.full_name ?? "—"}</div>
          <div className="truncate text-xs text-cream/50">{p.email}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-1 text-sm text-cream/50">{children}</div>;
}