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

  // 1) Tüm Dünya Kupası maçlarını çek ve upsert et (yeni turlar otomatik gelir)
  let matches;
  try {
    matches = await fetchWorldCupMatches();
  } catch (e: any) {
    return NextResponse.json({ error: "Maç çekme hatası: " + e.message }, { status: 502 });
  }

  if (matches.length) {
    const { error } = await admin.from("matches").upsert(matches, { onConflict: "id" });
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
    finished_matches: finished?.length ?? 0,
    predictions_scored: scoredPredictions,
    at: new Date().toISOString(),
  });
}
