# Changelog

Semua perubahan penting pada proyek ini dicatat di file ini.

## [1.2.0] — Multi-Webhook & World of the Day

### Added

- Dukungan banyak Discord webhook dalam satu Cloudflare Worker.
- Penyimpanan `message_id` terpisah untuk setiap webhook melalui Cloudflare D1.
- Gambar dan nama **World of the Day** dari endpoint resmi Growtopia `/detail`.
- Konfigurasi nama webhook, logo, footer, dan emoji per server.
- Pembatasan request paralel dan percobaan ulang saat terkena rate limit Discord.

### Improved

- Embed Discord dibuat lebih rapi dan informatif.
- Data Growtopia hanya diambil satu kali untuk seluruh webhook.
- Pesan lama diedit agar channel tidak dipenuhi pesan baru.
- Logging Cron dan respons endpoint `/run` dibuat lebih jelas.

## [1.1.0] — Improved Embed Design

- Menambahkan foto profil webhook dan logo embed.
- Menambahkan jumlah pemain sebelumnya dan waktu pembaruan terakhir.
- Menambahkan persentase kenaikan atau penurunan pemain.
- Menambahkan custom emoji plus dan minus.

## [1.0.0] — Initial Release

- Monitoring jumlah pemain Growtopia.
- Discord webhook embed.
- Cloudflare D1 untuk menyimpan state.
- Cloudflare Cron Trigger setiap satu menit.
