import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetAdminStats, getGetAdminStatsQueryKey,
  useAdminListUsers, getAdminListUsersQueryKey,
  useAdminGetUser,
  useAdminBanUser, useAdminVerifyUser, useAdminSetUserRole, useAdminAdjustBalance,
  useAdminListProducts, getAdminListProductsQueryKey,
  useAdminModerateProduct, useAdminDeleteProduct,
  useAdminListDeals, getAdminListDealsQueryKey,
  useAdminResolveDeal,
  useAdminListWithdrawals, getAdminListWithdrawalsQueryKey,
  useAdminProcessWithdrawal,
  useAdminListTransactions, getAdminListTransactionsQueryKey,
  useGetAdminRevenueChart, getGetAdminRevenueChartQueryKey,
  useGetCategories, getGetCategoriesQueryKey,
  useAdminCreateCategory, useAdminDeleteCategory, useAdminUpdateCategory,
  useAdminListReviews, getAdminListReviewsQueryKey, useAdminDeleteReview,
  useAdminBroadcast,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Users, ShoppingBag, Briefcase, Wallet, Shield, BarChart3,
  Ban, CheckCircle, X, Plus, Trash2, Eye, Star, Send, CreditCard,
  TrendingUp, DollarSign, ChevronRight, RefreshCw, MessageSquare,
  UserCheck, UserX, Crown, MinusCircle, PlusCircle, Filter,
} from "lucide-react";

type Tab = "stats" | "users" | "products" | "deals" | "withdrawals" | "transactions" | "categories" | "reviews";

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-card rounded-xl p-3 border border-border/30">
      <div className="text-[11px] text-muted-foreground mb-0.5">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center py-10 text-muted-foreground text-sm">{text}</div>;
}

function statusColor(s: string) {
  if (s === "completed" || s === "active") return "bg-green-500/15 text-green-400 border-green-500/20";
  if (s === "pending") return "bg-yellow-500/15 text-yellow-400 border-yellow-500/20";
  if (s === "disputed") return "bg-orange-500/15 text-orange-400 border-orange-500/20";
  if (s === "cancelled" || s === "rejected" || s === "banned") return "bg-red-500/15 text-red-400 border-red-500/20";
  if (s === "hidden") return "bg-gray-500/15 text-gray-400 border-gray-500/20";
  return "bg-secondary text-secondary-foreground border-border";
}

export default function AdminPage() {
  const { t } = useLang();
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("stats");
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "banned" | "verified">("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showBalanceModal, setShowBalanceModal] = useState<string | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceType, setBalanceType] = useState<"add" | "deduct">("add");
  const [balanceDesc, setBalanceDesc] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState("");
  const [dealStatusFilter, setDealStatusFilter] = useState("");
  const [resolveModal, setResolveModal] = useState<{ dealId: string; dealNum: number } | null>(null);
  const [resolveComment, setResolveComment] = useState("");
  const [withdrawNote, setWithdrawNote] = useState<Record<string, string>>({});
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("");
  const [revDays, setRevDays] = useState(30);
  const [txTypeFilter, setTxTypeFilter] = useState("");
  const [banModal, setBanModal] = useState<{ userId: string; username?: string } | null>(null);
  const [banReason, setBanReason] = useState("Нарушение правил платформы");
  const [banHours, setBanHours] = useState("");

  useEffect(() => {
    if (!isAuthenticated || !user?.isAdmin) setLocation("/");
  }, [isAuthenticated, user?.isAdmin]);

  if (!isAuthenticated || !user?.isAdmin) return null;

  // ── Data fetches ──────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey() },
  });
  const { data: revenueChart } = useGetAdminRevenueChart({ days: revDays }, {
    query: { enabled: tab === "stats", queryKey: getGetAdminRevenueChartQueryKey({ days: revDays }) },
  });
  const usersParams = {
    search: userSearch || undefined,
    banned: userFilter === "banned" ? "true" : undefined,
    verified: userFilter === "verified" ? "true" : undefined,
  } as any;
  const { data: usersData, isLoading: usersLoading } = useAdminListUsers(usersParams, {
    query: { enabled: tab === "users", queryKey: getAdminListUsersQueryKey(usersParams) },
  });
  const { data: selectedUserData } = useAdminGetUser(selectedUserId!, {
    query: { enabled: !!selectedUserId },
  });
  const { data: productsData } = useAdminListProducts({ status: productStatusFilter || undefined }, {
    query: { enabled: tab === "products", queryKey: getAdminListProductsQueryKey({ status: productStatusFilter || undefined }) },
  });
  const { data: dealsData } = useAdminListDeals({ status: dealStatusFilter || undefined }, {
    query: { enabled: tab === "deals", queryKey: getAdminListDealsQueryKey({ status: dealStatusFilter || undefined }) },
  });
  const { data: withdrawals } = useAdminListWithdrawals({
    query: { enabled: tab === "withdrawals", queryKey: getAdminListWithdrawalsQueryKey() },
  });
  const { data: txData } = useAdminListTransactions({ type: txTypeFilter || undefined }, {
    query: { enabled: tab === "transactions", queryKey: getAdminListTransactionsQueryKey({ type: txTypeFilter || undefined }) },
  });
  const { data: categories } = useGetCategories({
    query: { enabled: tab === "categories", queryKey: getGetCategoriesQueryKey() },
  });
  const { data: reviewsData } = useAdminListReviews({}, {
    query: { enabled: tab === "reviews", queryKey: getAdminListReviewsQueryKey({}) },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const banUser = useAdminBanUser();
  const verifyUser = useAdminVerifyUser();
  const setRole = useAdminSetUserRole();
  const adjustBalance = useAdminAdjustBalance();
  const moderateProduct = useAdminModerateProduct();
  const deleteProduct = useAdminDeleteProduct();
  const resolveDeal = useAdminResolveDeal();
  const processWithdrawal = useAdminProcessWithdrawal();
  const createCategory = useAdminCreateCategory();
  const deleteCategory = useAdminDeleteCategory();
  const updateCategory = useAdminUpdateCategory();
  const deleteReview = useAdminDeleteReview();
  const broadcast = useAdminBroadcast();

  const invalidate = useCallback((keys: any[]) => {
    keys.forEach((k) => queryClient.invalidateQueries({ queryKey: k }));
  }, [queryClient]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBan = (id: string, banned: boolean, username?: string) => {
    if (banned) {
      // Открываем модалку с причиной
      setBanModal({ userId: id, username });
      setBanReason("Нарушение правил платформы");
      setBanHours("");
    } else {
      // Разбан — сразу
      banUser.mutate({ id, data: { banned: false } }, {
        onSuccess: () => { invalidate([getAdminListUsersQueryKey(usersParams)]); toast({ title: "Пользователь разблокирован" }); },
        onError: () => toast({ title: "Ошибка", variant: "destructive" }),
      });
    }
  };

  const handleBanConfirm = () => {
    if (!banModal) return;
    const hours = banHours ? parseInt(banHours) : undefined;
    banUser.mutate({ id: banModal.userId, data: { banned: true, reason: banReason, banUntilHours: hours } as any }, {
      onSuccess: () => {
        invalidate([getAdminListUsersQueryKey(usersParams)]);
        setBanModal(null);
        toast({ title: "Пользователь заблокирован" });
      },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    });
  };

  const handleVerify = (id: string, verified: boolean) => {
    verifyUser.mutate({ id, data: { verified } as any }, {
      onSuccess: () => { invalidate([getAdminListUsersQueryKey(usersParams)]); toast({ title: verified ? "Верификация выдана" : "Верификация снята" }); },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    });
  };

  const handleSetRole = (id: string, isAdmin: boolean) => {
    setRole.mutate({ id, data: { isAdmin } }, {
      onSuccess: () => { invalidate([getAdminListUsersQueryKey(usersParams)]); toast({ title: isAdmin ? "Роль администратора выдана" : "Роль администратора снята" }); },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    });
  };

  const handleAdjustBalance = (id: string) => {
    const amt = parseFloat(balanceAmount);
    if (!amt || isNaN(amt) || amt <= 0) { toast({ title: "Введите корректную сумму", variant: "destructive" }); return; }
    adjustBalance.mutate({ id, data: { amount: amt, type: balanceType, description: balanceDesc || undefined } }, {
      onSuccess: () => {
        invalidate([getAdminListUsersQueryKey(usersParams)]);
        setShowBalanceModal(null);
        setBalanceAmount("");
        setBalanceDesc("");
        toast({ title: `Баланс ${balanceType === "add" ? "пополнен" : "уменьшен"} на ${amt} ₽` });
      },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    });
  };

  const handleModerate = (id: string, status: string) => {
    moderateProduct.mutate({ id, data: { status } as any }, {
      onSuccess: () => { invalidate([getAdminListProductsQueryKey({ status: productStatusFilter || undefined })]); toast({ title: `Статус изменён: ${status}` }); },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    });
  };

  const handleDeleteProduct = (id: string) => {
    if (!confirm("Удалить товар безвозвратно?")) return;
    deleteProduct.mutate({ id }, {
      onSuccess: () => { invalidate([getAdminListProductsQueryKey({ status: productStatusFilter || undefined })]); toast({ title: "Товар удалён" }); },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    });
  };

  const handleResolve = (resolution: string) => {
    if (!resolveModal) return;
    resolveDeal.mutate({ id: resolveModal.dealId, data: { resolution, adminComment: resolveComment || undefined } as any }, {
      onSuccess: () => {
        invalidate([getAdminListDealsQueryKey({ status: dealStatusFilter || undefined })]);
        setResolveModal(null);
        setResolveComment("");
        toast({ title: "Сделка разрешена" });
      },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    });
  };

  const handleWithdrawal = (id: string, action: string) => {
    processWithdrawal.mutate({ id, data: { action, note: withdrawNote[id] || undefined } as any }, {
      onSuccess: () => { invalidate([getAdminListWithdrawalsQueryKey()]); toast({ title: action === "approve" ? "Выплата одобрена" : "Выплата отклонена" }); },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    });
  };

  const handleBroadcast = () => {
    if (!broadcastText.trim()) { toast({ title: "Введите текст", variant: "destructive" }); return; }
    broadcast.mutate({ data: { text: broadcastText, targetUserId: broadcastTarget || undefined } }, {
      onSuccess: (d) => { setBroadcastModal(false); setBroadcastText(""); setBroadcastTarget(""); toast({ title: `Отправлено ${(d as any)?.sent ?? 0} пользователям` }); },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    });
  };

  const handleCreateCat = () => {
    if (!newCatName || !newCatSlug) { toast({ title: "Заполните название и slug", variant: "destructive" }); return; }
    createCategory.mutate({ data: { name: newCatName, slug: newCatSlug, icon: newCatIcon || undefined } }, {
      onSuccess: () => { setNewCatName(""); setNewCatSlug(""); setNewCatIcon(""); invalidate([getGetCategoriesQueryKey()]); toast({ title: "Категория создана" }); },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    });
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: { key: Tab; icon: any; label: string }[] = [
    { key: "stats", icon: BarChart3, label: "Статистика" },
    { key: "users", icon: Users, label: "Пользователи" },
    { key: "products", icon: ShoppingBag, label: "Товары" },
    { key: "deals", icon: Briefcase, label: "Сделки" },
    { key: "withdrawals", icon: Wallet, label: "Выплаты" },
    { key: "transactions", icon: CreditCard, label: "Транзакции" },
    { key: "reviews", icon: Star, label: "Отзывы" },
    { key: "categories", icon: Shield, label: "Категории" },
  ];

  return (
    <div className="flex flex-col pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 glass border-b border-border/30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="font-bold text-primary">Панель администратора</h1>
        </div>
        <Button size="sm" variant="secondary" className="gap-1 text-xs" onClick={() => setBroadcastModal(true)}>
          <Send className="w-3 h-3" /> Рассылка
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto no-scrollbar border-b border-border/20">
        {tabs.map((tb) => (
          <Button key={tb.key} variant={tab === tb.key ? "default" : "ghost"} size="sm"
            onClick={() => setTab(tb.key)}
            className="text-xs shrink-0 gap-1.5 h-7"
            data-testid={`admin-tab-${tb.key}`}
          >
            <tb.icon className="w-3.5 h-3.5" /> {tb.label}
          </Button>
        ))}
      </div>

      <div className="px-4 pt-3">

        {/* ── STATS ─────────────────────────────────────────────────────── */}
        {tab === "stats" && (
          <div className="flex flex-col gap-4">
            {statsLoading ? (
              <div className="grid grid-cols-2 gap-3">{Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Пользователи" value={stats.totalUsers?.toLocaleString()} sub={`+${stats.todayRegistrations} сегодня`} />
                  <StatCard label="Товары" value={stats.totalProducts?.toLocaleString()} />
                  <StatCard label="Сделки" value={stats.totalDeals?.toLocaleString()} sub={`+${stats.todayDeals} сегодня`} />
                  <StatCard label="Доход платформы" value={`${Number(stats.totalRevenue || 0).toLocaleString()} ₽`} sub={`+${Number(stats.todayVolume || 0).toLocaleString()} ₽ сегодня`} />
                  <StatCard label="Ожидают выплат" value={<span className={stats.pendingWithdrawals > 0 ? "text-yellow-400" : ""}>{stats.pendingWithdrawals}</span>} />
                  <StatCard label="Активных споров" value={<span className={stats.activeDisputes > 0 ? "text-orange-400" : ""}>{stats.activeDisputes}</span>} />
                </div>

                {/* Revenue chart */}
                {revenueChart && revenueChart.length > 0 && (
                  <div className="bg-card rounded-xl border border-border/30 p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold">График доходов</span>
                      <div className="flex gap-1">
                        {[7, 14, 30].map((d) => (
                          <button key={d} onClick={() => setRevDays(d)}
                            className={`text-[10px] px-2 py-0.5 rounded-md ${revDays === d ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                          >{d}д</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-end gap-0.5 h-24">
                      {revenueChart.map((pt, i) => {
                        const maxRev = Math.max(...revenueChart.map((p) => p.revenue), 1);
                        const h = Math.max(2, (pt.revenue / maxRev) * 100);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${pt.date}: ${Number(pt.revenue).toLocaleString()} ₽`}>
                            <div className="w-full rounded-t bg-primary/70 transition-all" style={{ height: `${h}%` }} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 text-center">
                      Итого: {revenueChart.reduce((s, p) => s + p.revenue, 0).toLocaleString()} ₽ за {revDays} дней
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ── USERS ─────────────────────────────────────────────────────── */}
        {tab === "users" && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Поиск по нику..." className="flex-1" data-testid="input-admin-user-search" />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(["all", "banned", "verified"] as const).map((f) => (
                <button key={f} onClick={() => setUserFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full border shrink-0 ${userFilter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                >
                  {f === "all" ? "Все" : f === "banned" ? "Заблок." : "Верифиц."}
                </button>
              ))}
            </div>

            {usersLoading && Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}

            {usersData?.users?.map((u) => (
              <div key={u.id} className="bg-card rounded-xl border border-border/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm truncate">{u.username}</span>
                      {u.isAdmin && <Crown className="w-3 h-3 text-yellow-400 shrink-0" />}
                      {u.isVerified && <CheckCircle className="w-3 h-3 text-blue-400 shrink-0" />}
                      {u.isBanned && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor("banned")}`}>Заблок.</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {Number(u.balance || 0).toLocaleString()} ₽ · {u.telegramUsername ? `@${u.telegramUsername}` : "—"} · {u.totalSales} продаж
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => setSelectedUserId(selectedUserId === u.id ? null : u.id)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  <Button size="sm" variant="secondary" className="h-7 text-[11px] gap-1 text-blue-400" onClick={() => handleVerify(u.id, !u.isVerified)} data-testid={`verify-${u.id}`}>
                    {u.isVerified ? <><UserX className="w-3 h-3" /> Снять верификацию</> : <><UserCheck className="w-3 h-3" /> Верифицировать</>}
                  </Button>
                  <Button size="sm" variant="secondary" className={`h-7 text-[11px] gap-1 ${u.isBanned ? "text-green-400" : "text-red-400"}`} onClick={() => handleBan(u.id, !u.isBanned, u.username || u.id)} data-testid={`ban-${u.id}`}>
                    {u.isBanned ? <><CheckCircle className="w-3 h-3" /> Разблокировать</> : <><Ban className="w-3 h-3" /> Заблокировать</>}
                  </Button>
                  <Button size="sm" variant="secondary" className={`h-7 text-[11px] gap-1 ${u.isAdmin ? "text-orange-400" : "text-yellow-400"}`} onClick={() => handleSetRole(u.id, !u.isAdmin)}>
                    <Crown className="w-3 h-3" /> {u.isAdmin ? "Снять админа" : "Дать права"}
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 text-[11px] gap-1" onClick={() => { setShowBalanceModal(u.id); setBalanceAmount(""); setBalanceDesc(""); }}>
                    <DollarSign className="w-3 h-3" /> Баланс
                  </Button>
                </div>

                {/* Balance modal inline */}
                {showBalanceModal === u.id && (
                  <div className="mt-3 pt-3 border-t border-border/30 flex flex-col gap-2">
                    <div className="flex gap-1.5">
                      <button onClick={() => setBalanceType("add")} className={`flex-1 text-xs py-1.5 rounded-lg border ${balanceType === "add" ? "bg-green-600/20 border-green-500/40 text-green-400" : "border-border text-muted-foreground"}`}>
                        <PlusCircle className="w-3 h-3 inline mr-1" /> Пополнить
                      </button>
                      <button onClick={() => setBalanceType("deduct")} className={`flex-1 text-xs py-1.5 rounded-lg border ${balanceType === "deduct" ? "bg-red-600/20 border-red-500/40 text-red-400" : "border-border text-muted-foreground"}`}>
                        <MinusCircle className="w-3 h-3 inline mr-1" /> Списать
                      </button>
                    </div>
                    <Input value={balanceAmount} onChange={(e) => setBalanceAmount(e.target.value)} placeholder="Сумма (₽)" type="number" min="0" />
                    <Input value={balanceDesc} onChange={(e) => setBalanceDesc(e.target.value)} placeholder="Причина (опционально)" />
                    <div className="flex gap-2">
                      <Button size="sm" className={`flex-1 text-xs ${balanceType === "add" ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90"}`}
                        onClick={() => handleAdjustBalance(u.id)} disabled={adjustBalance.isPending}
                      >
                        {adjustBalance.isPending ? "..." : `${balanceType === "add" ? "Пополнить" : "Списать"}`}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowBalanceModal(null)}>Отмена</Button>
                    </div>
                  </div>
                )}

                {/* User detail panel */}
                {selectedUserId === u.id && selectedUserData && (
                  <div className="mt-3 pt-3 border-t border-border/30 text-[11px] text-muted-foreground grid grid-cols-2 gap-1.5">
                    <div>Пополнено: {Number(selectedUserData.totalDeposited || 0).toLocaleString()} ₽</div>
                    <div>Выведено: {Number(selectedUserData.totalWithdrawn || 0).toLocaleString()} ₽</div>
                    <div>Оборот: {Number(selectedUserData.totalVolume || 0).toLocaleString()} ₽</div>
                    <div>Покупок: {selectedUserData.totalPurchases}</div>
                    <div>Сделок (покупатель): {selectedUserData.buyerDeals}</div>
                    <div>Сделок (продавец): {selectedUserData.sellerDeals}</div>
                    <div className="col-span-2">Рейтинг: {selectedUserData.rating} ({selectedUserData.reviewCount} отзывов)</div>
                    {selectedUserData.recentTransactions?.length > 0 && (
                      <div className="col-span-2 mt-1">
                        <div className="font-medium text-foreground mb-1">Последние транзакции:</div>
                        {(selectedUserData.recentTransactions as any[]).slice(0, 5).map((tx: any) => (
                          <div key={tx.id} className="flex justify-between py-0.5 border-b border-border/20">
                            <span>{tx.type}</span>
                            <span className={tx.type.includes("credit") || tx.type === "refund" || tx.type === "sale_revenue" ? "text-green-400" : "text-red-400"}>
                              {tx.type === "admin_deduct" || tx.type === "withdrawal" ? "-" : "+"}{Number(tx.amount).toLocaleString()} ₽
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!usersLoading && usersData?.users?.length === 0 && <EmptyState text="Пользователи не найдены" />}
            {usersData && <div className="text-center text-xs text-muted-foreground py-2">Всего: {usersData.total}</div>}
          </div>
        )}

        {/* ── PRODUCTS ──────────────────────────────────────────────────── */}
        {tab === "products" && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {["", "active", "pending", "rejected", "hidden"].map((s) => (
                <button key={s} onClick={() => setProductStatusFilter(s)}
                  className={`text-xs px-3 py-1 rounded-full border shrink-0 ${productStatusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                >
                  {s === "" ? "Все" : s === "active" ? "Активные" : s === "pending" ? "На модерации" : s === "rejected" ? "Отклонённые" : "Скрытые"}
                </button>
              ))}
            </div>
            {productsData?.products?.map((p) => (
              <div key={p.id} className="bg-card rounded-xl border border-border/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{p.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {Number(p.price).toLocaleString()} ₽ · {(p as any).sellerUsername || (p as any).seller?.username} · {p.views} просм · продано {p.soldCount}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColor(p.status || "")}`}>{p.status}</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <Button size="sm" variant="secondary" className="h-7 text-[11px] gap-1 text-green-400" onClick={() => handleModerate(p.id, "active")}>
                    <CheckCircle className="w-3 h-3" /> Активировать
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 text-[11px] gap-1 text-gray-400" onClick={() => handleModerate(p.id, "hidden")}>
                    <Eye className="w-3 h-3" /> Скрыть
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 text-[11px] gap-1 text-orange-400" onClick={() => handleModerate(p.id, "rejected")}>
                    <X className="w-3 h-3" /> Отклонить
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-[11px] gap-1" onClick={() => handleDeleteProduct(p.id)}>
                    <Trash2 className="w-3 h-3" /> Удалить
                  </Button>
                </div>
              </div>
            ))}
            {productsData?.products?.length === 0 && <EmptyState text="Товары не найдены" />}
          </div>
        )}

        {/* ── DEALS ─────────────────────────────────────────────────────── */}
        {tab === "deals" && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {["", "disputed", "pending", "completed", "cancelled"].map((s) => (
                <button key={s} onClick={() => setDealStatusFilter(s)}
                  className={`text-xs px-3 py-1 rounded-full border shrink-0 ${dealStatusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                >
                  {s === "" ? "Все" : s === "disputed" ? "Споры" : s === "pending" ? "Ожидают" : s === "completed" ? "Завершены" : "Отменены"}
                </button>
              ))}
            </div>
            {dealsData?.deals?.map((d) => (
              <div key={d.id} className="bg-card rounded-xl border border-border/30 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-sm">Сделка #{d.dealNumber}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColor(d.status || "")}`}>{d.status}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mb-2">
                  {(d as any).buyer?.username} → {(d as any).seller?.username} · {Number(d.amount).toLocaleString()} ₽
                  {d.disputeReason && <div className="mt-0.5 text-orange-400">Причина: {d.disputeReason}</div>}
                  {d.adminComment && <div className="mt-0.5 text-primary">Комментарий: {d.adminComment}</div>}
                </div>
                {(d.status === "disputed" || d.status === "pending") && (
                  <Button size="sm" variant="secondary" className="h-7 text-[11px] gap-1 text-primary" onClick={() => { setResolveModal({ dealId: d.id, dealNum: d.dealNumber! }); setResolveComment(""); }}>
                    <Shield className="w-3 h-3" /> Разрешить спор
                  </Button>
                )}
              </div>
            ))}
            {dealsData?.deals?.length === 0 && <EmptyState text="Сделки не найдены" />}
          </div>
        )}

        {/* ── WITHDRAWALS ───────────────────────────────────────────────── */}
        {tab === "withdrawals" && (
          <div className="flex flex-col gap-3">
            {withdrawals?.map((w) => (
              <div key={w.id} className="bg-card rounded-xl border border-border/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{Number(w.amount).toLocaleString()} ₽</div>
                    <div className="text-[10px] text-muted-foreground">
                      {(w as any).user?.username} · {(w as any).withdrawMethod} · {w.withdrawDetails}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{w.description}</div>
                  </div>
                </div>
                <Input
                  value={withdrawNote[w.id] || ""}
                  onChange={(e) => setWithdrawNote((prev) => ({ ...prev, [w.id]: e.target.value }))}
                  placeholder="Примечание (опционально)"
                  className="h-7 text-xs mb-2"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 text-xs h-7 bg-green-600 hover:bg-green-700" onClick={() => handleWithdrawal(w.id, "approve")} disabled={processWithdrawal.isPending}>
                    <CheckCircle className="w-3 h-3 mr-1" /> Одобрить
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1 text-xs h-7" onClick={() => handleWithdrawal(w.id, "reject")} disabled={processWithdrawal.isPending}>
                    <X className="w-3 h-3 mr-1" /> Отклонить
                  </Button>
                </div>
              </div>
            ))}
            {(!withdrawals || withdrawals.length === 0) && <EmptyState text="Нет ожидающих выплат" />}
          </div>
        )}

        {/* ── TRANSACTIONS ──────────────────────────────────────────────── */}
        {tab === "transactions" && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {["", "deposit", "withdrawal", "sale_revenue", "refund", "admin_credit", "admin_deduct"].map((s) => (
                <button key={s} onClick={() => setTxTypeFilter(s)}
                  className={`text-xs px-3 py-1 rounded-full border shrink-0 ${txTypeFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                >
                  {s === "" ? "Все" : s}
                </button>
              ))}
            </div>
            {txData?.transactions?.map((tx: any) => (
              <div key={tx.id} className="bg-card rounded-xl border border-border/30 p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{Number(tx.amount).toLocaleString()} ₽</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor(tx.status)}`}>{tx.status}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{tx.username} · {tx.type}</div>
                  {tx.description && <div className="text-[10px] text-muted-foreground truncate">{tx.description}</div>}
                </div>
                <div className="text-[10px] text-muted-foreground shrink-0">{new Date(tx.createdAt * 1000).toLocaleDateString("ru")}</div>
              </div>
            ))}
            {txData?.transactions?.length === 0 && <EmptyState text="Транзакции не найдены" />}
            {txData && <div className="text-center text-xs text-muted-foreground py-2">Всего: {txData.total}</div>}
          </div>
        )}

        {/* ── REVIEWS ───────────────────────────────────────────────────── */}
        {tab === "reviews" && (
          <div className="flex flex-col gap-3">
            {reviewsData?.reviews?.map((r: any) => (
              <div key={r.id} className="bg-card rounded-xl border border-border/30 p-3 flex gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="flex">
                      {Array(5).fill(0).map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < r.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">от {r.reviewer?.username} → {r.seller?.username}</span>
                  </div>
                  {r.comment && <div className="text-xs text-muted-foreground line-clamp-2">{r.comment}</div>}
                </div>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0 text-red-400" onClick={() => {
                  if (!confirm("Удалить отзыв?")) return;
                  deleteReview.mutate({ id: r.id }, {
                    onSuccess: () => { invalidate([getAdminListReviewsQueryKey({})]); toast({ title: "Отзыв удалён" }); },
                    onError: () => toast({ title: "Ошибка", variant: "destructive" }),
                  });
                }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            {reviewsData?.reviews?.length === 0 && <EmptyState text="Отзывы не найдены" />}
            {reviewsData && <div className="text-center text-xs text-muted-foreground py-2">Всего: {reviewsData.total}</div>}
          </div>
        )}

        {/* ── CATEGORIES ────────────────────────────────────────────────── */}
        {tab === "categories" && (
          <div className="flex flex-col gap-3">
            <div className="bg-card rounded-xl border border-border/30 p-3 flex flex-col gap-2">
              <div className="text-xs font-semibold text-muted-foreground">Добавить категорию</div>
              <div className="flex gap-2">
                <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Название" className="flex-1" data-testid="input-cat-name" />
                <Input value={newCatSlug} onChange={(e) => setNewCatSlug(e.target.value)} placeholder="slug" className="flex-1" data-testid="input-cat-slug" />
              </div>
              <div className="flex gap-2">
                <Input value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} placeholder="Иконка (emoji или URL)" className="flex-1" />
                <Button size="sm" onClick={handleCreateCat} disabled={createCategory.isPending} data-testid="button-add-cat">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {categories?.map((c) => (
              <div key={c.id} className="bg-card rounded-xl border border-border/30 p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm flex items-center gap-1.5">
                    {c.icon && <span>{c.icon}</span>}
                    {c.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{c.slug} · sortOrder: {c.sortOrder}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={c.isActive ? "default" : "secondary"} className="text-[10px]">
                    {c.isActive ? "Активна" : "Скрыта"}
                  </Badge>
                  <Button size="sm" variant="secondary" className="h-7 text-[11px]" onClick={() => updateCategory.mutate({ id: c.id, data: { isActive: !c.isActive } as any }, { onSuccess: () => invalidate([getGetCategoriesQueryKey()]) })}>
                    {c.isActive ? "Скрыть" : "Показать"}
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 w-7 p-0" onClick={() => {
                    if (!confirm("Удалить категорию?")) return;
                    deleteCategory.mutate({ id: c.id }, { onSuccess: () => { invalidate([getGetCategoriesQueryKey()]); toast({ title: "Категория удалена" }); } });
                  }} data-testid={`delete-cat-${c.id}`}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RESOLVE DEAL MODAL ──────────────────────────────────────────── */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setResolveModal(null)}>
          <div className="bg-card rounded-t-2xl p-5 w-full max-w-md border-t border-border/30" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-1">Разрешить сделку #{resolveModal.dealNum}</h3>
            <p className="text-xs text-muted-foreground mb-3">Выберите решение по спору</p>
            <Input value={resolveComment} onChange={(e) => setResolveComment(e.target.value)} placeholder="Комментарий администратора" className="mb-3" />
            <div className="flex flex-col gap-2">
              <Button variant="secondary" className="text-green-400 justify-start" onClick={() => handleResolve("refund_buyer")} disabled={resolveDeal.isPending}>
                <CheckCircle className="w-4 h-4 mr-2" /> Вернуть деньги покупателю
              </Button>
              <Button variant="secondary" className="text-blue-400 justify-start" onClick={() => handleResolve("pay_seller")} disabled={resolveDeal.isPending}>
                <DollarSign className="w-4 h-4 mr-2" /> Перевести продавцу
              </Button>
              <Button variant="secondary" className="text-yellow-400 justify-start" onClick={() => handleResolve("split")} disabled={resolveDeal.isPending}>
                <Shield className="w-4 h-4 mr-2" /> Разделить поровну (50/50)
              </Button>
            </div>
            <Button variant="ghost" className="w-full mt-2 text-muted-foreground" onClick={() => setResolveModal(null)}>Отмена</Button>
          </div>
        </div>
      )}

      {/* ── BAN MODAL ──────────────────────────────────────────────────── */}
      {banModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setBanModal(null)}>
          <div className="bg-card rounded-t-2xl p-5 w-full max-w-md border-t border-border/30" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-1 flex items-center gap-2 text-red-400"><Ban className="w-4 h-4" /> Блокировка @{banModal.username}</h3>
            <p className="text-xs text-muted-foreground mb-3">Укажите причину и срок блокировки</p>
            <div className="flex flex-col gap-2">
              <Label>Причина</Label>
              <Input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Нарушение правил платформы" />
              <Label>Срок (часов, пусто = бессрочно)</Label>
              <Input type="number" value={banHours} onChange={(e) => setBanHours(e.target.value)} placeholder="Оставьте пустым для бессрочной блокировки" min="1" />
              <Button variant="destructive" className="w-full mt-1" onClick={handleBanConfirm} disabled={banUser.isPending}>
                {banUser.isPending ? "Блокировка..." : "Заблокировать"}
              </Button>
            </div>
            <Button variant="ghost" className="w-full mt-2 text-muted-foreground" onClick={() => setBanModal(null)}>Отмена</Button>
          </div>
        </div>
      )}

      {/* ── BROADCAST MODAL ─────────────────────────────────────────────── */}
      {broadcastModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setBroadcastModal(false)}>
          <div className="bg-card rounded-t-2xl p-5 w-full max-w-md border-t border-border/30" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-1 flex items-center gap-2"><Send className="w-4 h-4" /> Рассылка сообщений</h3>
            <p className="text-xs text-muted-foreground mb-3">Оставьте "ID пользователя" пустым для рассылки всем</p>
            <div className="flex flex-col gap-2">
              <Input value={broadcastTarget} onChange={(e) => setBroadcastTarget(e.target.value)} placeholder="ID пользователя (опционально)" />
              <textarea
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Текст сообщения..."
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button onClick={handleBroadcast} disabled={broadcast.isPending} className="w-full gap-2">
                <Send className="w-4 h-4" /> {broadcast.isPending ? "Отправка..." : "Отправить"}
              </Button>
            </div>
            <Button variant="ghost" className="w-full mt-2 text-muted-foreground" onClick={() => setBroadcastModal(false)}>Отмена</Button>
          </div>
        </div>
      )}
    </div>
  );
}
