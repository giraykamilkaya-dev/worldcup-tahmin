"use client";
import { useState } from "react";

// football-data adı -> [emoji bayrak, Türkçe görünen ad]
const TEAM_META: Record<string, [string, string]> = {
  "Algeria": ["🇩🇿", "Cezayir"],
  "Argentina": ["🇦🇷", "Arjantin"],
  "Australia": ["🇦🇺", "Avustralya"],
  "Austria": ["🇦🇹", "Avusturya"],
  "Belgium": ["🇧🇪", "Belçika"],
  "Bosnia-Herzegovina": ["🇧🇦", "Bosna-Hersek"],
  "Brazil": ["🇧🇷", "Brezilya"],
  "Canada": ["🇨🇦", "Kanada"],
  "Cape Verde Islands": ["🇨🇻", "Cabo Verde"],
  "Colombia": ["🇨🇴", "Kolombiya"],
  "Congo DR": ["🇨🇩", "Kongo DC"],
  "Croatia": ["🇭🇷", "Hırvatistan"],
  "Curaçao": ["🇨🇼", "Curaçao"],
  "Czechia": ["🇨🇿", "Çekya"],
  "Ecuador": ["🇪🇨", "Ekvador"],
  "Egypt": ["🇪🇬", "Mısır"],
  "England": ["🏴󠁧󠁢󠁥󠁮󠁧󠁿", "İngiltere"],
  "France": ["🇫🇷", "Fransa"],
  "Germany": ["🇩🇪", "Almanya"],
  "Ghana": ["🇬🇭", "Gana"],
  "Haiti": ["🇭🇹", "Haiti"],
  "Iran": ["🇮🇷", "İran"],
  "Iraq": ["🇮🇶", "Irak"],
  "Ivory Coast": ["🇨🇮", "Fildişi Sahili"],
  "Japan": ["🇯🇵", "Japonya"],
  "Jordan": ["🇯🇴", "Ürdün"],
  "Mexico": ["🇲🇽", "Meksika"],
  "Morocco": ["🇲🇦", "Fas"],
  "Netherlands": ["🇳🇱", "Hollanda"],
  "New Zealand": ["🇳🇿", "Yeni Zelanda"],
  "Norway": ["🇳🇴", "Norveç"],
  "Panama": ["🇵🇦", "Panama"],
  "Paraguay": ["🇵🇾", "Paraguay"],
  "Portugal": ["🇵🇹", "Portekiz"],
  "Qatar": ["🇶🇦", "Katar"],
  "Saudi Arabia": ["🇸🇦", "Suudi Arabistan"],
  "Scotland": ["🏴󠁧󠁢󠁳󠁣󠁴󠁿", "İskoçya"],
  "Senegal": ["🇸🇳", "Senegal"],
  "South Africa": ["🇿🇦", "Güney Afrika"],
  "South Korea": ["🇰🇷", "Güney Kore"],
  "Spain": ["🇪🇸", "İspanya"],
  "Sweden": ["🇸🇪", "İsveç"],
  "Switzerland": ["🇨🇭", "İsviçre"],
  "Tunisia": ["🇹🇳", "Tunus"],
  "Turkey": ["🇹🇷", "Türkiye"],
  "United States": ["🇺🇸", "ABD"],
  "Uruguay": ["🇺🇾", "Uruguay"],
  "Uzbekistan": ["🇺🇿", "Özbekistan"],
};

function label(team: string) {
  const meta = TEAM_META[team];
  return meta ? `${meta[0]} ${meta[1]}` : team;
}

export default function ChampionPicker({
  teams,
  current,
  locked,
}: {
  teams: string[];
  current: string | null;
  locked: boolean;
}) {
  const [team, setTeam] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (!team) {
      setMsg("Önce bir takım seç");
      return;
    }
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/champion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team }),
    });
    setSaving(false);
    if (res.ok) setMsg("Kaydedildi ✓");
    else {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || "Hata");
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-gold/30 bg-pitch-deep/60 p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl">🏆</span>
        <h2 className="font-display text-lg uppercase tracking-wide text-gold">
          Şampiyon Tahmini
        </h2>
        <span className="ml-auto rounded-full bg-gold/20 px-2 py-0.5 text-xs font-600 text-gold">
          +15 puan
        </span>
      </div>
      <p className="mb-3 text-xs text-cream/50">
        Kupayı kim kaldırır? Grup aşaması bitene kadar (28 Haziran) değiştirebilirsin.
      </p>

      {locked ? (
        <div className="text-sm text-cream/70">
          {current ? (
            <>Tahminin: <b className="text-gold">{label(current)}</b> 🔒</>
          ) : (
            <>🔒 Şampiyon tahmini kapandı (tahmin girmedin).</>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="min-w-[180px] flex-1 rounded-lg border border-line bg-pitch px-3 py-2 text-sm text-cream outline-none focus:border-gold"
          >
            <option value="">— Takım seç —</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </select>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-tr-red px-5 py-2 font-display text-sm font-600 uppercase tracking-wide text-cream hover:bg-tr-red/90 disabled:opacity-50"
          >
            {saving ? "..." : current ? "Güncelle" : "Kaydet"}
          </button>
          {msg && <span className="text-xs text-gold">{msg}</span>}
        </div>
      )}
    </div>
  );
}