// =====================================================================
// PUANLAMA KURALLARI  —  buradan kolayca değiştirebilirsin.
// =====================================================================
export const POINTS = {
  EXACT: 5,      // Tam skor (ör: 2-1 dedin, 2-1 oldu)
  GOAL_DIFF: 3,  // Doğru sonuç + doğru gol farkı (ör: 2-0 dedin, 3-1 oldu)
  OUTCOME: 2,    // Sadece doğru kazanan/beraberlik (ör: 1-0 dedin, 3-2 oldu)
  WRONG: 0,      // Yanlış
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
