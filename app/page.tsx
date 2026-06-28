import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import ChampionPicker from "@/components/ChampionPicker";
import MatchTabs from "@/components/MatchTabs";
import AutoRefresh from "@/components/AutoRefresh";
import type { Match, Prediction } from "@/lib/types";

export const dynamic = "force-dynamic";

// Şampiyon tahmini kilidi — ilk Son 32 maçı: 28 Haz 22:00 TR = 28 Haz 19:00 UTC — route ile aynı olmalı
const CHAMPION_LOCK_AT = new Date("2026-06-28T19:00:00Z");

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

  const predByMatch: Record<number, Prediction> = {};
  (preds ?? []).forEach((p) => {
    predByMatch[p.match_id] = p as Prediction;
  });

  const all = (matches ?? []) as Match[];
  const open = all.filter((m) => m.status !== "FINISHED");
  const done = all.filter((m) => m.status === "FINISHED").reverse();

  // Devam eden maç var mı? (canlı skor için otomatik tazeleme)
  const hasLive = all.some((m) =>
    ["IN_PLAY", "PAUSED", "LIVE"].includes(m.status)
  );

  const championLocked = Date.now() >= CHAMPION_LOCK_AT.getTime();

  // Tahmin sayacı: takımı belli olan maçları baz al (TBD eleme maçları sayılmaz)
  const TBD = (t: string | null) => !t || t === "TBD";
  const predictable = all.filter((m) => !TBD(m.home_team) && !TBD(m.away_team));
  const totalMatches = predictable.length;
  const predictedCount = predictable.filter((m) => predByMatch[m.id]).length;
  const pct = totalMatches > 0 ? Math.round((predictedCount / totalMatches) * 100) : 0;

  return (
    <main className="min-h-dvh">
      {/* Devam eden maç varsa sayfayı 60 sn'de bir tazele (canlı skor) */}
      {hasLive && <AutoRefresh seconds={60} />}

      <Nav isAdmin={profile?.is_admin} />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 font-display text-3xl font-700 uppercase tracking-wide">
          Merhaba {profile?.full_name?.split(" ")[0] ?? "şampiyon"} 👋
        </h1>
        <p className="mb-4 text-sm text-cream/60">
          Maç başlamadan skor tahminini gir. Maç saati gelince tahmin kapanır.
        </p>

        {totalMatches > 0 && (
          <div className="mb-6 rounded-xl border border-line bg-pitch-deep/60 px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-display uppercase tracking-wide text-cream/70">
                Tahmin durumun
              </span>
              <span className="font-display text-gold">
                {predictedCount}/{totalMatches} maç
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-pitch">
              <div
                className="h-full rounded-full bg-gold transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            {predictedCount < totalMatches ? (
              <p className="mt-2 text-xs text-cream/50">
                {totalMatches - predictedCount} maç seni bekliyor — boş bırakma!
              </p>
            ) : (
              <p className="mt-2 text-xs text-gold">
                Açık tüm maçlara tahmin girdin! 🎯
              </p>
            )}
          </div>
        )}

        {teams.length > 0 && (
          <ChampionPicker
            teams={teams}
            current={profile?.champion_pick ?? null}
            locked={championLocked}
          />
        )}

        {all.length === 0 ? (
          <div className="rounded-2xl border border-line bg-pitch-deep/60 p-6 text-center text-cream/60">
            Henüz maç yüklenmedi. Yönetici skor senkronunu çalıştırdığında maçlar burada belirir.
          </div>
        ) : (
          <MatchTabs open={open} done={done} predByMatch={predByMatch} />
        )}
      </div>
    </main>
  );
}