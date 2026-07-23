const WEBSITE_URL = "https://www.growtopiagame.com/";
const DETAIL_URL = "https://www.growtopiagame.com/detail";

const LOGO_URL =
  "https://cdn.phototourl.com/free/2026-07-22-47dec906-4283-4af1-b922-7872f834771f.png";

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
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/run") {
      try {
        const result = await updateMonitor(env);

        return jsonResponse(
          result,
          result.ok ? 200 : 207
        );
      } catch (error) {
        console.error(
          "Manual run failed:",
          error
        );

        return jsonResponse(
          {
            ok: false,

            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
          500
        );
      }
    }

    return new Response(
      "Growtopia Online Monitoring aktif. Buka /run untuk tes manual.",
      {
        headers: {
          "Content-Type":
            "text/plain; charset=UTF-8",

          "Cache-Control":
            "no-store",
        },
      }
    );
  },

  async scheduled(
    controller,
    env,
    ctx
  ) {
    console.log(
      "CRON FIRED:",
      controller.cron,
      new Date(
        controller.scheduledTime
      ).toISOString()
    );

    ctx.waitUntil(
      updateMonitor(env).catch(
        (error) => {
          console.error(
            "Scheduled run failed:",

            error instanceof Error
              ? error.message
              : String(error)
          );

          throw error;
        }
      )
    );
  },
};

async function updateMonitor(env) {
  if (!env.DB) {
    throw new Error(
      'D1 binding "DB" belum dipasang.'
    );
  }

  const webhooks =
    getWebhookConfigs(env);

  await ensureDatabase(env.DB);

  /*
   * Jumlah pemain dan World of the Day
   * diambil sekaligus dari endpoint /detail.
   */
  const growtopia =
    await getGrowtopiaDetails();

  const settledResults =
    await Promise.allSettled(
      webhooks.map((webhook) =>
        updateWebhook(
          env.DB,
          webhook,
          growtopia
        )
      )
    );

  const results =
    settledResults.map(
      (result, index) => {
        const webhook =
          webhooks[index];

        if (
          result.status ===
          "fulfilled"
        ) {
          return result.value;
        }

        return {
          ok: false,

          webhookId:
            webhook.id,

          webhookName:
            webhook.name,

          error:
            result.reason instanceof
            Error
              ? result.reason.message
              : String(
                  result.reason
                ),
        };
      }
    );

  const successful =
    results.filter(
      (result) => result.ok
    ).length;

  const failed =
    results.length - successful;

  const output = {
    ok: failed === 0,

    online:
      growtopia.online,

    players:
      growtopia.count,

    worldOfTheDay:
      growtopia.wotdName,

    worldOfTheDayImage:
      growtopia.wotdImageUrl,

    totalWebhooks:
      webhooks.length,

    successful,
    failed,
    results,

    updatedAt:
      new Date().toISOString(),
  };

  console.log(
    "MONITOR UPDATED:",
    JSON.stringify(output)
  );

  return output;
}

function getWebhookConfigs(env) {
  /*
   * Mode banyak webhook.
   *
   * Secret:
   * DISCORD_WEBHOOKS_JSON
   */
  if (
    env.DISCORD_WEBHOOKS_JSON
  ) {
    let parsed;

    try {
      parsed = JSON.parse(
        env.DISCORD_WEBHOOKS_JSON
      );
    } catch (error) {
      throw new Error(
        `DISCORD_WEBHOOKS_JSON bukan JSON valid: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }

    if (
      !Array.isArray(parsed) ||
      parsed.length === 0
    ) {
      throw new Error(
        "DISCORD_WEBHOOKS_JSON harus berupa array dan minimal berisi satu webhook."
      );
    }

    const usedIds =
      new Set();

    return parsed.map(
      (item, index) => {
        const id = String(
          item?.id ?? ""
        ).trim();

        const name = String(
          item?.name ?? id ?? ""
        ).trim();

        const url = String(
          item?.url ?? ""
        ).trim();

        if (!id) {
          throw new Error(
            `Webhook urutan ${
              index + 1
            } tidak memiliki id.`
          );
        }

        if (
          usedIds.has(id)
        ) {
          throw new Error(
            `Webhook id duplikat: ${id}`
          );
        }

        if (
          !isDiscordWebhookUrl(
            url
          )
        ) {
          throw new Error(
            `URL webhook tidak valid pada id: ${id}`
          );
        }

        usedIds.add(id);

        return {
          id,

          name:
            name || id,

          url:
            normalizeWebhookUrl(
              url
            ),
        };
      }
    );
  }

  /*
   * Fallback untuk satu webhook.
   *
   * Secret:
   * DISCORD_WEBHOOK_URL
   */
  if (
    env.DISCORD_WEBHOOK_URL
  ) {
    const url = String(
      env.DISCORD_WEBHOOK_URL
    ).trim();

    if (
      !isDiscordWebhookUrl(
        url
      )
    ) {
      throw new Error(
        "DISCORD_WEBHOOK_URL tidak valid."
      );
    }

    return [
      {
        id: "default",

        name:
          "Default Server",

        url:
          normalizeWebhookUrl(
            url
          ),
      },
    ];
  }

  throw new Error(
    'Secret "DISCORD_WEBHOOKS_JSON" belum dipasang.'
  );
}

function normalizeWebhookUrl(
  url
) {
  return url
    .split("?")[0]
    .replace(/\/+$/, "");
}

function isDiscordWebhookUrl(
  url
) {
  return /^https:\/\/(?:canary\.|ptb\.)?(?:discord(?:app)?\.com)\/api(?:\/v\d+)?\/webhooks\/\d+\/[A-Za-z0-9._-]+/i.test(
    url
  );
}

async function ensureDatabase(
  db
) {
  /*
   * Tabel akan dibuat otomatis
   * kalau belum tersedia.
   */
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

async function updateWebhook(
  db,
  webhook,
  growtopia
) {
  const state = await db
    .prepare(
      `SELECT
         message_id,
         previous_count,
         last_updated
       FROM webhook_state
       WHERE webhook_id = ?1`
    )
    .bind(webhook.id)
    .first();

  const previousCount =
    state?.previous_count ===
      null ||
    state?.previous_count ===
      undefined
      ? null
      : Number(
          state.previous_count
        );

  const payload =
    createDiscordPayload(
      growtopia,
      previousCount
    );

  let messageId =
    state?.message_id ?? null;

  /*
   * Edit pesan lama agar tidak
   * mengirim pesan baru setiap menit.
   */
  if (messageId) {
    const edited =
      await editWebhookMessage(
        webhook.url,
        messageId,
        payload
      );

    /*
     * Jika pesan telah dihapus,
     * buat satu pesan baru.
     */
    if (!edited) {
      const message =
        await sendWebhookMessage(
          webhook.url,
          payload
        );

      messageId =
        message.id;
    }
  } else {
    const message =
      await sendWebhookMessage(
        webhook.url,
        payload
      );

    messageId =
      message.id;
  }

  const now =
    new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO webhook_state
         (
           webhook_id,
           message_id,
           previous_count,
           last_updated
         )
       VALUES
         (?1, ?2, ?3, ?4)
       ON CONFLICT(webhook_id)
       DO UPDATE SET
         message_id =
           excluded.message_id,
         previous_count =
           excluded.previous_count,
         last_updated =
           excluded.last_updated`
    )
    .bind(
      webhook.id,
      messageId,
      growtopia.count,
      now
    )
    .run();

  const change =
    previousCount === null
      ? null
      : growtopia.count -
        previousCount;

  return {
    ok: true,

    webhookId:
      webhook.id,

    webhookName:
      webhook.name,

    messageId,

    previousPlayers:
      previousCount,

    change,

    updatedAt: now,
  };
}

async function getGrowtopiaDetails() {
  const response = await fetch(
    `${DETAIL_URL}?t=${Date.now()}`,
    {
      method: "GET",

      headers: {
        Accept:
          "application/json, text/plain, */*",

        "User-Agent":
          "Growtopia-Online-Monitoring",
      },

      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Endpoint Growtopia gagal diambil: ${response.status} ${response.statusText}`
    );
  }

  const rawText =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(rawText);
  } catch {
    throw new Error(
      `Respons Growtopia bukan JSON valid: ${rawText.slice(
        0,
        200
      )}`
    );
  }

  /*
   * Jumlah pemain:
   *
   * data.online_user
   */
  const rawCount =
    data?.online_user;

  if (
    rawCount === undefined ||
    rawCount === null
  ) {
    throw new Error(
      `Kolom "online_user" tidak ditemukan. Respons: ${rawText.slice(
        0,
        200
      )}`
    );
  }

  const count = Number(
    String(rawCount).replace(
      /[^\d]/g,
      ""
    )
  );

  if (
    !Number.isSafeInteger(
      count
    ) ||
    count < 0
  ) {
    throw new Error(
      `Jumlah pemain tidak valid: ${String(
        rawCount
      )}`
    );
  }

  /*
   * World of the Day:
   *
   * data.world_day_images.full_size
   *
   * Contoh:
   * worlds/heatwaves.png
   */
  const wotdPath =
    data
      ?.world_day_images
      ?.full_size ||
    data
      ?.world_day_images
      ?.resize ||
    null;

  /*
   * Mengubah path relatif menjadi
   * URL gambar lengkap.
   */
  const wotdImageUrl =
    wotdPath
      ? new URL(
          String(
            wotdPath
          ).replace(
            /^\/+/,
            ""
          ),
          WEBSITE_URL
        ).href
      : null;

  return {
    online:
      count > 0,

    count,

    wotdImageUrl,

    wotdName:
      getWorldNameFromImagePath(
        wotdPath
      ),
  };
}

function getWorldNameFromImagePath(
  path
) {
  if (!path) {
    return "Unknown";
  }

  const filename =
    String(path)
      .split("/")
      .pop()
      .replace(
        /\.[^.]+$/,
        ""
      );

  return decodeURIComponent(
    filename
  )
    .replace(
      /[-_]+/g,
      " "
    )
    .trim()
    .toUpperCase();
}

function createDiscordPayload(
  growtopia,
  previousCount
) {
  const currentCount =
    growtopia.count;

  const change =
    previousCount === null
      ? null
      : currentCount -
        previousCount;

  const percentageChange =
    change === null ||
    previousCount === null ||
    previousCount <= 0
      ? null
      : (
          change /
          previousCount
        ) * 100;

  const unixTime =
    Math.floor(
      Date.now() / 1000
    );

  let changeValue;
  let trendValue;

  if (change === null) {
    changeValue =
      `${EMOJI.stats} **Initial Check**`;

    trendValue =
      `${EMOJI.stats} Menunggu pembaruan berikutnya`;
  } else if (change > 0) {
    changeValue =
      `${EMOJI.plus} **+${formatNumber(
        change
      )}**`;

    trendValue =
      `${EMOJI.plus} Meningkat ` +
      `**+${formatPercentage(
        percentageChange
      )}%**`;
  } else if (change < 0) {
    changeValue =
      `${EMOJI.minus} **-${formatNumber(
        Math.abs(change)
      )}**`;

    trendValue =
      `${EMOJI.minus} Menurun ` +
      `**-${formatPercentage(
        Math.abs(
          percentageChange
        )
      )}%**`;
  } else {
    changeValue =
      `${EMOJI.stats} **0**`;

    trendValue =
      `${EMOJI.stats} Stabil **0,00%**`;
  }

  const statusEmoji =
    growtopia.online
      ? EMOJI.online
      : EMOJI.offline;

  const statusText =
    growtopia.online
      ? "SERVER ONLINE"
      : "SERVER OFFLINE";

  const fields = [
    {
      name:
        `${EMOJI.player} Online Players`,

      value:
        growtopia.online
          ? `\`\`\`${formatNumber(
              currentCount
            )}\`\`\``
          : "```OFFLINE```",

      inline: true,
    },

    {
      name:
        `${EMOJI.stats} Previous Check`,

      value:
        previousCount === null
          ? "```NO DATA```"
          : `\`\`\`${formatNumber(
              previousCount
            )}\`\`\``,

      inline: true,
    },

    {
      name:
        `${EMOJI.stats} Player Change`,

      value:
        changeValue,

      inline: true,
    },

    {
      name:
        `${EMOJI.stats} Player Trend`,

      value:
        trendValue,

      inline: true,
    },

    {
      name:
        "🌍 World of the Day",

      value:
        growtopia.wotdImageUrl
          ? [
              `**${growtopia.wotdName}**`,
              `[View Full Image](${growtopia.wotdImageUrl})`,
            ].join("\n")
          : "Data tidak tersedia",

      inline: true,
    },

    {
      name:
        `${EMOJI.clock} Refresh Rate`,

      value:
        "**Every 1 Minute**",

      inline: true,
    },

    {
      name:
        `${EMOJI.clock} Last Updated`,

      value:
        `<t:${unixTime}:R>`,

      inline: true,
    },

    {
      name:
        `${EMOJI.online} Data Source`,

      value:
        "[Growtopia Official Website](https://www.growtopiagame.com/)",

      inline: false,
    },
  ];

  return {
    username:
      "Growtopia Online Monitoring",

    /*
     * Ini tetap menjadi foto profil
     * webhook, bukan gambar WOTD.
     */
    avatar_url:
      LOGO_URL,

    allowed_mentions: {
      parse: [],
    },

    embeds: [
      {
        author: {
          name:
            "Growtopia Online Monitoring",

          url:
            WEBSITE_URL,

          icon_url:
            LOGO_URL,
        },

        title:
          `${statusEmoji} ${statusText}`,

        url:
          WEBSITE_URL,

        description:
          growtopia.online
            ? [
                "> Real-time Growtopia server monitoring.",
                "",
                `${EMOJI.player} **CURRENT ONLINE PLAYERS**`,
                `# ${formatNumber(
                  currentCount
                )}`,
              ].join("\n")
            : [
                "> Real-time Growtopia server monitoring.",
                "",
                `${EMOJI.offline} **Growtopia server sedang offline atau tidak tersedia.**`,
              ].join("\n"),

        /*
         * Logo kecil di kanan atas.
         */
        thumbnail: {
          url:
            LOGO_URL,
        },

        /*
         * Gambar besar ini adalah
         * World of the Day dari /detail.
         */
        image:
          growtopia.wotdImageUrl
            ? {
                url:
                  growtopia.wotdImageUrl,
              }
            : undefined,

        color:
          growtopia.online
            ? 0x57f287
            : 0xed4245,

        fields,

        footer: {
          text:
            "Edgar • Growtopia Online Monitoring",

          icon_url:
            LOGO_URL,
        },

        timestamp:
          new Date().toISOString(),
      },
    ],
  };
}

async function sendWebhookMessage(
  webhookBase,
  payload
) {
  const response = await fetch(
    `${webhookBase}?wait=true`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Webhook gagal mengirim pesan: ${response.status} ${responseText}`
    );
  }

  return response.json();
}

async function editWebhookMessage(
  webhookBase,
  messageId,
  payload
) {
  /*
   * Username dan avatar_url tidak
   * digunakan ketika mengedit pesan.
   */
  const {
    username,
    avatar_url,
    ...editablePayload
  } = payload;

  const response = await fetch(
    `${webhookBase}/messages/${encodeURIComponent(
      messageId
    )}`,
    {
      method: "PATCH",

      headers: {
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(
          editablePayload
        ),
    }
  );

  if (
    response.status === 404
  ) {
    return false;
  }

  if (!response.ok) {
    const responseText =
      await response.text();

    throw new Error(
      `Webhook gagal mengedit pesan: ${response.status} ${responseText}`
    );
  }

  return true;
}

function formatNumber(value) {
  return new Intl.NumberFormat(
    "id-ID"
  ).format(value);
}

function formatPercentage(
  value
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "0,00";
  }

  return new Intl.NumberFormat(
    "id-ID",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function jsonResponse(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",

        "Cache-Control":
          "no-store",
      },
    }
  );
}
