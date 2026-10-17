// Opens the light detail screen of Hue-like Light Card directly, skipping its
// scene and tile overview. Trigger from any card:
//   tap_action:
//     action: fire-dom-event
//     hue_licht: light.wohnzimmer_decke
// Relies on internals of Hue-like Light Card v1.11 (api(), hue-dialog,
// hue-dialog-tile-light.tileClicked, clearSelectedLights, onDialogClose).
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

let busy = false;

async function openLight(entity) {
  if (busy) return;
  busy = true;
  let card = null;
  let timer = null;
  try {
    await customElements.whenDefined(CARD_TAG);
    const ha = document.querySelector("home-assistant");
    if (!ha || !ha.hass) return;

    card = document.createElement(CARD_TAG);
    card.setConfig({ entity, scenes: [] });
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
    if (!tile) return;
    await tile.updateComplete;

    // Leaving the detail screen closes the whole dialog instead of showing the overview.
    const clear = dialog.clearSelectedLights.bind(dialog);
    dialog.clearSelectedLights = () => {
      clear();
      setTimeout(() => dialog.onDialogClose(), 0);
    };
    tile.tileClicked();
  } catch (err) {
    console.error("[hue-licht]", err);
    if (timer) clearInterval(timer);
    if (card) card.remove();
  } finally {
    busy = false;
  }
}

window.addEventListener("ll-custom", (ev) => {
  const entity = ev.detail && ev.detail.hue_licht;
  if (entity) openLight(entity);
});
