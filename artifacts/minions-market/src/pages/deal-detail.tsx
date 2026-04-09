import { useRoute, useLocation } from "wouter";
import { useGetDeal, getGetDealQueryKey, useConfirmDeal, useDeliverDeal, useDisputeDeal, useLeaveDealReview } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Shield, Star, AlertTriangle, Check, Send, Copy } from "lucide-react";
import { useState } from "react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  paid: "bg-blue-500/20 text-blue-400",
  delivered: "bg-purple-500/20 text-purple-400",
  completed: "bg-green-500/20 text-green-400",
  disputed: "bg-red-500/20 text-red-400",
  cancelled: "bg-gray-500/20 text-gray-400",
  refunded: "bg-orange-500/20 text-orange-400",
};

export default function DealDetailPage() {
  const [, params] = useRoute("/deal/:id");
  const id = params?.id || "";
  const { t } = useLang();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [deliveryInput, setDeliveryInput] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [showReview, setShowReview] = useState(false);

  const { data: deal, isLoading } = useGetDeal(id, { query: { enabled: !!id, queryKey: getGetDealQueryKey(id) } });
  const confirmDeal = useConfirmDeal();
  const deliverDeal = useDeliverDeal();
  const disputeDealMut = useDisputeDeal();
  const leaveReview = useLeaveDealReview();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetDealQueryKey(id) });

  if (isLoading) return <div className="p-4"><Skeleton className="h-64" /></div>;
  if (!deal) return <div className="p-4 text-center text-muted-foreground">{t("error")}</div>;

  const isBuyer = user?.id === deal.buyerId;
  const isSeller = user?.id === deal.sellerId;

  return (
    <div className="flex flex-col pb-6">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="font-bold">{t("dealNumber")}{deal.dealNumber}</h1>
        <Badge className={`ml-auto text-xs border-0 ${statusColors[deal.status]}`}>{t(deal.status)}</Badge>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="bg-card rounded-xl border border-border/30 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("amount")}</span>
            <span className="text-xl font-bold text-primary">{Number(deal.amount).toLocaleString()} ₽</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("commission")}</span>
            <span>{Number(deal.commission).toLocaleString()} ₽</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("seller")}</span>
            <span className="font-medium">{deal.seller?.username}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("buyer")}</span>
            <span className="font-medium">{deal.buyer?.username}</span>
          </div>
          {deal.product && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t("title")}</span>
              <span className="font-medium truncate ml-4">{deal.product.title}</span>
            </div>
          )}
        </div>

        {deal.deliveryData && isBuyer && (
          <div className="bg-card rounded-xl border border-green-500/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-green-400">{t("delivered")}</span>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(deal.deliveryData || ""); toast({ title: "Copied" }); }}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-background/50 rounded-lg p-3">{deal.deliveryData}</pre>
          </div>
        )}

        {isSeller && deal.status === "paid" && (
          <div className="bg-card rounded-xl border border-border/30 p-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{t("deliver")}</h3>
            <Textarea value={deliveryInput} onChange={(e) => setDeliveryInput(e.target.value)} placeholder="Account data, keys, etc." data-testid="input-delivery" />
            <Button
              onClick={() => deliverDeal.mutate({ id, data: { deliveryData: deliveryInput } }, { onSuccess: invalidate })}
              disabled={deliverDeal.isPending || !deliveryInput.trim()}
              data-testid="button-deliver"
            >
              <Send className="w-4 h-4 mr-1" /> {t("deliver")}
            </Button>
          </div>
        )}

        {isBuyer && deal.status === "delivered" && (
          <div className="flex gap-2">
            <Button
              className="flex-1 gradient-primary border-0"
              onClick={() => confirmDeal.mutate({ id }, { onSuccess: invalidate })}
              disabled={confirmDeal.isPending}
              data-testid="button-confirm"
            >
              <Check className="w-4 h-4 mr-1" /> {t("confirm")}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                disputeDealMut.mutate({ id, data: { reason: disputeReason } }, { onSuccess: invalidate });
              }}
              disabled={disputeDealMut.isPending || !disputeReason.trim()}
              data-testid="button-dispute"
            >
              <AlertTriangle className="w-4 h-4 mr-1" /> {t("dispute")}
            </Button>
          </div>
        )}

        {isBuyer && deal.status === "delivered" && (
          <Input value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder={t("dispute") + " reason"} data-testid="input-dispute-reason" />
        )}

        {deal.status === "completed" && isBuyer && (
          <div className="bg-card rounded-xl border border-border/30 p-4 flex flex-col gap-3">
            {!showReview ? (
              <Button variant="secondary" onClick={() => setShowReview(true)} data-testid="button-show-review">
                <Star className="w-4 h-4 mr-1" /> {t("leaveReview")}
              </Button>
            ) : (
              <>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setReviewRating(s)}>
                      <Star className={`w-6 h-6 ${s <= reviewRating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                    </button>
                  ))}
                </div>
                <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder={t("comment")} data-testid="input-review-comment" />
                <Button
                  onClick={() => leaveReview.mutate({ id, data: { rating: reviewRating, comment: reviewComment || undefined } }, {
                    onSuccess: () => { toast({ title: t("reviewSent") }); setShowReview(false); invalidate(); },
                  })}
                  disabled={leaveReview.isPending}
                  data-testid="button-submit-review"
                >
                  {t("send")}
                </Button>
              </>
            )}
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1 pt-4">
          <Shield className="w-3.5 h-3.5 text-green-400" /> {t("secureDeal")}
        </div>
      </div>
    </div>
  );
}
