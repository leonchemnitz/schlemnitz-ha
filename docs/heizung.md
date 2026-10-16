# Heizung: Sonoff TRVZB mit externem Fühler, ohne Better Thermostat

Stand 15. Oktober 2026. Läuft in Leons Zimmer. Vorlage für weitere Räume.

## Aufbau

- Ventil: Sonoff TRVZB über Zigbee2MQTT (2.14.2), Firmware 1.4.4 (Datecode 20251229)
- Raumfühler: externer Temperatursensor in HA. Eine Automation schreibt ihn an den externen Eingang des Ventils. Das Ventil regelt damit selbst.
- Raum-Soll: Template-Sensor, gesetzt über ein Skript. Eine Automation hält ihn und das Ventil-Soll gleich und schaltet bei offenem Fenster aus.
- Zeitpläne (Scheduler-Komponente, nicht im Repo) rufen das Skript auf.
- Dashboard: Bubble-Klima-Karte auf `climate.leon_heizung`. Die zeigt den Raum-Soll, auch wenn das Ventil im Modus Aus 7° meldet. Modus und Flamme kommen vom Ventil.

Bis 15. Oktober 2026 lief Better Thermostat dazwischen. Es hat nur noch Fenster, Zeitpläne und Außentemperatur verwaltet und dabei die Fehler 1, 3, 4 und 6 unten verursacht. Ausgebaut, weil der TRVZB den externen Fühler selbst kann.

Leon:

| Rolle | Entity |
|---|---|
| Ventil | `climate.leon_thermostat` |
| Raumfühler | `sensor.leon_temperatur` (Gruppe um `sensor.leon_sensor_env_temperature`) |
| Feuchte | `sensor.leon_sensor_env_humidity` |
| Externer Eingang am Ventil | `number.leon_thermostat_external_temperature_input` |
| Offset am Ventil | `number.leon_thermostat_local_temperature_calibration` |
| Tastensperre am Ventil | `switch.leon_thermostat_child_lock` |
| Fenstersensor | `binary_sensor.leon_fenstersensor_contact` |
| Raum-Soll | `sensor.leon_heizung_soll` |
| Soll setzen | `script.leon_heizung_soll` |
| Karte | `climate.leon_heizung` |
| Zeitplan 04:00 auf 21° | `switch.schedule_3a20f1` |
| Zeitplan 20:00 auf 19,5° | `switch.schedule_f66468` |

## Bausteine

`automations.yaml`:

- „Leon - TRV follower“: schreibt `sensor.leon_temperatur` an `number.leon_thermostat_external_temperature_input`, nur wenn der Fühler eine Zahl liefert. Zusätzlich alle 30 Minuten. Dieselbe Zahl schickt Zigbee2MQTT nicht erneut, deshalb geht der Wert dafür zwei Sekunden um 0,1° nach oben und dann zurück. Ohne neue Meldung fällt das Ventil nach zwei Stunden auf den eigenen Fühler zurück (`remote_source_offline`) und regelt dann nach `sensor.leon_thermostat_local_temperature`. Die Automation stellt danach `select.leon_thermostat_temperature_sensor_select` wieder auf `remote_temperature`.
- „Leon - Heizung“ (`leon_heizung`):
  - Fenster auf (`on`) und Ventil nicht aus: merkt `fenster_aus`, schaltet das Ventil aus.
  - Fenster zu (`off`) und `fenster_aus` gesetzt: löscht es, schaltet auf Heizen. Ein Aus, das schon vor dem Öffnen galt, bleibt Aus.
  - Raum-Soll geändert oder Ventil auf Heizen: schreibt das Raum-Soll ans Ventil, wenn es abweicht.
  - Ventil-Soll steht 10 Sekunden auf einem neuen Wert (Karte, Taste am Ventil): übernimmt es als Raum-Soll. Die 10 Sekunden überbrücken die 7°, die das Ventil direkt nach dem Einschalten meldet.
  - Nur im Modus Heizen. Im Modus Aus oder Auto (Zeitplan im Ventil) gleicht sie nichts ab.

`templates.yaml`: `sensor.leon_heizung_soll`, Trigger auf das Event `leon_heizung`. Daten `soll` (Zahl) und `fenster_aus` (true/false), jeweils optional. Behält den Wert über Neustarts.

`scripts.yaml`: `script.leon_heizung_soll` mit Feld `temperatur`. Feuert `leon_heizung` mit `soll`.

`templates.yaml`: `climate.leon_heizung` für die Karte. Solltemperatur ist `sensor.leon_heizung_soll`, Isttemperatur `sensor.leon_temperatur`. HVAC-Modus und `hvac_action` kommen von `climate.leon_thermostat`. Eine Solländerung ruft das Skript auf, ein Moduswechsel das Ventil.

Zeitpläne: Aktion `script.turn_on`, Entity `script.leon_heizung_soll`, Daten `variables: {temperatur: 21}`. Läuft ein Zeitplan, während das Ventil aus ist, gilt der Wert beim nächsten Einschalten.

Am Ventil:

- `local_temperature_calibration` = 0.
- Tastensperre aus.

Fenster: `on` am Sensor ist offen, `off` ist zu. Zigbee2MQTT meldet `contact: true`, solange der Kontakt geschlossen ist. `unknown` und `unavailable` schalten nichts. Die Klima-Karte zeigt ein Fenster-Icon. Der Hintergrund färbt sich, wenn der Sensor `on` ist.

Abschalten bei warmem Wetter gibt es nicht mehr. Wer es braucht: eigener Zweig in „Leon - Heizung“.

## Gefundene Fehler

### 1. Offset läuft weg (Better Thermostat, Offset Based / AI Time Based)

Better Thermostat hatte `local_temperature_calibration` auf +12,6 °C getrieben (Grenze ±12,7). Die Anzeige am Ventil stimmte trotzdem mit dem Raum überein, deshalb fiel es nicht auf. Ohne Better Thermostat schreibt niemand den Offset. Er bleibt 0.

### 2. Ventil hängt in „heizt“

Ab spätestens 4. Oktober 2026 meldete das Ventil durchgehend `running_state: heat`, auch im Modus Aus bei Soll 7° und 22° Raum. Eine direkte Abfrage (`zigbee2mqtt/leon_thermostat/get`) lieferte denselben Wert, es war also das Gerät, nicht HA. Bis 25. August meldete es normal `idle`. Firmware und Zigbee2MQTT-Version hatten sich in der Zeit nicht geändert.

Behoben am 14. Oktober 2026 um 22:33 durch einen Druck auf die Taste am Ventil. Der Motor lief hörbar, danach meldete es `idle`. Ursache vermutlich Fehler 1, nicht bewiesen.

Folge: Orange und Flamme auf der Karte kommen von `hvac_action` des Ventils. Hängt das Ventil, ist die Anzeige falsch. Prüfen: Meldet es „heizt“ im Modus Aus, hängt es. Dann Taste am Ventil drücken. Hilft das nicht: Batterien 10 Sekunden heraus, danach abschrauben und neu aufsetzen, damit es die Ventilwege neu einmisst.

### 3. Kindersicherung schaltet Aus zurück (Better Thermostat)

Mit der Kindersicherung von Better Thermostat galt jede Änderung am Ventil als ungewollt. Ein Aus auf der Karte wurde in unter einer Sekunde auf Heizen zurückgestellt.

### 4. Aus nach Neustarts (Better Thermostat)

Bei vielen HA-Neustarts hintereinander fiel das Ventil auf Aus, und Better Thermostat übernahm das. Im Modus Aus schickte es keine Solltemperatur ans Ventil, die Zeitpläne liefen ins Leere. Jetzt: Fällt das Ventil auf Aus, bleibt es aus, bis jemand Heizen wählt. Dann bekommt es sofort das aktuelle Raum-Soll.

### 5. Ventil fällt auf den eigenen Fühler zurück

`select.leon_thermostat_temperature_sensor_select` = `remote_temperature` heißt: das Ventil regelt nach dem Raumfühler. `remote_source_offline` heißt: zwei Stunden keine neue Meldung, das Ventil nutzt den Fühler im Gehäuse. Der sitzt am Heizkörper und liegt über der Raumtemperatur. Am 16. Oktober 2026 stand der Raum auf 21°, der Gehäusefühler auf 22,5°. Soll 22° hat nichts geöffnet, Soll 23° schon.

`temperature_accuracy` ist −0,2°. Damit öffnet das Ventil, sobald die gemessene Temperatur mindestens 0,2° unter dem Soll liegt, und schließt, wenn sie den Soll erreicht. Die Spanne von 1° kam nicht daher, sondern vom Gehäusefühler.

### 6. Soll flattert um 0,5° (Better Thermostat)

Im Modus External Sensor Offset Only hat Better Thermostat das Ventil-Soll alle paar Minuten um 0,5° neben 21° und 19,5° geschoben, weil die Rundung auf das 0,5°-Raster bei jeder Messung neu fiel. Ohne Better Thermostat rechnet niemand am Soll.

### 7. Sonst beobachtet

- `temporary_mode_select: boost` mit Dauer 0 steht seit Mai so und ist kein aktiver Boost.
- `valve_opening_degree` und `valve_closing_degree` = 100 sind die Grenzen, nicht die aktuelle Stellung. Der TRVZB meldet keine Stellung.
- Im Modus Aus meldet das Ventil Soll 7°.

## Neuer Raum: Checkliste

1. Ventil in Zigbee2MQTT anlernen, Entity-IDs notieren und hier eintragen. Keine IDs raten.
2. Raumfühler wählen. Er sollte nicht direkt am Heizkörper hängen.
3. „Leon - TRV follower“ kopieren, Fühler und externen Eingang tauschen.
4. Template-Sensor in `templates.yaml` kopieren, mit eigenem Event (`<raum>_heizung`) und eigener ID.
5. Skript in `scripts.yaml` kopieren, Event tauschen.
6. „Leon - Heizung“ kopieren, Ventil, Fenstersensor, Sensor und Event tauschen.
7. `local_temperature_calibration` am Ventil auf 0, Tastensperre aus.
8. Zeitpläne: `script.turn_on` auf das neue Skript mit `variables: {temperatur: …}`.
9. Bubble-Klima-Karte auf die Template-Klima-Entity, Name „Heizung“, nur mit Fenster-Icon (`state_background: true`), im Raum-Popup in `dashboards/dashboard-schlemnitz.yaml`.
10. Prüfen: Soll auf der Karte ändern, nach 10 Sekunden steht es im Sensor. Fenster auf → Ventil aus, zu → Heizen mit altem Soll. Aus auf der Karte, Fenster auf und zu → bleibt Aus.

## Offen

- Ob Fehler 2 wiederkommt. Morgens nach 04:00 sollte das Ventil öffnen, wenn der Raum unter 21° liegt.
- Better Thermostat ist als HACS-Integration noch installiert, aber ohne Eintrag. Entfernen über HACS, danach Neustart.
