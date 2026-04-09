import { useRoute, Link, useLocation } from "wouter";
import { useGetUser, getGetUserQueryKey, useGetUserProducts, getGetUserProductsQueryKey, useGetUserReviews, getGetUserReviewsQueryKey, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, ShoppingBag, Package, Settings, Calendar, Shield, MessageCircle, User, Wallet, Heart, Briefcase } from "lucide-react";
import { Gamepad2, Eye } from "lucide-react";
import { useState } from "react";

export default function ProfilePage() {
  const [, params] = useRoute("/profile/:id");
  const profileId = params?.id;
  const { user: authUser, isAuthenticated } = useAuth();
  const { t } = useLang();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"products" | "reviews">("products");

  const isOwnProfile = !profileId || profileId === authUser?.id;
  const userId = isOwnProfile ? authUser?.id : profileId;

  const { data: profileUser, isLoading } = useGetUser(userId || "", { query: { enabled: !!userId, queryKey: getGetUserQueryKey(userId || "") } });
  const { data: me } = useGetMe({ query: { enabled: isOwnProfile && isAuthenticated, queryKey: getGetMeQueryKey() } });
  const { data: products } = useGetUserProducts(userId || "", {}, { query: { enabled: !!userId, queryKey: getGetUserProductsQueryKey(userId || "") } });
  const { data: reviews } = useGetUserReviews(userId || "", { query: { enabled: !!userId, queryKey: getGetUserReviewsQueryKey(userId || "") } });

  const profile = isOwnProfile && me ? me : profileUser;

  if (!isAuthenticated && isOwnProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
        <User className="w-16 h-16 text-muted-foreground" />
        <p className="text-muted-foreground">{t("login")}</p>
        <Button onClick={() => setLocation("/auth")} data-testid="button-go-login">{t("login")}</Button>
      </div>
    );
  }

  if (isLoading) return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center gap-4"><Skeleton className="w-16 h-16 rounded-full" /><div className="flex-1"><Skeleton className="h-6 w-32 mb-2" /><Skeleton className="h-4 w-24" /></div></div>
    </div>
  );

  if (!profile) return <div className="p-4 text-center text-muted-foreground">{t("error")}</div>;

  const levelColors: Record<string, string> = { newcomer: "text-gray-400", beginner: "text-blue-400", experienced: "text-green-400", professional: "text-purple-400", expert: "text-yellow-400" };

  return (
    <div className="flex flex-col pb-4">
      <div className="gradient-primary px-4 pt-6 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-card border-2 border-white/20 overflow-hidden flex items-center justify-center shrink-0">
            {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white truncate">{profile.username}</h1>
              {profile.isVerified && <Shield className="w-4 h-4 text-blue-300" />}
            </div>
            <div className="flex items-center gap-2 text-white/70 text-xs mt-0.5">
              <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{Number(profile.rating || 5).toFixed(1)}</span>
              <span>{profile.reviewCount || 0} {t("reviews").toLowerCase()}</span>
            </div>
            <Badge className={`mt-1 text-[10px] px-1.5 py-0 bg-white/10 border-0 ${levelColors[profile.sellerLevel || "newcomer"]}`}>
              {t(profile.sellerLevel || "newcomer")}
            </Badge>
          </div>
        </div>
        {profile.bio && <p className="text-white/70 text-xs mt-3">{profile.bio}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 -mt-4">
        <div className="bg-card rounded-xl p-3 border border-border/30 text-center">
          <div className="text-lg font-bold">{profile.totalSales || 0}</div>
          <div className="text-[10px] text-muted-foreground">{t("soldCount")}</div>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border/30 text-center">
          <div className="text-lg font-bold">{profile.totalPurchases || 0}</div>
          <div className="text-[10px] text-muted-foreground">{t("buyer")}</div>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border/30 text-center">
          <div className="text-lg font-bold">{(profile as any).productCount ?? products?.products?.length ?? 0}</div>
          <div className="text-[10px] text-muted-foreground">{t("products")}</div>
        </div>
      </div>

      {isOwnProfile && (
        <div className="grid grid-cols-2 gap-2 px-4 mt-4">
          {[
            { icon: Wallet, label: t("wallet"), href: "/wallet" },
            { icon: Briefcase, label: t("deals"), href: "/deals" },
            { icon: Heart, label: t("favorites"), href: "/favorites" },
            { icon: Settings, label: t("settings"), href: "/settings" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="bg-card rounded-xl p-3 border border-border/30 flex items-center gap-2 hover:border-primary/30 transition-colors" data-testid={`link-${item.href.slice(1)}`}>
              <item.icon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
          {(profile as any).isAdmin && (
            <Link href="/admin" className="bg-card rounded-xl p-3 border border-primary/30 flex items-center gap-2 col-span-2" data-testid="link-admin">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{t("admin")}</span>
            </Link>
          )}
        </div>
      )}

      {!isOwnProfile && (
        <div className="px-4 mt-4">
          <Button variant="secondary" className="w-full" onClick={() => setLocation(`/messages/${userId}`)} data-testid="button-msg-user">
            <MessageCircle className="w-4 h-4 mr-2" /> {t("writeMessage")}
          </Button>
        </div>
      )}

      <div className="flex gap-2 px-4 mt-4 mb-3">
        <Button variant={tab === "products" ? "default" : "secondary"} size="sm" onClick={() => setTab("products")} data-testid="tab-products">
          <Package className="w-4 h-4 mr-1" /> {t("products")}
        </Button>
        <Button variant={tab === "reviews" ? "default" : "secondary"} size="sm" onClick={() => setTab("reviews")} data-testid="tab-reviews">
          <Star className="w-4 h-4 mr-1" /> {t("reviews")}
        </Button>
      </div>

      <div className="px-4">
        {tab === "products" && (
          <div className="grid grid-cols-2 gap-3">
            {products?.products?.map((p) => (
              <Link key={p.id} href={`/product/${p.id}`} data-testid={`card-product-${p.id}`}>
                <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  <div className="aspect-[4/3] bg-secondary/50 flex items-center justify-center">
                    {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" /> : <Gamepad2 className="w-8 h-8 text-muted-foreground/30" />}
                  </div>
                  <div className="p-2">
                    <h3 className="text-xs font-semibold truncate">{p.title}</h3>
                    <span className="text-primary font-bold text-sm">{Number(p.price).toLocaleString()} ₽</span>
                  </div>
                </div>
              </Link>
            ))}
            {(!products?.products || products.products.length === 0) && (
              <div className="col-span-2 text-center py-8 text-muted-foreground text-sm">{t("noProducts")}</div>
            )}
          </div>
        )}
        {tab === "reviews" && (
          <div className="flex flex-col gap-3">
            {reviews?.map((r) => (
              <div key={r.id} className="bg-card rounded-xl p-3 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                    {r.reviewer?.avatar ? <img src={r.reviewer.avatar} className="w-full h-full object-cover" /> : <span className="text-[10px]">{r.reviewer?.username?.[0]?.toUpperCase()}</span>}
                  </div>
                  <span className="text-sm font-medium">{r.reviewer?.username}</span>
                  <div className="flex items-center gap-0.5 ml-auto">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < r.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
            {(!reviews || reviews.length === 0) && (
              <div className="text-center py-8 text-muted-foreground text-sm">{t("noReviews")}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
