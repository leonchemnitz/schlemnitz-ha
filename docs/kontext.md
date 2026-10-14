# Schlemnitz HA

Stand 14. Oktober 2026. Leon Chemnitz. Zeitzone Europe/Berlin, Ort „Home“.

## Anlage

- Proxmox im LAN `192.168.178.0/24`
- Home Assistant OS 18.3 auf `http://192.168.178.57:8123`. Core 2026.10.1, eingespielt am 14. Oktober 2026
- Agent-VM: Ubuntu, Hostname `agent-home`, `192.168.178.105`, User `agent`. Darauf läuft der Self-hosted-Worker `ha-worker`
- `/config` auf HA ist die Arbeitskopie. Git und GitHub-Zugang liegen nur auf der VM, Checkout `~/ha/config`, Remote `git@github-ha:leonchemnitz/schlemnitz-ha.git`
- Etwa 463 Entities (156 Sensoren, 46 Lichter, 17 Automationen)
- Integrationen unter anderem: HACS, better_thermostat, browser_mod, xiaomi_miot, scheduler, Zigbee2MQTT, Matter, Thread, Music Assistant

`ssh ha` geht über das Advanced-SSH-Add-on (User `hassio`). Für die `ha`-CLI in einer nicht-interaktiven Sitzung zuerst `SUPERVISOR_TOKEN` aus `/run/s6/container_environment/SUPERVISOR_TOKEN` setzen. `HA_URL` und `HA_TOKEN` stehen in `~/.config/ha/env` auf der VM.

## Was gilt

- Dashboards Schlemnitz, Test und Zeitsteuerung sind YAML und liegen in `dashboards/`. Der visuelle Editor speichert sie nicht. Entscheidung vom 9. Oktober 2026.
- Änderungen an `main` committen und pushen. `ha-push` deployt. Nichts von Hand nach `/config` kopieren.
- IKEA-Lampen nicht in Zigbee-Gruppen. Bindung vor Automation. Beides am 29. September 2026 so festgelegt.
- Agenten sprechen mit Leon Deutsch.

## Ems, Schimmel

Wandfeuchte ist ein Template in `templates.yaml`, keine Messung des Wandsensors.

- `T_wand`: `sensor.ems_sensor_wand_temperature`. Der Wandsensor hat keine Feuchte-Entity, die wird ignoriert
- `T_raum`: `sensor.zhimi_mb5_c00e_temperature`
- `RH_raum`: `sensor.zhimi_mb5_c00e_relative_humidity`
- Luftreiniger: `fan.ems_luftreiniger` (zhimi.airp.mb5)

Magnus-Formel, Sättigungsdampfdruck in hPa:

`E(T) = 6.112 * exp((17.67 * T) / (T + 243.5))`

`e = E(T_raum) * (RH_raum / 100)`

`RH_wand = (e / E(T_wand)) * 100`

In Jinja ist `e` die Eulersche Zahl, deshalb `e ** x` statt `exp(x)`.

Schwellen für `sensor.ems_rh_wand_kategorie`: Sicher unter 70, Erhöht von 70 bis unter 80, Kritisch ab 80.

Auf dem Dashboard Schlemnitz zeigt die Luftreiniger-Karte eine kompakte Blase mit `sensor.ems_rh_wand`. Die Hintergrundfarbe folgt der Kategorie (grün, orange, rot). Ein Tipp öffnet die Subview `wandfeuchte` (`/dashboard-schlemnitz/wandfeuchte`) mit Wandtemperatur, Raumtemperatur, Wandfeuchte, Raumfeuchte und Risiko.

Filter des Luftreinigers am 5. Oktober 2026 zurückgesetzt (`xiaomi_miot.call_action`, siid 4, aiid 1, `params: [0]`). Danach 100 %, 0 h, 291 Tage Rest.

## Licht

Hue-Wandmodule (RDM004 im Flur) sind per OnOff an die Zigbee-Gruppe des Raums gebunden. Sie senden abwechselnd `On` und `OffWithEffect`, nie `Toggle`.

Flur: Gruppe `flur_lichter` sind zwei innr-Deckenlampen. Die IKEA-Lampen bleiben draußen und folgen über „Flur Licht Synchronisation“. „Flur Schalter Nachzug“ (`flur_schalter_nachzug`) schaltet `light.flur_lichter` nur, wenn ein `left_press` innerhalb von 400 ms nichts geändert hat. Leon hat das am 29. September 2026 bestätigt.

Leon: Zigbee-Gruppe `leon_lichter` enthält Decke (Hue), Regal (innr), Bild (innr) und Lavalampen (SONOFF S60ZBTPF). Die Palme (IKEA) bleibt draußen und folgt über „Neue Automation“. Das Tap-Dial RDM002 ist nur an den Coordinator gebunden. Der Wandschalter RDM001 ist an die Gruppe gebunden. Gruppe-aus schaltet die Steckdose. `OffWithEffect` an der Steckdose ist noch nicht mit einem echten Tastendruck geprüft.

Lichtwecker: die Automation liest die Weckzeit live. Ein Alarm um 08:00 startet das Licht um 07:35.

## Leon Heizung

Sonoff TRVZB `climate.leon_thermostat`, Raumfühler `sensor.leon_sensor_env_temperature`, Better Thermostat `climate.leon_thermostat_2`. Schritt 0,5°. Kalibrierungstyp Target Temperature Based (`target_temp_based`), nicht Offset Based. `number.leon_thermostat_local_temperature_calibration` bleibt 0. Better Thermostat schreibt den Offset nicht mehr, sondern setzt vorübergehend den Ventil-Soll (weit auf bei Wärmebedarf, nahe am Minimum zum Schließen), gerechnet aus Raumfühler und Soll.

`switch.schedule_3a20f1` setzt täglich 04:00 auf 21°, `switch.schedule_f66468` täglich 20:00 auf 19,5°. Beide rufen nur `climate.set_temperature` auf `climate.leon_thermostat_2` auf. Diese Raum-Solltemperatur in den ersten ein bis zwei Tagen nach der Umstellung nicht von Hand ändern. Das Einpendeln dauert 24 bis 48 Stunden.

Die Karte im Popup Leon ist die Klima-Karte auf `climate.leon_thermostat` mit dem HVAC-Modus-Auswahlfeld. Orange und Flamme kommen von `hvac_action` des Ventils. Der Schieber zeigt den temporären Ventil-Soll, nicht die 19,5° oder 21° von Better Thermostat.

„Leon Heizung heilen“ stellt Heat mit der gespeicherten Better-Thermostat-Solltemperatur wieder her, solange `call_for_heat` an ist. Ein niedriger Ventil-Soll ist dabei kein Fehler. `call_for_heat` ist aus, wenn die Außentemperatur die `off_temperature` von 20° erreicht. Die Kindersicherung `switch.leon_leon_thermostat_kindersicherung` bleibt an, damit ein Ventil-Aus nicht wieder als Wunsch gilt.

## Offen

- SigNoz ist nicht installiert. Plan und Vorschläge stehen in `docs/signoz.md`. Leon hat die Defaults noch nicht angenommen. Dafür HA nicht anfassen.
- Health-Check steht aus: Datei `home-assistant.log.fault`, damals 15 nicht verfügbare Entities.
- Leons Wandschalter: `OffWithEffect` an den Lavalampen noch nicht real gedrückt.
