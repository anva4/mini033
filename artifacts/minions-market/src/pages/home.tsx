import { Link } from "wouter";
import {
  useGetMarketplaceStats,
  getGetMarketplaceStatsQueryKey,
  useListProducts,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useLang } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { IconWrapper } from "@/components/ui/icon-wrapper";
import { Search, Star, Eye, Gamepad2, Sparkles, ChevronRight, Zap } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { PLAYEROK_GAMES, PLAYEROK_MOBILE_GAMES, PLAYEROK_APPS } from "@/data/playerok-categories";

const QUICK_FILTERS = [
  { id: "all",       label: "Все",        icon: "⊞",  subcategory: undefined },
  { id: "donate",    label: "Донат",      icon: "💎",  subcategory: "currency" },
  { id: "subs",      label: "Подписки",   icon: "📋",  subcategory: "subs" },
  { id: "accounts",  label: "Аккаунты",   icon: "👤",  subcategory: "accounts" },
  { id: "items",     label: "Предметы",   icon: "⚔️",  subcategory: "items" },
  { id: "currency",  label: "Валюта",     icon: "💰",  subcategory: "currency" },
];

interface CategoryItem {
  name: string;
  slug: string;
  image?: string;
  bg?: string;
  icon?: React.ComponentType<any>;
}

function CategoryRow({
  emoji, title, items, count, newSlugs = [], tabKey,
}: {
  emoji: string;
  title: string;
  items: CategoryItem[];
  count: number;
  newSlugs?: string[];
  tabKey: string;
}) {
  const newSet = new Set(newSlugs);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-4">
        <h2 className="font-bold text-base text-foreground flex items-center gap-1.5">
          <span>{emoji}</span> {title}
        </h2>
        <Link
          href={`/games-list/${tabKey}`}
          className="flex items-center gap-0.5 text-sm text-muted-foreground font-medium hover:text-foreground transition"
        >
          {count} <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="grid grid-rows-2 grid-flow-col gap-x-3 gap-y-2 px-4" style={{ gridAutoColumns: "72px" }}>
          {items.slice(0, 16).map((item) => (
            <Link key={item.slug} href={`/game/${item.slug}`} className="flex flex-col items-center gap-1">
              <div className="relative w-[72px]">
                <div className="w-[72px] h-[72px] rounded-[18px] overflow-hidden" style={{ background: item.bg || "#1a2533" }}>
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : item.icon ? (
                    <IconWrapper size="xl" className="text-white"><item.icon /></IconWrapper>
                  ) : null}
                </div>
                {newSet.has(item.slug) && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">Новое</span>
                )}
              </div>
              <span className="text-[9px] text-center leading-tight text-foreground/70 w-[72px] line-clamp-1">{item.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: any }) {
  return (
    <Link href={`/product/${product.id}`} className="block">
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/30 transition-all group">
        <div className="aspect-[4/3] bg-secondary/50 relative overflow-hidden">
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Gamepad2 className="w-8 h-8 text-muted-foreground/30" /></div>
          )}
          {product.isPromoted && (
            <span className="absolute top-2 left-2 flex items-center gap-0.5 bg-primary/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
              <Sparkles className="w-2.5 h-2.5" /> TOP
            </span>
          )}
        </div>
        <div className="p-3 flex flex-col gap-1.5">
          <h3 className="font-semibold text-sm truncate">{product.title}</h3>
          <div className="flex items-center justify-between">
            <span className="text-primary font-bold text-lg">{Number(product.price).toLocaleString()} ₽</span>
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Eye className="w-3 h-3" />{product.views || 0}</span>
          </div>
          {product.seller && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                {product.seller.avatar ? <img src={product.seller.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[8px]">{product.seller.username?.[0]?.toUpperCase()}</span>}
              </div>
              <span className="truncate">{product.seller.username}</span>
              {product.seller.rating && (
                <span className="flex items-center gap-0.5 text-yellow-500"><Star className="w-3 h-3 fill-current" />{Number(product.seller.rating).toFixed(1)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { t } = useLang();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const { data: stats } = useGetMarketplaceStats({ query: { queryKey: getGetMarketplaceStatsQueryKey() } });
  const { data: featured, isLoading: featuredLoading } = useListProducts(
    { sort: "popular", limit: 6 },
    { query: { queryKey: getListProductsQueryKey({ sort: "popular", limit: 6 }) } }
  );
  const activeSubcat = QUICK_FILTERS.find(f => f.id === activeFilter)?.subcategory;
  const recentParams = { sort: "newest" as const, limit: 8, ...(activeSubcat ? { subcategory: activeSubcat } : {}), ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}) };
  const { data: recent, isLoading: recentLoading } = useListProducts(recentParams, { query: { queryKey: getListProductsQueryKey(recentParams) } });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) setLocation(`/catalog?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="px-4 pt-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-black font-black text-lg leading-none">M</span>
          </div>
          <span className="text-xl font-bold text-foreground">inions Market</span>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-bold">5.0</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {stats?.totalUsers ? (stats.totalUsers >= 1000 ? `${(stats.totalUsers / 1000).toFixed(0)}к+` : `${stats.totalUsers}+`) : "1к+"}
          </span>
        </div>
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Поиск игр и приложений"
              className="w-full pl-10 pr-4 h-11 bg-secondary rounded-xl text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary border-none" />
          </div>
        </form>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-0.5">
          {QUICK_FILTERS.map(f => (
            <button key={f.id} onClick={() => setActiveFilter(f.id)}
              className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition ${activeFilter === f.id ? "bg-primary text-black" : "bg-secondary text-foreground/70 hover:bg-secondary/80"}`}>
              <span>{f.icon}</span> {f.label}
            </button>
          ))}
        </div>
      </div>

      <CategoryRow emoji="🎮" title="Игры" items={PLAYEROK_GAMES} count={PLAYEROK_GAMES.length} newSlugs={["counter-strike-2", "valorant"]} tabKey="games" />
      <CategoryRow emoji="📱" title="Мобильные игры" items={PLAYEROK_MOBILE_GAMES} count={PLAYEROK_MOBILE_GAMES.length} newSlugs={["clash-royale", "pubg-mobile"]} tabKey="mobile" />
      <CategoryRow emoji="🗂️" title="Приложения" items={PLAYEROK_APPS} count={PLAYEROK_APPS.length} newSlugs={["chatgpt", "telegram"]} tabKey="apps" />

      {!featuredLoading && featured?.products && featured.products.length > 0 && (
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base flex items-center gap-1.5"><Zap className="w-4 h-4 text-primary" /> Популярные</h2>
            <Link href="/catalog?sort=popular" className="text-xs text-primary font-medium">Все</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {featured.products.map((p) => <div key={p.id} className="w-48 shrink-0"><ProductCard product={p} /></div>)}
          </div>
        </div>
      )}

      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-base">{t("recentProducts")}</h2>
          <Link href="/catalog" className="text-xs text-primary font-medium">{t("all")}</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {recentLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />) : recent?.products?.map((p) => <ProductCard key={p.id} product={p} />)}
          {!recentLoading && (!recent?.products || recent.products.length === 0) && (
            <div className="col-span-2 text-center py-12 text-muted-foreground text-sm">{t("noProducts")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
