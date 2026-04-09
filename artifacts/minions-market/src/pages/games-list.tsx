import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { ChevronLeft, Search } from "lucide-react";
import { useState, useMemo } from "react";
import {
  PLAYEROK_GAMES,
  PLAYEROK_MOBILE_GAMES,
  PLAYEROK_APPS,
} from "@/data/playerok-categories";

const TAB_CONFIG: Record<
  string,
  { title: string; emoji: string; items: typeof PLAYEROK_GAMES }
> = {
  games: { title: "Игры", emoji: "🎮", items: PLAYEROK_GAMES },
  mobile: { title: "Мобильные игры", emoji: "📱", items: PLAYEROK_MOBILE_GAMES },
  apps: { title: "Приложения", emoji: "🗂️", items: PLAYEROK_APPS },
};

export default function GamesListPage() {
  const { tab } = useParams<{ tab: string }>();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const config = TAB_CONFIG[tab ?? ""] ?? TAB_CONFIG["games"];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return config.items;
    return config.items.filter((item) =>
      item.name.toLowerCase().includes(q)
    );
  }, [search, config.items]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => window.history.back()} className="p-1 -ml-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-base flex-1">
            {config.emoji} {config.title}
          </h1>
          <span className="text-sm text-muted-foreground font-medium">
            {filtered.length}
          </span>
        </div>

        {/* ── SEARCH ── */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Поиск по ${config.title.toLowerCase()}...`}
              className="w-full pl-10 pr-4 h-10 bg-secondary rounded-xl text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary border-none"
            />
          </div>
        </div>
      </div>

      {/* ── GRID ── */}
      <div className="px-4 pt-4 pb-24">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Ничего не найдено
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-x-3 gap-y-4">
            {filtered.map((item) => (
              <Link
                key={item.slug}
                href={`/game/${item.slug}`}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="w-full aspect-square rounded-[18px] overflow-hidden bg-secondary">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <span className="text-[10px] text-center leading-tight text-foreground/70 w-full line-clamp-2">
                  {item.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
