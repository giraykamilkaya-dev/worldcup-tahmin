"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  // Aktif sayfa: altın renk + alt çizgi. Pasif: soluk, hover'da belirginleşir.
  const linkClass = (href: string) => {
    const isActive = pathname === href;
    return isActive
      ? "text-gold underline underline-offset-8 decoration-2"
      : "text-cream/60 hover:text-cream";
  };

  return (
    <header className="pitch-stripes border-b border-line">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-gold">⚽</span>
          <span className="font-display text-lg font-700 uppercase tracking-wide text-cream">
            Dünya Kupası Tahmin Ligi
          </span>
        </Link>
        <div className="flex items-center gap-4 font-display text-sm uppercase tracking-wide">
          <Link href="/" className={linkClass("/")}>Maçlar</Link>
          <Link href="/standings" className={linkClass("/standings")}>Puan Tablosu</Link>
          {isAdmin && (
            <Link href="/admin" className={linkClass("/admin")}>Yönetim</Link>
          )}
          <form action="/auth/signout" method="post">
            <button className="text-cream/60 hover:text-tr-red" type="submit">Çıkış</button>
          </form>
        </div>
      </nav>
    </header>
  );
}