# schlemnitz-ha

Versioned Home Assistant configuration (HA OS at `192.168.178.57`).

Cloud Agents read `AGENTS.md`, `docs/kontext.md`, and `docs/signoz.md`. Speak German with Leon.

The working copy lives on the management VM at `~/ha/config`. HA itself holds
no git state or GitHub credentials.

- `~/ha/bin/ha-pull` syncs HA `/config` to the VM over rsync+ssh (read-only on
  HA), regenerates `secrets.example.yaml`, and shows `git status`. Run it
  after making changes in the HA UI, then review and commit.
- `~/ha/bin/ha-check` runs HA's config check (`POST /api/config/core/check_config`)
  using `HA_URL` / `HA_TOKEN` from `~/.config/ha/env`.

## Lovelace dashboards

User-created dashboards live in `dashboards/` and are loaded by Home Assistant
(YAML mode, see `configuration.yaml`). Those files are the source of truth.
The visual editor does not save them: edit the file, then reload the
dashboard in the browser. Details are in `dashboards/README.md`.

## Not in this repo

| Path | Why |
| --- | --- |
| `secrets.yaml` | Real credentials. `secrets.example.yaml` lists the keys with placeholder values. |
| `*.db*`, `*.log*`, `home-assistant.log.fault` | Recorder database and logs: large, constantly changing. |
| `.storage/` | UI-managed registries, auth tokens, and integration credentials. Strategy dashboards (Übersicht, Karte) stay here. |
| `.cloud/`, `.cache/`, `.ha_run.lock`, `deps/`, `tts/`, `backups/`, `__pycache__/` | Runtime state, caches, generated files. |
| `custom_components/`, `www/community/` | Installed by HACS; reinstall from the list below. |
| `zigbee2mqtt/` | `configuration.yaml` contains the Zigbee `network_key`, `pan_id`/`ext_pan_id` and the MQTT password; `coordinator_backup.json` also contains the network key. Back it up via HA backups instead. |

## HACS repositories

Integrations (`custom_components/`):

| Repository | Version |
| --- | --- |
| [hacs/integration](https://github.com/hacs/integration) | 2.0.5 |
| [KartoffelToby/better_thermostat](https://github.com/KartoffelToby/better_thermostat) | 1.7.0 |
| [thomasloven/hass-browser_mod](https://github.com/thomasloven/hass-browser_mod) | v2.7.3 |
| [Hypfer/hass-scene_presets](https://github.com/Hypfer/hass-scene_presets) | 2.4.0 |
| [nielsfaber/scheduler-component](https://github.com/nielsfaber/scheduler-component) | v3.3.8 |
| [al-one/hass-xiaomi-miot](https://github.com/al-one/hass-xiaomi-miot) | v1.1.2 |

Frontend cards (`www/community/`):

| Repository | Version |
| --- | --- |
| [Clooos/Bubble-Card](https://github.com/Clooos/Bubble-Card) | v3.1.4 |
| [Gh61/lovelace-hue-like-light-card](https://github.com/Gh61/lovelace-hue-like-light-card) | v1.8.1 |
| [piitaya/lovelace-mushroom](https://github.com/piitaya/lovelace-mushroom) | v5.0.11 |
| [thomasloven/lovelace-card-mod](https://github.com/thomasloven/lovelace-card-mod) | v4.2.1 |
| [kalkih/mini-media-player](https://github.com/kalkih/mini-media-player) | v1.16.10 |
| [nielsfaber/scheduler-card](https://github.com/nielsfaber/scheduler-card) | v4.0.16 |
| [Nerwyn/universal-remote-card](https://github.com/Nerwyn/universal-remote-card) | 4.10.8 |
