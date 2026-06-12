"use client";
import { useState } from "react";
import MatchCard from "@/components/MatchCard";
import type { Match, Prediction } from "@/lib/types";

export default function MatchTabs({
  open,
  done,
  predByMatch,
}: {
  open: Match[];
  done: Match[];
  predByMatch: Record<number, Prediction>;
}) {
  const [tab, setTab] = useState<"open" | "done">("open");
  const list = tab === "open" ? open : done;

  const tabClass = (active: boolean) =>
    active
      ? "rounded-full bg-gold/15 px-4 py-2 font-display text-sm uppercase tracking-wide text-gold"
      : "rounded-full px-4 py-2 font-display text-sm uppercase tracking-wide text-cream/50 hover:text-cream";

  return (
    <div>
      {/* Sekmeler */}
      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab("open")} className={tabClass(tab === "open")}>
          Oynanacaklar ({open.length})
        </button>
        <button onClick={() => setTab("done")} className={tabClass(tab === "done")}>
          Sonuçlananlar ({done.length})
        </button>
      </div>

      {/* Liste */}
      {list.length === 0 ? (
        <div className="rounded-2xl border border-line bg-pitch-deep/60 p-6 text-center text-cream/60">
          {tab === "open" ? "Oynanacak maç kalmadı." : "Henüz sonuçlanan maç yok."}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((m) => (
            <MatchCard key={m.id} match={m} prediction={predByMatch[m.id] ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}