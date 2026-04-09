import { useState } from "react";
import { useLocation } from "wouter";
import { useGetWalletBalance, getGetWalletBalanceQueryKey, useCreateDeposit, useCreateWithdraw, useListTransactions, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Plus, Minus } from "lucide-react";

export default function WalletPage() {
  const { t } = useLang();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [depositAmount, setDepositAmount] = useState("");
  const [depositGateway, setDepositGateway] = useState("rukassa");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("");
  const [withdrawDetails, setWithdrawDetails] = useState("");
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  // FIX: все хуки вызываются ДО условного return (Rules of Hooks)
  const { data: balance, isLoading: balLoading } = useGetWalletBalance({
    query: { enabled: isAuthenticated, queryKey: getGetWalletBalanceQueryKey() },
  });
  const { data: txData, isLoading: txLoading } = useListTransactions(
    {},
    { query: { enabled: isAuthenticated, queryKey: getListTransactionsQueryKey({}) } },
  );
  const depositMut = useCreateDeposit();
  const withdrawMut = useCreateWithdraw();

  // FIX: условный return ПОСЛЕ всех хуков
  if (!isAuthenticated) {
    setLocation("/auth");
    return null;
  }

  const handleDeposit = () => {
    if (!depositAmount || parseFloat(depositAmount) < 10) return;
    depositMut.mutate({ data: { amount: parseFloat(depositAmount), gateway: depositGateway as any } }, {
      onSuccess: (res) => {
        toast({ title: t("depositCreated") });
        // FIX: сбрасываем сумму после успешного депозита
        setDepositAmount("");
        setShowDeposit(false);
        queryClient.invalidateQueries({ queryKey: getGetWalletBalanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey({}) });
        if (res.payUrl) window.open(res.payUrl, "_blank");
      },
      onError: () => toast({ title: t("error"), variant: "destructive" }),
    });
  };

  const handleWithdraw = () => {
    if (!withdrawAmount || !withdrawMethod || !withdrawDetails) return;
    withdrawMut.mutate({ data: { amount: parseFloat(withdrawAmount), method: withdrawMethod, details: withdrawDetails } }, {
      onSuccess: () => {
        toast({ title: t("withdrawCreated") });
        // FIX: сбрасываем поля после успешного вывода
        setWithdrawAmount("");
        setWithdrawMethod("");
        setWithdrawDetails("");
        setShowWithdraw(false);
        queryClient.invalidateQueries({ queryKey: getGetWalletBalanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey({}) });
      },
      onError: () => toast({ title: t("error"), variant: "destructive" }),
    });
  };

  const txTypeIcons: Record<string, { icon: typeof Plus; color: string; sign: string }> = {
    deposit: { icon: ArrowDownLeft, color: "text-green-400", sign: "+" },
    sale_revenue: { icon: ArrowDownLeft, color: "text-green-400", sign: "+" },
    withdrawal: { icon: ArrowUpRight, color: "text-foreground", sign: "-" },
    purchase: { icon: ArrowUpRight, color: "text-foreground", sign: "-" },
    commission: { icon: ArrowUpRight, color: "text-yellow-400", sign: "-" },
    refund: { icon: ArrowDownLeft, color: "text-blue-400", sign: "+" },
  };

  return (
    <div className="flex flex-col pb-4">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="font-bold">{t("wallet")}</h1>
      </div>

      <div className="gradient-primary mx-4 mt-4 rounded-2xl p-5">
        {balLoading ? <Skeleton className="h-12 w-32" /> : (
          <>
            <div className="text-white/60 text-xs mb-1">{t("balance")}</div>
            <div className="text-3xl font-bold text-white">{Number(balance?.balance || 0).toLocaleString()} ₽</div>
            {(balance?.frozenBalance ?? 0) > 0 && (
              <div className="text-white/50 text-xs mt-1">{t("frozen")}: {Number(balance?.frozenBalance).toLocaleString()} ₽</div>
            )}
          </>
        )}
        <div className="flex gap-2 mt-4">
          <Dialog open={showDeposit} onOpenChange={setShowDeposit}>
            <DialogTrigger asChild>
              <Button className="flex-1 bg-white/20 hover:bg-white/30 border-0 text-white" data-testid="button-open-deposit">
                <Plus className="w-4 h-4 mr-1" /> {t("deposit")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>{t("deposit")}</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex flex-col gap-2">
                  <Label>{t("amount")} (₽)</Label>
                  <Input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="100" min="10" data-testid="input-deposit-amount" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("paymentMethod")}</Label>
                  <Select value={depositGateway} onValueChange={setDepositGateway}>
                    <SelectTrigger data-testid="select-gateway"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rukassa">Rukassa (Card/SBP)</SelectItem>
                      <SelectItem value="nowpayments">NOWPayments (Crypto)</SelectItem>
                      <SelectItem value="crystalpay">CrystalPay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleDeposit} disabled={depositMut.isPending} className="gradient-primary border-0" data-testid="button-deposit">
                  {depositMut.isPending ? t("loading") : t("deposit")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
            <DialogTrigger asChild>
              <Button className="flex-1 bg-white/20 hover:bg-white/30 border-0 text-white" data-testid="button-open-withdraw">
                <Minus className="w-4 h-4 mr-1" /> {t("withdraw")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>{t("withdraw")}</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-3 pt-2">
                <div className="flex flex-col gap-2">
                  <Label>{t("amount")} (₽)</Label>
                  <Input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="100" min="100" data-testid="input-withdraw-amount" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("withdrawMethod")}</Label>
                  <Select value={withdrawMethod} onValueChange={setWithdrawMethod}>
                    <SelectTrigger data-testid="select-withdraw-method"><SelectValue placeholder={t("withdrawMethod")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="card">Bank Card</SelectItem>
                      <SelectItem value="sbp">SBP</SelectItem>
                      <SelectItem value="qiwi">QIWI</SelectItem>
                      <SelectItem value="crypto">Crypto (USDT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("withdrawDetails")}</Label>
                  <Input value={withdrawDetails} onChange={(e) => setWithdrawDetails(e.target.value)} placeholder="Card number / wallet" data-testid="input-withdraw-details" />
                </div>
                <Button onClick={handleWithdraw} disabled={withdrawMut.isPending} className="gradient-primary border-0" data-testid="button-withdraw">
                  {withdrawMut.isPending ? t("loading") : t("withdraw")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!balLoading && balance && (
        <div className="grid grid-cols-3 gap-2 px-4 mt-4">
          <div className="bg-card rounded-xl p-3 border border-border/30 text-center">
            <div className="text-xs text-muted-foreground">{t("totalDeposited")}</div>
            <div className="text-sm font-bold mt-0.5">{Number(balance.totalDeposited || 0).toLocaleString()} ₽</div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border/30 text-center">
            <div className="text-xs text-muted-foreground">{t("totalWithdrawn")}</div>
            <div className="text-sm font-bold mt-0.5">{Number(balance.totalWithdrawn || 0).toLocaleString()} ₽</div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border/30 text-center">
            <div className="text-xs text-muted-foreground">{t("totalEarned")}</div>
            <div className="text-sm font-bold mt-0.5">{Number(balance.totalEarned || 0).toLocaleString()} ₽</div>
          </div>
        </div>
      )}

      <div className="px-4 mt-6">
        <h2 className="font-bold mb-3">{t("transactions")}</h2>
        <div className="flex flex-col gap-2">
          {txLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />) :
            txData?.transactions?.map((tx) => {
              const info = txTypeIcons[tx.type] || { icon: ArrowUpRight, color: "text-foreground", sign: "" };
              const Icon = info.icon;
              return (
                <div key={tx.id} className="bg-card rounded-xl border border-border/30 p-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full bg-secondary flex items-center justify-center ${info.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium capitalize">{tx.type.replace("_", " ")}</div>
                    <div className="text-[10px] text-muted-foreground">{tx.description}</div>
                  </div>
                  <div className={`font-bold text-sm ${info.color}`}>
                    {info.sign}{Number(tx.amount).toLocaleString()} ₽
                  </div>
                </div>
              );
            })
          }
          {!txLoading && (!txData?.transactions || txData.transactions.length === 0) && (
            <div className="text-center py-8 text-muted-foreground text-sm">{t("noTransactions")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
