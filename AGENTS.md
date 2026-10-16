# Anweisungen

Sprich mit Leon auf Deutsch.

Dieses Repo ist die Home-Assistant-Konfiguration von Schlemnitz, auf GitHub `leonchemnitz/schlemnitz-ha`. Du änderst die Dateien hier, committest und pushst auf `main`. `ha-push` auf der VM übernimmt das Deploy. Kopiere nichts von Hand nach HA.

Lies bei Bedarf `docs/kontext.md`. Der SigNoz-Plan steht in `docs/signoz.md` und ist noch nicht angenommen.

## Deploy

- `main` ist der Stand, den HA bekommt. Committe auf `main` und pushe `origin/main` direkt. Kein Feature-Branch, kein Pull Request, kein Warten auf einen Merge, außer Leon fragt ausdrücklich danach. Er will jede Änderung sofort in HA sehen und kennt das Risiko eines direkten Pushs.
- Der Remote `origin` ist `git@github-ha:leonchemnitz/schlemnitz-ha.git`. `github-ha` ist der SSH-Alias in `~/.ssh/config` mit `HostName github.com`. Das ist dieses Repo, keine zweite Remote und keine GitHub-Enterprise-Instanz. Ein Werkzeug, das aus dem Alias eine Enterprise-Instanz macht, ist der falsche Weg. Dann normal per `git push origin main` liefern.
- `~/ha/bin/ha-push` auf `ha-worker` zieht `origin/main` alle 2 Minuten (fast-forward), kopiert nach `/config` und lädt nur das neu, was sich geändert hat. Deploy passiert nur, wenn `origin/main` vor dem lokalen `HEAD` liegt. Markdown und `docs/` lösen keinen Core-Neustart aus.
- Dieses Checkout ist `~/ha/config`, dasselbe Verzeichnis wie bei `ha-push`. Ein Commit hier setzt `HEAD` schon auf den neuen Stand. Danach `origin/main` pushen, `HEAD` auf den Stand zurücksetzen, den HA noch hat, und `ha-push` ausführen. Der fast-forwardt und kopiert. Bleibt `HEAD` auf dem neuen Commit, bricht der Timer ab, weil die Dateien auf HA von `HEAD` abweichen, und kopiert nichts.
- Der Lauf bricht auch ab, wenn der Checkout dreckig ist. Weichen versionierte Dateien auf HA von `HEAD` ab, ohne dass gerade ein eigener Commit dahintersteckt: zuerst `~/ha/bin/ha-pull`, den Unterschied ansehen, und nichts überschreiben.
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
