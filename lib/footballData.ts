// football-data.org v4 — Dünya Kupası fixtür & skorları
const BASE = "https://api.football-data.org/v4";
const COMPETITION = "WC"; // FIFA World Cup

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
    fullTime: { home: number | null; away: number | null };
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
  return (data.matches ?? []).map((m) => ({
    id: m.id,
    stage: m.stage,
    group_name: m.group,
    utc_date: m.utcDate,
    status: m.status,
    home_team: m.homeTeam?.name ?? null,
    home_crest: m.homeTeam?.crest ?? null,
    away_team: m.awayTeam?.name ?? null,
    away_crest: m.awayTeam?.crest ?? null,
    home_score: m.score?.fullTime?.home ?? null,
    away_score: m.score?.fullTime?.away ?? null,
    winner: m.score?.winner ?? null,
    updated_at: new Date().toISOString(),
  }));
}
