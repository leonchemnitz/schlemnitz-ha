# SigNoz im Haus

Entscheidungsvorlage, Stand 9. Oktober 2026. Noch nichts ist installiert. Home Assistant wird dafür nicht angefasst. Die Defaults gelten erst, wenn Leon sie annimmt.

Ziel: eine eigene SigNoz-Instanz im LAN, die Sensordaten als Metriken und Schaltvorgänge als Ereignisse bekommt. Der HA-Verlauf (Recorder) bleibt.

## Empfehlung

Neue Proxmox-VM, Ubuntu Server, SigNoz per Docker Compose. ClickHouse läuft nur dort.

Die HA-OS-VM (`192.168.178.57`) bleibt die Appliance. Die Agent-VM (`192.168.178.105`) bleibt der Cursor-Worker. Beide bekommen keinen ClickHouse-Prozess und keine SigNoz-Datenplatte.

LXC spart etwas RAM, teilt sich aber den Kernel mit dem Proxmox-Host. ClickHouse plus Docker braucht dort Nesting und extra Rechte und kann den Host bei Speicherdruck mitziehen. Für diese eine Instanz ist eine eigene VM die ruhigere Wahl.

## Größe

Quellen, abgerufen am 9. Oktober 2026:

- [Docker Standalone](https://signoz.io/docs/install/docker/): eine Maschine, Docker Engine 20.10+ mit Compose v2, mindestens 4 GB RAM für Docker. Offene Ports: `8080` (Oberfläche), `4317` (OTLP gRPC), `4318` (OTLP HTTP). Port `8000` nur, wenn man den optionalen MCP-Server einschaltet. Den lassen wir aus.
- Dieselbe Seite: das alte `install.sh` und die Compose-Dateien unter `deploy/` sind seit SigNoz v0.130.0 abgekündigt. Der unterstützte Weg erzeugt die Compose-Dateien mit Foundry (`flavor: compose`). Der Stack auf einer Maschine ist: ClickHouse, ClickHouse Keeper, Postgres, OTel-Collector, SigNoz.
- [Retention](https://signoz.io/docs/userguide/retention-period/): Vorgabe 15 Tage für Logs und Traces, 30 Tage für Metriken. Self-Host ändert das unter Einstellungen, Workspace, Retention. Die Änderung gilt nur für neu ankommende Daten.
- [Ingestion](https://signoz.io/docs/ingestion/self-hosted/overview/): ohne TLS ist das Ziel `http://<ip>:4317` oder `http://<ip>:4318`.
- [Installation-FAQ](https://signoz.io/docs/faqs/installation/): das ClickHouse-Volume in Kubernetes ist per Default 20 GB. Eine eigene Docker-Plattengröße nennt die Doku nicht.
- [Resources Planning](https://signoz.io/docs/setup/capacity-planning/community/resources-planning/): das ist ein Mehr-Knoten-Bild (ClickHouse 16 Kerne / 32 GiB, Collector 16 GiB). Es listet noch ZooKeeper. Für diese Wohnung ist die Tabelle die falsche Größe.

Vorschlag für diese Wohnung (etwa 463 Entities, davon 156 Sensoren, 46 Lichter, 17 Automationen):

| | |
|---|---|
| vCPU | 4 |
| RAM | 8 GB |
| Platte | 40 GB |
| IP | fest im Netz `192.168.178.0/24`, weder `.57` noch `.105` |

8 GB liegen über der 4-GB-Untergrenze, damit ClickHouse nicht mit dem Betriebssystem um den letzten Speicher ringt. 40 GB deckt System, Images und die Daten ab. Solange Sensorwerte nur Metriken sind, bleiben 15 Tage Logs und 30 Tage Metriken weit unter dem 20-GB-ClickHouse-Default. Die Platte ist Puffer, kein Versprechen der Doku.

## Brücke

Home Assistant hat keinen eingebauten SigNoz- oder OTLP-Export. Der Recorder schreibt die Historie für Verlauf, Logbuch und Energie. Das bleibt so.

Die Brücke ist ein kleiner Dienst auf der Agent-VM. Der langlebige HA-Token liegt dort schon. Er wird nicht in diesen Plan geschrieben, nicht ins Git übernommen und nicht auf die SigNoz-VM kopiert. Der Dienst liest den bestehenden Websocket bzw. die API und schickt OTLP an die neue VM.

- Sensoren und numerische Zustände werden Gauges (Metriken).
- Licht, Schalter, Taster, Szene, Automations-Auslösung und andere diskrete Zustandswechsel werden Logs. Keine Traces. Traces sind für verteilte Requests, nicht für „Licht an“.

v1 lässt aus: Kameras und Medienströme, den Ersatz des HA-Recorders, Zigbee-Netzwerkschlüssel und die Zigbee2MQTT-Konfiguration.

## Phasen

### 1. VM und SigNoz

Leon in Proxmox: VM anlegen (kein LXC), 4 vCPU, 8 GB, 40 GB, Ubuntu Server, feste LAN-IP, VM starten.

Agent danach: Docker und den Compose-Stack auf dieser VM, Oberfläche auf Port 8080 erreichbar, Aufbewahrung auf der Vorgabe lassen (15 Tage Logs, 30 Tage Metriken). MCP-Port 8000 bleibt aus.

### 2. Sensor-Metriken

Leon: die Domain-Liste unten bestätigen, oder eine kürzere Liste schicken.

Agent: Dienst auf der Agent-VM, nur Zahlen und binäre Zustände als Gauges nach `4318`.

### 3. Ereignisse

Leon: nichts, solange die Domain-Liste aus Phase 2 gilt.

Agent: Zustandswechsel von Licht, Schalter, Taster, Szene und Automation als Logs. Sensor-Updates werden dabei nicht noch einmal als Logzeile geschrieben.

### 4. Erstes Dashboard

Agent: eine Übersicht mit ein paar Sensorverläufen und den letzten Schaltvorgängen.

Leon: die Seite im Browser ansehen und sagen, ob Raum und Auswahl stimmen.

## Offene Punkte

Jeder Punkt hat einen Vorschlag. Widerspruch vor Phase 1 genügt, sonst gilt die Zeile. Phase 1 startet erst nach Leons Okay.

| Frage | Vorschlag |
|---|---|
| VM oder LXC? | VM |
| Aufbewahrung | Vorgabe der Doku: Logs 15 Tage, Metriken 30 Tage. Traces ungenutzt |
| Welche Domains? | Nur `sensor`, `binary_sensor`, `light`, `switch`, `button`, plus `scene` und `automation` als Ereignisse. Nicht alle Entities |
| HA-Recorder | Bleibt. SigNoz ist die zweite Sicht |

## Risiken

- RAM. Unter 8 GB läuft der Stack auf der 4-GB-Kante. ClickHouse nimmt sich Speicher, wenn die VM ihn hergibt. Die VM begrenzen, den Proxmox-Host nicht mit überbuchen.
- Platte. Wächst stark, wenn jeder Sensorwechsel zusätzlich ein Log wird oder Attribute mit in die Zeile wandern. Metriken und Logs getrennt halten.
- Token. Bleibt auf der Agent-VM. Ein Neustart der Brücke liest ihn dort neu. Er steht in keinem Dashboard und in keinem Repo.
- HA-Neustart. Reißt der Websocket ab, fehlt die Lücke in SigNoz. v1 holt sie nicht aus dem Recorder nach. Die Brücke verbindet sich wieder, sobald HA da ist.
- Labels. Metrik-Labels nur `entity_id`, `domain`, `device_class` und ein stabiler Raumname. Keine rohen Attribute (Farbe, Helligkeit, Effekt, freundlicher Name). Die gehören höchstens in den Log-Text, sonst sprengt die Kombination aus Label-Werten den Speicher.
