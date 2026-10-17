// Opens the light detail screen of Hue-like Light Card directly, skipping its
// scene and tile overview. Trigger from any card:
//   tap_action:
//     action: fire-dom-event
//     hue_licht: light.wohnzimmer_decke
// A list of lights opens all of them at once, one marker each on the color
// wheel. hue_gruppe is the group light used for the on/off switch:
//     hue_licht: [light.a, light.b]
//     hue_gruppe: light.ab
// hue_live: true sends color and brightness while dragging (every LIVE_MS),
// not only on release, with a short transition (LIVE_TRANSITION_S).
// Relies on internals of Hue-like Light Card v1.11 (api(), _ctrl, hue-dialog,
// _lightDetailElement, hue-dialog-tile-light.tileClicked, clearSelectedLights,
// onDialogClose, _colorPicker, _brightnessRollup, onColorChanged).
// Check after HACS updates.

const CARD_TAG = "hue-like-light-card";
const DIALOG_TAG = "hue-dialog";
const TILE_TAG = "hue-dialog-tile-light";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs = 3000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await sleep(30);
  }
  return null;
}

// Zigbee drops commands when flooded, so keep this at a few per second.
const LIVE_MS = 200;
// Slightly longer than LIVE_MS, so the light is still fading when the next
// value arrives and never stops between steps.
const LIVE_TRANSITION_S = 0.3;

function withTransition(hass) {
  return {
    ...hass,
    callService: (domain, service, data, ...rest) => {
      const isLevel =
        data &&
        ["brightness", "color_temp_kelvin", "hs_color", "rgb_color", "xy_color"].some(
          (k) => data[k] !== undefined
        );
      if (domain === "light" && service === "turn_on" && isLevel && data.transition === undefined) {
        data = { ...data, transition: LIVE_TRANSITION_S };
      }
      return hass.callService(domain, service, data, ...rest);
    },
  };
}

function throttle(fn, ms) {
  let last = 0;
  let timer = null;
  let args = null;
  return (...a) => {
    args = a;
    const wait = last + ms - Date.now();
    if (wait <= 0) {
      last = Date.now();
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn(...args);
      }, wait);
    }
  };
}

async function enableLive(detail) {
  await detail.updateComplete;
  const ready = await waitFor(() => detail._colorPicker && detail._brightnessRollup);
  if (!ready) return;
  const picker = detail._colorPicker;
  const rollup = detail._brightnessRollup;
  picker.addEventListener(
    "immediate-value-change",
    throttle((ev) => detail.onColorChanged(ev), LIVE_MS)
  );
  rollup.addEventListener(
    "immediate-value-change",
    throttle(() => rollup.setValue(rollup.immediateValue, true), LIVE_MS)
  );
}

let busy = false;

async function openLight(lights, group, live) {
  if (busy) return;
  busy = true;
  let card = null;
  let timer = null;
  try {
    await customElements.whenDefined(CARD_TAG);
    const ha = document.querySelector("home-assistant");
    if (!ha || !ha.hass) return;

    const several = lights.length > 1;
    card = document.createElement(CARD_TAG);
    card.setConfig(
      several
        ? { entities: lights, groupEntity: group, scenes: [] }
        : { entity: lights[0], scenes: [] }
    );
    const hassFor = (h) => (live ? withTransition(h) : h);
    card.hass = hassFor(ha.hass);
    card.style.display = "none";
    document.body.appendChild(card);
    await card.updateComplete;

    const before = new Set(ha.shadowRoot.querySelectorAll(DIALOG_TAG));
    card.api().openHueScreen();
    const dialog = await waitFor(() =>
      [...ha.shadowRoot.querySelectorAll(DIALOG_TAG)].find((d) => !before.has(d))
    );
    if (!dialog) return;

    let lastHass = ha.hass;
    timer = setInterval(() => {
      if (!dialog.isConnected) {
        clearInterval(timer);
        card.remove();
        return;
      }
      if (ha.hass !== lastHass) {
        lastHass = ha.hass;
        card.hass = hassFor(lastHass);
      }
    }, 250);

    await dialog.updateComplete;
    const tile = await waitFor(() => dialog.renderRoot.querySelector(TILE_TAG));
    const detail = await waitFor(() => dialog._lightDetailElement);
    if (!tile || !detail) return;
    await tile.updateComplete;

    // Leaving the detail screen closes the whole dialog instead of showing the overview.
    // onDialogClose also steps back in history, so it must run only once.
    const clear = dialog.clearSelectedLights.bind(dialog);
    let closing = false;
    dialog.clearSelectedLights = () => {
      clear();
      if (closing) return;
      closing = true;
      setTimeout(() => dialog.onDialogClose(), 0);
    };
    if (live) await enableLive(detail);
    if (several) {
      dialog.setSelectedLights(...card._ctrl.getLights());
      detail.lightContainer = card._ctrl;
      detail.show();
    } else {
      tile.tileClicked();
    }
  } catch (err) {
    console.error("[hue-licht]", err);
    if (timer) clearInterval(timer);
    if (card) card.remove();
  } finally {
    busy = false;
  }
}

window.addEventListener("ll-custom", (ev) => {
  const d = ev.detail || {};
  if (!d.hue_licht) return;
  const lights = Array.isArray(d.hue_licht) ? d.hue_licht : [d.hue_licht];
  openLight(lights, d.hue_gruppe, d.hue_live === true);
});
