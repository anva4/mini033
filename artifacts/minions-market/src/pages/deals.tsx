import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListDeals, getListDealsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, Gamepad2 } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  paid: "bg-blue-500/20 text-blue-400",
  delivered: "bg-purple-500/20 text-purple-400",
  completed: "bg-green-500/20 text-green-400",
  disputed: "bg-red-500/20 text-red-400",
  cancelled: "bg-gray-500/20 text-gray-400",
  refunded: "bg-orange-500/20 text-orange-400",
};

export default function DealsPage() {
  const { t } = useLang();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<string>("all");
  const [page, setPage] = useState(1);

  const params = { role: role as any, page, limit: 20 };

  // FIX: хук вызывается ДО условного return (Rules of Hooks)
  // FIX: enabled: isAuthenticated — не делаем запрос без авторизации
  // FIX: placeholderData: keepPreviousData — нет мигания при смене роли/страницы
  const { data, isLoading } = useListDeals(params, {
    query: {
      enabled: isAuthenticated,
      queryKey: getListDealsQueryKey(params),
      placeholderData: keepPreviousData,
    },
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
        <h1 className="font-bold">{t("deals")}</h1>
      </div>

      <div className="flex gap-2 px-4 py-3 overflow-x-auto">
        {["all", "buyer", "seller"].map((r) => (
          <Button key={r} variant={role === r ? "default" : "secondary"} size="sm" onClick={() => { setRole(r); setPage(1); }} className="text-xs shrink-0" data-testid={`tab-role-${r}`}>
            {t(r === "all" ? "all" : r)}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-3 px-4">
        {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) :
          data?.deals?.map((deal) => (
            <Link key={deal.id} href={`/deal/${deal.id}`} data-testid={`card-deal-${deal.id}`}>
              <div className="bg-card rounded-xl border border-border/30 p-3 flex items-center gap-3 hover:border-primary/20 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-secondary/50 flex items-center justify-center overflow-hidden shrink-0">
                  {deal.product?.images?.[0] ? <img src={deal.product.images[0]} className="w-full h-full object-cover" /> : <Gamepad2 className="w-5 h-5 text-muted-foreground/30" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{deal.product?.title || `${t("dealNumber")}${deal.dealNumber}`}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className={`text-[10px] border-0 ${statusColors[deal.status] || ""}`}>{t(deal.status)}</Badge>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-sm text-primary">{Number(deal.amount).toLocaleString()} ₽</div>
                  <div className="text-[10px] text-muted-foreground">{t("dealNumber")}{deal.dealNumber}</div>
                </div>
              </div>
            </Link>
          ))
        }
        {!isLoading && (!data?.deals || data.deals.length === 0) && (
          <div className="text-center py-16 text-muted-foreground text-sm">{t("noDeals")}</div>
        )}
      </div>
    </div>
  );
}
