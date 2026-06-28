export type Match = {
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
};

export type Prediction = {
  id: number;
  user_id: string;
  match_id: number;
  home_pred: number;
  away_pred: number;
  points: number | null;
  advance_pick?: string | null; // "HOME" | "AWAY" | null — eleme turunda beraberlikte tur atlayan
  bonus?: number | null;        // tur atlama bonusu (0/1)
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  approved: boolean;
  is_admin: boolean;
  group_no?: number;
  nickname?: string | null;
  champion_pick?: string | null;
};

export type StandingRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  group_no: number;
  group_name: string;
  total_points: number;
  scored_count: number;
  exact_count: number;
  predictions_count: number;
};
