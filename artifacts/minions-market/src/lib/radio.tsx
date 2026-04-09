import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export const stations = [
  { id: "radio-record", name: "Radio Record",     description: "Лучший EDM и dance из России",      emoji: "🎧" },
  { id: "europa-plus",  name: "Europa Plus",       description: "Популярная русская музыка 24/7",    emoji: "🌍" },
  { id: "retro-fm",     name: "Retro FM",          description: "Хиты из 80–90-х и ностальгия",      emoji: "💿" },
  { id: "dfm",          name: "DFM",               description: "Танцевальные хиты и радио-лидеры",  emoji: "🎚️" },
  { id: "mayak",        name: "Радио Маяк",        description: "Классика радио и новости",           emoji: "🕯️" },
  { id: "vesti-fm",     name: "Вести FM",          description: "Новости и эфиры из России",          emoji: "📰" },
  { id: "autoradio",    name: "Авторадио",         description: "Популярные хиты на дороге",          emoji: "🚗" },
  { id: "dorozhnoe",    name: "Дорожное Радио",    description: "Радио на все случаи пути",           emoji: "🛣️" },
  { id: "monte-carlo",  name: "Radio Monte Carlo", description: "Стильная музыка и новости",          emoji: "🎩" },
  { id: "hit-fm",       name: "Hit FM",            description: "Топовые российские треки",           emoji: "🔥" },
];

export type Station = typeof stations[number];

// Стрим идёт через наш бэкенд-прокси — решает CORS полностью
function getStreamUrl(stationId: string): string {
  return `/api/radio/stream/${stationId}`;
}

interface RadioContextValue {
  station: Station;
  isPlaying: boolean;
  isLoading: boolean;
  isMuted: boolean;
  error: string | null;
  selectStation: (id: string) => void;
  togglePlay: () => void;
  toggleMute: () => void;
}

const RadioContext = createContext<RadioContextValue | null>(null);

// Один аудио-элемент на всё приложение — не умирает при смене страниц
const globalAudio = new Audio();
globalAudio.preload = "none";

export function RadioProvider({ children }: { children: ReactNode }) {
  const [stationId, setStationId] = useState(stations[0].id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const station = stations.find((s) => s.id === stationId) || stations[0];

  useEffect(() => {
    const audio = globalAudio;

    const onPlaying = () => { setIsLoading(false); setIsPlaying(true); setError(null); };
    const onWaiting  = () => setIsLoading(true);
    const onCanPlay  = () => setIsLoading(false);
    const onPause    = () => { setIsPlaying(false); setIsLoading(false); };
    const onStalled  = () => setIsLoading(true);
    const onError    = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setError("Станция недоступна. Попробуйте другую.");
    };

    audio.addEventListener("playing",  onPlaying);
    audio.addEventListener("waiting",  onWaiting);
    audio.addEventListener("canplay",  onCanPlay);
    audio.addEventListener("pause",    onPause);
    audio.addEventListener("stalled",  onStalled);
    audio.addEventListener("error",    onError);

    return () => {
      audio.removeEventListener("playing",  onPlaying);
      audio.removeEventListener("waiting",  onWaiting);
      audio.removeEventListener("canplay",  onCanPlay);
      audio.removeEventListener("pause",    onPause);
      audio.removeEventListener("stalled",  onStalled);
      audio.removeEventListener("error",    onError);
    };
  }, []);

  const selectStation = (id: string) => {
    const next = stations.find((s) => s.id === id);
    if (!next) return;
    setError(null);
    setIsLoading(true);
    setStationId(id);
    globalAudio.pause();
    globalAudio.src = getStreamUrl(id);
    globalAudio.load();
    globalAudio.play().catch(() => {
      setIsLoading(false);
      setIsPlaying(false);
      setError("Не удалось запустить станцию");
    });
  };

  const togglePlay = () => {
    const audio = globalAudio;
    if (isPlaying || isLoading) {
      audio.pause();
      setIsPlaying(false);
      setIsLoading(false);
    } else {
      // Если src не установлен — ставим текущую станцию
      if (!audio.src || audio.src.endsWith(window.location.pathname)) {
        audio.src = getStreamUrl(stationId);
        audio.load();
      }
      setIsLoading(true);
      setError(null);
      audio.play().catch(() => {
        setIsLoading(false);
        setIsPlaying(false);
        setError("Ошибка воспроизведения");
      });
    }
  };

  const toggleMute = () => {
    globalAudio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <RadioContext.Provider value={{ station, isPlaying, isLoading, isMuted, error, selectStation, togglePlay, toggleMute }}>
      {children}
    </RadioContext.Provider>
  );
}

export function useRadio() {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error("useRadio must be used within RadioProvider");
  return ctx;
}
