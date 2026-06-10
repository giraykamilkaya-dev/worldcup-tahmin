import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import MatchCard from "@/components/MatchCard";
import type { Match, Prediction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, full_name")
    .eq("id", user!.id)
    .single();

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .order("utc_date", { ascending: true });

  const { data: preds } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", user!.id);

  const predByMatch = new Map<number, Prediction>();
  (preds ?? []).forEach((p) => predByMatch.set(p.match_id, p as Prediction));

  const all = (matches ?? []) as Match[];
  const open = all.filter((m) => m.status !== "FINISHED");
  const done = all.filter((m) => m.status === "FINISHED").reverse();

  return (
    <main className="min-h-dvh">
      <Nav isAdmin={profile?.is_admin} />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 font-display text-3xl font-700 uppercase tracking-wide">
          Merhaba {profile?.full_name?.split(" ")[0] ?? "şampiyon"} 👋
        </h1>
        <p className="mb-6 text-sm text-cream/60">
          Maç başlamadan skor tahminini gir. Maç saati gelince tahmin kapanır.
        </p>

        {all.length === 0 && (
          <div className="rounded-2xl border border-line bg-pitch-deep/60 p-6 text-center text-cream/60">
            Henüz maç yüklenmedi. Yönetici skor senkronunu çalıştırdığında maçlar burada belirir.
          </div>
        )}

        {open.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-gold">
              Oynanacak maçlar
            </h2>
            <div className="space-y-3">
              {open.map((m) => (
                <MatchCard key={m.id} match={m} prediction={predByMatch.get(m.id) ?? null} />
              ))}
            </div>
          </section>
        )}

        {done.length > 0 && (
          <section>
            <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-cream/50">
              Sonuçlananlar
            </h2>
            <div className="space-y-3">
              {done.map((m) => (
                <MatchCard key={m.id} match={m} prediction={predByMatch.get(m.id) ?? null} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
