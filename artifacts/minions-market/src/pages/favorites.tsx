import { Link, useLocation } from "wouter";
import { useGetFavorites, getGetFavoritesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Gamepad2, Heart } from "lucide-react";

export default function FavoritesPage() {
  const { t } = useLang();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // FIX: хук вызывается ДО условного return (Rules of Hooks)
  // FIX: enabled: isAuthenticated — не делаем запрос без авторизации
  const { data: favorites, isLoading } = useGetFavorites({
    query: { enabled: isAuthenticated, queryKey: getGetFavoritesQueryKey() },
  });

  // FIX: условный return ПОСЛЕ всех хуков
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  return (
    <div className="flex flex-col pb-4">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="font-bold">{t("favorites")}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />) :
          favorites?.map((p) => (
            <Link key={p.id} href={`/product/${p.id}`} data-testid={`card-fav-${p.id}`}>
              <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                <div className="aspect-[4/3] bg-secondary/50 relative flex items-center justify-center">
                  {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" /> : <Gamepad2 className="w-8 h-8 text-muted-foreground/30" />}
                  <Heart className="absolute top-2 right-2 w-4 h-4 text-red-500 fill-red-500" />
                </div>
                <div className="p-2.5">
                  <h3 className="text-xs font-semibold truncate">{p.title}</h3>
                  <span className="text-primary font-bold text-sm">{Number(p.price).toLocaleString()} ₽</span>
                </div>
              </div>
            </Link>
          ))
        }
        {!isLoading && (!favorites || favorites.length === 0) && (
          <div className="col-span-2 text-center py-16 text-muted-foreground text-sm">{t("noProducts")}</div>
        )}
      </div>
    </div>
  );
}
