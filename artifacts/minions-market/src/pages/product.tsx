import { useRoute, Link, useLocation } from "wouter";
import { useGetProduct, getGetProductQueryKey, useToggleFavorite, useCreateDeal, getGetFavoritesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Heart, Star, Eye, ShoppingCart, Shield, MessageCircle, Share2, User, Gamepad2 } from "lucide-react";
import { useState } from "react";

export default function ProductPage() {
  const [, params] = useRoute("/product/:id");
  const id = params?.id || "";
  const { t } = useLang();
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imgIdx, setImgIdx] = useState(0);

  const { data: product, isLoading } = useGetProduct(id, { query: { enabled: !!id, queryKey: getGetProductQueryKey(id) } });
  const toggleFav = useToggleFavorite();
  const createDeal = useCreateDeal();

  const handleFavorite = () => {
    if (!isAuthenticated) { setLocation("/auth"); return; }
    toggleFav.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetFavoritesQueryKey() });
      },
    });
  };

  const handleBuy = () => {
    if (!isAuthenticated) { setLocation("/auth"); return; }
    createDeal.mutate({ data: { productId: id } }, {
      onSuccess: (deal) => {
        toast({ title: t("dealCreated") });
        setLocation(`/deal/${deal.id}`);
      },
      onError: () => toast({ title: t("error"), variant: "destructive" }),
    });
  };

  if (isLoading) return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-20" />
    </div>
  );

  if (!product) return <div className="p-4 text-center text-muted-foreground">{t("error")}</div>;

  const images = product.images || [];
  const isOwner = user?.id === product.sellerId;

  return (
    <div className="flex flex-col pb-24">
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 glass border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleFavorite} data-testid="button-favorite">
            <Heart className={`w-5 h-5 ${product.isFavorited ? "fill-red-500 text-red-500" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="aspect-square bg-card relative overflow-hidden">
        {images.length > 0 ? (
          <img src={images[imgIdx]} alt={product.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary/50">
            <Gamepad2 className="w-16 h-16 text-muted-foreground/30" />
          </div>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_: string, i: number) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === imgIdx ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {product.categoryName && <Badge variant="secondary" className="text-xs">{product.categoryName}</Badge>}
            {product.deliveryType === "auto" && <Badge className="bg-green-500/20 text-green-400 text-xs border-0">{t("auto")}</Badge>}
          </div>
          <h1 className="text-xl font-bold leading-tight">{product.title}</h1>
          <div className="text-2xl font-black text-primary">{Number(product.price).toLocaleString()} ₽</div>
        </div>

        <Link href={`/profile/${product.seller?.id}`} className="bg-card rounded-xl p-3 flex items-center gap-3 border border-border/30" data-testid="link-seller">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
            {product.seller?.avatar ? <img src={product.seller.avatar} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{product.seller?.username}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5 text-yellow-500"><Star className="w-3 h-3 fill-current" />{Number(product.seller?.rating || 5).toFixed(1)}</span>
              <span>{product.seller?.totalSales || 0} {t("soldCount").toLowerCase()}</span>
            </div>
          </div>
          <Button variant="secondary" size="sm" asChild data-testid="button-message-seller">
            <Link href={`/messages/${product.seller?.id}`}><MessageCircle className="w-4 h-4" /></Link>
          </Button>
        </Link>

        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{t("description")}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{product.description || "-"}</p>
        </div>

        {product.tags && product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {product.tags.map((tag: string) => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-3 border-t border-border/30">
          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{product.views || 0} {t("views").toLowerCase()}</span>
          <span className="flex items-center gap-1"><ShoppingCart className="w-3.5 h-3.5" />{product.soldCount || 0} {t("soldCount").toLowerCase()}</span>
          <span className="flex items-center gap-1 ml-auto text-green-400"><Shield className="w-3.5 h-3.5" />{t("secureDeal")}</span>
        </div>
      </div>

      {!isOwner && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-3">
          <div className="max-w-lg mx-auto">
            <Button
              className="w-full h-12 text-base font-bold gradient-primary border-0 hover:opacity-90 transition-opacity"
              onClick={handleBuy}
              disabled={createDeal.isPending}
              data-testid="button-buy"
            >
              {createDeal.isPending ? t("loading") : `${t("buy")} ${Number(product.price).toLocaleString()} ₽`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
