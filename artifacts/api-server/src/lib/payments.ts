import { logger } from "./logger";

interface PaymentResult {
  orderId: string;
  payUrl: string;
}

export async function createRukassaPayment(amount: number, orderId: string, description: string): Promise<PaymentResult | null> {
  const apiKey = process.env.RUKASSA_API_KEY;
  const shopId = process.env.RUKASSA_SHOP_ID;
  if (!apiKey || !shopId) {
    logger.warn("Rukassa not configured");
    return null;
  }
  try {
    const res = await fetch("https://lk.rukassa.is/api/v1/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shop_id: shopId,
        token: apiKey,
        order_id: orderId,
        amount: amount.toString(),
        description,
      }),
    });
    const data = await res.json() as Record<string, unknown>;
    if (typeof data.url === "string") return { orderId, payUrl: data.url };
    logger.error(data, "Rukassa error");
    return null;
  } catch (err) {
    logger.error(err, "Rukassa request failed");
    return null;
  }
}

export async function createNowPayment(amount: number, orderId: string, description: string): Promise<PaymentResult | null> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    logger.warn("NOWPayments not configured");
    return null;
  }
  try {
    const res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: "rub",
        order_id: orderId,
        order_description: description,
        success_url: process.env.APP_URL || "",
        cancel_url: process.env.APP_URL || "",
      }),
    });
    const data = await res.json() as Record<string, unknown>;
    if (typeof data.invoice_url === "string") return { orderId, payUrl: data.invoice_url };
    return null;
  } catch (err) {
    logger.error(err, "NOWPayments request failed");
    return null;
  }
}

export async function createCrystalPayPayment(amount: number, orderId: string, description: string): Promise<PaymentResult | null> {
  const apiKey = process.env.CRYSTALPAY_API_KEY;
  const shopName = process.env.CRYSTALPAY_SHOP_NAME;
  if (!apiKey || !shopName) {
    logger.warn("CrystalPay not configured");
    return null;
  }
  try {
    const res = await fetch("https://api.crystalpay.io/v2/invoice/create/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_login: shopName,
        auth_secret: apiKey,
        amount,
        type: "purchase",
        description,
        extra: orderId,
        lifetime: 3600,
      }),
    });
    const data = await res.json() as Record<string, unknown>;
    if (typeof data.url === "string") return { orderId, payUrl: data.url };
    return null;
  } catch (err) {
    logger.error(err, "CrystalPay request failed");
    return null;
  }
}

export async function createPayment(gateway: string, amount: number, orderId: string, description: string): Promise<PaymentResult | null> {
  switch (gateway) {
    case "rukassa": return createRukassaPayment(amount, orderId, description);
    case "nowpayments": return createNowPayment(amount, orderId, description);
    case "crystalpay": return createCrystalPayPayment(amount, orderId, description);
    default: return null;
  }
}
