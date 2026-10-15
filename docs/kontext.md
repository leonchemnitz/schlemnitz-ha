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

Im Popup Ems sitzt `sensor.ems_rh_wand` neben der Raumfeuchte. Die Hintergrundfarbe folgt der Kategorie (grün, orange, rot). Ein Tipp öffnet die Subview `wandfeuchte` (`/dashboard-schlemnitz/wandfeuchte`) mit Wandtemperatur, Raumtemperatur, Wandfeuchte, Raumfeuchte und Risiko. `sensor.ems_pm25` sitzt als Blase an der Luftreiniger-Karte, grün unter 20, orange bis 120, rot darüber.

Filter des Luftreinigers am 5. Oktober 2026 zurückgesetzt (`xiaomi_miot.call_action`, siid 4, aiid 1, `params: [0]`). Danach 100 %, 0 h, 291 Tage Rest.

## Licht

Hue-Wandmodule (RDM004 im Flur) sind per OnOff an die Zigbee-Gruppe des Raums gebunden. Sie senden abwechselnd `On` und `OffWithEffect`, nie `Toggle`.

Flur: Gruppe `flur_lichter` sind zwei innr-Deckenlampen. Die IKEA-Lampen bleiben draußen und folgen über „Flur Licht Synchronisation“. „Flur Schalter Nachzug“ (`flur_schalter_nachzug`) schaltet `light.flur_lichter` nur, wenn ein `left_press` innerhalb von 400 ms nichts geändert hat. Leon hat das am 29. September 2026 bestätigt.

Leon: Zigbee-Gruppe `leon_lichter` enthält Decke (Hue), Regal (innr), Bild (innr) und Lavalampen (SONOFF S60ZBTPF). Die Palme (IKEA) bleibt draußen und folgt über „Neue Automation“. Das Tap-Dial RDM002 ist nur an den Coordinator gebunden. Der Wandschalter RDM001 ist an die Gruppe gebunden. Gruppe-aus schaltet die Steckdose. `OffWithEffect` an der Steckdose ist noch nicht mit einem echten Tastendruck geprüft.

Lichtwecker: die Automation liest die Weckzeit live. Ein Alarm um 08:00 startet das Licht um 07:35.

## Raumfühler

Temperatur steht im Popup-Kopf, Feuchte als Sub-Button daneben.

- Wohnzimmer: `sensor.wohnzimmer_sensor_env_temperature`, `sensor.wohnzimmer_sensor_env_humidity`. Gerät `wohnzimmer_sensor_env`, Bereich Wohnzimmer
- Bad: `sensor.bad_sensor_env_temperature`, `sensor.bad_sensor_env_humidity`. Gerät `bad_sensor_env`, Bereich Bad
- Küche: `sensor.kueche_sensor_env_temperature`, `sensor.kueche_sensor_env_humidity`. Gerät `kueche_sensor_env`, Bereich Küche
- Leon: `sensor.leon_sensor_env_temperature`, `sensor.leon_sensor_env_humidity`
- Ems: `sensor.zhimi_mb5_c00e_temperature`, `sensor.zhimi_mb5_c00e_relative_humidity`

## Leon Heizung

Aufbau, Einstellungen, gefundene Fehler und Checkliste für weitere Räume: `docs/heizung.md`.

Ohne Better Thermostat seit 15. Oktober 2026. Sonoff TRVZB `climate.leon_thermostat` regelt selbst nach dem Raumfühler `sensor.leon_temperatur` (Gruppe um `sensor.leon_sensor_env_temperature`), den „Leon - TRV follower“ an `number.leon_thermostat_external_temperature_input` schreibt. `number.leon_thermostat_local_temperature_calibration` bleibt 0.

Raum-Soll: `sensor.leon_heizung_soll` (Template, Attribut `fenster_aus`), gesetzt über `script.leon_heizung_soll` (Feld `temperatur`). Die Automation „Leon - Heizung“ (`leon_heizung`) hält ihn und das Ventil-Soll gleich, schaltet bei offenem Fenster (`binary_sensor.leon_fenstersensor_contact`) aus und danach wieder auf Heizen.

`switch.schedule_3a20f1` setzt täglich 04:00 auf 21°, `switch.schedule_f66468` täglich 20:00 auf 19,5°. Beide rufen `script.turn_on` auf `script.leon_heizung_soll` mit `variables: {temperatur: …}`.

Die Karte im Popup Leon heißt „Heizung“ und liegt auf `climate.leon_heizung`. Daneben nur das Fenster-Icon für `binary_sensor.leon_fenstersensor_contact`. Der Schieber zeigt `sensor.leon_heizung_soll`, nicht die 7°, die das Ventil im Modus Aus meldet. Eine Änderung am Schieber setzt den Raum-Soll. Den Modus schaltet man am Ventil. Orange kommt von `hvac_action` des Ventils.

`hvac_action` des Ventils ist kein Beleg für ein offenes Ventil. Es meldet `heating` auch im Modus Aus und bei Soll 7° unter Ist 21,7° (Verlauf 1. bis 14. Oktober 2026).

Die Gerätesperre (`switch.leon_thermostat_child_lock`) bleibt aus. Ein Aus am Ventil oder auf der Karte bleibt Aus. Es gibt keine Automation, die Heat erzwingt, nur das Wiedereinschalten nach dem Fenster.

## Offen

- SigNoz ist nicht installiert. Plan und Vorschläge stehen in `docs/signoz.md`. Leon hat die Defaults noch nicht angenommen. Dafür HA nicht anfassen.
- Health-Check steht aus: Datei `home-assistant.log.fault`, damals 15 nicht verfügbare Entities.
- Leons Wandschalter: `OffWithEffect` an den Lavalampen noch nicht real gedrückt.
