import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Upload, ChevronLeft, CheckCircle2, ArrowLeftRight, Lock, Info, Eye, EyeOff, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useCreateProduct } from "@workspace/api-client-react";
import { PLAYEROK_GAMES, PLAYEROK_MOBILE_GAMES, PLAYEROK_APPS } from "@/data/playerok-categories";

// ─── ТИПЫ ────────────────────────────────────────────────────────────────────

interface SubcategoryDef {
  id: string;
  label: string;
  commission?: boolean;
}

interface TransferMethodDef {
  id: string;
  label: string;
  description: string;
}

interface TraitOption {
  id: string;
  label: string;
}

interface TraitField {
  id: string;
  label: string;
  type: "range" | "select";
  min?: number;
  max?: number;
  options?: TraitOption[];
}

interface DataFieldDef {
  id: string;
  label: string;
  placeholder: string;
  type?: "text" | "password" | "textarea";
}

// ─── STEP WRAPPER — вынесен ЗА пределы компонента ─────────────────────────
// ВАЖНО: если StepWrapper определён внутри SellPage, React при каждом
// setState создаёт новую ссылку на компонент → перемонтирует DOM →
// клавиатура закрывается после первого символа.

interface StepWrapperProps {
  children: React.ReactNode;
  nextDisabled?: boolean;
  nextLabel?: string;
  onNext: () => void;
  step: number;
  selectedItem: any;
  selectedSubcat: SubcategoryDef | null;
  error?: string | null;
}

function StepWrapper({
  children, nextDisabled = false, nextLabel = "Далее", onNext,
  step, selectedItem, selectedSubcat, error,
}: StepWrapperProps) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col min-h-[calc(100vh-140px)]">
      {step >= 2 && selectedItem && (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[#1a2332]">
            <img src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="font-semibold text-sm">{selectedItem.name}</p>
            {selectedSubcat && <p className="text-xs text-gray-400">{selectedSubcat.label}</p>}
          </div>
          {selectedSubcat?.commission && (
            <span className="ml-auto px-2 py-0.5 bg-[#1CB0F6] text-black text-[10px] font-bold rounded-full">10%</span>
          )}
        </div>
      )}

      <div className="flex-1 space-y-3">{children}</div>

      {error && <p className="text-red-400 text-sm text-center py-2">{error}</p>}

      {/* Кнопка поднята выше — добавлен отступ снизу */}
      <div className="pt-4 pb-6">
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className={`w-full py-4 rounded-2xl font-semibold text-sm transition ${
            nextDisabled
              ? "bg-[#1f2a37] text-gray-500 cursor-not-allowed"
              : "bg-[#1CB0F6] text-black hover:bg-[#1aa7ff] active:scale-95"
          }`}
        >
          {nextLabel}
        </button>
      </div>
    </motion.div>
  );
}

// ─── ДАННЫЕ: подкатегории ─────────────────────────────────────────────────────

const SUBCATS_GAME_FULL: SubcategoryDef[] = [
  { id: "accounts",  label: "Аккаунты" },
  { id: "items",     label: "Предметы",      commission: true },
  { id: "currency",  label: "Валюта",        commission: true },
  { id: "boost",     label: "Буст",          commission: true },
  { id: "keys",      label: "Ключи",         commission: true },
  { id: "services",  label: "Услуги",        commission: true },
  { id: "other",     label: "Другое",        commission: true },
];

const SUBCATS_MOBILE: SubcategoryDef[] = [
  { id: "accounts",  label: "Аккаунты" },
  { id: "currency",  label: "Валюта",        commission: true },
  { id: "boost",     label: "Буст",          commission: true },
  { id: "services",  label: "Услуги",        commission: true },
  { id: "other",     label: "Другое",        commission: true },
];

const SUBCATS_APP: SubcategoryDef[] = [
  { id: "subs",      label: "Подписка",      commission: true },
  { id: "accounts",  label: "Аккаунты",      commission: true },
  { id: "services",  label: "Услуги",        commission: true },
  { id: "other",     label: "Другое",        commission: true },
];

const SUBCATS_BY_SLUG: Record<string, SubcategoryDef[]> = {
  "counter-strike-2": [
    { id: "skins",       label: "Скины",             commission: true },
    { id: "accounts",    label: "Аккаунты" },
    { id: "prime",       label: "Prime Status",      commission: true },
    { id: "faceit",      label: "Аккаунты FACEIT" },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "rent",        label: "Аренда",            commission: true },
    { id: "boost",       label: "Буст",              commission: true },
    { id: "other",       label: "Другое",            commission: true },
    { id: "design",      label: "Дизайн" },
    { id: "battlepass",  label: "Пропуск",           commission: true },
  ],
  "genshin-impact": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "crystals",    label: "Кристаллы",         commission: true },
    { id: "spins",       label: "Аккаунты с крутками" },
    { id: "boost",       label: "Буст",              commission: true },
    { id: "luna",        label: "Луна",              commission: true },
    { id: "promo",       label: "Промокоды" },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "battlepass",  label: "Боевой пропуск",    commission: true },
    { id: "other",       label: "Другое",            commission: true },
    { id: "design",      label: "Дизайн" },
    { id: "rent",        label: "Аренда" },
    { id: "twitchdrops", label: "Twitch Drops" },
    { id: "resin",       label: "Гранулы времени",   commission: true },
  ],
  "roblox": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "currency",    label: "Robux",             commission: true },
    { id: "items",       label: "Предметы",          commission: true },
    { id: "gamepasses",  label: "Игровые пропуска",  commission: true },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "other",       label: "Другое",            commission: true },
  ],
  "brawl-stars": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "currency",    label: "Гемы",              commission: true },
    { id: "boost",       label: "Буст",              commission: true },
    { id: "battlepass",  label: "Боевой пропуск",    commission: true },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "other",       label: "Другое",            commission: true },
  ],
  "pubg-mobile": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "uc",          label: "UC (валюта)",       commission: true },
    { id: "boost",       label: "Буст",              commission: true },
    { id: "royalpass",   label: "Royal Pass",        commission: true },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "other",       label: "Другое",            commission: true },
  ],
  "clash-royale": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "gems",        label: "Гемы",              commission: true },
    { id: "boost",       label: "Буст",              commission: true },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "other",       label: "Другое",            commission: true },
  ],
  "steam": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "balance",     label: "Пополнение баланса", commission: true },
    { id: "items",       label: "Предметы/скины",    commission: true },
    { id: "keys",        label: "Ключи/игры",        commission: true },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "other",       label: "Другое",            commission: true },
  ],
  "telegram": [
    { id: "stars",       label: "Звёзды Telegram",   commission: true },
    { id: "premium",     label: "Premium",           commission: true },
    { id: "accounts",    label: "Аккаунты",          commission: true },
    { id: "channels",    label: "Каналы/боты",       commission: true },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "other",       label: "Другое",            commission: true },
  ],
  "chatgpt": [
    { id: "subs",        label: "Подписка",          commission: true },
    { id: "accounts",    label: "Аккаунты",          commission: true },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "other",       label: "Другое",            commission: true },
  ],
  "valorant": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "vp",          label: "Valorant Points",   commission: true },
    { id: "boost",       label: "Буст ранга",        commission: true },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "other",       label: "Другое",            commission: true },
  ],
  "gta-5": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "currency",    label: "Деньги GTA$",       commission: true },
    { id: "boost",       label: "Буст репутации",    commission: true },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "other",       label: "Другое",            commission: true },
  ],
  "minecraft": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "keys",        label: "Ключи",             commission: true },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "other",       label: "Другое",            commission: true },
  ],
  "dota-2": [
    { id: "accounts",    label: "Аккаунты" },
    { id: "items",       label: "Предметы",          commission: true },
    { id: "boost",       label: "Буст",              commission: true },
    { id: "services",    label: "Услуги",            commission: true },
    { id: "other",       label: "Другое",            commission: true },
  ],
};

function getSubcategories(item: any): SubcategoryDef[] {
  if (SUBCATS_BY_SLUG[item.slug]) return SUBCATS_BY_SLUG[item.slug];
  if (item.category === "apps") return SUBCATS_APP;
  if (item.category === "mobile") return SUBCATS_MOBILE;
  return SUBCATS_GAME_FULL;
}

// ─── ДАННЫЕ: способы передачи ─────────────────────────────────────────────────

const TRANSFER_accounts: TransferMethodDef[] = [
  { id: "full",     label: "Полный доступ",          description: "Аккаунт с доступом ко всем привязкам" },
  { id: "login",    label: "Со входом в аккаунт",    description: "Передача данных для входа" },
];
const TRANSFER_subs: TransferMethodDef[] = [
  { id: "login",    label: "Со входом в аккаунт",    description: "Активация подписки со входом в аккаунт" },
  { id: "nologin",  label: "Без входа в аккаунт",    description: "Активация подписки без входа в аккаунт" },
];
const TRANSFER_digital: TransferMethodDef[] = [
  { id: "chat",     label: "Через чат сделки",       description: "Отправка данных в чате после оплаты" },
  { id: "auto",     label: "Автоматически",          description: "Данные отправляются сразу после оплаты" },
];
const TRANSFER_services: TransferMethodDef[] = [
  { id: "ingame",   label: "Внутри игры",            description: "Выполнение услуги в игре" },
  { id: "remote",   label: "Удалённо",               description: "Выполнение услуги удалённо" },
];

function getTransferMethods(subcatId: string): TransferMethodDef[] {
  if (["accounts", "spins", "skins", "prime", "faceit"].includes(subcatId)) return TRANSFER_accounts;
  if (["subs", "premium"].includes(subcatId)) return TRANSFER_subs;
  if (subcatId === "services") return TRANSFER_services;
  return TRANSFER_digital;
}

// ─── ДАННЫЕ: характеристики ───────────────────────────────────────────────────

const TRAITS_BY_SLUG: Record<string, Record<string, TraitField[]>> = {
  "counter-strike-2": {
    skins: [
      { id: "quality", label: "Качество", type: "select", options: [
        { id: "fn", label: "Factory New" }, { id: "mw", label: "Minimal Wear" },
        { id: "ft", label: "Field-Tested" }, { id: "ww", label: "Well-Worn" }, { id: "bs", label: "Battle-Scarred" },
      ]},
      { id: "stattrak", label: "StatTrak", type: "select", options: [
        { id: "yes", label: "Да" }, { id: "no", label: "Нет" },
      ]},
    ],
    accounts: [
      { id: "rank",   label: "Ранг",   type: "select", options: [
        { id: "s1", label: "Silver I" }, { id: "s2", label: "Silver II" }, { id: "s3", label: "Silver III" },
        { id: "s4", label: "Silver IV" }, { id: "se", label: "Silver Elite" }, { id: "sem", label: "Silver Elite Master" },
        { id: "gs1", label: "Gold Nova I" }, { id: "gs2", label: "Gold Nova II" }, { id: "gs3", label: "Gold Nova III" },
        { id: "gsm", label: "Gold Nova Master" }, { id: "mg1", label: "MG I" }, { id: "mg2", label: "MG II" },
        { id: "mge", label: "MGE" }, { id: "dmg", label: "DMG" }, { id: "le", label: "LE" },
        { id: "lem", label: "LEM" }, { id: "supreme", label: "Supreme" }, { id: "global", label: "Global Elite" },
      ]},
      { id: "faceit_level", label: "Уровень FACEIT", type: "range", min: 1, max: 10 },
      { id: "hours", label: "Часов в игре", type: "range", min: 0, max: 10000 },
    ],
  },
  "genshin-impact": {
    accounts: [
      { id: "ar", label: "AR", type: "range", min: 1, max: 60 },
      { id: "legendaries", label: "Легендарных персонажей", type: "range", min: 0, max: 100 },
      { id: "weapons", label: "Легендарных оружий", type: "range", min: 0, max: 100 },
      { id: "server", label: "Сервер", type: "select", options: [
        { id: "eu", label: "Европа" }, { id: "asia", label: "Азия" },
        { id: "am", label: "Америка" }, { id: "tw", label: "TW, НК, МО" },
      ]},
      { id: "hero", label: "Главный герой", type: "select", options: [
        { id: "aether", label: "Итэр" }, { id: "lumine", label: "Люмин" },
      ]},
    ],
  },
  "chatgpt": {
    subs: [
      { id: "type", label: "Тип", type: "select", options: [
        { id: "plus", label: "Plus" }, { id: "pro", label: "Pro" }, { id: "go", label: "GO" },
      ]},
      { id: "period", label: "Срок", type: "select", options: [
        { id: "1m", label: "1 месяц" }, { id: "1y", label: "1 год" }, { id: "other", label: "Другое" },
      ]},
    ],
  },
  "valorant": {
    accounts: [
      { id: "rank", label: "Ранг", type: "select", options: [
        { id: "iron", label: "Железо" }, { id: "bronze", label: "Бронза" },
        { id: "silver", label: "Серебро" }, { id: "gold", label: "Золото" },
        { id: "platinum", label: "Платина" }, { id: "diamond", label: "Диамант" },
        { id: "ascendant", label: "Вознесённый" }, { id: "immortal", label: "Бессмертный" },
        { id: "radiant", label: "Лучезарный" },
      ]},
      { id: "region", label: "Регион", type: "select", options: [
        { id: "eu", label: "Европа" }, { id: "na", label: "Северная Америка" }, { id: "ap", label: "Азия" },
      ]},
    ],
  },
  "roblox": {
    accounts: [
      { id: "robux", label: "Robux на балансе", type: "range", min: 0, max: 100000 },
      { id: "premium", label: "Premium", type: "select", options: [
        { id: "no", label: "Нет" }, { id: "450", label: "450 Robux/мес" },
        { id: "1000", label: "1000 Robux/мес" }, { id: "2200", label: "2200 Robux/мес" },
      ]},
    ],
  },
  "brawl-stars": {
    accounts: [
      { id: "trophies",  label: "Кубки",       type: "range", min: 0, max: 100000 },
      { id: "brawlers",  label: "Бойцов",       type: "range", min: 0, max: 100 },
      { id: "legendary", label: "Легендарных",  type: "range", min: 0, max: 20 },
    ],
  },
  "steam": {
    accounts: [
      { id: "games",  label: "Игр в библиотеке", type: "range", min: 0, max: 10000 },
      { id: "level",  label: "Уровень Steam",     type: "range", min: 0, max: 500 },
    ],
  },
};

function getTraits(slug: string, subcatId: string): TraitField[] {
  return TRAITS_BY_SLUG[slug]?.[subcatId] || [];
}

// ─── ДАННЫЕ: поля товара ──────────────────────────────────────────────────────

const DATA_FIELDS_BY_SUBCAT: Record<string, DataFieldDef[]> = {
  accounts: [
    { id: "login",    label: "Логин аккаунта",   placeholder: "Логин / email",      type: "text" },
    { id: "password", label: "Пароль",            placeholder: "Пароль",            type: "password" },
    { id: "uid",      label: "UID аккаунта",      placeholder: "UID аккаунта",      type: "text" },
    { id: "comment",  label: "Комментарий",       placeholder: "Комментарий",       type: "textarea" },
  ],
  skins: [
    { id: "tradelink", label: "Trade link",       placeholder: "Ссылка на трейд",   type: "text" },
    { id: "comment",   label: "Комментарий",      placeholder: "Дополнительно",     type: "textarea" },
  ],
  subs: [
    { id: "login",    label: "Логин аккаунта",   placeholder: "Логин / email",      type: "text" },
    { id: "password", label: "Пароль",            placeholder: "Пароль",            type: "password" },
    { id: "comment",  label: "Комментарий",       placeholder: "Комментарий",       type: "textarea" },
  ],
  currency: [
    { id: "nickname", label: "Ник / ID игрока",  placeholder: "Ник или ID",         type: "text" },
    { id: "server",   label: "Сервер",            placeholder: "Сервер",            type: "text" },
    { id: "comment",  label: "Комментарий",       placeholder: "Комментарий",       type: "textarea" },
  ],
  boost: [
    { id: "nickname", label: "Ник / ID игрока",  placeholder: "Ник или ID",         type: "text" },
    { id: "comment",  label: "Комментарий",       placeholder: "Комментарий",       type: "textarea" },
  ],
  services: [
    { id: "comment",  label: "Описание услуги",  placeholder: "Что нужно сделать",  type: "textarea" },
  ],
  keys: [
    { id: "key",      label: "Ключ активации",   placeholder: "XXXXX-XXXXX-XXXXX",  type: "text" },
    { id: "comment",  label: "Комментарий",       placeholder: "Комментарий",       type: "textarea" },
  ],
};

const DEFAULT_DATA_FIELDS: DataFieldDef[] = [
  { id: "comment", label: "Комментарий", placeholder: "Дополнительная информация", type: "textarea" },
];

function getDataFields(subcatId: string): DataFieldDef[] {
  return DATA_FIELDS_BY_SUBCAT[subcatId] || DEFAULT_DATA_FIELDS;
}

// ─── ИНСТРУКЦИИ ───────────────────────────────────────────────────────────────

const INSTRUCTIONS_BY_SUBCAT: Record<string, string[]> = {
  accounts: [
    "Удержание средств: средства удерживаются на стороне площадки для безопасности сделки.",
    "Передача аккаунта: предоставьте покупателю доступ для входа в аккаунт.",
    "Дополнительные привязки: отвяжите все дополнительные привязки в настройках безопасности.",
    "Выход из аккаунта: после передачи всех данных выйдите с аккаунта.",
    "Выполнение заказа: нажмите кнопку «Я выполнил» после передачи полного доступа.",
    "Проверка товара: покупатель подтвердит получение. В ином случае Minions подтвердит через 7 дней.",
    "⚠️ Остерегайтесь злоумышленников: ведите диалог только в чате на Minions Market.",
  ],
  subs: [
    "Удержание средств: средства удерживаются для безопасности сделки.",
    "Выполнение заказа: просмотрите чат и активируйте подписку. У вас есть 24 часа.",
    "Нажмите кнопку «Я выполнил» после предоставления товара покупателю.",
    "Проверка товара: покупатель подтвердит получение.",
  ],
  currency: [
    "Передача валюты: отправьте валюту на ник/ID покупателя из чата сделки.",
    "Выполнение заказа: нажмите «Я выполнил» после отправки валюты.",
    "Проверка товара: покупатель подтвердит получение.",
  ],
};

const DEFAULT_INSTRUCTIONS = [
  "Удержание средств: средства удерживаются для безопасности сделки.",
  "Выполнение заказа: просмотрите чат и выполните заказ. У вас есть 24 часа.",
  "Нажмите кнопку «Я выполнил» после предоставления товара покупателю.",
  "Проверка товара: если всё в порядке, покупатель подтвердит получение.",
];

function getInstructions(subcatId: string): string[] {
  return INSTRUCTIONS_BY_SUBCAT[subcatId] || DEFAULT_INSTRUCTIONS;
}

// ─── ОБЩИЕ ДАННЫЕ ─────────────────────────────────────────────────────────────

// FIX БАГ #18: фиксированный список "новых" игр вместо idx < 3
const NEW_SLUGS = new Set(["counter-strike-2", "valorant", "clash-royale", "pubg-mobile", "chatgpt", "telegram"]);

const TABS = [
  { id: "games",  label: "Игры",       icon: "🎮", count: PLAYEROK_GAMES.length },
  { id: "mobile", label: "Мобильные",  icon: "📱", count: PLAYEROK_MOBILE_GAMES.length },
  { id: "apps",   label: "Приложения", icon: "🛠️", count: PLAYEROK_APPS.length },
];

const ALL_ITEMS = [
  ...PLAYEROK_GAMES.map(g => ({ ...g, category: "games" })),
  ...PLAYEROK_MOBILE_GAMES.map(g => ({ ...g, category: "mobile" })),
  ...PLAYEROK_APPS.map(g => ({ ...g, category: "apps" })),
];

const TOTAL_STEPS = 8;

const STEP_TITLES: Record<number, string> = {
  1: "Выберите раздел товаров",
  2: "Выберите категорию",
  3: "Способ передачи",
  4: "Характеристики",
  5: "О товаре",
  6: "Цена",
  7: "Данные товара",
  8: "Фото",
};

// ─── КОМПОНЕНТ ────────────────────────────────────────────────────────────────

export default function SellPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState("games");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedSubcat, setSelectedSubcat] = useState<SubcategoryDef | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<string>("");
  const [selectedTraits, setSelectedTraits] = useState<Record<string, string | string[]>>({});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceForBuyer, setPriceForBuyer] = useState("");
  const [priceForMe, setPriceForMe] = useState("");
  const [dataFields, setDataFields] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [images, setImages] = useState<File[]>([]);

  // FIX: useMemo для стабильных URL (не stale ref)
  const imageUrls = useMemo(() => images.map(f => URL.createObjectURL(f)), [images]);
  const prevUrlsRef = useRef<string[]>([]);
  useMemo(() => {
    prevUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    prevUrlsRef.current = imageUrls;
  }, [imageUrls]);

  const { mutate: createProduct, isPending } = useCreateProduct();

  const filtered = useMemo(() => {
    const base = ALL_ITEMS.filter(i => i.category === activeTab);
    if (!search) return base;
    const q = search.toLowerCase();
    return base.filter(i => i.name.toLowerCase().includes(q));
  }, [activeTab, search]);

  const subcategories = selectedItem ? getSubcategories(selectedItem) : [];
  const transferMethods = selectedSubcat ? getTransferMethods(selectedSubcat.id) : [];
  const traitFields = selectedItem && selectedSubcat ? getTraits(selectedItem.slug, selectedSubcat.id) : [];
  const productDataFields = selectedSubcat ? getDataFields(selectedSubcat.id) : DEFAULT_DATA_FIELDS;
  const instructions = selectedSubcat ? getInstructions(selectedSubcat.id) : DEFAULT_INSTRUCTIONS;

  const progress = (step / TOTAL_STEPS) * 100;
  const goNext = () => { setError(null); setStep(s => s + 1); };
  const goBack = () => { setError(null); setStep(s => s - 1); };

  const handleSelectItem = (item: any) => {
    setSelectedItem(item);
    setSelectedSubcat(null);
    setSelectedTransfer("");
    setSelectedTraits({});
    setStep(2);
  };

  const handlePriceChange = (field: "buyer" | "me", value: string) => {
    const num = parseFloat(value) || 0;
    const commission = 0.1;
    if (field === "buyer") {
      setPriceForBuyer(value);
      setPriceForMe(num > 0 ? (num * (1 - commission)).toFixed(2) : "");
    } else {
      setPriceForMe(value);
      setPriceForBuyer(num > 0 ? (num / (1 - commission)).toFixed(2) : "");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(prev => [...prev, ...files].slice(0, 10));
    e.target.value = "";
  };

  // FIX БАГ #5: конвертируем изображения в base64 для отправки на сервер
  const convertImagesToBase64 = async (files: File[]): Promise<string[]> => {
    return Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    );
  };

  const handleSubmit = async () => {
    setError(null);
    const deliveryData = Object.entries(dataFields)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    // Конвертируем изображения в base64
    let imageBase64: string[] = [];
    if (images.length > 0) {
      try {
        imageBase64 = await convertImagesToBase64(images);
      } catch {
        setError("Ошибка при обработке изображений");
        return;
      }
    }

    createProduct(
      {
        data: {
          title: title.trim(),
          description: description.trim(),
          price: parseFloat(priceForBuyer) || 0,
          category: selectedItem?.category ?? "games",
          subcategory: selectedSubcat?.id,
          game: selectedItem?.slug,
          deliveryType: selectedTransfer as any,
          deliveryData: deliveryData || undefined,
          images: imageBase64,
          tags: Object.entries(selectedTraits)
            .flatMap(([k, v]) => Array.isArray(v) ? v.map(x => `${k}:${x}`) : [`${k}:${v}`])
            .filter(Boolean),
        },
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          setTimeout(() => {
            setStep(1); setSelectedItem(null); setSelectedSubcat(null);
            setSelectedTransfer(""); setSelectedTraits({}); setTitle(""); setDescription("");
            setPriceForBuyer(""); setPriceForMe(""); setDataFields({}); setImages([]);
            setSubmitted(false);
            navigate("/");
          }, 2000);
        },
        onError: (err: any) => {
          setError(err?.message ?? "Ошибка при публикации товара");
        },
      }
    );
  };

  // Общие стили инпута
  const inputCls = "w-full px-4 py-4 bg-[#1a2332] rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1CB0F6] border-none";

  return (
    <div className="bg-[#0d1117] text-white min-h-screen">
      {/* Прогресс-бар */}
      <div className="fixed top-0 left-0 right-0 z-50 flex">
        <motion.div className="h-0.5 bg-[#1CB0F6]" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        <div className="flex-1 h-0.5 bg-[#1f2a37]" />
      </div>

      <div className="max-w-md mx-auto pt-2 pb-4">
        {/* Header */}
        <div className="px-4 py-2 flex items-center justify-between gap-2 mb-1">
          {step > 1 ? (
            <button onClick={goBack} className="p-2 rounded-xl hover:bg-[#1a2332] transition flex-shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : <div className="w-9" />}
          <p className="text-sm font-semibold text-center flex-1">{STEP_TITLES[step]}</p>
          <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-[#1a2332] transition flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence>
          {submitted && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mx-4 mb-3 p-3 bg-green-600 rounded-xl text-sm text-center flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Товар успешно опубликован!
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-4">

          {/* ══ ШАГ 1: Выбор игры ══ */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Поиск игр и приложений"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className={`${inputCls} pl-10`}
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(""); }}
                    className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition ${activeTab === tab.id ? "bg-[#1f2a37] text-white" : "bg-[#131a23] text-gray-400"}`}>
                    {tab.icon} {tab.label} <span className="opacity-50">{tab.count}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[#1CB0F6]">🏷️</span>
                <span className="text-gray-400">Комиссия 10%</span>
              </div>
              {filtered.length > 0 ? (
                <div className="grid grid-cols-4 gap-x-2 gap-y-3">
                  {filtered.map((item) => (
                    <button key={`${item.category}-${item.slug}`} onClick={() => handleSelectItem(item)}
                      className="relative flex flex-col items-center gap-1 active:scale-95 transition">
                      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-[#1a2332]">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <span className="text-[9px] text-center leading-tight text-gray-300 w-full line-clamp-1">{item.name}</span>
                      {NEW_SLUGS.has(item.slug) && (
                        <span className="absolute -top-1 -right-1 bg-green-500 text-black text-[7px] font-bold px-1 rounded-full">Новое</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-12">Ничего не найдено</p>
              )}
            </motion.div>
          )}

          {/* ══ ШАГ 2: Категория ══ */}
          {step === 2 && (
            <StepWrapper nextDisabled={!selectedSubcat} onNext={goNext} step={step} selectedItem={selectedItem} selectedSubcat={selectedSubcat} error={error}>
              <div className="divide-y divide-[#1f2a37]">
                {subcategories.map(sub => (
                  <button key={sub.id} onClick={() => setSelectedSubcat(sub)}
                    className="w-full flex items-center justify-between py-4 px-1 hover:bg-[#1a2332]/30 transition">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{sub.label}</span>
                      {sub.commission && <span className="px-1.5 py-0.5 bg-[#1CB0F6] text-black text-[9px] font-bold rounded-full">10%</span>}
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${selectedSubcat?.id === sub.id ? "border-[#1CB0F6] bg-[#1CB0F6]" : "border-[#333]"}`}>
                      {selectedSubcat?.id === sub.id && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                    </div>
                  </button>
                ))}
              </div>
            </StepWrapper>
          )}

          {/* ══ ШАГ 3: Способ передачи ══ */}
          {step === 3 && (
            <StepWrapper nextDisabled={!selectedTransfer} onNext={goNext} step={step} selectedItem={selectedItem} selectedSubcat={selectedSubcat} error={error}>
              <div className="divide-y divide-[#1f2a37]">
                {transferMethods.map(method => (
                  <button key={method.id} onClick={() => setSelectedTransfer(method.id)}
                    className="w-full flex items-center justify-between py-4 px-1 hover:bg-[#1a2332]/30 transition">
                    <div className="text-left">
                      <p className="text-sm font-medium">{method.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{method.description}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center ml-3 transition ${selectedTransfer === method.id ? "border-[#1CB0F6] bg-[#1CB0F6]" : "border-[#333]"}`}>
                      {selectedTransfer === method.id && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                    </div>
                  </button>
                ))}
              </div>
            </StepWrapper>
          )}

          {/* ══ ШАГ 4: Характеристики ══ */}
          {step === 4 && (
            <StepWrapper onNext={goNext} step={step} selectedItem={selectedItem} selectedSubcat={selectedSubcat} error={error}>
              {traitFields.length === 0 ? (
                <p className="text-gray-500 text-sm py-6 text-center">Нет дополнительных характеристик</p>
              ) : (
                <div className="space-y-5">
                  {traitFields.map(trait => (
                    <div key={trait.id}>
                      <p className="text-xs text-gray-400 mb-2">{trait.label}</p>
                      {trait.type === "range" && (
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder={`от ${trait.min}`}
                            value={(selectedTraits[`${trait.id}_from`] as string) || ""}
                            onChange={e => setSelectedTraits(p => ({ ...p, [`${trait.id}_from`]: e.target.value }))}
                            className={inputCls} />
                          <input type="text" placeholder={`до ${trait.max}`}
                            value={(selectedTraits[`${trait.id}_to`] as string) || ""}
                            onChange={e => setSelectedTraits(p => ({ ...p, [`${trait.id}_to`]: e.target.value }))}
                            className={inputCls} />
                        </div>
                      )}
                      {trait.type === "select" && trait.options && (
                        <div className="flex flex-wrap gap-2">
                          {trait.options.map(opt => (
                            <button key={opt.id}
                              onClick={() => {
                                const cur = (selectedTraits[trait.id] as string[]) || [];
                                const next = cur.includes(opt.id) ? cur.filter(x => x !== opt.id) : [...cur, opt.id];
                                setSelectedTraits(p => ({ ...p, [trait.id]: next }));
                              }}
                              className={`px-4 py-2 rounded-full text-sm transition ${((selectedTraits[trait.id] as string[]) || []).includes(opt.id) ? "bg-[#1a3a4a] text-white border border-[#1CB0F6]" : "bg-[#1a2332] text-gray-300 border border-transparent"}`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </StepWrapper>
          )}

          {/* ══ ШАГ 5: О товаре ══ */}
          {step === 5 && (
            <StepWrapper nextDisabled={!title.trim()} onNext={goNext} step={step} selectedItem={selectedItem} selectedSubcat={selectedSubcat} error={error}>
              <input type="text" placeholder="Название товара" value={title} maxLength={100}
                onChange={e => setTitle(e.target.value)} className={inputCls} />
              <textarea placeholder="Описание товара" value={description} maxLength={2000} rows={6}
                onChange={e => setDescription(e.target.value)} className={`${inputCls} resize-none`} />
              <p className="text-xs text-gray-500 text-right">{description.length}/2000</p>
            </StepWrapper>
          )}

          {/* ══ ШАГ 6: Цена ══ */}
          {step === 6 && (
            <StepWrapper nextDisabled={!priceForBuyer || parseFloat(priceForBuyer) <= 0} onNext={goNext} step={step} selectedItem={selectedItem} selectedSubcat={selectedSubcat} error={error}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1.5">Цена товара</p>
                  <input type="number" placeholder="Цена" value={priceForBuyer} min="1"
                    onChange={e => handlePriceChange("buyer", e.target.value)} className={inputCls} />
                </div>
                <ArrowLeftRight className="w-4 h-4 text-gray-500 flex-shrink-0 mt-5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1.5">Доход</p>
                  <input type="number" placeholder="Доход" value={priceForMe}
                    onChange={e => handlePriceChange("me", e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="text-[#1CB0F6]">🏷️</span>
                <span>Комиссия 10%</span>
              </div>
            </StepWrapper>
          )}

          {/* ══ ШАГ 7: Данные товара ══ */}
          {step === 7 && (
            // FIX БАГ #14: блокируем переход если обязательные поля пусты
            <StepWrapper
              onNext={goNext}
              step={step}
              selectedItem={selectedItem}
              selectedSubcat={selectedSubcat}
              error={error}
              nextDisabled={productDataFields.some(
                f => f.id !== "comment" && f.id !== "uid" && !dataFields[f.id]?.trim()
              )}
            >
              {selectedTransfer && (
                <div className="bg-[#131a23] rounded-xl p-4 mb-2 border border-white/5">
                  <p className="text-sm font-bold mb-0.5">📦 Способ передачи</p>
                  <p className="text-sm">{transferMethods.find(m => m.id === selectedTransfer)?.label}</p>
                  <p className="text-xs text-gray-400">{transferMethods.find(m => m.id === selectedTransfer)?.description}</p>
                </div>
              )}
              {productDataFields.map(field => (
                <div key={field.id} className="relative">
                  {field.type === "textarea" ? (
                    <textarea placeholder={field.placeholder} value={dataFields[field.id] || ""} rows={4}
                      onChange={e => setDataFields(p => ({ ...p, [field.id]: e.target.value }))}
                      className={`${inputCls} resize-none`} />
                  ) : (
                    <input type={field.type === "password" && !showPassword ? "password" : "text"}
                      placeholder={field.placeholder} value={dataFields[field.id] || ""}
                      onChange={e => setDataFields(p => ({ ...p, [field.id]: e.target.value }))}
                      className={`${inputCls} pr-12`} />
                  )}
                  {field.type === "password" && (
                    <button onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  )}
                </div>
              ))}
              <button className="flex items-center gap-2 text-sm text-gray-400">
                <Lock className="w-4 h-4 text-amber-500" />
                <span>Данные защищены</span>
              </button>
              <div className="mt-2">
                <p className="font-bold text-base mb-3 flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-400" /> Инструкция после продажи
                </p>
                <ul className="space-y-3">
                  {instructions.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-300">
                      <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </StepWrapper>
          )}

          {/* ══ ШАГ 8: Фотографии ══ */}
          {step === 8 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col min-h-[calc(100vh-140px)]">
              {selectedItem && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[#1a2332]">
                    <img src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{selectedItem.name}</p>
                    {selectedSubcat && <p className="text-xs text-gray-400">{selectedSubcat.label}</p>}
                  </div>
                </div>
              )}
              <p className="text-sm text-gray-400 mb-4">Фото {images.length}/10</p>
              <div className="grid grid-cols-2 gap-3 flex-1">
                {Array.from({ length: Math.min(images.length + 1, 10) }).map((_, idx) => (
                  <div key={idx} className="aspect-square rounded-2xl bg-[#1a2332] overflow-hidden relative border-2 border-dashed border-[#2a3a4a] hover:border-[#1CB0F6]/50 transition">
                    {images[idx] ? (
                      <>
                        <img src={imageUrls[idx]} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <span className="bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded-full">{idx + 1}/10</span>
                          <button onClick={() => setImages(p => p.filter((_, i) => i !== idx))} className="bg-black/70 p-1 rounded-full">
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer gap-2">
                        <Upload className="w-7 h-7 text-gray-500" />
                        <span className="text-xs text-gray-500">Загрузить</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                ))}
              </div>
              {error && <p className="text-red-400 text-sm text-center py-2">{error}</p>}
              <div className="pt-4 pb-6">
                <button onClick={handleSubmit} disabled={isPending}
                  className="w-full py-4 bg-[#1CB0F6] text-black font-semibold rounded-2xl text-sm hover:bg-[#1aa7ff] transition disabled:opacity-60 flex items-center justify-center gap-2">
                  {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Публикуется...</> : "Опубликовать"}
                </button>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}
