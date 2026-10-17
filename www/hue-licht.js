// Opens the light detail screen of Hue-like Light Card directly, skipping its
// scene and tile overview. Trigger from any card:
//   tap_action:
//     action: fire-dom-event
//     hue_licht: light.wohnzimmer_decke
// A list of lights opens all of them at once, one marker each on the color
// wheel. hue_gruppe is the group light used for the on/off switch:
//     hue_licht: [light.a, light.b]
//     hue_gruppe: light.ab
// Relies on internals of Hue-like Light Card v1.11 (api(), _ctrl, hue-dialog,
// _lightDetailElement, hue-dialog-tile-light.tileClicked, clearSelectedLights,
// onDialogClose). Check after HACS updates.

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

let busy = false;

async function openLight(lights, group) {
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
    card.hass = ha.hass;
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
        card.hass = lastHass;
      }
    }, 250);

    await dialog.updateComplete;
    const tile = await waitFor(() => dialog.renderRoot.querySelector(TILE_TAG));
    const detail = await waitFor(() => dialog._lightDetailElement);
    if (!tile || !detail) return;
    await tile.updateComplete;

    // Leaving the detail screen closes the whole dialog instead of showing the overview.
    const clear = dialog.clearSelectedLights.bind(dialog);
    dialog.clearSelectedLights = () => {
      clear();
      setTimeout(() => dialog.onDialogClose(), 0);
    };
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
  openLight(lights, d.hue_gruppe);
});
