<div align="center">
  <img src="https://cdn.phototourl.com/free/2026-07-22-47dec906-4283-4af1-b922-7872f834771f.png" alt="Growtopia Online Monitoring" width="128" />

# Growtopia Online Monitoring

**Monitor jumlah pemain dan World of the Day Growtopia secara otomatis melalui Discord webhook.**

![JavaScript](https://img.shields.io/badge/JavaScript-Cloudflare%20Workers-F7DF1E?logo=javascript&logoColor=111)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1-F38020?logo=cloudflare&logoColor=white)
![Discord](https://img.shields.io/badge/Discord-Webhook-5865F2?logo=discord&logoColor=white)

</div>

## Tentang proyek

Growtopia Online Monitoring adalah Cloudflare Worker yang mengambil data dari endpoint resmi Growtopia, lalu mengirim atau memperbarui embed pada satu atau banyak server Discord.

Worker mengambil data Growtopia **satu kali setiap pembaruan**, kemudian menyebarkannya ke seluruh webhook yang terdaftar. Setiap webhook memiliki `message_id` tersendiri di Cloudflare D1 sehingga pesan yang sama dapat terus diedit tanpa memenuhi channel.

## Fitur

- Monitoring jumlah pemain Growtopia secara real-time.
- Status server Online atau Offline.
- Jumlah pemain sekarang dan pengecekan sebelumnya.
- Perubahan pemain beserta persentase kenaikan atau penurunan.
- Gambar dan nama **World of the Day** dari endpoint `/detail`.
- Dukungan banyak server atau webhook dalam satu Worker.
- Konfigurasi logo, nama, footer, dan emoji per server.
- Pesan Discord lama terus diedit sehingga tidak menimbulkan spam.
- Pembaruan otomatis melalui Cloudflare Cron Trigger.
- Dapat berjalan tanpa komputer atau HP menyala.
- Percobaan ulang otomatis ketika Discord terkena rate limit sementara.

## Struktur proyek

```text
growtopia-online-monitoring/
├── .gitignore
├── CHANGELOG.md
├── README.md
├── schema.sql
├── webhooks.example.json
└── worker.js
```

## Cara kerja

```text
Cloudflare Cron Trigger
          │
          ▼
Growtopia /detail endpoint
          │
          ├── Jumlah pemain
          └── World of the Day
          │
          ▼
Cloudflare Worker
          │
          ├── Discord Webhook Server 1
          ├── Discord Webhook Server 2
          └── Discord Webhook Server lainnya
          │
          ▼
Cloudflare D1 menyimpan message_id dan data sebelumnya
```

## Persyaratan

- Akun Cloudflare.
- Server Discord dan izin **Manage Webhooks**.
- Minimal satu Discord webhook.
- Tidak memerlukan Node.js, PowerShell, atau perangkat yang menyala terus apabila pemasangan dilakukan melalui dashboard Cloudflare.

# Instalasi melalui dashboard Cloudflare

## 1. Buat Discord webhook

Lakukan langkah berikut pada setiap server atau channel yang ingin menerima monitor:

1. Buka server Discord.
2. Pilih channel tujuan.
3. Buka **Edit Channel → Integrations → Webhooks**.
4. Pilih **New Webhook**.
5. Atur nama, avatar, dan channel tujuan.
6. Pilih **Copy Webhook URL**.
7. Simpan URL secara rahasia.

> [!CAUTION]
> URL webhook adalah token rahasia. Jangan menaruh URL asli di repository GitHub, screenshot, atau pesan publik.

## 2. Buat Cloudflare Worker

1. Masuk ke Cloudflare Dashboard.
2. Buka **Workers & Pages**.
3. Pilih **Create application**.
4. Pilih **Start with Hello World**.
5. Beri nama, misalnya `growtopia-online-monitoring`.
6. Pilih **Deploy**.
7. Buka Worker yang baru dibuat.
8. Pilih **Edit code**.
9. Hapus seluruh kode bawaan.
10. Salin seluruh isi [`worker.js`](worker.js) ke editor.
11. Pilih **Deploy**.

Ketika alamat Worker dibuka tanpa `/run`, responsnya akan berbentuk:

```text
Growtopia Online Monitoring aktif. Buka /run untuk menjalankan tes manual.
```

## 3. Buat database Cloudflare D1

1. Di Cloudflare Dashboard, buka **D1 SQL Database**.
2. Pilih **Create Database**.
3. Beri nama, misalnya `growtopia-monitor-db`.
4. Buka database tersebut.
5. Pilih tab **Console**.
6. Salin seluruh isi [`schema.sql`](schema.sql).
7. Tempel ke D1 Console.
8. Pilih **Execute**.

Tabel yang dibuat:

```sql
CREATE TABLE IF NOT EXISTS webhook_state (
  webhook_id TEXT PRIMARY KEY,
  message_id TEXT,
  previous_count INTEGER,
  last_updated TEXT
);
```

## 4. Hubungkan D1 ke Worker

1. Kembali ke Worker `growtopia-online-monitoring`.
2. Buka tab **Bindings** atau bagian **Settings → Bindings**.
3. Pilih **Add binding**.
4. Pilih **D1 Database**.
5. Isi nama variabel dengan tepat:

```text
DB
```

6. Pilih database `growtopia-monitor-db`.
7. Simpan atau deploy perubahan.

Nama binding harus `DB` karena kode mengakses database melalui `env.DB`.

## 5. Susun daftar webhook

Gunakan [`webhooks.example.json`](webhooks.example.json) sebagai contoh. Format paling sederhana:

```json
[
  {
    "id": "server-satu",
    "name": "Server Satu",
    "url": "https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN"
  },
  {
    "id": "server-dua",
    "name": "Server Dua",
    "url": "https://discord.com/api/webhooks/WEBHOOK_ID_2/WEBHOOK_TOKEN_2"
  }
]
```

Aturan penting:

- `id` wajib unik dan tidak boleh berubah setelah monitor berjalan.
- `name` hanya digunakan untuk log dan respons `/run`.
- `url` harus berisi URL webhook Discord lengkap.
- Jangan menaruh koma setelah item terakhir.

### Konfigurasi opsional per server

Setiap webhook dapat memiliki tampilan sendiri:

```json
{
  "id": "server-edgar",
  "name": "Server Edgar",
  "url": "https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN",
  "username": "Growtopia Online Monitoring",
  "logoUrl": "https://example.com/logo.png",
  "footer": "Edgar • Growtopia Online Monitoring",
  "emojis": {
    "online": "🟢",
    "offline": "🔴",
    "player": "👥",
    "stats": "📊",
    "clock": "⏰",
    "plus": "📈",
    "minus": "📉",
    "world": "🌍"
  }
}
```

Konfigurasi `username`, `logoUrl`, `footer`, dan `emojis` bersifat opsional. Jika tidak diisi, Worker memakai pengaturan bawaan.

## 6. Simpan daftar webhook sebagai Cloudflare Secret

1. Buka Worker.
2. Pilih **Settings**.
3. Cari **Variables and Secrets**.
4. Pilih **Add**.
5. Pilih tipe **Secret**.
6. Isi nama variabel:

```text
DISCORD_WEBHOOKS_JSON
```

7. Pada bagian value, tempel seluruh JSON daftar webhook.
8. Pilih **Deploy**.

> [!IMPORTANT]
> Jangan menyimpan daftar webhook sebagai plaintext variable. Gunakan tipe **Secret** agar nilainya disembunyikan di dashboard.

### Mode satu webhook lama

Script juga masih mendukung Secret berikut sebagai fallback:

```text
DISCORD_WEBHOOK_URL
```

Namun untuk pemasangan baru, gunakan `DISCORD_WEBHOOKS_JSON` supaya mudah menambah server di kemudian hari.

## 7. Tes manual

Buka URL Worker dan tambahkan `/run`:

```text
https://NAMA-WORKER.NAMA-AKUN.workers.dev/run
```

Contoh respons berhasil:

```json
{
  "ok": true,
  "online": true,
  "players": 46786,
  "worldOfTheDay": "HEATWAVES",
  "worldOfTheDayImage": "https://www.growtopiagame.com/worlds/heatwaves.png",
  "totalWebhooks": 2,
  "successful": 2,
  "failed": 0
}
```

Periksa semua channel Discord. Setiap webhook seharusnya menerima satu embed.

Jalankan `/run` sekali lagi. Worker seharusnya mengedit pesan yang sama, bukan membuat pesan baru.

## 8. Aktifkan pembaruan otomatis

1. Buka Worker.
2. Masuk ke **Settings → Triggers → Cron Triggers**.
3. Pilih **Add Cron Trigger**.
4. Masukkan:

```cron
* * * * *
```

5. Simpan.

Jadwal tersebut menjalankan Worker setiap satu menit. Perubahan Cron Trigger dapat memerlukan beberapa menit sebelum aktif sepenuhnya.

## 9. Periksa log

Buka bagian **Observability** atau **Logs** pada Worker. Ketika Cron berjalan, log akan menampilkan pesan seperti:

```text
CRON FIRED: * * * * *
MONITOR UPDATED: {...}
```

# Menambah atau menghapus server

## Menambah server

1. Buat webhook baru pada Discord.
2. Buka Secret `DISCORD_WEBHOOKS_JSON`.
3. Tambahkan objek baru dengan `id` unik.
4. Deploy perubahan.
5. Buka `/run` untuk tes langsung.

## Menghapus server

1. Hapus objek server dari `DISCORD_WEBHOOKS_JSON`.
2. Deploy perubahan.
3. Opsional: hapus state lama dari D1:

```sql
DELETE FROM webhook_state
WHERE webhook_id = 'id-server-yang-dihapus';
```

# Mengganti emoji Discord

Format custom emoji statis:

```text
<:NamaEmoji:ID_EMOJI>
```

Format custom emoji animasi:

```text
<a:NamaEmoji:ID_EMOJI>
```

Untuk melihat kode mentah emoji di Discord, kirim emoji dengan karakter backslash di depannya. Backslash hanya digunakan saat mengambil ID; jangan memasukkannya ke JSON atau `worker.js`.

Server yang tidak menggunakan custom emoji dapat memakai emoji Unicode biasa melalui konfigurasi `emojis` per webhook.

# Mengganti foto profil dan logo embed

Ubah `logoUrl` pada konfigurasi webhook:

```json
{
  "logoUrl": "https://example.com/logo.png"
}
```

Gunakan URL gambar publik yang dapat dibuka langsung melalui HTTPS.

`avatar_url` diterapkan ketika Worker membuat pesan baru. Jika foto profil pesan lama tidak berubah:

1. Hapus pesan monitor lama di Discord.
2. Jalankan perintah berikut di D1 Console:

```sql
DELETE FROM webhook_state
WHERE webhook_id = 'id-server';
```

3. Buka `/run` untuk membuat pesan baru.

# Reset seluruh pesan monitor

Gunakan perintah berikut jika seluruh pesan ingin dibuat ulang:

```sql
DELETE FROM webhook_state;
```

Setelah itu, buka `/run`. Worker akan membuat satu pesan baru untuk setiap webhook.

# Mengubah jadwal

| Jadwal | Cron expression |
|---|---|
| Setiap 1 menit | `* * * * *` |
| Setiap 5 menit | `*/5 * * * *` |
| Setiap 10 menit | `*/10 * * * *` |
| Setiap 30 menit | `*/30 * * * *` |
| Setiap jam | `0 * * * *` |

Cloudflare Cron menggunakan waktu UTC. Jika interval diubah, sesuaikan juga teks **Refresh Rate** di `worker.js`.

# Troubleshooting

### `D1 binding "DB" belum dipasang`

Tambahkan binding D1 dengan nama variabel `DB` dan pilih database yang benar.

### `DISCORD_WEBHOOKS_JSON bukan JSON valid`

Periksa tanda kutip, koma, kurung siku, dan kurung kurawal. Gunakan `webhooks.example.json` sebagai acuan.

### `Webhook id duplikat`

Setiap item harus memiliki `id` yang berbeda.

### `URL webhook tidak valid`

Pastikan URL berasal dari Discord dan belum dipotong. Buat ulang webhook apabila token sudah tidak valid.

### Emoji muncul sebagai teks biasa

Periksa nama dan ID emoji. Untuk server berbeda, gunakan emoji Unicode atau masukkan konfigurasi emoji milik server tersebut.

### Pesan baru terus dibuat

- Pastikan D1 binding `DB` terhubung.
- Pastikan tabel `webhook_state` tersedia.
- Jangan mengubah nilai `id` webhook setelah monitor berjalan.
- Jika pesan lama dihapus, Worker memang akan membuat satu pesan pengganti.

### Cron tidak berjalan

- Pastikan hanya ada satu Cron Trigger yang benar.
- Tunggu beberapa menit setelah membuat atau mengubah Cron.
- Periksa **Observability / Logs**.
- Pastikan deployment terbaru memiliki fungsi `scheduled()`.

### World of the Day tidak tampil

Worker membaca `world_day_images.full_size` dari endpoint resmi `/detail`. Jika kolom tersebut kosong atau endpoint sedang bermasalah, embed tetap diperbarui tanpa gambar.

# Keamanan

- Jangan commit URL webhook ke GitHub.
- Jangan memasukkan webhook asli ke `webhooks.example.json`.
- Simpan daftar webhook sebagai Cloudflare Secret.
- Jika webhook bocor, hapus webhook lama dan buat webhook baru.
- Jangan membagikan screenshot yang memperlihatkan URL atau token webhook.

# Sumber data dan dokumentasi

- Growtopia detail endpoint: `https://www.growtopiagame.com/detail`
- Cloudflare Workers: `https://developers.cloudflare.com/workers/`
- Cloudflare D1: `https://developers.cloudflare.com/d1/`
- Cloudflare Secrets: `https://developers.cloudflare.com/workers/configuration/secrets/`
- Cloudflare Cron Triggers: `https://developers.cloudflare.com/workers/configuration/cron-triggers/`
- Discord Webhook API: `https://docs.discord.com/developers/resources/webhook`

# Credits

Created by **Edgar**.
