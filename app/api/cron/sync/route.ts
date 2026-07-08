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

  // 2) Biten maçların tahminlerini gerçek skora göre puanla.
  // PERFORMANS: Eskiden her maç için ayrı select + her tahmin için ayrı
  // update yapılıyordu (81 maç × N tahmin = yüzlerce sorgu, her 2 dakikada).
  // Bu, Supabase bağlantı havuzunu doldurup sayfa açılışlarını yavaşlatıyordu.
  // Artık: tüm biten maçların tahminlerini TEK sorguda çekip, yalnızca puanı
  // DEĞİŞEN tahminleri topluca (paralel, küçük gruplar halinde) güncelliyoruz.
  const { data: finished } = await admin
    .from("matches")
    .select("id, stage, home_score, away_score, winner")
    .eq("status", "FINISHED");

  // Skoru belli olan biten maçları bir haritaya al
  const finishedMap = new Map<
    number,
    { stage: string | null; home: number; away: number; winner: string | null }
  >();
  for (const m of finished ?? []) {
    if (m.home_score == null || m.away_score == null) continue;
    finishedMap.set(m.id, {
      stage: m.stage,
      home: m.home_score,
      away: m.away_score,
      winner: m.winner ?? null,
    });
  }

  let scoredPredictions = 0;
  const finishedIds = [...finishedMap.keys()];

  if (finishedIds.length) {
    // TEK sorgu yerine SAYFALAMA: Supabase varsayılan olarak en fazla 1000
    // satır döndürür. Biten maç × oyuncu sayısı 1000'i aşınca tahminlerin bir
    // kısmı hiç işlenmiyor ve puanları null kalıyordu. Bu yüzden .range() ile
    // tüm tahminleri parça parça çekiyoruz.
    const preds: {
      id: number;
      match_id: number;
      home_pred: number;
      away_pred: number;
      points: number | null;
      advance_pick: string | null;
      bonus: number | null;
    }[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: page } = await admin
        .from("predictions")
        .select("id, match_id, home_pred, away_pred, points, advance_pick, bonus")
        .in("match_id", finishedIds)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (!page || page.length === 0) break;
      preds.push(...page);
      if (page.length < PAGE) break; // son sayfa
    }

    // Yalnızca puanı/bonusu değişen tahminleri topla
    const updates: { id: number; points: number; bonus: number }[] = [];
    for (const p of preds) {
      const m = finishedMap.get(p.match_id);
      if (!m) continue;
      const base = calcPoints(p.home_pred, p.away_pred, m.home, m.away);
      const bonus = isKnockout(m.stage)
        ? calcBonus(p.advance_pick ?? null, p.home_pred, p.away_pred, m.home, m.away, m.winner)
        : 0;
      const total = base + bonus;
      if (p.points !== total || (p.bonus ?? 0) !== bonus) {
        updates.push({ id: p.id, points: total, bonus });
      }
    }

    // Sadece değişenleri güncelle — küçük paralel gruplar halinde
    // (hiçbir şey değişmediyse tek bir yazma bile yapılmaz)
    const CHUNK = 20;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const slice = updates.slice(i, i + CHUNK);
      await Promise.all(
        slice.map((u) =>
          admin.from("predictions").update({ points: u.points, bonus: u.bonus }).eq("id", u.id)
        )
      );
    }
    scoredPredictions = updates.length;
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