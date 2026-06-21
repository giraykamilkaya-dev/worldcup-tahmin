import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWorldCupMatches } from "@/lib/footballData";
import { calcPoints } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Maçları çeker (grup + eleme turları), DB'yi günceller, biten maçların
// puanlarını hesaplar. Vercel Cron veya cron-job.org düzenli aralıkla çağırır.
export async function GET(request: Request) {
  // Güvenlik: doğru secret olmadan çalışmaz.
  const url = new URL(request.url);
  const secret =
    url.searchParams.get("secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1) Tüm Dünya Kupası maçlarını çek
  let matches;
  try {
    matches = await fetchWorldCupMatches();
  } catch (e: any) {
    return NextResponse.json({ error: "Maç çekme hatası: " + e.message }, { status: 502 });
  }

  // Skoru elle kilitlenmiş maçları öğren (football-data yanlış skor verirse koruruz)
  const { data: lockedRows } = await admin
    .from("matches")
    .select("id")
    .eq("score_locked", true);
  const lockedIds = new Set((lockedRows ?? []).map((r) => r.id));

  if (matches.length) {
    // Kilitli maçların skor/durumunu football-data'dan gelenle EZME.
    // Kilitli maçlar için sadece zararsız alanları (takım, arma, tarih) güncelle.
    const toUpsert = matches.map((m) => {
      if (!lockedIds.has(m.id)) return m;
      // Kilitli: skor, durum ve kazananı DB'deki elle düzeltilmiş haliyle bırak
      const { home_score, away_score, status, winner, ...safe } = m;
      return safe;
    });

    const { error } = await admin.from("matches").upsert(toUpsert, { onConflict: "id" });
    if (error)
      return NextResponse.json({ error: "Maç yazma hatası: " + error.message }, { status: 500 });
  }

  // 2) Biten maçların henüz puanlanmamış tahminlerini hesapla
  const { data: finished } = await admin
    .from("matches")
    .select("id, home_score, away_score")
    .eq("status", "FINISHED");

  let scoredPredictions = 0;
  for (const m of finished ?? []) {
    if (m.home_score == null || m.away_score == null) continue;

    const { data: preds } = await admin
      .from("predictions")
      .select("id, home_pred, away_pred")
      .eq("match_id", m.id)
      .is("points", null);

    for (const p of preds ?? []) {
      const pts = calcPoints(p.home_pred, p.away_pred, m.home_score, m.away_score);
      await admin.from("predictions").update({ points: pts }).eq("id", p.id);
      scoredPredictions++;
    }
  }

  return NextResponse.json({
    ok: true,
    matches_synced: matches.length,
    locked_protected: lockedIds.size,
    finished_matches: finished?.length ?? 0,
    predictions_scored: scoredPredictions,
    at: new Date().toISOString(),
  });
}