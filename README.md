<div align="center">

# 🌱 Growtopia Discord Player Monitor

Monitor jumlah pemain Growtopia secara otomatis melalui **Cloudflare Workers**, **D1 Database**, dan **Discord Webhook**.

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Discord Webhook](https://img.shields.io/badge/Discord-Webhook-5865F2?logo=discord&logoColor=white)](https://discord.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)

**Berjalan 24/7 tanpa komputer atau HP harus terus menyala.**

</div>

---

## ✨ Fitur

- Mengambil jumlah pemain Growtopia dari endpoint resmi.
- Mengirim status server ke Discord menggunakan webhook.
- Mengedit satu pesan yang sama agar channel tidak dipenuhi spam.
- Menampilkan jumlah pemain, perubahan, arah tren, dan persentase perubahan.
- Mendukung custom emoji dari server Discord.
- Berjalan otomatis setiap satu menit menggunakan Cloudflare Cron Trigger.
- Menyimpan ID pesan dan data sebelumnya di Cloudflare D1.
- Menyediakan endpoint `/run` untuk pengujian manual.
- Menampilkan log Cron dan hasil pembaruan melalui Observability Cloudflare.

## 🧱 Cara Kerja

```text
Growtopia API
     │
     ▼
Cloudflare Worker ──────► Discord Webhook
     │                         │
     ▼                         ▼
Cloudflare D1          Satu embed diperbarui
```

Pada setiap eksekusi, Worker akan:

1. Mengambil jumlah pemain terbaru.
2. Membaca jumlah pemain sebelumnya dari D1.
3. Menghitung selisih dan persentase perubahan.
4. Mengedit embed Discord yang sudah ada.
5. Menyimpan data terbaru ke D1.

## 📁 Struktur Proyek

```text
growtopia-monitor-cloudflare/
├── worker.js     # Kode utama Cloudflare Worker
├── schema.sql    # Struktur tabel Cloudflare D1
└── README.md     # Dokumentasi proyek
```

## 📋 Persyaratan

Sebelum memulai, siapkan:

- Akun Cloudflare.
- Server Discord yang dapat kamu kelola.
- Channel Discord untuk menampilkan monitor.
- Discord Webhook URL.
- Custom emoji Discord apabila ingin menggunakan tampilan bawaan proyek ini.

---

# 🚀 Instalasi

## 1. Membuat Discord Webhook

1. Buka server Discord.
2. Pilih channel tempat monitor akan dikirim.
3. Buka **Edit Channel**.
4. Pilih **Integrations** → **Webhooks**.
5. Klik **New Webhook**.
6. Atur nama dan channel webhook.
7. Klik **Copy Webhook URL**.

> [!CAUTION]
> Jangan membagikan URL webhook atau memasukkannya langsung ke repository GitHub. Siapa pun yang memiliki URL tersebut dapat mengirim pesan ke channel kamu.

## 2. Membuat Cloudflare Worker

1. Masuk ke Cloudflare Dashboard.
2. Buka **Workers & Pages**.
3. Klik **Create**.
4. Pilih **Worker** atau **Start with Hello World**.
5. Gunakan nama, misalnya:

```text
growtopia-monitoring
```

6. Klik **Deploy**.
7. Buka Worker yang baru dibuat.
8. Klik **Edit Code**.
9. Hapus seluruh kode bawaan.
10. Salin seluruh isi [`worker.js`](./worker.js) ke editor.
11. Klik **Deploy**.

Saat alamat Worker dibuka tanpa `/run`, responsnya akan seperti:

```text
Growtopia Monitor Edgar V5 aktif. Buka /run untuk tes manual.
```

## 3. Membuat Database D1

1. Di Cloudflare Dashboard, buka **Storage & Databases**.
2. Pilih **D1 SQL Database**.
3. Klik **Create Database**.
4. Gunakan nama, misalnya:

```text
growtopia-monitor-db
```

5. Buka database yang baru dibuat.
6. Masuk ke tab **Console**.
7. Jalankan isi [`schema.sql`](./schema.sql):

```sql
CREATE TABLE IF NOT EXISTS monitor_state (
  id INTEGER PRIMARY KEY,
  message_id TEXT,
  previous_count INTEGER,
  last_updated TEXT
);
```

## 4. Menghubungkan D1 ke Worker

1. Buka Worker `growtopia-monitoring`.
2. Masuk ke **Settings**.
3. Cari bagian **Bindings**.
4. Klik **Add Binding**.
5. Pilih **D1 Database**.
6. Isi nama variabel berikut secara persis:

```text
DB
```

7. Pilih database `growtopia-monitor-db`.
8. Simpan atau deploy perubahan.

> [!IMPORTANT]
> Nama binding harus `DB` karena kode membaca database melalui `env.DB`.

## 5. Menambahkan Discord Webhook sebagai Secret

1. Buka Worker.
2. Masuk ke **Settings**.
3. Cari **Variables and Secrets**.
4. Klik **Add**.
5. Pilih tipe **Secret**.
6. Gunakan nama variabel:

```text
DISCORD_WEBHOOK_URL
```

7. Isi value dengan Discord Webhook URL.
8. Simpan dan deploy perubahan.

## 6. Menjalankan Tes Manual

Tambahkan `/run` pada alamat Worker:

```text
https://NAMA-WORKER.NAMA-AKUN.workers.dev/run
```

Contoh respons berhasil:

```json
{
  "ok": true,
  "online": true,
  "players": 50000,
  "previousPlayers": 49800,
  "change": 200,
  "percentageChange": 0.4016,
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

Embed akan muncul di Discord. Jalankan `/run` sekali lagi untuk memastikan pesan lama diedit, bukan membuat pesan baru.

## 7. Mengaktifkan Cron Trigger

1. Buka Worker.
2. Masuk ke **Settings** → **Triggers**.
3. Cari bagian **Cron Triggers**.
4. Klik **Add Cron Trigger**.
5. Masukkan:

```cron
* * * * *
```

6. Simpan.

Jadwal tersebut menjalankan Worker setiap satu menit. Cron baru mungkin membutuhkan beberapa menit sebelum mulai aktif.

> [!NOTE]
> Jangan menghapus dan membuat ulang Cron berulang-ulang ketika belum langsung aktif karena proses aktivasi akan dimulai kembali.

## 8. Memeriksa Log Cron

1. Buka Worker.
2. Masuk ke **Observability** atau **Logs**.
3. Buka **Live Logs**.
4. Tunggu eksekusi berikutnya.

Log yang berhasil akan menampilkan pesan seperti:

```text
CRON FIRED: * * * * *
MONITOR UPDATED: ...
```

---

# 🎨 Custom Emoji

Emoji bawaan yang digunakan di [`worker.js`](./worker.js):

| Nama | Kode |
|---|---|
| Offline | `<:Offline:1529422157187387472>` |
| Online | `<:Online:1529422176212750366>` |
| Player | `<:Player:1529422279522517093>` |
| Stats | `<:Stats:1529422196060192861>` |
| Wall Clock | `<:WallClock:1529422130167676949>` |
| Plus | `<:Pluss:1529434551162769418>` |
| Minus | `<:Minuss:1529434532644786234>` |

Custom emoji harus tersedia di server tempat webhook berada. Untuk menggantinya, edit bagian berikut di `worker.js`:

```javascript
const EMOJI = {
  offline: "<:Offline:ID_EMOJI>",
  online: "<:Online:ID_EMOJI>",
  player: "<:Player:ID_EMOJI>",
  stats: "<:Stats:ID_EMOJI>",
  clock: "<:WallClock:ID_EMOJI>",
  plus: "<:Pluss:ID_EMOJI>",
  minus: "<:Minuss:ID_EMOJI>",
};
```

Jangan gunakan karakter backslash sebelum kode emoji di JavaScript.

```text
Benar:  <:Online:1529422176212750366>
Salah:  \<:Online:1529422176212750366>
```

# ⚙️ Kustomisasi

## Mengganti Nama Footer

Cari teks berikut di `worker.js`:

```text
Edgar • Growtopia Monitoring System • V5
```

Ganti `Edgar` dengan nama yang kamu inginkan.

## Mengubah Jadwal

| Interval | Cron Expression |
|---|---|
| Setiap 1 menit | `* * * * *` |
| Setiap 5 menit | `*/5 * * * *` |
| Setiap 10 menit | `*/10 * * * *` |
| Setiap 30 menit | `*/30 * * * *` |
| Setiap jam | `0 * * * *` |

Apabila jadwal diubah, sesuaikan juga teks **Refresh Rate** di `worker.js` agar informasi pada embed tetap benar.

## Rumus Persentase

```text
persentase = perubahan pemain / jumlah pemain sebelumnya × 100
```

Contoh:

```text
Pemain sebelumnya : 50.000
Pemain sekarang   : 50.250
Perubahan          : +250
Persentase         : 250 / 50.000 × 100 = 0,50%
```

---

# 🛠️ Troubleshooting

### `D1 binding "DB" belum dipasang`

Tambahkan D1 binding dengan variable name `DB`, lalu pilih database yang benar.

### `Secret "DISCORD_WEBHOOK_URL" belum dipasang`

Tambahkan Cloudflare Secret dengan nama `DISCORD_WEBHOOK_URL`.

### `no such table: monitor_state`

Jalankan isi `schema.sql` di D1 Console.

### Tampilan Discord masih menggunakan desain lama

- Pastikan kode terbaru sudah di-deploy.
- Pastikan kamu mengedit Worker yang benar.
- Periksa Worker lama yang mungkin menggunakan webhook yang sama.
- Matikan Cron Trigger pada Worker lama.

### Cron tidak berjalan

- Pastikan hanya ada satu Cron Trigger yang benar.
- Tunggu beberapa menit setelah membuat Cron.
- Periksa **Observability** atau **Live Logs**.
- Pastikan kode memiliki handler `async scheduled(...)`.
- Pastikan binding dan secret tersedia pada deployment produksi.

### Emoji muncul sebagai teks biasa

- Pastikan webhook berada di server yang memiliki emoji tersebut.
- Pastikan nama dan ID emoji benar.
- Jangan menambahkan backslash pada kode emoji di `worker.js`.

### Pesan baru dibuat setiap menit

- Pastikan D1 sudah terhubung.
- Pastikan tabel `monitor_state` sudah dibuat.
- Jangan menghapus pesan monitor dari Discord.
- Jika pesan dihapus, Worker akan membuat satu pesan baru dan menyimpan ID barunya.

# 🔐 Keamanan

- Jangan commit Discord Webhook URL ke GitHub.
- Simpan webhook melalui Cloudflare Secret.
- Jangan membagikan tangkapan layar yang memperlihatkan URL webhook.
- Jika webhook bocor, hapus webhook lama dan buat webhook baru.

# 📄 Lisensi

Proyek ini dapat digunakan dan dimodifikasi untuk kebutuhan pribadi. Tambahkan file lisensi terpisah apabila repository akan didistribusikan secara publik dengan ketentuan tertentu.

---

<div align="center">

Dibuat oleh **Edgar** menggunakan Cloudflare Workers, D1, dan Discord Webhook.

</div>
