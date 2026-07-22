GROWTOPIA DISCORD PLAYER MONITOR
Cloudflare Workers + D1 + Discord Webhook
Dibuat untuk: Edgar

============================================================
ISI FOLDER
============================================================

1. worker.js
   Kode utama Cloudflare Worker.

2. schema.sql
   Perintah SQL untuk membuat tabel database D1.

3. Read Me.txt
   Tutorial lengkap pemasangan.

============================================================
FITUR
============================================================

- Mengambil jumlah pemain Growtopia dari website resminya.
- Mengirim status ke Discord menggunakan webhook.
- Mengedit satu pesan yang sama agar channel tidak dipenuhi spam.
- Menampilkan pemain online, perubahan pemain, tren, dan persentase.
- Menggunakan custom emoji Discord server.
- Berjalan otomatis setiap satu menit melalui Cloudflare Cron Trigger.
- Komputer atau HP tidak perlu terus menyala.

============================================================
LANGKAH 1 — MEMBUAT DISCORD WEBHOOK
============================================================

1. Buka server Discord.
2. Buka channel tempat monitor akan dikirim.
3. Klik Edit Channel.
4. Pilih Integrations.
5. Pilih Webhooks.
6. Klik New Webhook.
7. Atur nama dan channel.
8. Klik Copy Webhook URL.
9. Simpan URL tersebut secara rahasia.

PENTING:
Jangan pernah membagikan URL webhook kepada orang lain.
Orang yang memiliki URL tersebut dapat mengirim pesan ke channel kamu.

============================================================
LANGKAH 2 — MEMBUAT CLOUDFLARE WORKER
============================================================

1. Masuk ke dashboard Cloudflare.
2. Buka Workers & Pages.
3. Klik Create.
4. Pilih Worker atau Start with Hello World.
5. Beri nama, contoh:

   growtopia-monitoring

6. Klik Deploy.
7. Buka Worker tersebut.
8. Klik Edit Code.
9. Hapus seluruh kode bawaan.
10. Buka file worker.js dari folder ini.
11. Salin seluruh isi worker.js ke editor Cloudflare.
12. Klik Deploy.

Saat membuka alamat Worker tanpa /run, halaman seharusnya menampilkan:

Growtopia Monitor Edgar V5 aktif. Buka /run untuk tes manual.

============================================================
LANGKAH 3 — MEMBUAT DATABASE D1
============================================================

1. Di dashboard Cloudflare, buka Storage & Databases.
2. Pilih D1 SQL Database.
3. Klik Create Database.
4. Beri nama, contoh:

   growtopia-monitor-db

5. Buka database yang baru dibuat.
6. Buka tab Console.
7. Buka file schema.sql dari folder ini.
8. Salin isi schema.sql ke Console.
9. Klik Execute.

Perintah yang dijalankan:

CREATE TABLE IF NOT EXISTS monitor_state (
  id INTEGER PRIMARY KEY,
  message_id TEXT,
  previous_count INTEGER,
  last_updated TEXT
);

============================================================
LANGKAH 4 — MENGHUBUNGKAN D1 KE WORKER
============================================================

1. Kembali ke Worker growtopia-monitoring.
2. Buka Settings.
3. Cari Bindings.
4. Klik Add Binding.
5. Pilih D1 Database.
6. Variable name harus persis:

   DB

7. Pilih database:

   growtopia-monitor-db

8. Simpan atau Deploy perubahan.

Nama DB harus sama persis karena worker.js membaca database melalui env.DB.

============================================================
LANGKAH 5 — MENAMBAHKAN DISCORD WEBHOOK SEBAGAI SECRET
============================================================

1. Buka Worker growtopia-monitoring.
2. Buka Settings.
3. Cari Variables and Secrets.
4. Klik Add.
5. Pilih Secret.
6. Variable name harus persis:

   DISCORD_WEBHOOK_URL

7. Isi Value dengan URL webhook Discord.
8. Simpan dan Deploy.

Jangan menaruh URL webhook langsung di worker.js.

============================================================
LANGKAH 6 — TES MANUAL
============================================================

Buka alamat Worker dan tambahkan /run.

Contoh:

https://NAMA-WORKER.NAMA-AKUN.workers.dev/run

Jika berhasil, browser akan menampilkan JSON seperti:

{
  "ok": true,
  "online": true,
  "players": 50000,
  "previousPlayers": 49800,
  "change": 200,
  "percentageChange": 0.4016,
  "updatedAt": "..."
}

Pesan embed juga akan muncul di Discord.

Buka /run sekali lagi untuk memastikan pesan lama diedit dan bukan membuat
pesan baru setiap kali.

============================================================
LANGKAH 7 — MEMBUAT CRON TRIGGER SETIAP SATU MENIT
============================================================

1. Buka Worker growtopia-monitoring.
2. Buka Settings.
3. Buka Triggers.
4. Cari Cron Triggers.
5. Klik Add Cron Trigger.
6. Masukkan:

   * * * * *

7. Simpan.

Arti * * * * * adalah menjalankan Worker setiap satu menit.

Setelah dibuat, Cron mungkin membutuhkan beberapa menit sebelum mulai aktif.
Jangan terus-menerus menghapus dan membuat ulang Cron karena waktu aktivasi
akan dimulai kembali.

============================================================
LANGKAH 8 — MELIHAT LOG CRON
============================================================

1. Buka Worker growtopia-monitoring.
2. Buka Observability atau Logs.
3. Buka Live Logs.
4. Tunggu sekitar satu menit.

Jika Cron berjalan, log akan menampilkan:

CRON FIRED: * * * * *
MONITOR UPDATED: ...

Jika tidak muncul, periksa kembali apakah Cron Trigger dipasang pada Worker
yang benar.

============================================================
CUSTOM EMOJI YANG DIGUNAKAN
============================================================

Offline:
<:Offline:1529422157187387472>

Online:
<:Online:1529422176212750366>

Player:
<:Player:1529422279522517093>

Stats:
<:Stats:1529422196060192861>

Clock:
<:WallClock:1529422130167676949>

Plus:
<:Pluss:1529434551162769418>

Minus:
<:Minuss:1529434532644786234>

Jangan menggunakan karakter backslash sebelum kode emoji di worker.js.

Benar:
<:Online:1529422176212750366>

Salah:
\<:Online:1529422176212750366>

============================================================
CARA MENGGANTI NAMA EDGAR
============================================================

Cari teks ini di worker.js:

Edgar • Growtopia Monitoring System • V5

Lalu ganti Edgar dengan nama yang diinginkan.

============================================================
CARA MENGUBAH JADWAL
============================================================

Setiap 1 menit:
* * * * *

Setiap 5 menit:
*/5 * * * *

Setiap 10 menit:
*/10 * * * *

Setiap 30 menit:
*/30 * * * *

Setiap jam:
0 * * * *

Jika jadwal Cron diubah, sesuaikan juga teks Refresh Rate di worker.js agar
tampilan Discord tidak menampilkan informasi yang salah.

============================================================
MASALAH UMUM DAN SOLUSI
============================================================

1. ERROR: D1 binding "DB" belum dipasang.

   Solusi:
   Tambahkan D1 binding dengan nama DB dan pilih database yang benar.

2. ERROR: Secret "DISCORD_WEBHOOK_URL" belum dipasang.

   Solusi:
   Tambahkan Secret dengan nama DISCORD_WEBHOOK_URL.

3. ERROR: no such table: monitor_state.

   Solusi:
   Jalankan isi schema.sql di D1 Console.

4. Tampilan Discord masih desain lama.

   Solusi:
   - Pastikan kode baru sudah di-Deploy.
   - Pastikan kamu mengedit Worker yang benar.
   - Cari Worker lama yang mungkin memakai webhook yang sama.
   - Matikan Cron Trigger pada Worker lama.

5. Cron tidak berjalan.

   Solusi:
   - Pastikan ada satu Cron Trigger * * * * *.
   - Tunggu beberapa menit setelah membuat Cron.
   - Periksa Observability atau Live Logs.
   - Pastikan kode memiliki fungsi async scheduled(...).
   - Pastikan binding DB dan secret tersedia pada Worker produksi.

6. Emoji muncul sebagai teks biasa.

   Solusi:
   - Pastikan webhook berada di server yang memiliki emoji tersebut.
   - Pastikan ID emoji benar.
   - Jangan menambahkan backslash sebelum emoji di worker.js.

7. Pesan Discord baru terus dibuat setiap menit.

   Solusi:
   - Pastikan database D1 terhubung.
   - Pastikan tabel monitor_state sudah dibuat.
   - Jangan menghapus pesan monitor dari Discord.
   - Jika pesan dihapus, Worker otomatis membuat satu pesan baru.

8. Persentase terlihat sangat kecil.

   Itu normal karena persentase dihitung dengan rumus:

   perubahan pemain / jumlah pemain sebelumnya × 100

Contoh:
Pemain sebelumnya = 50.000
Pemain sekarang = 50.250
Perubahan = 250
Persentase = 250 / 50.000 × 100 = 0,50%

============================================================
CATATAN KEAMANAN
============================================================

- Jangan membagikan URL Discord webhook.
- Jangan menaruh webhook di kode publik atau GitHub.
- Jika webhook bocor, hapus webhook lama dan buat webhook baru.
- Simpan webhook menggunakan Cloudflare Secret.

============================================================
SELESAI
============================================================

Setelah semua langkah selesai, Cloudflare akan mengambil jumlah pemain
Growtopia setiap satu menit, membandingkannya dengan data sebelumnya,
menghitung persentase kenaikan atau penurunan, lalu memperbarui satu pesan
Discord yang sama secara otomatis.
