import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Şampiyon tahmini bu tarihten sonra kilitlenir.
// İlk Son 32 maçının başlangıcı: 28 Haziran 22:00 TR = 28 Haziran 19:00 UTC
const LOCK_AT = new Date("2026-06-28T19:00:00Z");

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("approved")
    .eq("id", user.id)
    .single();
  if (!profile?.approved)
    return NextResponse.json({ error: "Hesabın onaylı değil" }, { status: 403 });

  if (Date.now() >= LOCK_AT.getTime())
    return NextResponse.json({ error: "Şampiyon tahmini kapandı" }, { status: 423 });

  let body: { team?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const team = String(body.team ?? "").trim();
  if (!team) return NextResponse.json({ error: "Takım seç" }, { status: 400 });

  const admin = createAdminClient();
  // Takımın gerçekten turnuvada olduğunu doğrula
  const { data: teams } = await admin.rpc("get_teams");
  const valid = (teams ?? []).some((t: { team: string }) => t.team === team);
  if (!valid) return NextResponse.json({ error: "Geçersiz takım" }, { status: 400 });

  const { error } = await admin
    .from("profiles")
    .update({ champion_pick: team })
    .eq("id", user.id);
  if (error)
    return NextResponse.json({ error: "Kaydedilemedi" }, { status: 500 });

  return NextResponse.json({ ok: true });
}