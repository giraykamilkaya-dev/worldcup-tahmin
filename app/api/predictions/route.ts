import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Tahmin kaydet/güncelle. Kilit kontrolü BURADA (sunucuda) yapılır:
// maç başlama saati geçtiyse veya takımlar belli değilse tahmin kabul edilmez.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  // Onaylı üye mi?
  const { data: profile } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .single();
  if (!profile?.approved)
    return NextResponse.json({ error: "Hesabın henüz onaylı değil" }, { status: 403 });

  let body: { match_id?: number; home_pred?: number; away_pred?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const matchId = Number(body.match_id);
  const homePred = Number(body.home_pred);
  const awayPred = Number(body.away_pred);

  if (!Number.isInteger(matchId))
    return NextResponse.json({ error: "Maç bulunamadı" }, { status: 400 });
  if (
    !Number.isInteger(homePred) ||
    !Number.isInteger(awayPred) ||
    homePred < 0 ||
    awayPred < 0 ||
    homePred > 99 ||
    awayPred > 99
  )
    return NextResponse.json({ error: "Skor 0-99 arası tam sayı olmalı" }, { status: 400 });

  const admin = createAdminClient();

  // Maçı al, başlama saatini ve takımları doğrula
  const { data: match, error: matchErr } = await admin
    .from("matches")
    .select("id, utc_date, status, home_team, away_team")
    .eq("id", matchId)
    .single();
  if (matchErr || !match)
    return NextResponse.json({ error: "Maç bulunamadı" }, { status: 404 });

  // Takımlar henüz belli değilse tahmin alınmaz (eleme turu TBD maçları)
  const isTBD = (t: string | null) => !t || t === "TBD";
  if (isTBD(match.home_team) || isTBD(match.away_team)) {
    return NextResponse.json(
      { error: "Takımlar henüz belli değil" },
      { status: 422 }
    );
  }

  // KİLİT: başlama saati geçtiyse tahmine izin yok
  if (new Date(match.utc_date).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Bu maç için tahmin kapandı (maç başladı)" },
      { status: 423 }
    );
  }

  // Upsert (kullanıcı + maç tekil)
  const { error: upErr } = await admin.from("predictions").upsert(
    {
      user_id: user.id,
      match_id: matchId,
      home_pred: homePred,
      away_pred: awayPred,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,match_id" }
  );
  if (upErr)
    return NextResponse.json({ error: "Kaydedilemedi: " + upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}