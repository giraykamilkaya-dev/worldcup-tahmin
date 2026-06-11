import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import type { StandingRow } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function StandingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user!.id)
    .single();
  const { data: rows } = await supabase.rpc("get_standings");
  const standings = (rows ?? []) as StandingRow[];
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <main className="min-h-dvh">
      <Nav isAdmin={profile?.is_admin} />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-1 font-display text-3xl font-700 uppercase tracking-wide">
          Puan Tablosu
        </h1>
        <p className="mb-6 text-sm text-cream/60">
          Puanlama: Tam skor 5 · Doğru gol farkı 3 · Doğru sonuç (galip/berabere) 2
        </p>
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left">
            <thead className="bg-pitch-deep/80 font-display text-xs uppercase tracking-wide text-cream/50">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Oyuncu</th>
                <th className="px-2 py-3 text-center">Tam</th>
                <th className="px-2 py-3 text-center">Tahmin</th>
                <th className="px-4 py-3 text-right">Puan</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r, i) => (
                <tr
                  key={r.user_id}
                  className={`border-t border-line ${
                    r.user_id === user!.id ? "bg-gold/5" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-display text-lg">
                    {medals[i] ?? i + 1}
                  </td>
                  <td className="px-4 py-3 font-600">
                    {r.full_name ?? "—"}
                    {r.user_id === user!.id && (
                      <span className="ml-2 text-xs text-gold">(sen)</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-center text-cream/70">{r.exact_count}</td>
                  <td className="px-2 py-3 text-center text-cream/70">{r.predictions_count}</td>
                  <td className="scorebox px-4 py-3 text-right font-display text-2xl font-700 text-gold">
                    {r.total_points}
                  </td>
                </tr>
              ))}
              {standings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-cream/50">
                    Henüz puanlanan maç yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}