import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import MatchCard from "@/components/MatchCard";
import ChampionPicker from "@/components/ChampionPicker";
import type { Match, Prediction } from "@/lib/types";

export const dynamic = "force-dynamic";

// Şampiyon tahmini kilidi (TR 28 Haziran 00:00 = UTC 27 Haz 21:00) — route ile aynı olmalı
const CHAMPION_LOCK_AT = new Date("2026-06-27T21:00:00Z");

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, full_name, champion_pick")
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

  const { data: teamRows } = await supabase.rpc("get_teams");
  const teams = (teamRows ?? []).map((t: { team: string }) => t.team);

  const predByMatch = new Map<number, Prediction>();
  (preds ?? []).forEach((p) => predByMatch.set(p.match_id, p as Prediction));

  const all = (matches ?? []) as Match[];
  const open = all.filter((m) => m.status !== "FINISHED");
  const done = all.filter((m) => m.status === "FINISHED").reverse();

  const championLocked = Date.now() >= CHAMPION_LOCK_AT.getTime();

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

        {teams.length > 0 && (
          <ChampionPicker
            teams={teams}
            current={profile?.champion_pick ?? null}
            locked={championLocked}
          />
        )}

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