#!/usr/bin/env bash
# Run the SFCode stack (scripts/up.mjs) as a systemd USER service, so the site
# comes back by itself after a reboot or a crash. Adapted from DWCode's.
#
#   npm run service:install     install + enable + start
#   systemctl --user status sfcode
#   journalctl --user -u sfcode -f          (also .run/logs/<component>.log)
#   systemctl --user restart sfcode         (after pulling changes: rebuilds what changed)
#   systemctl --user disable --now sfcode   (uninstall)
#
# The public hostname is served by DWCode's tunnel (dwcode.service), not here.
# Needs "linger" so user services run without a login session.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$(command -v node)"
UNIT="$HOME/.config/systemd/user/sfcode.service"
mkdir -p "$(dirname "$UNIT")"

cat > "$UNIT" <<UNIT
# SFCode: postgres + server + site via scripts/up.mjs. The public tunnel is DWCode's.
# Installed by $ROOT/scripts/install-service.sh. Logs: journalctl --user -u sfcode, and .run/logs/
[Unit]
Description=SFCode stack (sf.bighnesh.space)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$ROOT
Environment=PATH=$(dirname "$NODE"):$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$NODE scripts/up.mjs
KillSignal=SIGINT
# First start after a change rebuilds the client, which takes a while.
TimeoutStartSec=infinity
TimeoutStopSec=60
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now sfcode.service
[ "$(loginctl show-user "$USER" -p Linger --value)" = yes ] || echo "⚠ linger is off: the stack only runs while you are logged in. Fix: sudo loginctl enable-linger $USER"
echo "✓ sfcode service installed. Status: systemctl --user status sfcode"
