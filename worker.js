const WEBSITE_URL = "https://www.growtopiagame.com/";
const DETAIL_URL = "https://www.growtopiagame.com/detail";

const DEFAULT_LOGO_URL =
  "https://cdn.phototourl.com/free/2026-07-22-47dec906-4283-4af1-b922-7872f834771f.png";

const MAX_CONCURRENT_WEBHOOKS = 5;

const DEFAULT_EMOJI = {
  offline: "<:Offline:1529422157187387472>",
  online: "<:Online:1529422176212750366>",
  player: "<:Player:1529422279522517093>",
  stats: "<:Stats:1529422196060192861>",
  clock: "<:WallClock:1529422130167676949>",
  plus: "<:Pluss:1529434551162769418>",
  minus: "<:Minuss:1529434532644786234>",
  world: "🌍",
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/run") {
      try {
        const result = await updateMonitor(env);
        return jsonResponse(result, result.ok ? 200 : 207);
      } catch (error) {
        console.error("Manual run failed:", error);

        return jsonResponse(
          {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          },
          500
        );
      }
    }

    return new Response(
      "Growtopia Online Monitoring aktif. Buka /run untuk menjalankan tes manual.",
      {
        headers: {
          "Content-Type": "text/plain; charset=UTF-8",
          "Cache-Control": "no-store",
        },
      }
    );
  },

  async scheduled(controller, env, ctx) {
    console.log(
      "CRON FIRED:",
      controller.cron,
      new Date(controller.scheduledTime).toISOString()
    );

    ctx.waitUntil(
      updateMonitor(env).catch((error) => {
        console.error(
          "Scheduled run failed:",
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      })
    );
  },
};

async function updateMonitor(env) {
  if (!env.DB) {
    throw new Error('D1 binding "DB" belum dipasang.');
  }

  const webhooks = getWebhookConfigs(env);

  await ensureDatabase(env.DB);

  // Data pemain dan World of the Day hanya diambil satu kali per pembaruan.
  const growtopia = await getGrowtopiaDetails();
  const results = [];

  // Batasi jumlah request paralel agar lebih stabil saat webhook bertambah banyak.
  for (let index = 0; index < webhooks.length; index += MAX_CONCURRENT_WEBHOOKS) {
    const batch = webhooks.slice(index, index + MAX_CONCURRENT_WEBHOOKS);

    const settledBatch = await Promise.allSettled(
      batch.map((webhook) => updateWebhook(env.DB, webhook, growtopia))
    );

    for (let batchIndex = 0; batchIndex < settledBatch.length; batchIndex += 1) {
      const settled = settledBatch[batchIndex];
      const webhook = batch[batchIndex];

      if (settled.status === "fulfilled") {
        results.push(settled.value);
      } else {
        results.push({
          ok: false,
          webhookId: webhook.id,
          webhookName: webhook.name,
          error:
            settled.reason instanceof Error
              ? settled.reason.message
              : String(settled.reason),
        });
      }
    }
  }

  const successful = results.filter((result) => result.ok).length;
  const failed = results.length - successful;

  const output = {
    ok: failed === 0,
    online: growtopia.online,
    players: growtopia.count,
    worldOfTheDay: growtopia.wotdName,
    worldOfTheDayImage: growtopia.wotdImageUrl,
    totalWebhooks: webhooks.length,
    successful,
    failed,
    results,
    updatedAt: new Date().toISOString(),
  };

  console.log("MONITOR UPDATED:", JSON.stringify(output));
  return output;
}

function getWebhookConfigs(env) {
  if (env.DISCORD_WEBHOOKS_JSON) {
    let parsed;

    try {
      parsed = JSON.parse(env.DISCORD_WEBHOOKS_JSON);
    } catch (error) {
      throw new Error(
        `DISCORD_WEBHOOKS_JSON bukan JSON valid: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(
        "DISCORD_WEBHOOKS_JSON harus berupa array dan minimal berisi satu webhook."
      );
    }

    const usedIds = new Set();

    return parsed.map((item, index) => {
      const id = String(item?.id ?? "").trim();
      const name = String(item?.name ?? id).trim() || id;
      const url = String(item?.url ?? "").trim();

      if (!id) {
        throw new Error(`Webhook urutan ${index + 1} tidak memiliki id.`);
      }

      if (usedIds.has(id)) {
        throw new Error(`Webhook id duplikat: ${id}`);
      }

      if (!isDiscordWebhookUrl(url)) {
        throw new Error(`URL webhook tidak valid pada id: ${id}`);
      }

      usedIds.add(id);

      return {
        id,
        name,
        url: normalizeWebhookUrl(url),
        username:
          String(item?.username ?? "Growtopia Online Monitoring").trim() ||
          "Growtopia Online Monitoring",
        logoUrl: normalizeOptionalHttpUrl(item?.logoUrl) || DEFAULT_LOGO_URL,
        footer:
          String(item?.footer ?? "Edgar • Growtopia Online Monitoring").trim() ||
          "Edgar • Growtopia Online Monitoring",
        emojis: {
          ...DEFAULT_EMOJI,
          ...(isPlainObject(item?.emojis) ? item.emojis : {}),
        },
      };
    });
  }

  // Fallback untuk pengguna lama yang hanya memakai satu webhook.
  if (env.DISCORD_WEBHOOK_URL) {
    const url = String(env.DISCORD_WEBHOOK_URL).trim();

    if (!isDiscordWebhookUrl(url)) {
      throw new Error("DISCORD_WEBHOOK_URL tidak valid.");
    }

    return [
      {
        id: "default",
        name: "Default Server",
        url: normalizeWebhookUrl(url),
        username: "Growtopia Online Monitoring",
        logoUrl: DEFAULT_LOGO_URL,
        footer: "Edgar • Growtopia Online Monitoring",
        emojis: { ...DEFAULT_EMOJI },
      },
    ];
  }

  throw new Error(
    'Secret "DISCORD_WEBHOOKS_JSON" belum dipasang. Untuk satu webhook, "DISCORD_WEBHOOK_URL" juga masih didukung.'
  );
}

function normalizeWebhookUrl(url) {
  return url.split("?")[0].replace(/\/+$/, "");
}

function isDiscordWebhookUrl(value) {
  try {
    const url = new URL(value);
    const allowedHosts = new Set([
      "discord.com",
      "www.discord.com",
      "canary.discord.com",
      "ptb.discord.com",
      "discordapp.com",
      "www.discordapp.com",
    ]);

    return (
      url.protocol === "https:" &&
      allowedHosts.has(url.hostname.toLowerCase()) &&
      /^\/api(?:\/v\d+)?\/webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/.test(
        url.pathname
      )
    );
  } catch {
    return false;
  }
}

function normalizeOptionalHttpUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function ensureDatabase(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS webhook_state (
        webhook_id TEXT PRIMARY KEY,
        message_id TEXT,
        previous_count INTEGER,
        last_updated TEXT
      )`
    )
    .run();
}

async function updateWebhook(db, webhook, growtopia) {
  const state = await db
    .prepare(
      `SELECT message_id, previous_count, last_updated
       FROM webhook_state
       WHERE webhook_id = ?1`
    )
    .bind(webhook.id)
    .first();

  const previousCount =
    state?.previous_count === null || state?.previous_count === undefined
      ? null
      : Number(state.previous_count);

  const payload = createDiscordPayload(growtopia, previousCount, webhook);
  let messageId = state?.message_id ?? null;

  if (messageId) {
    const edited = await editWebhookMessage(webhook.url, messageId, payload);

    // Jika pesan lama dihapus dari Discord, Worker membuat satu pesan pengganti.
    if (!edited) {
      const message = await sendWebhookMessage(webhook.url, payload);
      messageId = message.id;
    }
  } else {
    const message = await sendWebhookMessage(webhook.url, payload);
    messageId = message.id;
  }

  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO webhook_state
         (webhook_id, message_id, previous_count, last_updated)
       VALUES
         (?1, ?2, ?3, ?4)
       ON CONFLICT(webhook_id) DO UPDATE SET
         message_id = excluded.message_id,
         previous_count = excluded.previous_count,
         last_updated = excluded.last_updated`
    )
    .bind(webhook.id, messageId, growtopia.count, now)
    .run();

  return {
    ok: true,
    webhookId: webhook.id,
    webhookName: webhook.name,
    messageId,
    previousPlayers: previousCount,
    change:
      previousCount === null ? null : growtopia.count - previousCount,
    updatedAt: now,
  };
}

async function getGrowtopiaDetails() {
  const response = await fetch(`${DETAIL_URL}?t=${Date.now()}`, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "Growtopia-Online-Monitoring",
    },
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Endpoint Growtopia gagal diambil: ${response.status} ${response.statusText}`
    );
  }

  const rawText = await response.text();
  let data;

  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(
      `Respons Growtopia bukan JSON valid: ${rawText.slice(0, 200)}`
    );
  }

  const rawCount = data?.online_user;

  if (rawCount === undefined || rawCount === null) {
    throw new Error(
      `Kolom "online_user" tidak ditemukan. Respons: ${rawText.slice(0, 200)}`
    );
  }

  const count = Number(String(rawCount).replace(/[^\d]/g, ""));

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error(`Jumlah pemain tidak valid: ${String(rawCount)}`);
  }

  const wotdPath =
    data?.world_day_images?.full_size ||
    data?.world_day_images?.resize ||
    null;

  const wotdImageUrl = wotdPath
    ? new URL(String(wotdPath).replace(/^\/+/, ""), WEBSITE_URL).href
    : null;

  return {
    online: count > 0,
    count,
    wotdImageUrl,
    wotdName: getWorldNameFromImagePath(wotdPath),
  };
}

function getWorldNameFromImagePath(path) {
  if (!path) return "Unknown";

  const filename = String(path)
    .split("/")
    .pop()
    .replace(/\.[^.]+$/, "");

  let decoded = filename;

  try {
    decoded = decodeURIComponent(filename);
  } catch {
    // Gunakan filename asli jika encoding tidak valid.
  }

  return decoded.replace(/[-_]+/g, " ").trim().toUpperCase() || "Unknown";
}

function createDiscordPayload(growtopia, previousCount, webhook) {
  const currentCount = growtopia.count;
  const change =
    previousCount === null ? null : currentCount - previousCount;

  const percentageChange =
    change === null || previousCount === null || previousCount <= 0
      ? null
      : (change / previousCount) * 100;

  const unixTime = Math.floor(Date.now() / 1000);
  const emoji = webhook.emojis;

  let changeValue;
  let trendValue;

  if (change === null) {
    changeValue = `${emoji.stats} **Initial Check**`;
    trendValue = `${emoji.stats} Menunggu pembaruan berikutnya`;
  } else if (change > 0) {
    changeValue = `${emoji.plus} **+${formatNumber(change)}**`;
    trendValue = `${emoji.plus} Meningkat **+${formatPercentage(
      percentageChange
    )}%**`;
  } else if (change < 0) {
    changeValue = `${emoji.minus} **-${formatNumber(Math.abs(change))}**`;
    trendValue = `${emoji.minus} Menurun **-${formatPercentage(
      Math.abs(percentageChange)
    )}%**`;
  } else {
    changeValue = `${emoji.stats} **0**`;
    trendValue = `${emoji.stats} Stabil **0,00%**`;
  }

  const statusEmoji = growtopia.online ? emoji.online : emoji.offline;
  const statusText = growtopia.online ? "SERVER ONLINE" : "SERVER OFFLINE";

  const embed = {
    author: {
      name: "Growtopia Online Monitoring",
      url: WEBSITE_URL,
      icon_url: webhook.logoUrl,
    },
    title: `${statusEmoji} ${statusText}`,
    url: WEBSITE_URL,
    description: growtopia.online
      ? [
          "> Real-time Growtopia server monitoring.",
          "",
          `${emoji.player} **CURRENT ONLINE PLAYERS**`,
          `# ${formatNumber(currentCount)}`,
        ].join("\n")
      : [
          "> Real-time Growtopia server monitoring.",
          "",
          `${emoji.offline} **Growtopia server sedang offline atau tidak tersedia.**`,
        ].join("\n"),
    color: growtopia.online ? 0x57f287 : 0xed4245,
    fields: [
      {
        name: `${emoji.player} Online Players`,
        value: growtopia.online
          ? `\`\`\`${formatNumber(currentCount)}\`\`\``
          : "```OFFLINE```",
        inline: true,
      },
      {
        name: `${emoji.stats} Previous Check`,
        value:
          previousCount === null
            ? "```NO DATA```"
            : `\`\`\`${formatNumber(previousCount)}\`\`\``,
        inline: true,
      },
      {
        name: `${emoji.stats} Player Change`,
        value: changeValue,
        inline: true,
      },
      {
        name: `${emoji.stats} Player Trend`,
        value: trendValue,
        inline: true,
      },
      {
        name: `${emoji.world} World of the Day`,
        value: growtopia.wotdImageUrl
          ? [
              `**${growtopia.wotdName}**`,
              `[View Full Image](${growtopia.wotdImageUrl})`,
            ].join("\n")
          : "Data tidak tersedia",
        inline: true,
      },
      {
        name: `${emoji.clock} Refresh Rate`,
        value: "**Every 1 Minute**",
        inline: true,
      },
      {
        name: `${emoji.clock} Last Updated`,
        value: `<t:${unixTime}:R>`,
        inline: true,
      },
      {
        name: `${emoji.online} Data Source`,
        value: "[Growtopia Official Website](https://www.growtopiagame.com/)",
        inline: false,
      },
    ],
    footer: {
      text: webhook.footer,
      icon_url: webhook.logoUrl,
    },
    timestamp: new Date().toISOString(),
  };

  if (webhook.logoUrl) {
    embed.thumbnail = { url: webhook.logoUrl };
  }

  if (growtopia.wotdImageUrl) {
    embed.image = { url: growtopia.wotdImageUrl };
  }

  return {
    username: webhook.username,
    avatar_url: webhook.logoUrl,
    allowed_mentions: {
      parse: [],
    },
    embeds: [embed],
  };
}

async function sendWebhookMessage(webhookBase, payload) {
  const response = await discordRequest(`${webhookBase}?wait=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Webhook gagal mengirim pesan: ${response.status} ${await response.text()}`
    );
  }

  return response.json();
}

async function editWebhookMessage(webhookBase, messageId, payload) {
  // Discord hanya memakai username dan avatar_url ketika membuat pesan baru.
  const { username, avatar_url, ...editablePayload } = payload;

  const response = await discordRequest(
    `${webhookBase}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(editablePayload),
    }
  );

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    throw new Error(
      `Webhook gagal mengedit pesan: ${response.status} ${await response.text()}`
    );
  }

  return true;
}

async function discordRequest(url, init, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, init);

    if (response.status === 429 && attempt < maxAttempts) {
      let retryAfterMs = 1000;

      try {
        const rateLimit = await response.clone().json();
        const retryAfter = Number(rateLimit?.retry_after);

        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          retryAfterMs = retryAfter > 100 ? retryAfter : retryAfter * 1000;
        }
      } catch {
        const headerSeconds = Number(response.headers.get("retry-after"));
        if (Number.isFinite(headerSeconds) && headerSeconds > 0) {
          retryAfterMs = headerSeconds * 1000;
        }
      }

      await sleep(Math.min(retryAfterMs, 10_000));
      continue;
    }

    if (response.status >= 500 && attempt < maxAttempts) {
      await sleep(attempt * 500);
      continue;
    }

    return response;
  }

  throw new Error("Discord request gagal setelah beberapa percobaan.");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function formatNumber(value) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatPercentage(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0,00";
  }

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}
