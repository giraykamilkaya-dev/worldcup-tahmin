import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-dvh">
      <Nav />
      <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-4 text-5xl">⏳</div>
        <h1 className="font-display text-2xl font-700 uppercase tracking-wide">
          Onay bekleniyor
        </h1>
        <p className="mt-3 text-cream/60">
          Hesabın oluşturuldu ({user?.email}). Yönetici (aile ferdi) seni onayladığında
          oyuna katılabileceksin. Onaylandıktan sonra sayfayı yenile.
        </p>
      </div>
    </main>
  );
}
