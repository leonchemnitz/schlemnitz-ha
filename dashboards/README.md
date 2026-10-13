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
(`www/community/`): Bubble Card, Card Mod, Mushroom, Scheduler Card,
Universal Remote Card.
