# Heizung: Sonoff TRVZB mit Better Thermostat

Stand 14. Oktober 2026. Läuft in Leons Zimmer. Vorlage für weitere Räume.

## Aufbau

- Ventil: Sonoff TRVZB über Zigbee2MQTT (2.14.2), Firmware 1.4.4 (Datecode 20251229)
- Raumfühler: externer Temperatursensor in HA
- Better Thermostat (HACS, 1.9.3) regelt das Ventil nach dem Raumfühler
- Zeitpläne (Scheduler-Komponente, nicht im Repo) setzen nur die Solltemperatur von Better Thermostat
- Dashboard: Bubble-Klima-Karte auf dem Ventil, nicht auf Better Thermostat

Leon:

| Rolle | Entity |
|---|---|
| Ventil | `climate.leon_thermostat` |
| Better Thermostat | `climate.leon_thermostat_2` |
| Raumfühler für Better Thermostat | `sensor.leon_sensor_env_temperature` |
| Feuchte | `sensor.leon_sensor_env_humidity` |
| Wetter für `call_for_heat` | `weather.forecast_home` |
| Offset am Ventil | `number.leon_thermostat_local_temperature_calibration` |
| Externer Eingang am Ventil | `number.leon_thermostat_external_temperature_input` |
| Kindersicherung Better Thermostat | `switch.leon_leon_thermostat_kindersicherung` |
| Tastensperre am Ventil | `switch.leon_thermostat_child_lock` |
| Zeitplan 04:00 auf 21° | `switch.schedule_3a20f1` |
| Zeitplan 20:00 auf 19,5° | `switch.schedule_f66468` |
| Fenstersensor | `binary_sensor.leon_fenstersensor_contact` |

Better-Thermostat-Eintrag: `01KGER4032KFCDN0HQHBXM6Q2M`.

## Einstellungen in Better Thermostat

Allgemein:

- Temperaturfühler: Raumfühler
- Wetter: `weather.forecast_home`
- Fenstersensor: `binary_sensor.leon_fenstersensor_contact`. Verzögerung beim Öffnen und Schließen: 0
- Außentemperatur für Aus (`off_temperature`): 20
- Toleranz: 0
- Schritt (`target_temp_step`): 0,5 °C. Entspricht dem Raster des TRVZB.

Erweitert, pro Ventil:

| Option | Wert |
|---|---|
| Kalibrierungstyp (`calibration`) | Target Temperature Based (`target_temp_based`) |
| Kalibrierungsmodus (`calibration_mode`) | External Sensor Offset Only (`default`) |
| Überhitzungsschutz | aus |
| Kein Aus-Modus (`no_off_system_mode`) | aus |
| Kindersicherung (`child_lock`) | aus |
| Heat/Auto tauschen, HomematicIP, Ventilwartung | aus |

Nicht verwenden: Kalibrierungstyp Offset Based (`local_calibration_based`) und Modus „(AI) Time Based“ (`heating_power_calibration`). Siehe Bug 1.

Am Ventil:

- `local_temperature_calibration` = 0. Better Thermostat schreibt ihn im Modus Target Temperature Based nicht.
- Tastensperre aus.

So regelt es: Better Thermostat rechnet `Ventil-Soll = Raum-Soll − Raum-Ist + Ventil-Ist` und schreibt das als Sollwert ans Ventil. Ist der Raum zu warm, landet der Wert am Minimum (4 °C) und das Ventil schließt. Der Schieber der Karte zeigt diesen Ventil-Soll, nicht den Raum-Soll.

Fenster: `on` am Sensor ist offen, `off` ist zu. Zigbee2MQTT meldet `contact: true`, solange der Kontakt geschlossen ist. Better Thermostat schaltet das Ventil sofort aus, solange der Sensor `on`, `unknown` oder `unavailable` ist, und heizt wieder, sobald er `off` ist. Die Klima-Karte zeigt dafür ein Fenster-Icon. Der Hintergrund färbt sich, wenn der Sensor `on` ist.

Einstellungen ändern: Einstellungen → Geräte & Dienste → Better Thermostat → Konfigurieren. Die Optionen lassen sich nicht in YAML setzen. Better Thermostat lädt sich nach dem Speichern neu.

## Gefundene Fehler

### 1. Offset läuft weg (Offset Based / AI Time Based)

Better Thermostat hatte `local_temperature_calibration` auf +12,6 °C getrieben (Grenze ±12,7). Die Anzeige am Ventil stimmte trotzdem mit dem Raum überein, deshalb fiel es nicht auf. Abhilfe: Kalibrierungstyp Target Temperature Based, dann den Offset von Hand auf 0.

### 2. Ventil hängt in „heizt“

Ab spätestens 4. Oktober 2026 meldete das Ventil durchgehend `running_state: heat`, auch im Modus Aus bei Soll 7° und 22° Raum. Eine direkte Abfrage (`zigbee2mqtt/leon_thermostat/get`) lieferte denselben Wert, es war also das Gerät, nicht HA. Bis 25. August meldete es normal `idle`. Firmware und Zigbee2MQTT-Version hatten sich in der Zeit nicht geändert.

Behoben am 14. Oktober 2026 um 22:33 durch einen Druck auf die Taste am Ventil. Der Motor lief hörbar, danach meldete es `idle`. Ursache vermutlich Bug 1, nicht bewiesen.

Folge: Orange und Flamme auf der Karte kommen von `hvac_action` des Ventils. Hängt das Ventil, ist die Anzeige falsch. Prüfen: Meldet es „heizt“ im Modus Aus, hängt es. Dann Taste am Ventil drücken. Hilft das nicht: Batterien 10 Sekunden heraus, danach abschrauben und neu aufsetzen, damit es die Ventilwege neu einmisst.

### 3. Kindersicherung schaltet Aus zurück

Mit der Kindersicherung von Better Thermostat gilt jede Änderung am Ventil als ungewollt. Ein Aus auf der Karte (die das Ventil steuert) wurde in unter einer Sekunde auf Heizen zurückgestellt. Kindersicherung aus lassen. Dann übernimmt Better Thermostat ein Aus am Ventil als Aus.

### 4. Aus nach Neustarts

Bei vielen HA-Neustarts hintereinander (Restart-Schleife von `ha-push`, 13./14. Oktober 2026) fiel das Ventil auf Aus, und Better Thermostat übernahm das. Im Modus Aus schickt Better Thermostat keine Solltemperatur ans Ventil. Die Zeitpläne setzen nur die Temperatur, nicht den Modus, und liefen deshalb ins Leere. Abhilfe: Modus einmal auf Heizen stellen. Eine Automation, die Heizen erzwingt, gibt es bewusst nicht mehr, weil sie auch ein gewolltes Aus zurückschaltet.

### 5. `temperature_sensor_select` zeigt `unknown`

Das Ventil meldet `external_3`. Zigbee2MQTT 2.14 kennt nur noch `local_temperature`, `remote_temperature`, `remote_source_offline`. `external_3` bedeutet: externer Fühler ist wieder da, das Ventil nutzt ihn. HA zeigt deshalb `unknown`. Kein Fehler in der Regelung. Better Thermostat korrigiert die Auswahl nicht, solange sie `unknown` ist.

### 6. `call_for_heat` hängt am Wetter

`call_for_heat` ist der Vergleich Außentemperatur (Wetter-Entity) mit `off_temperature`, nicht Raum gegen Soll. Ist es draußen 20° oder wärmer, schaltet Better Thermostat das Ventil aus.

### 7. Sonst beobachtet

- `temporary_mode_select: boost` mit Dauer 0 steht seit Mai so und ist kein aktiver Boost.
- `valve_opening_degree` und `valve_closing_degree` = 100 sind die Grenzen, nicht die aktuelle Stellung. Der TRVZB meldet keine Stellung.

## Verhalten

- Einpendeln nach einer Umstellung: 24 bis 48 Stunden. In der Zeit die Raum-Solltemperatur nicht von Hand ändern.
- Träge durch den Raum, die seltenen Meldungen des Batteriegeräts und die Glättung in Better Thermostat.

## Neuer Raum: Checkliste

1. Ventil in Zigbee2MQTT anlernen, Entity-IDs notieren und hier eintragen. Keine IDs raten.
2. Raumfühler wählen. Er sollte nicht direkt am Heizkörper hängen.
3. Optional den Fühler als externen Eingang ans Ventil schicken (wie „Leon - TRV follower“). Dabei nichts schicken, wenn der Fühler `unavailable` ist, siehe Offen.
4. Better Thermostat anlegen mit den Werten oben: Target Temperature Based, External Sensor Offset Only, Schritt 0,5, Kindersicherung aus.
5. `local_temperature_calibration` am Ventil auf 0.
6. Zeitpläne auf die Better-Thermostat-Entity, nicht aufs Ventil.
7. Bubble-Klima-Karte auf das Ventil, mit Auswahl `hvac_modes` und Fenster-Icon (`state_background: true`), im Raum-Popup in `dashboards/dashboard-schlemnitz.yaml`. Fenstersensor in Better Thermostat eintragen, Verzögerung 0.
8. Prüfen: Raum über Soll → Ventil-Soll fällt auf 4 °C, Ventil meldet `idle`. Modus Aus auf der Karte bleibt Aus.
9. 24 bis 48 Stunden nicht nachstellen.

## Offen

- „Leon - TRV follower“ schreibt `float(0)`, wenn `sensor.leon_temperatur` nicht verfügbar ist, also 0 °C an das Ventil. Besser vorher auf `is_number` prüfen.
- Ob Bug 2 wiederkommt. Morgens nach 04:00 sollte das Ventil öffnen, wenn der Raum unter 21° liegt.
