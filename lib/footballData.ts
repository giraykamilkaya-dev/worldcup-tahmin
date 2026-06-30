// football-data.org v4 — Dünya Kupası fixtür & skorları
const BASE = "https://api.football-data.org/v4";
const COMPETITION = "WC"; // FIFA World Cup

type FDScorePart = { home: number | null; away: number | null };
type FDMatch = {
  id: number;
  utcDate: string;
  status: string;
  stage: string | null;
  group: string | null;
  homeTeam: { name: string | null; crest: string | null };
  awayTeam: { name: string | null; crest: string | null };
  score: {
    winner: string | null;
    duration?: string; // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
    fullTime: FDScorePart;
    regularTime?: FDScorePart;
    extraTime?: FDScorePart;
    penalties?: FDScorePart;
  };
};

export type NormalizedMatch = {
  id: number;
  stage: string | null;
  group_name: string | null;
  utc_date: string;
  status: string;
  home_team: string | null;
  home_crest: string | null;
  away_team: string | null;
  away_crest: string | null;
  home_score: number | null;
  away_score: number | null;
  pen_home: number | null;
  pen_away: number | null;
  winner: string | null;
  updated_at: string;
};

export async function fetchWorldCupMatches(): Promise<NormalizedMatch[]> {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) throw new Error("FOOTBALL_DATA_API_KEY tanımlı değil");

  const res = await fetch(`${BASE}/competitions/${COMPETITION}/matches`, {
    headers: { "X-Auth-Token": key },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`football-data.org ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { matches: FDMatch[] };
  return (data.matches ?? []).map((m) => {
    const s = m.score ?? ({} as FDMatch["score"]);
    const add = (a: number | null | undefined, b: number | null | undefined) =>
      a == null && b == null ? null : (a ?? 0) + (b ?? 0);

    // PENALTI HARİÇ gerçek oyun skoru (90 dk + uzatma).
    // football-data penaltıya gidince fullTime'a penaltı gollerini de
    // kattığı için, penaltı varsa regularTime+extraTime'ı kullanırız.
    let home: number | null;
    let away: number | null;
    const pen = s.penalties;
    const hasPens = pen != null && (pen.home != null || pen.away != null);
    if (hasPens && s.regularTime) {
      home = add(s.regularTime.home, s.extraTime?.home);
      away = add(s.regularTime.away, s.extraTime?.away);
    } else {
      // Penaltı yoksa fullTime zaten 90dk veya 120dk gerçek skorudur
      home = s.fullTime?.home ?? null;
      away = s.fullTime?.away ?? null;
    }

    return {
      id: m.id,
      stage: m.stage,
      group_name: m.group,
      utc_date: m.utcDate,
      status: m.status,
      home_team: m.homeTeam?.name ?? null,
      home_crest: m.homeTeam?.crest ?? null,
      away_team: m.awayTeam?.name ?? null,
      away_crest: m.awayTeam?.crest ?? null,
      home_score: home,
      away_score: away,
      pen_home: pen?.home ?? null,
      pen_away: pen?.away ?? null,
      winner: s.winner ?? null,
      updated_at: new Date().toISOString(),
    };
  });
}
