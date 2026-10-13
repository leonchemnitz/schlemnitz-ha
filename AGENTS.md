# Anweisungen

Sprich mit Leon auf Deutsch.

Dieses Repo ist die Home-Assistant-Konfiguration von Schlemnitz. Du änderst die Dateien hier, committest und pushst auf `main`. `ha-push` auf der VM übernimmt das Deploy. Kopiere nichts von Hand nach HA.

Lies bei Bedarf `docs/kontext.md`. Der SigNoz-Plan steht in `docs/signoz.md` und ist noch nicht angenommen.

## Deploy

- `main` ist der Stand, den HA bekommt. Kein langlebiger Feature-Branch, außer Leon fragt danach.
- `~/ha/bin/ha-push` auf `ha-worker` zieht `origin/main` alle 2 Minuten (fast-forward), prüft die Config und lädt nur das neu, was sich geändert hat. Ist `main` nicht voraus, passiert nichts.
- Der Lauf bricht ab, wenn der Checkout dreckig ist oder versionierte Dateien auf HA von `HEAD` abweichen. Dann zuerst `~/ha/bin/ha-pull`, den Unterschied ansehen, und nichts überschreiben.
- Schlägt `ha-check` fehl, stellt `ha-push` die vorigen Dateien wieder her und lädt nicht neu.
- Starte Core nur, wenn ein Reload die Änderung nicht anwenden kann. Dashboards und Templates brauchen keinen Neustart.
- Lege keinen Webhook, Tunnel oder Nabu-Casa-Login an, außer Leon fragt danach.

## Dashboards

`dashboards/dashboard-*.yaml` ist die Quelle. Der visuelle Editor speichert sie nicht. Übersicht und Karte bleiben Storage-Dashboards und liegen nicht im Repo. Details in `dashboards/README.md`.

## Entities

Erfinde keine Entity-IDs. Verwende nur IDs, die schon im Repo oder in `docs/kontext.md` stehen. Ein neues Gerät: Leon nach der ID fragen, oder — nur auf `ha-worker` — live nachsehen und die ID danach hier festhalten.

## Zigbee

- IKEA-Lampen bleiben außerhalb der Zigbee-Gruppen. Sie folgen über eine Automation. Leon hat geprüft, dass sie in der Gruppe unzuverlässig sind.
- Zuerst Zigbee-Bindung oder Geräteeinstellung. Schalterlogik nur dann über eine HA-Automation, wenn die Bindung es nicht kann.
- Hue-Wandmodule senden abwechselnd `On` und `OffWithEffect`, nie `Toggle`.

## Geheimnisse

Gib nichts davon aus und committe es nicht: `HA_TOKEN`, `secrets.yaml`, SSH-Keys, `zigbee2mqtt/configuration.yaml`, `coordinator_backup.json` (`network_key`, `pan_id`, MQTT-Passwort). Diese Pfade sind gitignored: `zigbee2mqtt/`, `custom_components/`, `www/community/`, `.storage/`.

## Auf ha-worker

API und Token liegen in `~/.config/ha/env`. SSH zur HA-Instanz ist `ssh ha`. Skripte: `~/ha/bin/ha-pull`, `ha-check`, `ha-push`. Den Token nie ausgeben. Nach dem Push auf `main` deployt der Timer. Rufe HA-Dienste, die etwas schalten, nur auf, wenn Leon das verlangt.

## Lokale Config-Prüfung

Im Cloud-Agent liegt Home Assistant Core als `hass` auf dem PATH. Die Version kommt aus `.HA_VERSION` und braucht Python 3.14.

Vor dem Check die gitignorierte Platzhalter-Datei anlegen. Die Config nutzt kein `!secret`.

```bash
test -f secrets.yaml || cp secrets.example.yaml secrets.yaml
mkdir -p themes
hass --script check_config -c /workspace -f
```

Exit 0 ohne die Zeile `Incorrect config` heißt: die YAML-Dateien sind geladen. MQTT-Automationen melden dabei `Integration 'mqtt' does not provide trigger support`, weil der Broker nur in der UI der echten Instanz steht (`.storage`, nicht im Repo).

`hass --config /workspace` startet einen lokalen Core. Das ist nicht das Haus. Zeit-Trigger laufen dort. Dienste, die etwas schalten, nur aufrufen, wenn Leon das verlangt, und dann gegen die echte Instanz.
