import { ArrowLeft, Mail, Phone, MapPin, Globe, Shield, CreditCard, FileText } from "lucide-react";

export default function LegalPage() {
  return (
    <div className="flex flex-col pb-8">
      <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 glass border-b border-border/30">
        <button onClick={() => window.history.back()} className="p-1 -ml-1 rounded-lg hover:bg-secondary transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold">Правовая информация</h1>
      </div>

      <div className="flex flex-col gap-4 p-4">

        {/* Реквизиты */}
        <div className="bg-card rounded-xl border border-border/30 p-4 flex flex-col gap-3">
          <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> О компании</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Globe className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Minions Market</p>
                <p className="text-muted-foreground">Игровой маркетплейс</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Адрес</p>
                <p className="text-muted-foreground">г. Ташкент, Узбекистан</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Mail className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Email</p>
                <a href="mailto:anvarikromov778@gmail.com" className="text-primary hover:underline">anvarikromov778@gmail.com</a>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Telegram</p>
                <a href="https://t.me/for_ewer0721" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@for_ewer0721</a>
              </div>
            </div>
          </div>
        </div>

        {/* Способы оплаты */}
        <div className="bg-card rounded-xl border border-border/30 p-4 flex flex-col gap-3">
          <h2 className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> Способы оплаты</h2>
          <p className="text-sm text-muted-foreground">Мы принимаем платежи через следующие платёжные системы:</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <span className="text-blue-400 font-bold text-sm">Ru</span>
              </div>
              <div>
                <p className="font-medium text-sm">RuKassa</p>
                <p className="text-xs text-muted-foreground">Онлайн-касса для платежей</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl">
              <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                <span className="text-green-400 font-bold text-sm">E</span>
              </div>
              <div>
                <p className="font-medium text-sm">Enot.io</p>
                <p className="text-xs text-muted-foreground">Приём платежей онлайн</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl">
              <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <span className="text-orange-400 font-bold text-sm">L</span>
              </div>
              <div>
                <p className="font-medium text-sm">Lava</p>
                <p className="text-xs text-muted-foreground">Платёжный сервис Lava</p>
              </div>
            </div>
          </div>
        </div>

        {/* Пользовательское соглашение */}
        <div className="bg-card rounded-xl border border-border/30 p-4 flex flex-col gap-3">
          <h2 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Пользовательское соглашение</h2>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>1. Используя наш сервис, вы соглашаетесь с настоящими условиями.</p>
            <p>2. Минимальный возраст для использования сервиса — 18 лет.</p>
            <p>3. Запрещено продавать незаконные товары, аккаунты с ворованными данными и мошеннические предложения.</p>
            <p>4. Платформа является посредником между покупателем и продавцом и не несёт ответственности за действия третьих лиц.</p>
            <p>5. Все споры между пользователями решаются через систему диспутов платформы.</p>
            <p>6. Платформа вправе блокировать аккаунты, нарушающие правила.</p>
          </div>
        </div>

        {/* Политика возврата */}
        <div className="bg-card rounded-xl border border-border/30 p-4 flex flex-col gap-3">
          <h2 className="font-semibold">Политика возврата</h2>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Возврат средств возможен в следующих случаях:</p>
            <p>• Товар не был доставлен в течение 3 дней после оплаты</p>
            <p>• Товар не соответствует описанию</p>
            <p>• Продавец не вышел на связь</p>
            <p>Для оформления возврата откройте диспут в разделе «Сделки» или обратитесь в поддержку.</p>
          </div>
        </div>

        {/* Политика конфиденциальности */}
        <div className="bg-card rounded-xl border border-border/30 p-4 flex flex-col gap-3">
          <h2 className="font-semibold">Политика конфиденциальности</h2>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Мы собираем только необходимые данные: имя пользователя, Telegram ID, данные о транзакциях.</p>
            <p>Данные не передаются третьим лицам без вашего согласия, за исключением требований законодательства.</p>
            <p>Вы можете запросить удаление своих данных, обратившись в поддержку.</p>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-2">
          © {new Date().getFullYear()} Minions Market. Все права защищены.
        </p>
      </div>
    </div>
  );
}
