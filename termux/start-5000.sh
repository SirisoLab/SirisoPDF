#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT="${PORT:-5000}"

echo "=========================================================="
echo "  SIRISO PDF STUDIO - ANDROID TERMUX LAUNCHER (PORT $PORT)"
echo "=========================================================="

if command -v termux-wake-lock >/dev/null 2>&1; then
  echo "[Termux] Mengaktifkan termux-wake-lock agar server tetap jalan di background..."
  termux-wake-lock || true
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[Termux] Node.js belum terpasang. Menginstal nodejs..."
  if command -v pkg >/dev/null 2>&1; then
    pkg update -y && pkg install -y nodejs tar
  else
    echo "Silakan instal Node.js terlebih dahulu."
    exit 1
  fi
fi

if [ ! -f "$SCRIPT_DIR/public/index.html" ] && [ -f "$SCRIPT_DIR/siriso-web-dist.tar.gz" ]; then
  echo "[Termux] Mengekstrak bundle produksi Siriso PDF..."
  mkdir -p "$SCRIPT_DIR/public"
  tar -xzf "$SCRIPT_DIR/siriso-web-dist.tar.gz" -C "$SCRIPT_DIR/public"
  echo "[Termux] Bundle web berhasil diekstrak."
fi

LAN_IP=""
if command -v ip >/dev/null 2>&1; then
  LAN_IP="$(ip -4 addr show wlan0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1 || true)"
fi
if [ -z "$LAN_IP" ] && command -v ifconfig >/dev/null 2>&1; then
  LAN_IP="$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n 1 || true)"
fi

if [ -n "$LAN_IP" ]; then
  echo "  -> Akses di HP Android ini : http://localhost:$PORT"
  echo "  -> Akses dari Wi-Fi / LAN  : http://$LAN_IP:$PORT"
else
  echo "  -> Akses Server Lokal      : http://localhost:$PORT"
fi

if [ "${1:-}" = "--bg" ] || [ "${1:-}" = "--daemon" ]; then
  LOG_FILE="$SCRIPT_DIR/siriso-5000.log"
  PID_FILE="$SCRIPT_DIR/siriso-5000.pid"
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "[Termux] Menghentikan proses lama (PID $(cat "$PID_FILE"))..."
    kill "$(cat "$PID_FILE")" || true
    sleep 1
  fi
  PORT="$PORT" nohup node "$SCRIPT_DIR/server-5000.mjs" > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "[Termux] Server berjalan di background (PID: $(cat "$PID_FILE"))"
  echo "[Termux] Log server: $LOG_FILE"
  echo "[Termux] Untuk cek log: tail -f $LOG_FILE"
else
  PORT="$PORT" exec node "$SCRIPT_DIR/server-5000.mjs"
fi
