import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWorldCupMatches } from "@/lib/footballData";
import { calcPoints, calcBonus, isKnockout } from "@/lib/scoring";

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

  // Mevcut DB satırlarını çek — football-data bir alanı null verdiğinde
  // DB'deki dolu değeri korumak için (eleme turlarında takım isimleri
  // bazen API'de geçici null gelip ekrandaki maçı "belirsiz"e döndürüyordu).
  const { data: existingRows } = await admin
    .from("matches")
    .select("id, stage, group_name, home_team, home_crest, away_team, away_crest, home_score, away_score, pen_home, pen_away, winner, score_locked");
  const existingById = new Map((existingRows ?? []).map((r) => [r.id, r]));
  const lockedIds = new Set(
    (existingRows ?? []).filter((r) => r.score_locked === true).map((r) => r.id)
  );

  // API null verince eskisini koru; dolu verince güncelle.
  const keep = <T,>(incoming: T | null | undefined, current: T | null | undefined): T | null =>
    incoming == null ? (current ?? null) : incoming;

  if (matches.length) {
    // Kilitli maçları upsert'e hiç dahil etme — DB'deki elle düzeltilmiş
    // skor/durum aynen korunur, football-data ezemez.
    const toUpsert = matches
      .filter((m) => !lockedIds.has(m.id))
      .map((m) => {
        const cur = existingById.get(m.id);
        if (!cur) return m; // yeni maç, olduğu gibi yaz
        return {
          ...m,
          // Takım/arma/skor alanları: API null verirse DB'deki doluyu koru
          home_team: keep(m.home_team, cur.home_team),
          home_crest: keep(m.home_crest, cur.home_crest),
          away_team: keep(m.away_team, cur.away_team),
          away_crest: keep(m.away_crest, cur.away_crest),
          home_score: keep(m.home_score, cur.home_score),
          away_score: keep(m.away_score, cur.away_score),
          pen_home: keep(m.pen_home, cur.pen_home),
          pen_away: keep(m.pen_away, cur.pen_away),
          winner: keep(m.winner, cur.winner),
          group_name: keep(m.group_name, cur.group_name),
        };
      });

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
  // Eleme turunda beraberlik + tur atlama bonusu da burada eklenir.
  const { data: finished } = await admin
    .from("matches")
    .select("id, stage, home_score, away_score, winner")
    .eq("status", "FINISHED");

  let scoredPredictions = 0;
  for (const m of finished ?? []) {
    if (m.home_score == null || m.away_score == null) continue;

    const { data: preds } = await admin
      .from("predictions")
      .select("id, home_pred, away_pred, points, advance_pick, bonus")
      .eq("match_id", m.id);

    for (const p of preds ?? []) {
      const base = calcPoints(p.home_pred, p.away_pred, m.home_score, m.away_score);
      // Bonus sadece eleme turlarında ve oyuncu beraberlik dediğinde geçerli
      const bonus = isKnockout(m.stage)
        ? calcBonus(
          p.advance_pick ?? null,
          p.home_pred,
          p.away_pred,
          m.home_score,
          m.away_score,
          m.winner ?? null
        )
        : 0;
      const total = base + bonus;
      // points'e bonus dahil (puan tablosu points'i topluyor); bonus'u ayrıca
      // sakla ki ekranda "+1 bonus" gösterebilelim.
      if (p.points !== total || (p.bonus ?? 0) !== bonus) {
        await admin
          .from("predictions")
          .update({ points: total, bonus })
          .eq("id", p.id);
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