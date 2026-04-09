import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Radio, Play, Pause, ArrowLeft, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useRadio, stations } from "@/lib/radio";

export default function RadioPage() {
  const { t } = useLang();
  const { station, isPlaying, isLoading, isMuted, error, selectStation, togglePlay, toggleMute } = useRadio();

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur px-4 pt-3 pb-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">{t("radio")}</h1>
            <p className="text-xs text-muted-foreground">{t("liveRadio")}</p>
          </div>
        </div>
      </div>

      {/* Текущая станция */}
      <div className="px-4">
        <div className="bg-card rounded-3xl border border-border/40 p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-3xl bg-primary/10 text-primary w-14 h-14 flex items-center justify-center text-2xl">
              {station.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase tracking-[0.2em] text-primary">{t("radioTop10")}</span>
              </div>
              <h2 className="text-xl font-semibold">{station.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{station.description}</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 rounded-3xl bg-background p-4 border border-border/50">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("nowPlaying")}</p>
                <p className="font-medium text-sm mt-1 truncate">{station.name}</p>
                {error ? (
                  <p className="text-xs text-destructive mt-1">{error}</p>
                ) : isLoading ? (
                  <p className="text-xs text-muted-foreground mt-1 animate-pulse">Подключение...</p>
                ) : isPlaying ? (
                  <p className="text-xs text-primary mt-1">● В эфире</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">{station.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={toggleMute}>
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Button variant="secondary" size="icon" onClick={togglePlay}>
                  {isLoading
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : isPlaying
                    ? <Pause className="w-5 h-5" />
                    : <Play className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Список станций */}
      <div className="px-4">
        <h2 className="font-bold text-base mb-3">{t("topRadio")}</h2>
        <div className="grid gap-3">
          {stations.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => selectStation(s.id)}
              className={`w-full rounded-3xl border p-4 text-left transition ${
                s.id === station.id
                  ? "border-primary bg-primary/10"
                  : "border-border/50 bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 text-primary w-12 h-12 flex items-center justify-center text-xl">
                  {s.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{s.name}</span>
                    {s.id === station.id && isPlaying && (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-primary">{t("playing")}</span>
                    )}
                    {s.id === station.id && isLoading && (
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
