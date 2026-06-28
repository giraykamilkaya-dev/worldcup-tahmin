// =====================================================================
// PUANLAMA KURALLARI  —  buradan kolayca değiştirebilirsin.
// =====================================================================
export const POINTS = {
  EXACT: 5,      // Tam skor (ör: 2-1 dedin, 2-1 oldu)
  GOAL_DIFF: 3,  // Doğru sonuç + doğru gol farkı (ör: 2-0 dedin, 3-1 oldu)
  OUTCOME: 2,    // Sadece doğru kazanan/beraberlik (ör: 1-0 dedin, 3-2 oldu)
  WRONG: 0,      // Yanlış
  ADVANCE_BONUS: 1, // Eleme turunda beraberlik dedin + tur atlayanı bildin
};

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

export function calcPoints(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number
): number {
  if (predHome === actualHome && predAway === actualAway) return POINTS.EXACT;

  const predOutcome = sign(predHome - predAway);
  const actualOutcome = sign(actualHome - actualAway);
  if (predOutcome !== actualOutcome) return POINTS.WRONG;

  // Buraya geldiysek kazanan/beraberlik doğru bilinmiş.
  if (predHome - predAway === actualHome - actualAway) return POINTS.GOAL_DIFF;
  return POINTS.OUTCOME;
}

// =====================================================================
// TUR ATLAMA BONUSU (sadece eleme turları)
// Oyuncu 120 dk'yı (penaltı hariç) BERABERE tahmin ettiyse ve maç da
// gerçekten berabere bitip penaltılara gittiyse, "tur atlayan takım"
// seçimini doğru bildiğinde +1 bonus alır.
//
// advancePick : "HOME" | "AWAY" | null  (oyuncunun seçimi)
// predHome/predAway : oyuncunun skor tahmini (beraberlik mi diye bakarız)
// actualHome/actualAway : maçın 120 dk (fullTime) skoru — penaltı HARİÇ
// matchWinner : football-data'nın "winner" alanı (HOME_TEAM/AWAY_TEAM/DRAW)
//               — penaltı sonrası turu geçen takımı verir
// =====================================================================
export function calcBonus(
  advancePick: string | null,
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number,
  matchWinner: string | null
): number {
  if (!advancePick) return 0;
  // Oyuncu beraberlik tahmin etmediyse bonus yok
  if (predHome !== predAway) return 0;
  // Maç 120 dk'da berabere bitmediyse (normal sürede/uzatmada biri kazandıysa)
  // bonus iptal — zaten beraberlik tahmini de tutmadı
  if (actualHome !== actualAway) return 0;
  // Penaltı kazananını advancePick ile eşleştir
  const winnerSide =
    matchWinner === "HOME_TEAM" ? "HOME" : matchWinner === "AWAY_TEAM" ? "AWAY" : null;
  if (!winnerSide) return 0;
  return advancePick === winnerSide ? POINTS.ADVANCE_BONUS : 0;
}

// Eleme turu mu? (bonus seçimi sadece bu turlarda görünür)
export const KNOCKOUT_STAGES = [
  "LAST_32",
  "LAST_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "FINAL",
];
export function isKnockout(stage: string | null): boolean {
  return !!stage && KNOCKOUT_STAGES.includes(stage);
}
