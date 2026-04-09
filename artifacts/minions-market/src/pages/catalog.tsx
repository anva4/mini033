import { useState, useEffect } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useListProducts, getListProductsQueryKey, useGetCategories, getGetCategoriesQueryKey } from "@workspace/api-client-react";
import { useLang } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, SlidersHorizontal, Star, Eye, Gamepad2, Sparkles, ChevronDown } from "lucide-react";

export default function CatalogPage() {
  const { t } = useLang();
  const searchStr = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(searchStr);

  const [search, setSearch] = useState(params.get("search") || "");
  const [category, setCategory] = useState(params.get("category") || "");
  const [sort, setSort] = useState<string>(params.get("sort") || "newest");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // FIX БАГ #13: синхронизация фильтров с URL при изменении
  useEffect(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (category) p.set("category", category);
    if (sort && sort !== "newest") p.set("sort", sort);
    const query = p.toString();
    setLocation(`/catalog${query ? `?${query}` : ""}`, { replace: true });
  }, [search, category, sort]);

  const { data: categories } = useGetCategories({ query: { queryKey: getGetCategoriesQueryKey() } });

  const queryParams = {
    ...(search ? { search } : {}),
    ...(category ? { category } : {}),
    sort: sort as any,
    page,
    limit: 20,
  };

  const { data, isLoading } = useListProducts(queryParams, { query: { queryKey: getListProductsQueryKey(queryParams) } });

  useEffect(() => { setPage(1); }, [search, category, sort]);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur pt-3 pb-2 px-4 border-b border-border/30">
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="pl-9 h-9"
              data-testid="input-catalog-search"
            />
          </div>
          <Button variant="secondary" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowFilters(!showFilters)} data-testid="button-filters">
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
        </div>

        {showFilters && (
          <div className="flex flex-col gap-3 pb-3 animate-in slide-in-from-top-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <Badge
                variant={!category ? "default" : "secondary"}
                className="cursor-pointer shrink-0 text-xs"
                onClick={() => setCategory("")}
              >
                {t("all")}
              </Badge>
              {categories?.map((c) => (
                <Badge
                  key={c.id}
                  variant={category === c.slug ? "default" : "secondary"}
                  className="cursor-pointer shrink-0 text-xs flex items-center gap-1"
                  onClick={() => setCategory(category === c.slug ? "" : c.slug)}
                  data-testid={`filter-cat-${c.slug}`}
                >
                  <span className="text-sm">{c.icon}</span>
                  {c.name}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              {(["newest", "cheapest", "expensive", "popular"] as const).map((s) => (
                <Button
                  key={s}
                  variant={sort === s ? "default" : "secondary"}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setSort(s)}
                >
                  {t(s)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 px-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)
          : data?.products?.map((product) => (
              <Link key={product.id} href={`/product/${product.id}`} data-testid={`card-product-${product.id}`}>
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/30 transition-all">
                  <div className="aspect-[4/3] bg-secondary/50 relative overflow-hidden">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gamepad2 className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                    {product.isPromoted && (
                      <Badge className="absolute top-2 left-2 bg-primary/90 text-[10px] gap-0.5 px-1.5 py-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> TOP
                      </Badge>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-1">
                    <h3 className="font-semibold text-xs truncate">{product.title}</h3>
                    <span className="text-primary font-bold text-sm">{Number(product.price).toLocaleString()} ₽</span>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{product.views || 0}</span>
                      {product.seller?.rating && (
                        <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />{Number(product.seller.rating).toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
      </div>

      {!isLoading && (!data?.products || data.products.length === 0) && (
        <div className="text-center py-16 text-muted-foreground text-sm">{t("noResults")}</div>
      )}

      {data && data.totalPages && data.totalPages > 1 && (
        <div className="flex justify-center gap-2 px-4">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} data-testid="button-prev-page">
            {t("back")}
          </Button>
          <span className="text-sm text-muted-foreground py-1">{page} / {data.totalPages}</span>
          <Button variant="secondary" size="sm" disabled={page >= (data.totalPages || 1)} onClick={() => setPage(page + 1)} data-testid="button-next-page">
            <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
          </Button>
        </div>
      )}
    </div>
  );
}
