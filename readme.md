# Choco AI 

Sebuah aplikasi web AI Chat *full-stack* yang dibangun dengan backend Python (Flask) dan antarmuka frontend (HTML, CSS, JS) dengan gaya desain Neo-Brutalism yang khas.



---

## 🌟 Fitur Utama

-   **Autentikasi Pengguna**: Sistem registrasi dan login yang aman menggunakan Flask-Login.
-   **Multi-Model AI**: Pengguna dapat memilih model AI:
    -   **ChatGPT** (via OpenAI API)
    -   **Gemini** (via Google Gemini API)
    -   **Choco AI** (Sistem jawaban kustom dari database, dengan fallback ke Gemini).
-   **Manajemen Histori Chat**: Pengguna dapat melihat dan menghapus percakapan sebelumnya.
-   **Tampilan Respons Canggih**:
    -   **Animasi Ketik (Typewriter Effect)** dengan tombol ON/OFF.
    -   **Format Otomatis**: Respons AI yang mengandung blok kode dan tabel akan ditampilkan dalam format yang rapi dan terpisah.
-   **Fitur Interaktif**:
    -   **Reaksi Emoji**: Pengguna dapat memberikan reaksi (😂, ❤️, 🔥, 😡) pada setiap jawaban AI.
    -   **Timer Sesi**: Pengingat otomatis muncul setelah pengguna chatting selama 5 menit.
-   **Sistem Level & Donasi Pengguna**:
    -   Level pengguna (Bronze, Silver, Platinum, Royal) yang ditampilkan sebagai *badge*.
    -   Tombol donasi yang mengarah ke Saweria.
    -   Verifikasi donasi dan upgrade level dilakukan secara manual oleh admin.
-   **Panel Admin Komprehensif**:
    -   Melihat statistik total pengguna dan total chat.
    -   **Manajemen Pengguna**: Memberikan atau mencabut status admin dan mengubah level pengguna.
    -   **Manajemen Q&A Kustom**: Menambah atau menghapus jawaban kustom untuk Choco AI.
    -   Melihat log reaksi emoji dari semua pengguna.

---

## 🛠️ Teknologi yang Digunakan

-   **Backend**: Python, Flask, Flask-SQLAlchemy, Flask-Login, Flask-Bcrypt
-   **Frontend**: HTML, CSS, JavaScript (Vanilla JS)
-   **Database**: SQLite (untuk development), siap untuk PostgreSQL (untuk production)
-   **API**: Google Gemini, OpenAI

---

## 🚀 Instalasi & Menjalankan Proyek

Berikut adalah langkah-langkah untuk menjalankan proyek ini di komputer lokal Anda.

### 1. Prasyarat
-   Python 3.8+
-   Git

### 2. Clone Repositori
Buka terminal dan jalankan perintah berikut:
```bash
git clone https://github.com/ikyy2001/chocoaii.git
cd chocoaii
```

### 3. Siapkan Virtual Environment
Sangat disarankan untuk menggunakan lingkungan virtual (`venv`).

```bash
# Buat venv
python -m venv venv

# Aktifkan venv
# Di Windows:
venv\Scripts\activate
# Di macOS/Linux:
source venv/bin/activate
```
Anda akan melihat `(venv)` di awal baris terminal Anda.

### 4. Buat File `requirements.txt`
Jika file ini belum ada, Anda bisa membuatnya dari semua library yang sudah kita install dengan `pip`:
```bash
pip freeze > requirements.txt
```
*Catatan: Pastikan semua library seperti `Flask`, `openai`, `google-generativeai`, `click`, dll. sudah terinstall.*

### 5. Install Semua Kebutuhan
Dengan `venv` yang aktif, install semua library yang dibutuhkan:
```bash
pip install -r requirements.txt
```

### 6. Konfigurasi Environment Variables
1.  Buat file baru bernama `.env` di folder utama proyek.
2.  Salin konten di bawah ini ke dalam file `.env` dan isi nilainya:

    ```env
    # Ganti dengan kunci rahasia Anda sendiri (string acak yang panjang)
    SECRET_KEY='kunci-rahasia-anda-yang-sangat-aman'

    # Masukkan API Key Anda dari Google AI Studio dan OpenAI Platform
    GEMINI_API_KEY='API_KEY_GEMINI_ANDA'
    OPENAI_API_KEY='API_KEY_OPENAI_ANDA'
    ```

### 7. Jalankan Aplikasi
Setelah semua siap, jalankan server Flask:
```bash
python backend.py
```
Aplikasi akan berjalan di **http://127.0.0.1:5001**.

---

## ⚙️ Penggunaan Fitur Khusus

### Akses Panel Admin
1.  Jalankan aplikasi untuk pertama kali, maka akun admin default akan dibuat.
2.  Buka halaman login.
3.  Gunakan kredensial:
    -   **Username**: `admin`
    -   **Password**: `admin`
4.  Setelah login, akses panel di **http://127.0.0.1:5001/admin**.

### Mengganti Password via Terminal
Gunakan perintah CLI yang telah kita buat untuk mengganti password pengguna mana pun dengan aman.

1.  Pastikan `venv` Anda aktif.
2.  Jalankan perintah dengan format: `flask change-password <username> <password_baru>`

    **Contoh:**
    ```bash
    flask change-password admin PasswordBaruSuperAman123
    ```

---
Dibuat dengan Python dan Flask.
