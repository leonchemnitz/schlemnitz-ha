# Heizung: Sonoff TRVZB mit externem Fühler

Stand 15. November 2026. Läuft in Leons Zimmer, im Wohnzimmer, im Bad, bei Ems und in der Küche. Leon, Wohnzimmer und Bad seit 15. November 2026 mit Better Thermostat (Abschnitt unten), Ems und Küche ohne.

## Aufbau

- Ventil: Sonoff TRVZB über Zigbee2MQTT (2.14.2), Firmware 1.4.4 (Datecode 20251229)
- Raumfühler: externer Temperatursensor in HA. Eine Automation schreibt ihn an den externen Eingang des Ventils. Das Ventil regelt damit selbst.
- Raum-Soll: Template-Sensor, gesetzt über ein Skript. Eine Automation hält ihn und das Ventil-Soll gleich und schaltet bei offenem Fenster aus.
- Zeitpläne (Scheduler-Komponente, nicht im Repo) rufen das Skript auf.
- Dashboard: Bubble-Klima-Karte auf `climate.leon_heizung`. Die zeigt den Raum-Soll, auch wenn das Ventil im Modus Aus 7° meldet. Modus und Flamme kommen vom Ventil.

Bis 15. Oktober 2026 lief Better Thermostat dazwischen. Es hat nur noch Fenster, Zeitpläne und Außentemperatur verwaltet und dabei die Fehler 1, 3, 4 und 6 unten verursacht. Ausgebaut, weil der TRVZB den externen Fühler selbst kann.

## Better Thermostat in Leon, Wohnzimmer und Bad (seit 15. November 2026)

Grund: Ohne Better Thermostat regelt der TRVZB als Zweipunktregler und überschießt (7, 7a). Mit Better Thermostat lief Leons Zimmer im Februar und März 2026 auf ±0,3° (7b). Better Thermostat 1.9.3 aus HACS, Einträge angelegt am 15. November 2026, Wohnzimmer und Leon um 12:09, Bad um 18:20 (MEZ):

| | Wohnzimmer | Leon | Bad |
|---|---|---|---|
| Eintrag | „Wohnzimmer Better Thermostat“ | „Leon Better Thermostat“ | „Bad Better Thermostat“ |
| Klima-Entity | `climate.wohnzimmer_better_thermostat` | `climate.leon_better_thermostat` | `climate.bad_better_thermostat` |
| Raumfühler | `sensor.wohnzimmer_sensor_env_temperature` | `sensor.leon_temperatur` | `sensor.bad_sensor_env_temperature` |
| Feuchte | `sensor.wohnzimmer_sensor_env_humidity` | `sensor.leon_sensor_env_humidity` | `sensor.bad_sensor_env_humidity` |
| Kalibrierung | `target_temp_based` | `target_temp_based` | `direct_valve_based` (Test) |

Alle drei gleich eingestellt bis auf die Kalibrierung (liegt in `.storage`, nicht im Repo; Optionen über Einstellungen → Geräte → Better Thermostat → Konfigurieren):

- Wetter `weather.forecast_home`, kein Außenfühler, keine Fenster- oder Türsensoren (das Fenster schaltet weiter die Automation „<Raum> - Heizung“), keine Presets
- `off_temperature` 20, `tolerance` 0, `target_temp_min`/`max` auto, `target_temp_step` auto
- `calibration_mode: heating_power_calibration` („AI Time Based“). `calibration`: Wohnzimmer und Leon `target_temp_based` (verschiebt das Ventil-Soll), Bad `direct_valve_based` (stellt die Ventilöffnung, Abschnitt unten)
- Überhitzungsschutz, Kindersicherung, `no_off_system_mode`, `heat_auto_swapped`, Ventilwartung, HomematicIP: aus

Abweichend vom Februar `target_temp_based` statt `local_calibration_based`: Better Thermostat 1.9.3 schreibt beim TRVZB den Raumwert selbst an `number.<raum>_thermostat_external_temperature_input` (Keepalive alle 30 Minuten) und stellt `select.<raum>_thermostat_temperature_sensor_select` auf `remote_temperature`. Im externen Modus wendet der TRVZB `local_temperature_calibration` nicht an. Beim Anlegen hat Better Thermostat den Offset im Wohnzimmer aus dem Gehäusefühler (29,7° bei 22,3° Raum) auf −7,4 gesetzt, das Ventil zeigte trotzdem 22,3°. Ein Offset ohne Wirkung kann unbemerkt bis an die Grenze laufen, vermutlich Fehler 1. Mit `target_temp_based` regelt Better Thermostat über das Ventil-Soll, der Offset bleibt 0.

Damit entfallen für die drei Räume die Fühler-Automationen. Ihre Automation-IDs tragen jetzt den „Ventil-Wächter“ (`automation.leon_trv_follower`, `automation.wohnzimmer_trv_follower`, `automation.bad_trv_follower`):

- `temperature_accuracy` zurück auf −0,2, `smart_temperature_control` aus (Better Thermostat und die PID-Regelung im Ventil würden gegeneinander regeln)
- `local_temperature_calibration`, die 5 Minuten nicht 0 ist, zurück auf 0
- Benachrichtigung (`persistent_notification`, ID `<raum>_better_thermostat`), wenn die Better-Thermostat-Entity 15 Minuten `unavailable` ist. Dazu `valve_opening_degree` und `valve_closing_degree` zurück auf 100, damit ein Ventil im Bad nicht auf der letzten Öffnung stehen bleibt. Das Ventil regelt dann allein mit dem letzten Soll und dem letzten externen Wert weiter und fällt nach zwei Stunden auf den Gehäusefühler.

„<Raum> - Heizung“ spricht `climate.<raum>_better_thermostat` an: Fenster aus/an, Raum-Soll in beide Richtungen. Nur „Ventil springt auf Auto“ bleibt am Ventil. Die Karten `climate.leon_heizung`, `climate.wohnzimmer_heizung` und `climate.bad_heizung` nehmen Modus, Heizanzeige und Moduswechsel von Better Thermostat. Better Thermostat kennt nur Heizen und Aus, deshalb haben diese drei Karten kein Auto mehr. Das Wäschetrocknen im Bad setzt nur das Raum-Soll und läuft unverändert.

### Test im Bad: direkte Ventilsteuerung (seit 15. November 2026, 18:20)

Ziel: Das Ventil-Display soll das Raum-Soll zeigen (Anzeige am Ventil, unten) und Better Thermostat trotzdem stetig regeln. Mit `direct_valve_based` und `heating_power_calibration` schickt Better Thermostat 1.9.3 dem Ventil immer sein eigenes Soll, beim Heizen und im Leerlauf (`calibration.py`, `calculate_calibration_setpoint`). Geregelt wird über die Öffnung: Beim Heizen rechnet es aus Abstand zum Soll und gelernter Heizleistung einen Prozentwert x, sonst 0. Es schreibt `number.bad_thermostat_valve_opening_degree` = x und `number.bad_thermostat_valve_closing_degree` = 100 − x. Damit steht das Ventil bei x %, egal ob seine Zweipunktregelung „heizt“ oder „zu“ meint. Vor jedem weiteren Schließen fährt es beim TRVZB kurz 10 % weiter auf und nach 5 Sekunden auf den Zielwert (Schutz gegen ungenaues Schließen, `model_fixes/TRVZB.py`).

Neue Entity: `number.bad_better_thermostat_maximale_ventiloffnung` (100). Begrenzt x nach oben, nicht anfassen.

Erster Stand um 18:21: Soll Raum, Better Thermostat und Ventil 21°, Raum 20,5°, Öffnung 77/23. Prüfen wie bei Leon und Wohnzimmer, zusätzlich:

- Steht das Ventil-Display immer auf dem Raum-Soll?
- Wie oft schreibt Better Thermostat die Öffnung, wie oft fährt der Motor (Batterie)?
- Geht die Öffnung über dem Soll auf 0 und bleibt der Raum dann stehen?

Klappt es, auch Wohnzimmer und Leon so. Zurück: in den Optionen des Eintrags `target_temp_based` wählen, danach Öffnen und Schließen am Ventil auf 100.

Anzeige am Ventil: Mit `target_temp_based` zeigt das Display des TRVZB das verschobene Soll, nicht das Raum-Soll. Am 15. November 2026 um 17:00 stand das Wohnzimmer-Ventil auf 19° bei Raum-Soll 19,5° und 22,5° Raum. Beim Aufheizen zeigt es auch 25° bis 35° (16:56). Die Ist-Temperatur auf dem Display stimmt, das ist der externe Wert. Das richtige Soll steht auf der Karte und in `climate.<raum>_better_thermostat`. Drehen am Ventil geht: Better Thermostat übernimmt den Wert als sein Soll, „<Raum> - Heizung“ schreibt ihn ins Raum-Soll. Gezählt wird dabei aber vom verschobenen Wert aus. Mit `local_calibration_based` bliebe das Display-Soll gleich dem Raum-Soll. Das wirkt beim TRVZB im externen Modus aber nicht (oben). Eine Lösung, bei der das Soll am Ventil stimmt und trotzdem besser geregelt wird, ist offen. Erst die Regelung bewerten, dann entscheiden.

Bewertung nach zwei Tagen Lernen, ab 17. November 2026, je Raum:

- Stundenmittel 07 bis 20 Uhr: Tagesspanne und Abstand zum Soll (Vorbild 7b: Spanne 0,3 bis 0,8°, Mittel 20,7 bis 21,2° bei 21°)
- Spitze nach dem Sprung um 04:00 von 19,5° auf 21° (Zweipunkt 21,5 bis 21,7°, PID bis 22,7°, 7a)
- Abfall nach 20:00 auf 19,5°: Wie schnell, und steigt der Raum bei geschlossenem Ventil (8a)?
- Wie oft der Motor fährt (`sensor.<raum>_thermostat_valve_motor_running_voltage` ändert sich nach jeder Fahrt, Batterie), und ob das Ventil-Soll flattert (Fehler 6)
- `number.<raum>_thermostat_local_temperature_calibration` bleibt 0, `select.<raum>_thermostat_temperature_sensor_select` bleibt `remote_temperature`

Wohnzimmer erst ab der neuen Montage am 15. November 2026, 16:55, werten (8a). Davon hängt ab, ob Ems und Küche folgen und ob alle auf die direkte Ventilsteuerung wechseln. Zurück ohne Better Thermostat: Eintrag löschen, die Fühler-Automationen aus Commit `40402eb` zurückholen, Karten und „<Raum> - Heizung“ wieder auf `climate.<raum>_thermostat`.

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
| Better Thermostat | `climate.leon_better_thermostat` |
| Ventil-Wächter | `'1770107769590'` (`automation.leon_trv_follower`) |
| Fenster und Soll | `leon_heizung` |
| Zeitplan 04:00 auf 21° | `switch.schedule_3a20f1` |
| Zeitplan 20:00 auf 19,5° | `switch.schedule_f66468` |

Wohnzimmer:

| Rolle | Entity |
|---|---|
| Ventil | `climate.wohnzimmer_thermostat` |
| Raumfühler | `sensor.wohnzimmer_sensor_env_temperature` |
| Feuchte | `sensor.wohnzimmer_sensor_env_humidity` |
| Externer Eingang am Ventil | `number.wohnzimmer_thermostat_external_temperature_input` |
| Offset am Ventil | `number.wohnzimmer_thermostat_local_temperature_calibration` |
| Tastensperre am Ventil | `switch.wohnzimmer_thermostat_child_lock` |
| Fenstersensor | `binary_sensor.wohnzimmer_fenstersensor_contact` |
| Raum-Soll | `sensor.wohnzimmer_heizung_soll` |
| Soll setzen | `script.wohnzimmer_heizung_soll` |
| Karte | `climate.wohnzimmer_heizung` |
| Better Thermostat | `climate.wohnzimmer_better_thermostat` |
| Ventil-Wächter | `wohnzimmer_trv_follower` |
| Fenster und Soll | `wohnzimmer_heizung` |
| Zeitplan 04:00 auf 21° | `switch.schedule_wohnzimmer_04_00` |
| Zeitplan 20:00 auf 19,5° | `switch.schedule_wohnzimmer_20_00` |

Bad:

| Rolle | Entity |
|---|---|
| Ventil | `climate.bad_thermostat` |
| Raumfühler | `sensor.bad_sensor_env_temperature` |
| Feuchte | `sensor.bad_sensor_env_humidity` |
| Externer Eingang am Ventil | `number.bad_thermostat_external_temperature_input` |
| Offset am Ventil | `number.bad_thermostat_local_temperature_calibration` |
| Tastensperre am Ventil | `switch.bad_thermostat_child_lock` |
| Fenstersensor | `binary_sensor.bad_fenstersensor_contact` |
| Raum-Soll | `sensor.bad_heizung_soll` |
| Soll setzen | `script.bad_heizung_soll` |
| Karte | `climate.bad_heizung` |
| Better Thermostat | `climate.bad_better_thermostat` |
| Ventil-Wächter | `bad_trv_follower` |
| Fenster und Soll | `bad_heizung` |
| Zeitplan 04:00 auf 21° | `switch.schedule_bad_04_00` |
| Zeitplan 20:00 auf 19,5° | `switch.schedule_bad_20_00` |

Wäsche trocknen im Bad (`bad_waesche_trocknen`): Steigt `sensor.bad_sensor_env_humidity` über 68 %, geht der Raum-Soll sofort auf 25° und `sensor.bad_heizung_soll` bekommt `trocknen: true`. Das Ende misst `sensor.bad_absolute_feuchte` (g/m³ aus Temperatur und relativer Feuchte), weil das Aufheizen allein die relative Feuchte von 68 % auf etwa 54 % drückt. Fällt die absolute Feuchte unter 11 g/m³ (60 % bei 21°), gilt sofort wieder der letzte Zeitplanwert (Attribut `zeitplan_soll`, ohne Wert 21°). Die Bad-Zeitpläne rufen `script.bad_heizung_soll` mit `zeitplan: true` auf. Während des Trocknens merkt sich das Skript diesen Wert nur. Eine Änderung an der Karte gilt sofort, auch beim Trocknen. Fenster auf schaltet das Ventil weiterhin aus. Auch Duschen kann die 68 % auslösen. Der Start braucht zusätzlich mehr als 11 g/m³, sonst käme das Ende nie, etwa bei 68 % in einem kalten Bad.

Ems:

| Rolle | Entity |
|---|---|
| Ventil | `climate.ems_thermostat` |
| Raumfühler | `sensor.zhimi_mb5_c00e_temperature` (Luftreiniger) |
| Feuchte | `sensor.zhimi_mb5_c00e_relative_humidity` |
| Externer Eingang am Ventil | `number.ems_thermostat_external_temperature_input` |
| Offset am Ventil | `number.ems_thermostat_local_temperature_calibration` |
| Tastensperre am Ventil | `switch.ems_thermostat_child_lock` |
| Fenstersensor | `binary_sensor.ems_fenstersensor_contact` |
| Raum-Soll | `sensor.ems_heizung_soll` |
| Soll setzen | `script.ems_heizung_soll` |
| Karte | `climate.ems_heizung` |
| Fühler-Automation | `ems_trv_follower` |
| Fenster und Soll | `ems_heizung` |
| Zeitplan 04:00 auf 21° | `switch.schedule_ems_04_00` |
| Zeitplan 20:00 auf 19,5° | `switch.schedule_ems_20_00` |

Küche (seit 19. Oktober 2026):

| Rolle | Entity |
|---|---|
| Ventil | `climate.kueche_thermostat` |
| Raumfühler | `sensor.kueche_sensor_env_temperature` |
| Feuchte | `sensor.kueche_sensor_env_humidity` |
| Externer Eingang am Ventil | `number.kueche_thermostat_external_temperature_input` |
| Offset am Ventil | `number.kueche_thermostat_local_temperature_calibration` |
| Tastensperre am Ventil | `switch.kueche_thermostat_child_lock` |
| Fenstersensor | `binary_sensor.kueche_fenstersensor_contact` |
| Raum-Soll | `sensor.kueche_heizung_soll` |
| Soll setzen | `script.kueche_heizung_soll` |
| Karte | `climate.kueche_heizung` |
| Fühler-Automation | `kueche_trv_follower` (`automation.kuche_trv_follower`) |
| Fenster und Soll | `kueche_heizung` (`automation.kuche_heizung`) |
| Zeitplan 04:00 auf 21° | `switch.schedule_kueche_04_00` |
| Zeitplan 20:00 auf 19,5° | `switch.schedule_kueche_20_00` |

Dieselben Uhrzeiten und Temperaturen wie bei Leon: täglich 04:00 auf 21°, 20:00 auf 19,5°. Die Abendtemperatur ist 19,5°, nicht 19°. `temperature_accuracy` soll an allen Ventilen −0,2° sein. Ein neues Ventil kommt mit −1,0°. Das Wohnzimmer stand vom 16. Oktober 2026, 22:43, bis 4. November wieder auf −1,0°, Ursache unbekannt. Mit −1,0° öffnete es bei Soll 22° erst bei 21,0° Raum. Die Fühler-Automation jedes Raums setzt den Wert seitdem auf −0,2° zurück, sobald er abweicht. Bei Ems ist der Raumfühler der Luftreiniger, nicht ein eigener Umweltsensor.

## Bausteine

`automations.yaml`:

- Ems und Küche, „<Raum> - TRV follower“ (Beispiel Leon bis 15. November 2026): schreibt `sensor.leon_temperatur` an `number.leon_thermostat_external_temperature_input`, nur wenn der Fühler eine Zahl liefert. Zusätzlich alle 30 Minuten. Dieselbe Zahl schickt Zigbee2MQTT nicht erneut, deshalb geht der Wert dafür zwei Sekunden um 0,1° nach oben und dann zurück. Ohne neue Meldung fällt das Ventil nach zwei Stunden auf den eigenen Fühler zurück (`remote_source_offline`) und regelt dann nach `sensor.leon_thermostat_local_temperature`. Die Automation stellt danach `select.leon_thermostat_temperature_sensor_select` wieder auf `remote_temperature`.
- „Leon - Heizung“ (`leon_heizung`):
  - Fenster auf (`on`) und Ventil nicht aus: merkt `fenster_aus`, schaltet das Ventil aus.
  - Fenster zu (`off`) und `fenster_aus` gesetzt: löscht es, schaltet auf Heizen. Ein Aus, das schon vor dem Öffnen galt, bleibt Aus.
  - Raum-Soll geändert oder Ventil auf Heizen: schreibt das Raum-Soll ans Ventil, wenn es abweicht.
  - Ventil-Soll steht 10 Sekunden auf einem neuen Wert (Karte, Taste am Ventil): übernimmt es als Raum-Soll. Die 10 Sekunden überbrücken die 7°, die das Ventil direkt nach dem Einschalten meldet.
  - Ventil springt auf Auto (Taste am Ventil, eingebauter Wochenplan): stellt es auf Heizen zurück. Danach greift der Zweig „Ventil auf Heizen“ und schreibt das Raum-Soll. Am 3. November 2026 stand die Küche so mit 16° im Wochenplan, während die Karte 22° zeigte.
  - Sonst nur im Modus Heizen. Im Modus Aus gleicht sie nichts ab.

`templates.yaml`: `sensor.leon_heizung_soll`, Trigger auf das Event `leon_heizung`. Daten `soll` (Zahl) und `fenster_aus` (true/false), jeweils optional. Behält den Wert über Neustarts.

`scripts.yaml`: `script.leon_heizung_soll` mit Feld `temperatur`. Feuert `leon_heizung` mit `soll`.

`templates.yaml`: `climate.leon_heizung` für die Karte. Solltemperatur ist `sensor.leon_heizung_soll`, Isttemperatur `sensor.leon_temperatur`. HVAC-Modus und `hvac_action` kommen von `climate.leon_better_thermostat` (bei Ems und Küche vom Ventil). Eine Solländerung ruft das Skript auf, ein Moduswechsel Better Thermostat beziehungsweise das Ventil.

Zeitpläne: Aktion `script.turn_on`, Entity `script.leon_heizung_soll`, Daten `variables: {temperatur: 21}`. Läuft ein Zeitplan, während das Ventil aus ist, gilt der Wert beim nächsten Einschalten.

Am Ventil:

- `local_temperature_calibration` = 0.
- Tastensperre aus.
- `temperature_accuracy` = −0,2, hält die Fühler-Automation, solange `smart_temperature_control` aus ist, in Leon, Wohnzimmer und Bad der Ventil-Wächter.
- `smart_temperature_control` (PID-Regelung im Ventil): im Wohnzimmer vom 7. November 2026, 21:47, bis 15. November 2026 an, sonst überall aus. Ist sie an, gelten Genauigkeit und Öffnungsweite nicht, und die Fühler-Automation lässt die Genauigkeit in Ruhe. In Leon, Wohnzimmer und Bad schaltet der Ventil-Wächter sie aus.

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

### 7. Raum pendelt um 0,8°

Mit Genauigkeit −0,2 arbeitet der TRVZB als Zweipunktregler: ganz auf bei 0,3° unter Soll, ganz zu bei 0,1° darüber. Der Heizkörper gibt danach noch etwa zehn Minuten Wärme ab. Wohnzimmer am 7. November 2026 bei Soll 21°: auf bei 20,7°, nach etwa 10 Minuten zu bei 21,1°, Spitze 21,5°, dann knapp zwei Stunden Abkühlen bis 20,7°. Seit 21:47 läuft dort `smart_temperature_control` als Versuch. Vergleich nach zwei, drei Tagen, danach entscheiden, ob die anderen Räume folgen. Ausweichlösung: `valve_opening_degree` auf etwa 40 %.

### 7a. Auswertung PID-Versuch Wohnzimmer (15. November 2026)

Verlauf 5. bis 15. November 2026, Raumfühler, Phase Soll 21° (04:00 bis 20:00):

| Tag | min | max | Mittel | Anteil über 21,3° | Regelung |
|---|---|---|---|---|---|
| 5.11. | 20,7 | 21,7 | 21,17 | 25 % | Zweipunkt, Genauigkeit −0,2 |
| 6.11. | 20,1 | 21,5 | 21,15 | 21 % | Zweipunkt |
| 7.11. | 19,7 | 21,7 | 21,14 | 15 % | Zweipunkt, ab 21:47 PID |
| 10.11. | 19,5 | 22,1 | 21,01 | 23 % | PID |
| 11.11. | 19,5 | 22,7 | 21,11 | 23 % | PID |
| 12.11. | 19,5 | 22,5 | 21,11 | 35 % | PID |
| 13.11. | 19,5 | 22,3 | 21,31 | 38 % | PID |
| 14.11. | 19,7 | 22,5 | 21,49 | 55 % | PID, Fenster 12:40 bis 15:13 |

Typischer PID-Tag (12.11.): Ab 04:00 Soll 21°, der Raum steigt von 19,5° auf 22,3° um 07:30. Das Ventil meldet bis 07:30 „heizt“, obwohl der Raum schon ab etwa 05:00 über dem Soll liegt. Danach fällt er bis 20,1° um 12:00, das Ventil heizt von 09:00 bis 20:00 durch, zweite Spitze 21,7° um 16:00. Pendeln um etwa ±1° mit 8 bis 10 Stunden Periode. Die PID-Regelung im Ventil reagiert zu träge und schießt nach dem Morgensprung von 19,5° auf 21° deutlich über. Gegenüber Zweipunkt (Spitzen 21,5 bis 21,7°) ist das schlechter.

`hvac_action` „heizt“ heißt im PID-Modus nur „Ventil nicht ganz zu“. Der Anteil „heizt“ stieg von 3 bis 19 % (Zweipunkt) auf 58 bis 70 % (PID) und taugt nicht als Maß für die Öffnung.

14.11. ab 19:00 bis 15.11. mittags: Raum bis 24,1° um 23:00 und nachts 22,3 bis 22,9°, ohne dass das Ventil seit 17:30 gefahren ist (Motorspannung unverändert, „idle“). Die anderen Räume blieben normal. Vermutlich ließ das locker montierte Ventil trotz „zu“ Wasser durch (8a). Mögliche Folge auch für die PID-Tage davor: Wie lange der Kopf schon locker saß, ist unbekannt. Diese Zeit nicht zur Bewertung der Regelung nutzen.

Die Karten (`climate.<raum>_heizung`) hatten `precision: 0.5` und rundeten die Ist-Temperatur im Verlauf auf 0,5°. Seit 15. November 2026 `precision: 0.1`. Das Ventil bekam immer Zehntel. Der Raumfühler Wohnzimmer meldet in 0,2°-Schritten, der externe Eingang zeigt zusätzlich die +0,1°-Wachhaltewerte der Fühler-Automation.

### 7b. Vorbild: Better Thermostat in Leons Zimmer, Februar und März 2026

Aus dem Backup vom 14. Oktober 2026 (`/backup/6cf3d6c9.tar`, Better Thermostat 1.7.0). Eintrag „Leon Thermostat“, angelegt am 2. Februar 2026:

- Ventil `climate.leon_thermostat`, Raumfühler `sensor.leon_sensor_env_temperature`, Feuchte `sensor.leon_sensor_env_humidity`, Außen über `weather.forecast_home`
- `calibration: local_calibration_based`: Better Thermostat verschiebt `local_temperature_calibration`, das Ventil regelt mit eigenem Fühler und Zweipunkt
- `calibration_mode: heating_power_calibration` (in der Oberfläche „AI Time Based“): lernt die Aufheizgeschwindigkeit und nimmt den Offset vor dem Soll zurück, damit die Restwärme nicht überschießt
- `tolerance: 0`, `target_temp_step: 0`, `off_temperature: 20`, keine Fenstersensoren, Kindersicherung und Überhitzungsschutz aus

Ergebnis laut Langzeitstatistik (`sensor.leon_sensor_env_temperature`, Stundenmittel, 07 bis 20 Uhr): im Januar 2026 ohne Better Thermostat Tagesspanne 0,6 bis 2,8°, Tagesmittel zwischen 19,4 und 22,8°. Ab 4. Februar, nach zwei Tagen Lernen, Spanne meist 0,3 bis 0,8°, im März Stundenmittel fast immer 20,7 bis 21,2° bei Soll 21°. Ausreißer über 1° nur an einzelnen Tagen, vermutlich Fenster.

Das Backup vom 25. Januar 2026 enthält noch keinen Better-Thermostat-Eintrag und keine Heizungs-Automationen. Fehler 1 (Offset auf +12,6°) trat später mit genau diesem Modus auf. Seit 15. November 2026 wieder im Einsatz, mit `target_temp_based` (Abschnitt Better Thermostat oben).

### 8. Ems: Ventilstift klemmte

Bei Ems lag der Raum tagelang um 20,3°, während das Ventil „heizt“ meldete. Die Kalibrierung vom 11. November 2026 zeigte das Muster eines klemmenden Stifts: Grenzspannung Öffnen 3326, Schließen 2408, also mehr Kraft zum Öffnen als zum Schließen. Gesunde Ventile liegen umgekehrt (Leon 1803/3053, Wohnzimmer 1522/2647, Küche 2034/2713).

Am 15. November 2026 hat Leon das Ventil abgenommen und den Stift geölt. Neue Kalibrierung um 11:38: Öffnen 2126, Schließen 2707, Leerlaufschritte 141, Schließschritte 277. Danach von 11:42 bis 11:55 zweimal zu (Soll 5°) und zweimal auf (Soll 30°), mit `automation.ems_heizung` pausiert. Der Motor fuhr jedes Mal etwa sieben Sekunden nach dem Befehl (`valve_motor_running_voltage` neu: rund 1436 nach dem Schließen, rund 1340 nach dem Öffnen), und Leon hörte den Durchfluss jedes Mal stoppen und wieder anlaufen.

Prüfen bei Verdacht an einem anderen Ventil: Grenzspannung Öffnen deutlich über Schließen heißt Stift prüfen.

### 8a. Wohnzimmer: Ventil saß locker

Am 14. November 2026 fuhr der Motor um 17:18 zum letzten Mal, mit `valve_motor_running_voltage` 2134 (sonst 1300 bis 1500). Danach meldete das Ventil zu, ab 20:00 bei Soll 19,5°. Der Raum stieg trotzdem von 21,7° auf 24,3° um 23:08 und lag am 15. November bis Mittag über 22°. Um 12:08 zeigte der Gehäusefühler 29,7° bei 22,3° Raum. Der Heizkörper war laut Leon komplett warm.

Leons Test am 15. November um 12:17 (Fenster auf und zu, Karte 24,5° und 19,5°): Motor und Durchfluss hörbar, Spannung 995 beim Öffnen, 1307 beim Schließen, normal. Danach trotzdem den ganzen Nachmittag 21,9 bis 22,3° bei Soll 19,5° und geschlossenem Ventil. Die Kalibrierwerte zeigten kein Klemmen (Öffnen 1522, Schließen 2647).

Ursache nach Leon: Ventilkopf zu locker auf dem Ventil, der Stift wurde nicht ganz eingedrückt. Am 15. November gegen 16:50 Stift geölt und Kopf fester verschraubt. Neue Kalibrierung um 16:55: Öffnen 1530, Schließen 2445, Schließschritte 267, Leerlaufschritte 129. Fahrten um 16:56 und 16:57: 979/1324 und 987/1318. Während der Montage maß das Ventil etwa zwei Minuten mit dem Gehäusefühler (29 bis 30°), Better Thermostat schob das Ventil-Soll dabei zwischen 19 und 35°. Ab 16:57 wieder Raumfühler, Soll ruhig.

Ob es jetzt dicht schließt, zeigt der Abend des 15. November: Ventil zu, der Raum sollte unter 22° fallen. Die Wärme vom 14. November (7a) erklärt das vermutlich, Ems (8) hatte dagegen mehr Kraft zum Öffnen als zum Schließen. Ein locker sitzender Kopf zeigt sich nicht in den Grenzspannungen, nur im Verlauf: Raum steigt bei geschlossenem Ventil, Heizkörper bleibt warm.

### 9. Sonst beobachtet

- `temporary_mode_select: boost` mit Dauer 0 steht seit Mai so und ist kein aktiver Boost.
- `valve_opening_degree` und `valve_closing_degree` = 100 sind die Grenzen, nicht die aktuelle Stellung. Der TRVZB meldet keine Stellung. Im Bad stellt Better Thermostat sie seit 15. November 2026 laufend (Test oben).
- Im Modus Aus meldet das Ventil Soll 7°.

## Neuer Raum: Checkliste

1. Ventil in Zigbee2MQTT anlernen, Entity-IDs notieren und hier eintragen. Keine IDs raten.
2. Raumfühler wählen. Er sollte nicht direkt am Heizkörper hängen.
3. „Leon - TRV follower“ kopieren, Fühler und externen Eingang tauschen.
4. Template-Sensor in `templates.yaml` kopieren, mit eigenem Event (`<raum>_heizung`) und eigener ID.
5. Skript in `scripts.yaml` kopieren, Event tauschen.
6. „Leon - Heizung“ kopieren, Ventil, Fenstersensor, Sensor und Event tauschen.
7. `local_temperature_calibration` am Ventil auf 0, Tastensperre aus, `temperature_accuracy` auf −0,2. Ventil und Fenstersensor in den Bereich des Raums.
8. Zeitpläne: `script.turn_on` auf das neue Skript mit `variables: {temperatur: …}`.
9. Bubble-Klima-Karte auf die Template-Klima-Entity, Name „Heizung“, nur mit Fenster-Icon (`state_background: true`), im Raum-Popup in `dashboards/dashboard-schlemnitz.yaml`.
10. Prüfen: Soll auf der Karte ändern, nach 10 Sekunden steht es im Sensor. Fenster auf → Ventil aus, zu → Heizen mit altem Soll. Aus auf der Karte, Fenster auf und zu → bleibt Aus.

## Offen

- PID-Versuch im Wohnzimmer: ausgewertet am 15. November 2026 (Fehler 7a), beendet. Ersetzt durch Better Thermostat.
- Wärme im Wohnzimmer am 14. und 15. November 2026 bei geschlossenem Ventil: vermutlich der locker montierte Kopf (8a). Prüfen, ob der Raum ab 15. November abends bei geschlossenem Ventil fällt.
- Ob Ems nach dem Ölen (Fehler 8) jetzt 21° erreicht. Verlauf ab 15. November 2026 ansehen.
- Ob Fehler 2 wiederkommt. Morgens nach 04:00 sollte das Ventil öffnen, wenn der Raum unter 21° liegt.
- Better Thermostat in Leon, Wohnzimmer und Bad ab 17. November 2026 bewerten (Abschnitt Better Thermostat oben, Wohnzimmer ab der neuen Montage, Bad mit direkter Ventilsteuerung).
- Soll am Ventil-Display: Test mit direkter Ventilsteuerung im Bad. Klappt er, Wohnzimmer und Leon umstellen.
