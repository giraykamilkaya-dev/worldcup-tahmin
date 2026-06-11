"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  // Aktif sayfa: altın yazı + hafif altın kutu. Pasif: soluk, hover'da belirginleşir.
  const linkClass = (href: string) => {
    const isActive = pathname === href;
    return isActive
      ? "rounded-full bg-gold/15 px-2.5 py-1 text-gold"
      : "rounded-full px-2.5 py-1 text-cream/60 hover:text-cream";
  };

  return (
    <header className="pitch-stripes border-b border-line">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="text-gold">⚽</span>
          <span className="font-display text-base font-700 uppercase leading-tight tracking-wide text-cream sm:text-lg">
            Dünya Kupası<span className="hidden sm:inline"> Tahmin Ligi</span>
          </span>
        </Link>
        <div className="flex items-center gap-1 font-display text-xs uppercase tracking-wide sm:gap-2 sm:text-sm">
          <Link href="/" className={linkClass("/")}>Maçlar</Link>
          <Link href="/standings" className={linkClass("/standings")}>Puan</Link>
          {isAdmin && (
            <Link href="/admin" className={linkClass("/admin")}>Yönetim</Link>
          )}
          <form action="/auth/signout" method="post">
            <button className="rounded-full px-2.5 py-1 text-cream/60 hover:text-tr-red" type="submit">
              Çıkış
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}