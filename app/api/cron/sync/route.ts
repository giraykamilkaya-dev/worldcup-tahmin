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
    // Kilitli maçları upsert'e hiç dahil etme — DB'deki elle düzeltilmiş
    // skor/durum aynen korunur, football-data ezemez.
    const toUpsert = matches.filter((m) => !lockedIds.has(m.id));

    if (toUpsert.length) {
      const { error } = await admin.from("matches").upsert(toUpsert, { onConflict: "id" });
      if (error)
        return NextResponse.json({ error: "Maç yazma hatası: " + error.message }, { status: 500 });
    }
  }

  // 2) Biten maçların TÜM tahminlerini gerçek skora göre yeniden hesapla.
  // Sadece points=null olanları değil, hepsini; çünkü football-data maç
  // sırasında yanlış/ara skor verip puanı bozmuş olabilir. Her turda doğru
  // skora göre yeniden hesaplayınca yanlışlar kendiliğinden düzelir.
  const { data: finished } = await admin
    .from("matches")
    .select("id, home_score, away_score")
    .eq("status", "FINISHED");

  let scoredPredictions = 0;
  for (const m of finished ?? []) {
    if (m.home_score == null || m.away_score == null) continue;

    const { data: preds } = await admin
      .from("predictions")
      .select("id, home_pred, away_pred, points")
      .eq("match_id", m.id);

    for (const p of preds ?? []) {
      const correct = calcPoints(p.home_pred, p.away_pred, m.home_score, m.away_score);
      // Sadece yanlışsa güncelle (gereksiz yazma yapma)
      if (p.points !== correct) {
        await admin.from("predictions").update({ points: correct }).eq("id", p.id);
        scoredPredictions++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    matches_synced: matches.length,
    locked_protected: lockedIds.size,
    finished_matches: finished?.length ?? 0,
    predictions_corrected: scoredPredictions,
    at: new Date().toISOString(),
  });
}