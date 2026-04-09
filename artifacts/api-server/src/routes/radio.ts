import { Router, type Request, type Response } from "express";
import https from "https";
import http from "http";

const router = Router();

const STATIONS: Record<string, { name: string; urls: string[] }> = {
  "radio-record": {
    name: "Radio Record",
    urls: [
      "https://air.radiorecord.ru:8101/rr_320",
      "https://radiorecord.hostingradio.ru/rr96.aacp",
      "https://air2.radiorecord.ru:8101/rr_320",
    ],
  },
  "europa-plus": {
    name: "Europa Plus",
    urls: [
      "https://ep256.hostingradio.ru/ep256",
      "https://ep128.hostingradio.ru/ep128",
      "https://europaplus.hostingradio.ru/europaplus128.mp3",
    ],
  },
  "retro-fm": {
    name: "Retro FM",
    urls: [
      "https://retro.hostingradio.ru/retro96.aacp",
      "https://retrohost-32bit.cdnvideo.ru/retro128.mp3",
      "https://retro128.cdnvideo.ru/retro128",
    ],
  },
  "dfm": {
    name: "DFM",
    urls: [
      "https://dfm.hostingradio.ru/dfm128.mp3",
      "https://dfm96.hostingradio.ru/dfm96.aacp",
      "https://dfm.cdnvideo.ru/dfm128.mp3",
    ],
  },
  "mayak": {
    name: "Радио Маяк",
    urls: [
      "https://mayak.hostingradio.ru/mayak128.mp3",
      "https://icecast.radiomayak.ru/mayak128.mp3",
      "https://mayak.hostingradio.ru/mayak96.aacp",
    ],
  },
  "vesti-fm": {
    name: "Вести FM",
    urls: [
      "https://vedfm.cdnvideo.ru/vesti128.mp3",
      "https://icecast.vesti.ru/vestifm_mp3_128kbps",
      "https://vesti.hostingradio.ru/vesti96.aacp",
    ],
  },
  "autoradio": {
    name: "Авторадио",
    urls: [
      "https://avtoradio.hostingradio.ru/avtoradio128.mp3",
      "https://avto.hostingradio.ru/avto96.aacp",
    ],
  },
  "dorozhnoe": {
    name: "Дорожное Радио",
    urls: [
      "https://dorozhnoe.hostingradio.ru/dorozhnoe128.mp3",
      "https://dorozhnoe96.hostingradio.ru/dorozhnoe96.aacp",
    ],
  },
  "monte-carlo": {
    name: "Radio Monte Carlo",
    urls: [
      "https://mc.hostingradio.ru/mc128.mp3",
      "https://mc.hostingradio.ru/mc96.aacp",
      "https://mcradio.hostingradio.ru/mc128.mp3",
    ],
  },
  "hit-fm": {
    name: "Hit FM",
    urls: [
      "https://hitfm.hostingradio.ru/hitfm128.mp3",
      "https://hitfm96.hostingradio.ru/hitfm96.aacp",
    ],
  },
};

router.get("/stations", (_req, res) => {
  const list = Object.entries(STATIONS).map(([id, s]) => ({ id, name: s.name }));
  res.json(list);
});

/**
 * Рекурсивно следует редиректам и стримит аудио.
 * При ошибке или редиректе без Location вызывает onFail().
 */
function fetchStream(
  targetUrl: string,
  res: Response,
  onFail: () => void,
  redirectsLeft = 5
): void {
  if (redirectsLeft <= 0) {
    onFail();
    return;
  }

  const proto = targetUrl.startsWith("https") ? https : http;

  const proxyReq = proto.get(
    targetUrl,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RadioProxy/1.0)",
        "Icy-MetaData": "1",
        "Accept": "*/*",
        "Connection": "keep-alive",
      },
      timeout: 15000,
    },
    (proxyRes) => {
      const status = proxyRes.statusCode ?? 0;

      // ── Редиректы 301/302/303/307/308 ─────────────────────────────────────
      if (status >= 300 && status < 400) {
        const location = proxyRes.headers["location"];
        proxyRes.resume(); // потребляем тело чтобы освободить сокет
        proxyReq.destroy();
        if (location) {
          const next = location.startsWith("http")
            ? location
            : new URL(location, targetUrl).href;
          fetchStream(next, res, onFail, redirectsLeft - 1);
        } else {
          onFail();
        }
        return;
      }

      // ── Ошибки источника ──────────────────────────────────────────────────
      if (status >= 400) {
        proxyRes.resume();
        proxyReq.destroy();
        onFail();
        return;
      }

      // ── Успех — стримим клиенту ────────────────────────────────────────────
      const ct = proxyRes.headers["content-type"] || "audio/mpeg";
      res.setHeader("Content-Type", ct);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Accel-Buffering", "no");
      res.status(200);

      proxyRes.pipe(res);

      proxyRes.on("error", () => {
        if (!res.writableEnded) res.end();
      });

      // Клиент нажал стоп — убиваем upstream
      res.on("close", () => proxyReq.destroy());
    }
  );

  proxyReq.on("error", () => onFail());
  proxyReq.on("timeout", () => {
    proxyReq.destroy();
    onFail();
  });
}

// Прокси-стрим: браузер → Express → радио-сервер
// Решает CORS; перебирает fallback URL; следует редиректам
router.get("/stream/:stationId", (req: Request, res: Response) => {
  const station = STATIONS[req.params.stationId];
  if (!station) {
    res.status(404).json({ message: "Station not found" });
    return;
  }

  let urlIndex = 0;

  function tryNext() {
    if (urlIndex >= station.urls.length) {
      if (!res.headersSent) {
        res.status(502).json({ message: "All stream URLs failed" });
      } else if (!res.writableEnded) {
        res.end();
      }
      return;
    }
    fetchStream(station.urls[urlIndex++], res, tryNext);
  }

  tryNext();
});

export default router;
