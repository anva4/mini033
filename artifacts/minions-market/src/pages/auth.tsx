import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin, useRegister, useRequestAuthCode, useTelegramAuth } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Gamepad2, Send, Shield } from "lucide-react";
import { useEffect } from "react";

export default function AuthPage() {
  const { t } = useLang();
  const { setAuth, isAuthenticated, isTelegramMiniApp, isTelegramLoading, setTelegramLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [directMessageSent, setDirectMessageSent] = useState(false);

  useEffect(() => {
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((data) => { if (data.botUsername) setBotUsername(data.botUsername); })
      .catch(() => {});
  }, []);

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const requestCodeMutation = useRequestAuthCode();
  const telegramAuthMutation = useTelegramAuth();

  // Редирект если уже залогинен
  useEffect(() => {
    if (isAuthenticated) setLocation("/");
  }, [isAuthenticated, setLocation]);

  // Авто-вход через TG initData
  useEffect(() => {
    if (!isTelegramMiniApp) {
      setTelegramLoading(false);
      return;
    }
    const initData = (window as any).Telegram?.WebApp?.initData;
    if (!initData || initData.length === 0) {
      setTelegramLoading(false);
      return;
    }
    telegramAuthMutation.mutate({ data: { initData } }, {
      onSuccess: (res) => {
        setAuth(res.token, res.user);
        setTelegramLoading(false);
        toast({ title: t("loginSuccess") });
        setLocation("/");
      },
      onError: () => {
        setTelegramLoading(false);
        toast({ title: t("error"), variant: "destructive" });
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTelegramMiniApp]);

  const handleRequestCode = () => {
    if (!telegramUsername.trim()) return;
    const normalizedUsername = telegramUsername.trim().replace(/^@/, "").toLowerCase();
    requestCodeMutation.mutate({ data: { telegramUsername: normalizedUsername } }, {
      onSuccess: (res) => {
        setCodeSent(true);
        const bot = (res as any).botUsername || botUsername;
        if (bot) setBotUsername(bot);
        if ((res as any).directMessageSent) {
          setDirectMessageSent(true);
        } else if (bot) {
          window.open(`https://t.me/${bot}?start=${normalizedUsername}`, "_blank");
        }
        toast({ title: t("codeSent") });
      },
      onError: () => toast({ title: t("error"), variant: "destructive" }),
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { username, password } }, {
      onSuccess: (res) => {
        setAuth(res.token, res.user);
        toast({ title: t("loginSuccess") });
        setLocation("/");
      },
      onError: () => toast({ title: t("error"), variant: "destructive" }),
    });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedUsername = telegramUsername.trim().replace(/^@/, "").toLowerCase();
    registerMutation.mutate({ data: { username, password, code, telegramUsername: normalizedUsername } }, {
      onSuccess: (res) => {
        setAuth(res.token, res.user);
        toast({ title: t("registerSuccess") });
        setLocation("/");
      },
      onError: () => toast({ title: t("error"), variant: "destructive" }),
    });
  };

  // Показываем спиннер пока идёт TG авто-вход
  if (isTelegramLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Minions Market</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("secureDeal")}</p>
        </div>

        <div className="flex gap-2 mb-6 bg-card rounded-xl p-1">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            data-testid="tab-login"
          >
            {t("login")}
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            data-testid="tab-register"
          >
            {t("register")}
          </button>
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>{t("username")}</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("username")} data-testid="input-username" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t("password")}</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("password")} data-testid="input-password" />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loginMutation.isPending} data-testid="button-login">
              {loginMutation.isPending ? t("loading") : t("login")}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-card rounded-xl p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Send className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">{t("telegramBot")}</span>
                {botUsername && (
                  <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-xs text-primary underline"
                  >
                    @{botUsername}
                  </a>
                )}
              </div>
              {botUsername && !codeSent && (
                <p className="text-xs text-muted-foreground mb-2">
                  Введите ваш @username и нажмите «Получить код». Код придёт от бота <b>@{botUsername}</b> в Telegram.
                </p>
              )}
              <div className="flex flex-col gap-2">
                <Input
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                  placeholder="@username"
                  data-testid="input-tg-username"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRequestCode}
                  disabled={requestCodeMutation.isPending || !telegramUsername.trim()}
                  data-testid="button-request-code"
                >
                  {requestCodeMutation.isPending ? t("loading") : t("requestCode")}
                </Button>
              </div>
              {codeSent && (
                <div className="mt-2 flex flex-col gap-1">
                  {directMessageSent ? (
                    <p className="text-xs text-success flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Код отправлен вам в Telegram — проверьте личные сообщения от бота.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-success flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Бот открыт — проверьте Telegram, там уже есть код.
                      </p>
                      {botUsername && (
                        <a
                          href={`https://t.me/${botUsername}?start=${telegramUsername.replace(/^@/, "").toLowerCase()}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" /> Открыть @{botUsername} снова
                        </a>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("authCode")} data-testid="input-code" />
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("username")} data-testid="input-reg-username" />
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("password")} data-testid="input-reg-password" />
              <Button type="submit" className="w-full h-11" disabled={registerMutation.isPending || !codeSent || !code.trim() || !username.trim() || !password.trim()} data-testid="button-register">
                {registerMutation.isPending ? t("loading") : t("register")}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
