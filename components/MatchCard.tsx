"use client";
import { useState } from "react";
import type { Match, Prediction } from "@/lib/types";
import { teamTR, TURKEY } from "@/lib/teams";
import { isKnockout } from "@/lib/scoring";

const STAGE_TR: Record<string, string> = {
  GROUP_STAGE: "Grup",
  LAST_32: "Son 32",
  LAST_16: "Son 16",
  QUARTER_FINALS: "Çeyrek Final",
  SEMI_FINALS: "Yarı Final",
  THIRD_PLACE: "3.'lük Maçı",
  FINAL: "Final",
};

function prettyGroup(g: string | null): string {
  if (!g) return "";
  return g.replace(/group[_ ]?/i, "Grup ").trim();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Crest({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <div className="h-7 w-7 shrink-0 rounded-full bg-cream/10" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="h-7 w-7 shrink-0 object-contain" />;
}

export default function MatchCard({
  match,
  prediction,
}: {
  match: Match;
  prediction: Prediction | null;
}) {
  // Takımlar belli değilse (eleme turu TBD/null) tahmin alınmaz
  const isTBD = (t: string | null) => !t || t === "TBD";
  const teamsUnknown = isTBD(match.home_team) || isTBD(match.away_team);

  const locked =
    teamsUnknown || new Date(match.utc_date).getTime() <= Date.now();
  const finished = match.status === "FINISHED";
  const isTurkey = match.home_team === TURKEY || match.away_team === TURKEY;

  // Maç başladı ama bitmedi → canlı (free planda skor gecikmeli gelebilir)
  const live = ["IN_PLAY", "PAUSED", "LIVE"].includes(match.status);
  const liveScore =
    live && match.home_score != null && match.away_score != null
      ? `${match.home_score} - ${match.away_score}`
      : null;

  const [home, setHome] = useState<string>(
    prediction ? String(prediction.home_pred) : ""
  );
  const [away, setAway] = useState<string>(
    prediction ? String(prediction.away_pred) : ""
  );
  const [advancePick, setAdvancePick] = useState<string | null>(
    prediction?.advance_pick ?? null
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [hasPrediction, setHasPrediction] = useState<boolean>(!!prediction);

  // Eleme turu + girilen skor beraberlik mi? → tur atlayan takım seçimi açılır
  const knockout = isKnockout(match.stage);
  const isDrawPred = home !== "" && away !== "" && home === away;
  const showAdvancePicker = knockout && isDrawPred && !locked;

  async function save() {
    if (home === "" || away === "") {
      setMsg("İki skoru da gir");
      return;
    }
    setSaving(true);
    setMsg(null);
    // Beraberlik değilse veya eleme turu değilse advance_pick gönderme
    const pickToSend = knockout && home === away ? advancePick : null;
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: match.id,
        home_pred: Number(home),
        away_pred: Number(away),
        advance_pick: pickToSend,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg("Kaydedildi ✓");
      setHasPrediction(true);
    } else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || "Hata");
    }
  }

  const stage = match.stage ? STAGE_TR[match.stage] ?? match.stage : "";
  const group = prettyGroup(match.group_name);
  const label =
    match.stage === "GROUP_STAGE" ? group || "Grup" : [stage, group].filter(Boolean).join(" · ");

  const pts = prediction?.points;

  const cardClass = isTurkey
    ? "border-tr-red bg-tr-red/10 shadow-[0_0_0_1px_rgba(227,10,23,0.4)]"
    : "border-line bg-pitch-deep/60";

  return (
    <div className={`fade-up rounded-2xl border p-4 ${cardClass}`}>
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wide text-cream/50">
        <span className="flex items-center gap-2">
          {isTurkey && (
            <span className="rounded-full bg-tr-red px-2 py-0.5 font-600 text-cream">
              🇹🇷 Türkiye maçı
            </span>
          )}
          <span>{label || "Maç"}</span>
        </span>
        <span>{fmtDate(match.utc_date)}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* Ev sahibi */}
        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
          <span className="font-display text-sm font-600 uppercase leading-tight sm:text-base">
            {teamTR(match.home_team)}
          </span>
          <Crest src={match.home_crest} alt={match.home_team ?? ""} />
        </div>

        {/* Skor kutusu — her zaman kişinin tahminini gösterir */}
        {/* Laptop/PC: klasik input (klavye ile hızlı) */}
        <div className="scorebox hidden items-center gap-1 md:flex">
          <ScoreInput value={home} onChange={setHome} disabled={locked} />
          <span className="px-1 font-display text-cream/40">:</span>
          <ScoreInput value={away} onChange={setAway} disabled={locked} />
        </div>
        {/* Mobil: klavyesiz +/− stepper */}
        <div className="scorebox flex items-center gap-2 md:hidden">
          <MobileScore value={home} onChange={setHome} disabled={locked} />
          <span className="px-0.5 font-display text-cream/40">:</span>
          <MobileScore value={away} onChange={setAway} disabled={locked} />
        </div>

        {/* Deplasman */}
        <div className="flex min-w-0 items-center gap-2">
          <Crest src={match.away_crest} alt={match.away_team ?? ""} />
          <span className="font-display text-sm font-600 uppercase leading-tight sm:text-base">
            {teamTR(match.away_team)}
          </span>
        </div>
      </div>

      {/* Eleme turu bilgi notu — skorun hangi süreyi kapsadığını netleştirir */}
      {knockout && (
        <p className="mt-2 text-center text-xs text-cream/40">
          Skor tahmini oynanan süre içindir: 90, uzatma olursa 120 dk. (Penaltı hariç)
        </p>
      )}

      {/* Tur atlama bonusu — eleme turunda beraberlik tahmin edilince açılır */}
      {showAdvancePicker && (
        <div className="mt-3 rounded-xl border border-gold/30 bg-gold/5 p-3">
          <div className="mb-2 text-xs text-gold">
            ⚽ Beraberlik durumunda penaltılarda turu kim geçer? (Bilirsen +1 puan)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <AdvanceBtn
              label={teamTR(match.home_team)}
              active={advancePick === "HOME"}
              onClick={() => setAdvancePick(advancePick === "HOME" ? null : "HOME")}
            />
            <AdvanceBtn
              label={teamTR(match.away_team)}
              active={advancePick === "AWAY"}
              onClick={() => setAdvancePick(advancePick === "AWAY" ? null : "AWAY")}
            />
          </div>
        </div>
      )}

      {/* Alt satır */}
      <div className="mt-3 flex min-h-[28px] items-center justify-between gap-2">
        <div className="text-xs text-cream/50">
          {finished && match.home_score != null ? (
            <span className="flex flex-col gap-1">
              <span>
                Sonuç: <b className="text-cream">{match.home_score} - {match.away_score}</b>
                {match.pen_home != null && match.pen_away != null && (
                  <b className="text-cream/70"> (Pen {match.pen_home}-{match.pen_away})</b>
                )}
                {pts != null && (
                  <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 font-600 text-gold">
                    +{pts} puan
                  </span>
                )}
                {prediction?.bonus ? (
                  <span className="ml-1 rounded-full bg-tr-red/20 px-2 py-0.5 font-600 text-tr-red">
                    🎯 +1 tur bonusu
                  </span>
                ) : null}
              </span>
              {/* Oyuncu penaltıda tur atlayan seçtiyse: doğru/yanlış göster */}
              {prediction?.advance_pick &&
                (() => {
                  const pickedTeam = teamTR(
                    prediction.advance_pick === "HOME"
                      ? match.home_team
                      : match.away_team
                  );
                  const winnerSide =
                    match.winner === "HOME_TEAM"
                      ? "HOME"
                      : match.winner === "AWAY_TEAM"
                        ? "AWAY"
                        : null;
                  // Bonus gerçekten kazanıldı mı? (beraberlik + doğru takım)
                  const correct = !!prediction.bonus;
                  // Penaltıya gitmediyse (winnerSide yok ya da maç berabere
                  // bitmediyse) tahmin "geçersiz" sayılır, nötr gösterilir
                  const wentToPens = match.pen_home != null && match.pen_away != null;
                  return (
                    <span className="text-cream/50">
                      Penaltı tahminin:{" "}
                      <b className="text-cream/70">{pickedTeam}</b>{" "}
                      {wentToPens ? (
                        correct ? (
                          <span className="text-gold">✓ doğru</span>
                        ) : (
                          <span className="text-tr-red/70">✗ yanlış</span>
                        )
                      ) : (
                        <span className="text-cream/40">— penaltıya gitmedi</span>
                      )}
                    </span>
                  );
                })()}
            </span>
          ) : teamsUnknown ? (
            <span className="text-cream/40">Takımlar belli değil</span>
          ) : live ? (
            <span className="flex items-center gap-6">
              <span className="text-tr-red/80">🔒 Tahmin kapandı.</span>
              <span className="flex items-center gap-1 rounded-full bg-tr-red/20 px-2 py-0.5 font-600 text-tr-red">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-tr-red" />
                CANLI{liveScore ? ` ${liveScore}` : ""}
              </span>
            </span>
          ) : locked ? (
            <span className="text-tr-red/80">🔒 Tahmin kapandı.</span>
          ) : prediction ? (
            <span>
              Tahminin: {prediction.home_pred} - {prediction.away_pred}
              {prediction.advance_pick && prediction.home_pred === prediction.away_pred && (
                <span className="ml-1">
                  · Tur:{" "}
                  {teamTR(
                    prediction.advance_pick === "HOME"
                      ? match.home_team
                      : match.away_team
                  )}
                </span>
              )}
            </span>
          ) : (
            <span>Tahminini gir</span>
          )}
        </div>

        {!locked && (
          <button
            onClick={save}
            disabled={saving}
            className="shrink-0 rounded-full bg-tr-red px-4 py-1.5 font-display text-sm font-600 uppercase tracking-wide text-cream transition hover:bg-tr-red/90 disabled:opacity-50"
          >
            {saving ? "..." : hasPrediction ? "Güncelle" : "Kaydet"}
          </button>
        )}
        {msg && <span className="text-xs text-gold">{msg}</span>}
      </div>
    </div>
  );
}

function AdvanceBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-3 font-display text-sm font-600 uppercase tracking-wide transition active:scale-95 sm:py-2 ${active
          ? "border-gold bg-gold/20 text-gold"
          : "border-line bg-pitch text-cream/70 hover:border-gold/50 active:border-gold/50"
        }`}
    >
      {label}
    </button>
  );
}

// Mobil için klavyesiz +/− skor girişi.
// Dokununca iOS klavyesi açılmaz; parmakla artır/azalt.
function MobileScore({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const num = value === "" ? null : Number(value);
  const set = (n: number) => {
    if (n < 0) n = 0;
    if (n > 20) n = 20;
    onChange(String(n));
  };
  const inc = () => set((num ?? -1) + 1); // boşsa ilk artış 0 olur
  const dec = () => set((num ?? 1) - 1); // boşsa ilk azalış 0 olur

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={inc}
        disabled={disabled}
        aria-label="Artır"
        className="flex h-9 w-14 items-center justify-center rounded-lg border border-line bg-pitch text-xl font-700 text-cream/70 transition active:scale-95 active:border-gold active:text-gold disabled:opacity-40"
      >
        +
      </button>
      <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-line bg-pitch font-display text-3xl font-700 text-gold">
        {value === "" ? "–" : value}
      </div>
      <button
        type="button"
        onClick={dec}
        disabled={disabled}
        aria-label="Azalt"
        className="flex h-9 w-14 items-center justify-center rounded-lg border border-line bg-pitch text-xl font-700 text-cream/70 transition active:scale-95 active:border-gold active:text-gold disabled:opacity-40"
      >
        −
      </button>
    </div>
  );
}

function ScoreInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <input
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
      className="h-12 w-12 rounded-lg border border-line bg-pitch text-center font-display text-2xl font-700 text-gold outline-none focus:border-gold disabled:text-cream/70"
      placeholder="–"
    />
  );
}