import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Link } from "wouter";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { ChevronLeft, Search, SlidersHorizontal, Eye, Star, Gamepad2, Sparkles, ArrowUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAYEROK_GAMES, PLAYEROK_MOBILE_GAMES, PLAYEROK_APPS } from "@/data/playerok-categories";

// ─── Подкатегории для игр ──────────────────────────────────────────────────

const GAME_SUBCATS: Record<string, { id: string; label: string }[]> = {
  "counter-strike-2": [
    { id: "skins",       label: "Скины" },
    { id: "accounts",    label: "Аккаунты" },
    { id: "prime",       label: "Prime Status" },
    { id: "faceit",      label: "Аккаунты FACEIT" },
    { id: "services",    label: "Услуги" },
    { id: "rent",        label: "Аренда" },
    { id: "boost",       label: "Буст" },
    { id: "other",       label: "Другое" },
    { id: "design",      label: "Дизайн" },
    { id: "battlepass",  label: "Пропуск" },
  ],
  "genshin-impact": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "crystals",    label: "Кристаллы" },
    { id: "spins",       label: "Крутки" },
    { id: "boost",       label: "Буст" },
    { id: "services",    label: "Услуги" },
    { id: "battlepass",  label: "Боевой пропуск" },
    { id: "other",       label: "Другое" },
  ],
  "roblox": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "currency",    label: "Robux" },
    { id: "items",       label: "Предметы" },
    { id: "gamepasses",  label: "Пропуска" },
    { id: "services",    label: "Услуги" },
    { id: "other",       label: "Другое" },
  ],
  "valorant": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "vp",          label: "VP (валюта)" },
    { id: "boost",       label: "Буст ранга" },
    { id: "services",    label: "Услуги" },
    { id: "other",       label: "Другое" },
  ],
  "dota-2": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "items",       label: "Предметы" },
    { id: "boost",       label: "Буст" },
    { id: "services",    label: "Услуги" },
    { id: "other",       label: "Другое" },
  ],
  "steam": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "balance",     label: "Пополнение" },
    { id: "items",       label: "Предметы/скины" },
    { id: "keys",        label: "Ключи/игры" },
    { id: "services",    label: "Услуги" },
    { id: "other",       label: "Другое" },
  ],
  "telegram": [
    { id: "stars",       label: "Звёзды" },
    { id: "premium",     label: "Premium" },
    { id: "accounts",    label: "Аккаунты" },
    { id: "channels",    label: "Каналы/боты" },
    { id: "services",    label: "Услуги" },
    { id: "other",       label: "Другое" },
  ],
  "chatgpt": [
    { id: "subs",        label: "Подписка" },
    { id: "accounts",    label: "Аккаунты" },
    { id: "services",    label: "Услуги" },
    { id: "other",       label: "Другое" },
  ],
  "brawl-stars": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "currency",    label: "Гемы" },
    { id: "boost",       label: "Буст" },
    { id: "battlepass",  label: "Боевой пропуск" },
    { id: "services",    label: "Услуги" },
    { id: "other",       label: "Другое" },
  ],
  "pubg-mobile": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "uc",          label: "UC (валюта)" },
    { id: "boost",       label: "Буст" },
    { id: "royalpass",   label: "Royal Pass" },
    { id: "services",    label: "Услуги" },
    { id: "other",       label: "Другое" },
  ],
};

const DEFAULT_SUBCATS = [
  { id: "accounts",    label: "Аккаунты" },
  { id: "items",       label: "Предметы" },
  { id: "currency",    label: "Валюта" },
  { id: "boost",       label: "Буст" },
  { id: "keys",        label: "Ключи" },
  { id: "services",    label: "Услуги" },
  { id: "other",       label: "Другое" },
];

// ─── Найти игру по slug ───────────────────────────────────────────────────────

const ALL_ITEMS = [
  ...PLAYEROK_GAMES.map(g => ({ ...g, tab: "games" })),
  ...PLAYEROK_MOBILE_GAMES.map(g => ({ ...g, tab: "mobile" })),
  ...PLAYEROK_APPS.map(g => ({ ...g, tab: "apps" })),
];

// ─── Карточка товара ─────────────────────────────────────────────────────────

function ProductCard({ product }: { product: any }) {
  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : null;

  return (
    <Link href={`/product/${product.id}`}>
      <div className="rounded-xl overflow-hidden bg-[#131a23] border border-white/5 hover:border-primary/30 transition-all">
        <div className="aspect-[4/3] relative overflow-hidden bg-[#0d1420]">
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Gamepad2 className="w-8 h-8 text-white/10" />
            </div>
          )}
          {product.isReady && (
            <span className="absolute top-2 right-2 bg-green-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
              Готов к Выдаче
            </span>
          )}
          {product.isPromoted && (
            <span className="absolute top-2 left-2 flex items-center gap-0.5 bg-primary/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
              <Sparkles className="w-2.5 h-2.5" /> TOP
            </span>
          )}
        </div>
        <div className="p-2.5 space-y-1.5">
          {/* Цена */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-green-400 font-bold text-base">
              {Number(product.price).toLocaleString()} ₽
            </span>
            {discount && (
              <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                -{discount}%
              </span>
            )}
            {product.originalPrice && (
              <span className="text-white/30 text-xs line-through">
                {Number(product.originalPrice).toLocaleString()}
              </span>
            )}
          </div>
          {/* Название */}
          <p className="text-white text-xs font-medium line-clamp-2 leading-snug">
            {product.title}
          </p>
          {/* Рейтинг */}
          {product.seller?.rating && (
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${i < Math.round(Number(product.seller.rating)) ? "fill-yellow-400 text-yellow-400" : "text-white/20"}`}
                />
              ))}
              <span className="text-white/40 text-[10px] ml-0.5">{product.reviews || 0}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────

export default function GamePage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  const game = ALL_ITEMS.find(i => i.slug === slug);
  const subcats = GAME_SUBCATS[slug] || DEFAULT_SUBCATS;

  const [activeSubcat, setActiveSubcat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "cheapest" | "expensive" | "popular">("newest");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [activeSubcat, search, sort]);

  const queryParams = {
    game: slug,
    ...(activeSubcat ? { subcategory: activeSubcat } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    sort,
    page,
    limit: 20,
  };

  const { data, isLoading } = useListProducts(queryParams as any, {
    query: { queryKey: getListProductsQueryKey(queryParams as any) },
  });

  if (!game) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white/50 gap-3">
        <Gamepad2 className="w-12 h-12" />
        <p>Игра не найдена</p>
        <button onClick={() => navigate("/")} className="text-primary text-sm">На главную</button>
      </div>
    );
  }

  const displayTitle = activeSubcat
    ? `${subcats.find(s => s.id === activeSubcat)?.label} ${game.name}`
    : game.name;

  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white">

      {/* ── ХЕДЕР ── */}
      <div className="sticky top-0 z-40 bg-[#0d1117]/95 backdrop-blur border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => window.history.back()} className="p-1">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <p className="font-bold text-base">{game.name}</p>
          {/* FIX БАГ #9: кнопка поиска скроллит к полю ввода */}
          <button className="p-1" onClick={() => document.getElementById("game-search-input")?.focus()}>
            <Search className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </div>

      {/* ── БАННЕР ИГРЫ ── */}
      <div className="relative w-full h-36 overflow-hidden">
        <img
          src={game.image}
          alt={game.name}
          className="w-full h-full object-cover"
          style={{ filter: "brightness(0.6)" }}
        />
        {/* Градиент снизу */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent" />
        {/* Иконка + название */}
        <div className="absolute bottom-3 left-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white/20 flex-shrink-0">
            <img src={game.image} alt={game.name} className="w-full h-full object-cover" />
          </div>
          <p className="font-bold text-lg text-white drop-shadow-md">{displayTitle}</p>
        </div>
      </div>

      {/* ── ПОДКАТЕГОРИИ ── */}
      <div className="overflow-x-auto scrollbar-hide px-4 py-3 flex gap-2 border-b border-white/5">
        <button
          onClick={() => setActiveSubcat(null)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
            activeSubcat === null
              ? "bg-primary text-black"
              : "bg-[#1a2332] text-white/70 hover:text-white"
          }`}
        >
          Все
        </button>
        {subcats.map(sub => (
          <button
            key={sub.id}
            onClick={() => setActiveSubcat(activeSubcat === sub.id ? null : sub.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
              activeSubcat === sub.id
                ? "bg-primary text-black"
                : "bg-[#1a2332] text-white/70 hover:text-white"
            }`}
          >
            {sub.label}
          </button>
        ))}
      </div>

      {/* ── ПОИСК ── */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            id="game-search-input"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию"
            className="w-full pl-10 pr-4 py-3 bg-[#1a2332] rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary border-none"
          />
        </div>
      </div>

      {/* ── ФИЛЬТРЫ ── */}
      <div className="overflow-x-auto scrollbar-hide px-4 pb-3 flex gap-2">
        {(["newest", "cheapest", "expensive", "popular"] as const).map(s => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
              sort === s
                ? "bg-primary text-black"
                : "bg-[#1a2332] text-white/60 hover:text-white"
            }`}
          >
            {s === "newest" && "Новые"}
            {s === "cheapest" && "Цена ↑"}
            {s === "expensive" && "Цена ↓"}
            {s === "popular" && "⭐ Отзывы"}
          </button>
        ))}
      </div>

      {/* ── СЧЁТЧИК ── */}
      <div className="flex items-center justify-between px-4 pb-3">
        <p className="text-white/40 text-sm">
          {data?.total ? `Всего ${data.total.toLocaleString()} товара` : "Загрузка..."}
        </p>
        <button className="p-1 text-white/40 hover:text-white">
          <ArrowUpDown className="w-4 h-4" />
        </button>
      </div>

      {/* ── СЕТКА ТОВАРОВ ── */}
      <div className="px-4 pb-24">
        <div className="grid grid-cols-2 gap-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-52 rounded-xl bg-[#1a2332]" />
              ))
            : data?.products?.map(p => <ProductCard key={p.id} product={p} />)}
        </div>

        {!isLoading && (!data?.products || data.products.length === 0) && (
          <div className="text-center py-16 text-white/30 text-sm">Товары не найдены</div>
        )}

        {/* Пагинация */}
        {data?.totalPages && data.totalPages > 1 && (
          <div className="flex justify-center gap-3 mt-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-xl bg-[#1a2332] text-sm text-white/60 disabled:opacity-30"
            >
              Назад
            </button>
            <span className="py-2 text-sm text-white/40">{page} / {data.totalPages}</span>
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl bg-[#1a2332] text-sm text-white/60 disabled:opacity-30"
            >
              Далее
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
