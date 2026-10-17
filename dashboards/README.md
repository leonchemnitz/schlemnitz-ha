# Lovelace dashboards

These files are the source of truth. Home Assistant loads them in YAML mode
(`lovelace:` in `configuration.yaml`).

The visual editor does not save them. Edits are file edits plus a Lovelace
reload: save the YAML, then reload the dashboard in the browser. Home
Assistant re-reads the file the next time it is fetched. Card edits do not
need a core restart. Restart only when a dashboard entry in
`configuration.yaml` changes (new dashboard, title, icon, sidebar, or url
path).

Built-in strategy dashboards stay in storage mode and are not in this
folder: Übersicht (`/lovelace`, original-states) and Karte (`/map`).

| Title | URL path | Sidebar | Icon | File | Views |
| --- | --- | --- | --- | --- | --- |
| Schlemnitz | `/dashboard-schlemnitz` | shown | `mdi:cards-heart` | `dashboard-schlemnitz.yaml` | 2 (`wandfeuchte` is a subview) |
| Test | `/dashboard-test` | shown | default | `dashboard-test.yaml` | 1 |
| Zeitsteuerung | `/dashboard-zeitsteuerung` | shown | `mdi:calendar-clock` | `dashboard-zeitsteuerung.yaml` | 1 |

Frontend cards used here are installed with HACS and are not in git
(`www/community/`): Bubble Card, Card Mod, Hue-like Light Card, Mushroom,
Scheduler Card, Universal Remote Card.

Hue-style light screen (every color light and every room group in the room
pop-ups): the Bubble button keeps its look, its icon tap is `fire-dom-event` with
`hue_licht: <light entity>`. For a room, `hue_licht` is a list of all lights
and `hue_gruppe` the group light. On/off-only lights keep their toggle tap.
`hue_live: true` sends color and brightness while dragging, every 200 ms with
a 0.3 s transition
(test: Ems Kugelständer).
`www/hue-licht.js` (Lovelace resource `/local/hue-licht.js?v=N`, module)
opens the light detail of Hue-like Light Card directly, without its overview.
It uses card internals of v1.11, so check it after a HACS update. Bump `?v=`
in the resource after editing the file.
