import SignInButton from "@/components/SignInButton";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="fade-up max-w-md">
        <div className="mb-4 text-5xl">⚽</div>
        <h1 className="font-display text-4xl font-700 uppercase leading-tight tracking-wide">
          Dünya Kupası<br />
          <span className="text-tr-red">Tahmin Ligi</span>
        </h1>
        <p className="mt-3 mb-8 text-cream/60">
          2026 Dünya Kupası boyunca tahmin yarışı. Giriş yap, onay
          bekle, sonra her maça skor tahminini gir.
        </p>
        <div className="flex justify-center">
          <SignInButton />
        </div>
        <p className="mt-6 text-xs text-cream/40">
          Sadece onaylanan üyeler oyuna katılabilir.
        </p>
      </div>
    </main>
  );
}
