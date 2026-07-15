"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Sayfanın sunucu verisini güncel tutar:
//  1) Belirli aralıkla sessizce tazeler (interval).
//  2) Sekmeye geri dönülünce hemen tazeler (visibilitychange) — uzun süre
//     arka planda kalıp eski görünümde donan sekmeler için.
//  3) Tarayıcı geri/ileri önbelleğinden (bfcache) geri gelince tazeler
//     (pageshow event.persisted) — iOS Safari'de "yenilesem de eski hal
//     kalıyor" sorununun ana kaynağı budur.
export default function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();

    const refresh = () => {
      last = Date.now();
      router.refresh();
    };

    // 1) Düzenli tazeleme — sekme görünürken
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, seconds * 1000);

    // 2) Sekme yeniden görünür olunca; ama çok sık spam olmasın diye 10sn kısıt
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > 10_000) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // 3) bfcache'ten geri gelme (persisted=true) → mutlaka tazele
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh();
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router, seconds]);

  return null;
}
