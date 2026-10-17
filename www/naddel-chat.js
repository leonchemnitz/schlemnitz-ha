// Chat card for an Assist pipeline with streamed replies.
//   type: custom:naddel-chat-card
//   pipeline_id: <assist pipeline id>   # optional, default: preferred pipeline
//   name: Naddel                        # optional
//   height: 60vh                        # optional
// Uses the same websocket API as the built-in Assist dialog
// (assist_pipeline/run, intent-progress chat_log_delta, binary STT audio).

const STORE_KEY = "naddel-chat-v1";
const MAX_STORED = 40;

const TOOL_LABELS = {
  HassTurnOn: "Einschalten",
  HassTurnOff: "Ausschalten",
  HassLightSet: "Licht einstellen",
  HassClimateSetTemperature: "Temperatur setzen",
  HassMediaPause: "Pause",
  HassMediaUnpause: "Weiter",
  HassMediaNext: "Nächster Titel",
  HassMediaPrevious: "Voriger Titel",
  HassSetVolume: "Lautstärke",
  HassListAddItem: "Zur Liste hinzufügen",
  HassListCompleteItem: "Erledigt",
  GetLiveContext: "Zustand abfragen",
  GetDateTime: "Uhrzeit",
};

const STYLE = `
  :host { display: block; }
  .wrap {
    display: flex; flex-direction: column;
    height: var(--naddel-height, 60vh);
    min-height: 320px;
    font-family: var(--paper-font-body1_-_font-family, inherit);
  }
  .bar { display: flex; justify-content: flex-end; gap: 6px; padding: 0 4px 6px; }
  .icon-btn {
    border: 0; background: var(--bubble-secondary-background-color, var(--secondary-background-color));
    color: var(--primary-text-color); width: 36px; height: 36px; border-radius: 18px;
    display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .icon-btn.on { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  .icon-btn ha-icon { --mdc-icon-size: 20px; }
  .msgs {
    flex: 1; overflow-y: auto; padding: 4px 4px 12px;
    display: flex; flex-direction: column; gap: 8px;
    overscroll-behavior: contain;
  }
  .row { display: flex; }
  .row.user { justify-content: flex-end; }
  .bubble {
    max-width: 82%; padding: 10px 14px; border-radius: 20px;
    line-height: 1.4; font-size: 15px; word-wrap: break-word; white-space: normal;
    animation: pop .18s ease-out;
  }
  .user .bubble {
    background: var(--primary-color); color: var(--text-primary-color, #fff);
    border-bottom-right-radius: 6px; white-space: pre-wrap;
  }
  .hass .bubble {
    background: var(--bubble-main-background-color, var(--card-background-color));
    color: var(--primary-text-color);
    border-bottom-left-radius: 6px;
    box-shadow: 0 1px 2px rgba(0,0,0,.12);
  }
  .hass.error .bubble { color: var(--error-color, #db4437); }
  .bubble ha-markdown { display: block; }
  .tools { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
  .tool {
    font-size: 12px; padding: 2px 8px; border-radius: 10px;
    background: var(--bubble-secondary-background-color, var(--secondary-background-color));
    color: var(--secondary-text-color);
  }
  .tool.done::before { content: "✓ "; }
  .dots { display: inline-flex; gap: 4px; padding: 4px 0; }
  .dots span {
    width: 7px; height: 7px; border-radius: 50%; background: var(--secondary-text-color);
    animation: blink 1.2s infinite ease-in-out;
  }
  .dots span:nth-child(2) { animation-delay: .15s; }
  .dots span:nth-child(3) { animation-delay: .3s; }
  .input {
    display: flex; align-items: flex-end; gap: 6px; padding: 6px;
    border-radius: 26px;
    background: var(--bubble-main-background-color, var(--card-background-color));
    box-shadow: 0 1px 3px rgba(0,0,0,.15);
  }
  textarea {
    flex: 1; resize: none; border: 0; outline: none; background: transparent;
    color: var(--primary-text-color); font: inherit; font-size: 16px;
    padding: 8px 10px; max-height: 120px; line-height: 1.35;
  }
  .send { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  .send[disabled] { opacity: .4; cursor: default; }
  .mic.rec { background: var(--error-color, #db4437); color: #fff; animation: pulse 1.2s infinite; }
  @keyframes pop { from { transform: scale(.96); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes blink { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }
  @keyframes pulse { 50% { box-shadow: 0 0 0 6px rgba(219,68,55,.25); } }
`;

class NaddelChatCard extends HTMLElement {
  constructor() {
    super();
    this._messages = [];
    this._conversationId = null;
    this._busy = false;
    this._speak = false;
    this._audio = null;
    this._rec = null;
    this._sttHandler = null;
    this._built = false;
    this._load();
  }

  setConfig(config) {
    this._config = { name: "Naddel", height: "60vh", ...config };
    if (this._built) this.style.setProperty("--naddel-height", this._config.height);
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
  }

  getCardSize() {
    return 8;
  }

  _load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (s) {
        this._messages = (s.messages || []).filter((m) => !m.pending);
        this._conversationId = s.conversationId || null;
        this._speak = !!s.speak;
      }
    } catch (e) {
      this._messages = [];
    }
  }

  _save() {
    const messages = this._messages
      .filter((m) => !m.pending)
      .slice(-MAX_STORED)
      .map(({ who, text, error, tools }) => ({ who, text, error, tools }));
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ messages, conversationId: this._conversationId, speak: this._speak })
    );
  }

  async _build() {
    this._built = true;
    await this._ensureMarkdown();
    const root = this.attachShadow({ mode: "open" });
    this.style.setProperty("--naddel-height", this._config.height);
    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="wrap">
        <div class="bar">
          <button class="icon-btn speak" title="Antworten vorlesen"><ha-icon></ha-icon></button>
          <button class="icon-btn new" title="Neues Gespräch"><ha-icon icon="mdi:chat-plus-outline"></ha-icon></button>
        </div>
        <div class="msgs"></div>
        <div class="input">
          <button class="icon-btn mic" title="Sprechen"><ha-icon icon="mdi:microphone"></ha-icon></button>
          <textarea rows="1" placeholder="Frag ${this._config.name} …"></textarea>
          <button class="icon-btn send" title="Senden" disabled><ha-icon icon="mdi:arrow-up"></ha-icon></button>
        </div>
      </div>`;
    this._els = {
      msgs: root.querySelector(".msgs"),
      input: root.querySelector("textarea"),
      send: root.querySelector(".send"),
      mic: root.querySelector(".mic"),
      speak: root.querySelector(".speak"),
      newBtn: root.querySelector(".new"),
    };
    const { input, send, mic, speak, newBtn } = this._els;
    input.addEventListener("input", () => this._autosize());
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {
        ev.preventDefault();
        this._sendText();
      }
    });
    send.addEventListener("click", () => this._sendText());
    mic.addEventListener("click", () => (this._rec ? this._stopListening() : this._startListening()));
    speak.addEventListener("click", () => {
      this._speak = !this._speak;
      if (!this._speak) this._stopAudio();
      this._renderBar();
      this._save();
    });
    newBtn.addEventListener("click", () => {
      this._stopAudio();
      this._messages = [];
      this._conversationId = null;
      this._save();
      this._renderAll();
    });
    this._renderBar();
    this._renderAll();
  }

  async _ensureMarkdown() {
    if (customElements.get("ha-markdown")) return;
    try {
      const helpers = await window.loadCardHelpers();
      helpers.createCardElement({ type: "markdown", content: " " });
      await Promise.race([
        customElements.whenDefined("ha-markdown"),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    } catch (e) {
      // Plain text fallback.
    }
  }

  _autosize() {
    const { input, send } = this._els;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
    send.disabled = this._busy || !input.value.trim();
  }

  _renderBar() {
    const icon = this._els.speak.querySelector("ha-icon");
    icon.setAttribute("icon", this._speak ? "mdi:volume-high" : "mdi:volume-off");
    this._els.speak.classList.toggle("on", this._speak);
    this._els.mic.classList.toggle("rec", !!this._rec);
    this._autosize();
  }

  _renderAll() {
    const box = this._els.msgs;
    box.innerHTML = "";
    if (!this._messages.length) {
      this._appendRow({ who: "hass", text: `Hallo, ich bin ${this._config.name}. Wie kann ich helfen?` });
    }
    for (const m of this._messages) this._appendRow(m);
    this._scroll(true);
  }

  _appendRow(m) {
    const row = document.createElement("div");
    row.className = `row ${m.who}${m.error ? " error" : ""}`;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    row.appendChild(bubble);
    this._els.msgs.appendChild(row);
    m._row = row;
    this._fill(m);
    return row;
  }

  _fill(m) {
    const row = m._row;
    if (!row) return;
    row.className = `row ${m.who}${m.error ? " error" : ""}`;
    const bubble = row.firstChild;
    if (m.who === "user") {
      bubble.textContent = m.text;
      return;
    }
    if (!m.text && m.pending) {
      if (!bubble.querySelector(".dots")) {
        bubble.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
      }
    } else {
      let md = bubble.querySelector("ha-markdown");
      if (!md) {
        bubble.innerHTML = "";
        if (customElements.get("ha-markdown")) {
          md = document.createElement("ha-markdown");
          md.breaks = true;
          bubble.appendChild(md);
        } else {
          md = document.createElement("div");
          md.style.whiteSpace = "pre-wrap";
          bubble.appendChild(md);
        }
      }
      if (md.tagName === "HA-MARKDOWN") md.content = m.text;
      else md.textContent = m.text;
    }
    const tools = Object.values(m.tools || {});
    let box = bubble.querySelector(".tools");
    if (tools.length) {
      if (!box) {
        box = document.createElement("div");
        box.className = "tools";
        bubble.appendChild(box);
      }
      box.innerHTML = "";
      for (const t of tools) {
        const chip = document.createElement("span");
        chip.className = "tool" + (t.done ? " done" : "");
        chip.textContent = t.label;
        box.appendChild(chip);
      }
    } else if (box) {
      box.remove();
    }
  }

  _scroll(force = false) {
    const box = this._els.msgs;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    if (force || nearBottom) requestAnimationFrame(() => (box.scrollTop = box.scrollHeight));
  }

  _add(m) {
    if (!this._messages.length) this._els.msgs.innerHTML = "";
    this._messages.push(m);
    this._appendRow(m);
    this._scroll(true);
    return m;
  }

  _setBusy(b) {
    this._busy = b;
    this._autosize();
  }

  _stopAudio() {
    if (this._audio) {
      this._audio.pause();
      this._audio.removeAttribute("src");
      this._audio = null;
    }
  }

  _playTts(url) {
    this._stopAudio();
    const audio = new Audio(this._hass.hassUrl(url));
    this._audio = audio;
    audio.addEventListener("canplaythrough", () => audio.play().catch(() => {}));
    audio.addEventListener("ended", () => this._audio === audio && (this._audio = null));
    audio.play().catch(() => {});
  }

  // Turns pipeline events into one streamed assistant bubble.
  _replyProcessor() {
    let role = "";
    const reply = { who: "hass", text: "", tools: {}, pending: true };
    const update = () => {
      this._fill(reply);
      this._scroll();
    };
    return {
      reply,
      show: () => this._add(reply),
      event: (ev) => {
        if (ev.type === "intent-progress" && ev.data && ev.data.chat_log_delta) {
          const d = ev.data.chat_log_delta;
          if (d.role) role = d.role;
          if (role === "assistant") {
            if (d.content) reply.text += d.content;
            for (const tc of d.tool_calls || []) {
              const args = tc.tool_args || {};
              const what = args.name || args.area || args.floor || "";
              const label = (TOOL_LABELS[tc.tool_name] || tc.tool_name) + (what ? `: ${what}` : "");
              reply.tools[tc.id] = { label, done: false };
            }
            update();
          } else if (role === "tool_result" && reply.tools[d.tool_call_id]) {
            reply.tools[d.tool_call_id].done = true;
            update();
          }
        } else if (ev.type === "intent-end") {
          const out = ev.data.intent_output;
          this._conversationId = out.conversation_id;
          const speech = out.response && out.response.speech && out.response.speech.plain
            ? out.response.speech.plain.speech
            : "";
          if (speech) reply.text = speech;
          if (out.response && out.response.response_type === "error") reply.error = true;
          reply.pending = false;
          update();
          this._save();
        } else if (ev.type === "error") {
          reply.text = (ev.data && ev.data.message) || "Da ist etwas schiefgelaufen.";
          reply.error = true;
          reply.pending = false;
          update();
          this._save();
        }
      },
      finish: () => {
        if (reply.pending) {
          reply.pending = false;
          if (!reply.text) {
            reply.text = "Keine Antwort erhalten.";
            reply.error = true;
          }
          update();
          this._save();
        }
      },
    };
  }

  async _sendText() {
    const text = this._els.input.value.trim();
    if (!text || this._busy) return;
    this._els.input.value = "";
    this._stopAudio();
    this._add({ who: "user", text });
    this._save();
    this._setBusy(true);
    const p = this._replyProcessor();
    p.show();
    try {
      const unsub = await this._hass.connection.subscribeMessage(
        (ev) => {
          if (ev.type === "run-start" && this._speak && ev.data.tts_output && ev.data.tts_output.url) {
            this._playTts(ev.data.tts_output.url);
          }
          p.event(ev);
          if (ev.type === "run-end" || ev.type === "error") {
            p.finish();
            this._setBusy(false);
            unsub();
          }
        },
        this._runMsg({
          start_stage: "intent",
          end_stage: this._speak ? "tts" : "intent",
          input: { text },
        })
      );
    } catch (err) {
      p.event({ type: "error", data: { message: err.message || String(err) } });
      this._setBusy(false);
    }
  }

  _runMsg(extra) {
    const msg = { type: "assist_pipeline/run", ...extra };
    if (this._config.pipeline_id) msg.pipeline = this._config.pipeline_id;
    if (this._conversationId) msg.conversation_id = this._conversationId;
    return msg;
  }

  async _startListening() {
    if (this._busy) return;
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this._add({
        who: "hass",
        error: true,
        text: "Das Mikrofon geht nur über eine sichere Verbindung (HTTPS) oder in der Companion App.",
      });
      return;
    }
    this._stopAudio();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      this._add({ who: "hass", error: true, text: "Kein Zugriff auf das Mikrofon." });
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const buffer = [];
    proc.onaudioprocess = (e) => {
      const f = e.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(f.length);
      for (let i = 0; i < f.length; i++) {
        const s = Math.max(-1, Math.min(1, f[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      if (this._sttHandler == null) buffer.push(pcm);
      else this._sendAudio(pcm);
    };
    source.connect(proc);
    proc.connect(ctx.destination);
    this._rec = { stream, ctx, source, proc, buffer };
    this._renderBar();

    const user = this._add({ who: "user", text: "…" });
    this._setBusy(true);
    const p = this._replyProcessor();
    try {
      const unsub = await this._hass.connection.subscribeMessage(
        (ev) => {
          if (ev.type === "run-start") {
            this._sttHandler = ev.data.runner_data.stt_binary_handler_id;
            for (const chunk of buffer.splice(0)) this._sendAudio(chunk);
            if (ev.data.tts_output && ev.data.tts_output.url) this._playTts(ev.data.tts_output.url);
          } else if (ev.type === "stt-end") {
            this._stopListening(false);
            user.text = (ev.data.stt_output && ev.data.stt_output.text) || "…";
            this._fill(user);
            p.show();
          } else if (ev.type.startsWith("intent-")) {
            p.event(ev);
          } else if (ev.type === "error") {
            this._stopListening(false);
            if (user.text === "…") {
              user.text = "(nicht verstanden)";
              this._fill(user);
            }
            if (!p.reply._row) p.show();
            p.event(ev);
          }
          if (ev.type === "run-end" || ev.type === "error") {
            p.finish();
            this._setBusy(false);
            this._save();
            unsub();
          }
        },
        this._runMsg({
          start_stage: "stt",
          end_stage: "tts",
          input: { sample_rate: ctx.sampleRate },
        })
      );
    } catch (err) {
      this._stopListening(false);
      this._add({ who: "hass", error: true, text: err.message || String(err) });
      this._setBusy(false);
    }
  }

  _sendAudio(pcm) {
    const socket = this._hass.connection.socket;
    if (this._sttHandler == null || !socket) return;
    socket.binaryType = "arraybuffer";
    const data = new Uint8Array(1 + pcm.length * 2);
    data[0] = this._sttHandler;
    data.set(new Uint8Array(pcm.buffer), 1);
    socket.send(data);
  }

  _stopListening(finishStream = true) {
    const r = this._rec;
    if (r) {
      r.proc.disconnect();
      r.source.disconnect();
      r.stream.getTracks().forEach((t) => t.stop());
      r.ctx.close().catch(() => {});
      this._rec = null;
    }
    if (finishStream && this._sttHandler != null) this._sendAudio(new Int16Array());
    this._sttHandler = null;
    this._renderBar();
  }

  disconnectedCallback() {
    if (this._rec) this._stopListening();
  }
}

if (!customElements.get("naddel-chat-card")) {
  customElements.define("naddel-chat-card", NaddelChatCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "naddel-chat-card",
    name: "Naddel Chat",
    description: "Chat mit einer Assist-Pipeline, Antworten werden gestreamt.",
  });
}
