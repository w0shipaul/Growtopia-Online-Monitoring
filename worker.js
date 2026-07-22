const WEBSITE_URL = "https://www.growtopiagame.com/";
const DETAIL_URL = "https://www.growtopiagame.com/detail";

const EMOJI = {
  offline: "<:Offline:1529422157187387472>",
  online: "<:Online:1529422176212750366>",
  player: "<:Player:1529422279522517093>",
  stats: "<:Stats:1529422196060192861>",
  clock: "<:WallClock:1529422130167676949>",
  plus: "<:Pluss:1529434551162769418>",
  minus: "<:Minuss:1529434532644786234>",
};

export default {
  // Tes manual melalui alamat Worker + /run
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/run") {
      try {
        const result = await updateMonitor(env);
        return jsonResponse(result, 200);
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
      "Growtopia Monitor Edgar V5 aktif. Buka /run untuk tes manual.",
      {
        headers: {
          "Content-Type": "text/plain; charset=UTF-8",
          "Cache-Control": "no-store",
        },
      }
    );
  },

  // Dipanggil otomatis oleh Cron Trigger Cloudflare
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

  if (!env.DISCORD_WEBHOOK_URL) {
    throw new Error('Secret "DISCORD_WEBHOOK_URL" belum dipasang.');
  }

  const state = await env.DB.prepare(
    `SELECT message_id, previous_count, last_updated
     FROM monitor_state
     WHERE id = 1`
  ).first();

  const status = await getGrowtopiaStatus();

  const previousCount =
    state?.previous_count === null || state?.previous_count === undefined
      ? null
      : Number(state.previous_count);

  const payload = createDiscordPayload(status, previousCount);

  const webhookBase = String(env.DISCORD_WEBHOOK_URL)
    .split("?")[0]
    .replace(/\/+$/, "");

  let messageId = state?.message_id ?? null;

  // Edit pesan lama agar Discord tidak penuh spam.
  if (messageId) {
    const edited = await editWebhookMessage(webhookBase, messageId, payload);

    // Jika pesan lama sudah dihapus, buat pesan baru.
    if (!edited) {
      const message = await sendWebhookMessage(webhookBase, payload);
      messageId = message.id;
    }
  } else {
    const message = await sendWebhookMessage(webhookBase, payload);
    messageId = message.id;
  }

  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO monitor_state
       (id, message_id, previous_count, last_updated)
     VALUES
       (1, ?1, ?2, ?3)
     ON CONFLICT(id) DO UPDATE SET
       message_id = excluded.message_id,
       previous_count = excluded.previous_count,
       last_updated = excluded.last_updated`
  )
    .bind(messageId, status.count, now)
    .run();

  const change =
    previousCount === null ? null : status.count - previousCount;

  const percentageChange =
    change === null || previousCount === null || previousCount <= 0
      ? null
      : (change / previousCount) * 100;

  const result = {
    ok: true,
    source: DETAIL_URL,
    online: status.online,
    players: status.count,
    previousPlayers: previousCount,
    change,
    percentageChange,
    messageId,
    updatedAt: now,
  };

  console.log("MONITOR UPDATED:", JSON.stringify(result));
  return result;
}

async function getGrowtopiaStatus() {
  const response = await fetch(`${DETAIL_URL}?t=${Date.now()}`, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "Growtopia-Monitor-Cloudflare/5.0",
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

  return {
    online: count > 0,
    count,
  };
}

function createDiscordPayload(status, previousCount) {
  const change =
    previousCount === null ? null : status.count - previousCount;

  const percentageChange =
    change === null || previousCount === null || previousCount <= 0
      ? null
      : (change / previousCount) * 100;

  let changeText;
  let trendText;

  if (change === null) {
    changeText = `${EMOJI.stats} Initial Check`;
    trendText = `${EMOJI.stats} Belum ada data sebelumnya untuk dibandingkan`;
  } else if (change > 0) {
    changeText = `${EMOJI.plus} +${formatNumber(change)}`;
    trendText =
      `${EMOJI.plus} Jumlah pemain meningkat ` +
      `**+${formatPercentage(percentageChange)}%**`;
  } else if (change < 0) {
    changeText = `${EMOJI.minus} -${formatNumber(Math.abs(change))}`;
    trendText =
      `${EMOJI.minus} Jumlah pemain menurun ` +
      `**-${formatPercentage(Math.abs(percentageChange))}%**`;
  } else {
    changeText = `${EMOJI.stats} 0`;
    trendText = `${EMOJI.stats} Jumlah pemain stabil **0,00%**`;
  }

  const statusEmoji = status.online ? EMOJI.online : EMOJI.offline;
  const statusText = status.online ? "Server Online" : "Server Offline";

  return {
    username: "Growtopia Monitor",

    allowed_mentions: {
      parse: [],
    },

    embeds: [
      {
        author: {
          name: "Growtopia Live Status",
          url: WEBSITE_URL,
        },

        title: `${statusEmoji} ${statusText}`,
        url: WEBSITE_URL,

        description: status.online
          ? [
              `${EMOJI.online} **Growtopia Server is Online**`,
              "",
              `${EMOJI.player} **${formatNumber(
                status.count
              )} Players Online**`,
            ].join("\n")
          : [
              `${EMOJI.offline} **Growtopia Server is Offline**`,
              "",
              "Server sedang tidak tersedia.",
            ].join("\n"),

        color: status.online ? 0x57f287 : 0xed4245,

        fields: [
          {
            name: `${EMOJI.player} Online Players`,
            value: status.online
              ? `**${formatNumber(status.count)}**`
              : "**OFFLINE**",
            inline: true,
          },
          {
            name: `${EMOJI.stats} Player Change`,
            value: `**${changeText}**`,
            inline: true,
          },
          {
            name: `${EMOJI.stats} Player Trend`,
            value: trendText,
            inline: false,
          },
          {
            name: `${EMOJI.clock} Refresh Rate`,
            value: "**Every 1 Minute**",
            inline: true,
          },
          {
            name: `${EMOJI.online} Data Source`,
            value:
              "[Growtopia Official Website](https://www.growtopiagame.com/)",
            inline: true,
          },
        ],

        footer: {
          text: "Edgar • Growtopia Monitoring System • V5",
        },

        timestamp: new Date().toISOString(),
      },
    ],
  };
}

async function sendWebhookMessage(webhookBase, payload) {
  const response = await fetch(`${webhookBase}?wait=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Webhook gagal mengirim pesan: ${response.status} ${responseText}`
    );
  }

  return response.json();
}

async function editWebhookMessage(webhookBase, messageId, payload) {
  const response = await fetch(
    `${webhookBase}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Webhook gagal mengedit pesan: ${response.status} ${responseText}`
    );
  }

  return true;
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
