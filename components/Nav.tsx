import Link from "next/link";

export default function Nav({ isAdmin }: { isAdmin?: boolean }) {
  return (
    <header className="pitch-stripes border-b border-line">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-gold">⚽</span>
          <span className="font-display text-lg font-700 uppercase tracking-wide text-cream">
            Aile Tahmin Ligi
          </span>
        </Link>
        <div className="flex items-center gap-4 font-display text-sm uppercase tracking-wide">
          <Link href="/" className="text-cream/80 hover:text-cream">Maçlar</Link>
          <Link href="/standings" className="text-cream/80 hover:text-cream">Puan Tablosu</Link>
          {isAdmin && (
            <Link href="/admin" className="text-gold hover:text-gold/80">Yönetim</Link>
          )}
          <form action="/auth/signout" method="post">
            <button className="text-cream/60 hover:text-tr-red" type="submit">Çıkış</button>
          </form>
        </div>
      </nav>
    </header>
  );
}
