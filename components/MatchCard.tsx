"use client";
import { useState } from "react";
import type { Match, Prediction } from "@/lib/types";

const STAGE_TR: Record<string, string> = {
  GROUP_STAGE: "Grup",
  LAST_32: "Son 32",
  LAST_16: "Son 16",
  QUARTER_FINALS: "Çeyrek Final",
  SEMI_FINALS: "Yarı Final",
  THIRD_PLACE: "3.'lük Maçı",
  FINAL: "Final",
};

// football-data Türkiye'yi "Turkey" olarak verir
const TURKEY = "Turkey";

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
  if (!src) return <div className="h-7 w-7 rounded-full bg-cream/10" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="h-7 w-7 object-contain" />;
}

export default function MatchCard({
  match,
  prediction,
}: {
  match: Match;
  prediction: Prediction | null;
}) {
  const locked = new Date(match.utc_date).getTime() <= Date.now();
  const finished = match.status === "FINISHED";
  const isTurkey = match.home_team === TURKEY || match.away_team === TURKEY;

  const [home, setHome] = useState<string>(
    prediction ? String(prediction.home_pred) : ""
  );
  const [away, setAway] = useState<string>(
    prediction ? String(prediction.away_pred) : ""
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (home === "" || away === "") {
      setMsg("İki skoru da gir");
      return;
    }
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        match_id: match.id,
        home_pred: Number(home),
        away_pred: Number(away),
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg("Kaydedildi ✓");
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

  // Türkiye maçında özel çerçeve/zemin
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
        <div className="flex items-center justify-end gap-2 text-right">
          <span className="font-display text-base font-600 uppercase">
            {match.home_team === TURKEY ? "🇹🇷 " : ""}
            {match.home_team ?? "Belirsiz"}
          </span>
          <Crest src={match.home_crest} alt={match.home_team ?? ""} />
        </div>

        {/* Skor kutusu */}
        <div className="scorebox flex items-center gap-1">
          <ScoreInput
            value={home}
            onChange={setHome}
            disabled={locked}
            actual={finished ? match.home_score : null}
          />
          <span className="px-1 font-display text-cream/40">:</span>
          <ScoreInput
            value={away}
            onChange={setAway}
            disabled={locked}
            actual={finished ? match.away_score : null}
          />
        </div>

        {/* Deplasman */}
        <div className="flex items-center gap-2">
          <Crest src={match.away_crest} alt={match.away_team ?? ""} />
          <span className="font-display text-base font-600 uppercase">
            {match.away_team ?? "Belirsiz"}
            {match.away_team === TURKEY ? " 🇹🇷" : ""}
          </span>
        </div>
      </div>

      {/* Alt satır */}
      <div className="mt-3 flex min-h-[28px] items-center justify-between">
        <div className="text-xs text-cream/50">
          {finished && match.home_score != null ? (
            <span>
              Sonuç: <b className="text-cream">{match.home_score} - {match.away_score}</b>
              {pts != null && (
                <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 font-600 text-gold">
                  +{pts} puan
                </span>
              )}
            </span>
          ) : locked ? (
            <span className="text-tr-red/80">🔒 Tahmin kapandı</span>
          ) : prediction ? (
            <span>
              Tahminin: {prediction.home_pred} - {prediction.away_pred}
            </span>
          ) : (
            <span>Tahminini gir</span>
          )}
        </div>

        {!locked && (
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-tr-red px-4 py-1.5 font-display text-sm font-600 uppercase tracking-wide text-cream transition hover:bg-tr-red/90 disabled:opacity-50"
          >
            {saving ? "..." : prediction ? "Güncelle" : "Kaydet"}
          </button>
        )}
        {msg && <span className="text-xs text-gold">{msg}</span>}
      </div>
    </div>
  );
}

function ScoreInput({
  value,
  onChange,
  disabled,
  actual,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  actual: number | null;
}) {
  const shown = actual != null ? String(actual) : value;
  return (
    <input
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      value={shown}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
      className="h-12 w-12 rounded-lg border border-line bg-pitch text-center font-display text-2xl font-700 text-gold outline-none focus:border-gold disabled:text-cream/70"
      placeholder="–"
    />
  );
}