import ai from './ai.js';
import settings from './settings.js';

class ExpGPTPlugin {
  constructor() {
    this.chatHead = null;
    this.panel = null;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.headX = 20;
    this.headY = 150;
    this.lastUserMessage = "";
  }

  async init(baseUrl, $page, options) {
    this.baseUrl = baseUrl;
    await this.loadStyles();
    this.createFloatingButton();
    this.createPanelMarkup();
    this.initEventListeners();
    this.loadSettingsToUI();
  }

  loadStyles() {
    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = this.baseUrl + 'style.css';
      link.onload = resolve;
      document.head.appendChild(link);
    });
  }

  createFloatingButton() {
    this.chatHead = document.createElement('div');
    this.chatHead.id = 'expgpt-chathead';
    this.chatHead.style.left = this.headX + 'px';
    this.chatHead.style.top = this.headY + 'px';
    
    // Icon SVG Robot AI bawaan
    this.chatHead.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4M12,18C8.66,18 5.66,16.31 3.89,13.75C4.31,12.33 5.62,11.25 7.25,11.25C7.9,11.25 8.5,11.45 9,11.75C9.79,12.21 10.72,12.5 11.75,12.5C12.78,12.5 13.71,12.21 14.5,11.75C15,11.45 15.6,11.25 16.25,11.25C17.88,11.25 19.19,12.33 19.61,13.75C17.84,16.31 14.84,18 12,18Z"/>
      </svg>
    `;
    document.body.appendChild(this.chatHead);
  }

  createPanelMarkup() {
    const container = document.createElement('div');
    container.innerHTML = `
      <div id="expgpt-panel" class="expgpt-panel hidden">
        <div class="expgpt-header">
          <div class="expgpt-brand">
            <h3>ExpGPT Workspace AI</h3>
          </div>
          <div class="expgpt-nav">
            <button id="expgpt-tab-chat-btn" class="active">Chat</button>
            <button id="expgpt-tab-settings-btn">Set</button>
            <button id="expgpt-close-btn">&times;</button>
          </div>
        </div>
        <div class="expgpt-body">
          <div id="expgpt-tab-chat" class="expgpt-tab-content">
            <div id="expgpt-chat-container" class="expgpt-chat-container">
              <div class="expgpt-message system">
                <div class="bubble">Halo! Saya ExpGPT. Berikan perintah otomatisasi project seperti "Buat website toko" atau "Buat bot whatsapp".</div>
              </div>
            </div>
            <div id="expgpt-progress-box" class="expgpt-progress-box hidden">
              <div class="progress-title">Workspace Progress</div>
              <pre id="expgpt-progress-text">Menunggu instruksi...</pre>
            </div>
            <div class="expgpt-input-area">
              <textarea id="expgpt-chat-input" placeholder="Ketik pesan atau instruksi..."></textarea>
              <div class="expgpt-action-row">
                <button id="expgpt-stop-btn" class="secondary hidden">Stop</button>
                <button id="expgpt-clear-btn" class="secondary">Clear</button>
                <button id="expgpt-send-btn" class="primary">Kirim</button>
              </div>
            </div>
          </div>
          <div id="expgpt-tab-settings" class="expgpt-tab-content hidden">
            <div class="expgpt-settings-form">
              <div class="form-group">
                <label>Endpoint URL</label>
                <input type="text" id="expgpt-set-endpoint" />
              </div>
              <div class="form-group">
                <label>API Key</label>
                <input type="password" id="expgpt-set-apikey" />
              </div>
              <div class="form-group">
                <label>Model Name</label>
                <input type="text" id="expgpt-set-model" />
              </div>
              <div class="form-row">
                <div class="form-group half">
                  <label>Temp</label>
                  <input type="number" id="expgpt-set-temp" min="0" max="2" step="0.1" />
                </div>
                <div class="form-group half">
                  <label>Max Token</label>
                  <input type="number" id="expgpt-set-tokens" />
                </div>
              </div>
              <div class="form-group row-align">
                <label>Streaming</label>
                <input type="checkbox" id="expgpt-set-stream" />
              </div>
              <button id="expgpt-save-settings-btn" class="primary btn-block">Simpan</button>
            </div>
          </div>
        </div>
      </div>
    `;
    this.panel = container.firstElementChild;
    document.body.appendChild(this.panel);
  }

  initEventListeners() {
    // Event Handler Geser/Drag ChatHead untuk Layar Sentuh Mobile & Desktop
    const onDragStart = (e) => {
      this.isDragging = false;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      this.dragStartX = clientX - this.headX;
      this.dragStartY = clientY - this.headY;
      
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('touchmove', onDragMove, { passive: false });
      document.addEventListener('mouseup', onDragEnd);
      document.addEventListener('touchend', onDragEnd);
    };

    const onDragMove = (e) => {
      this.isDragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      this.headX = clientX - this.dragStartX;
      this.headY = clientY - this.dragStartY;

      // Batasi agar tidak keluar viewport layar Android
      this.headX = Math.max(0, Math.min(window.innerWidth - 60, this.headX));
      this.headY = Math.max(0, Math.min(window.innerHeight - 60, this.headY));

      this.chatHead.style.left = this.headX + 'px';
      this.chatHead.style.top = this.headY + 'px';
      e.preventDefault();
    };

    const onDragEnd = () => {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('touchend', onDragEnd);
    };

    this.chatHead.addEventListener('mousedown', onDragStart);
    this.chatHead.addEventListener('touchstart', onDragStart, { passive: true });

    this.chatHead.addEventListener('click', () => {
      if (!this.isDragging) {
        this.togglePanel();
      }
    });

    // Kontrol Navigasi Tab UI
    const chatTabBtn = this.panel.querySelector('#expgpt-tab-chat-btn');
    const setTabBtn = this.panel.querySelector('#expgpt-tab-settings-btn');
    const chatContent = this.panel.querySelector('#expgpt-tab-chat');
    const setContent = this.panel.querySelector('#expgpt-tab-settings');

    chatTabBtn.addEventListener('click', () => {
      chatTabBtn.classList.add('active');
      setTabBtn.classList.remove('active');
      chatContent.classList.remove('hidden');
      setContent.classList.add('hidden');
    });

    setTabBtn.addEventListener('click', () => {
      setTabBtn.classList.add('active');
      chatTabBtn.classList.remove('active');
      setContent.classList.remove('hidden');
      chatContent.classList.add('hidden');
    });

    this.panel.querySelector('#expgpt-close-btn').addEventListener('click', () => this.togglePanel());

    // Fungsionalitas Utama Pengiriman Pesan Ke AI
    const sendBtn = this.panel.querySelector('#expgpt-send-btn');
    const stopBtn = this.panel.querySelector('#expgpt-stop-btn');
    const clearBtn = this.panel.querySelector('#expgpt-clear-btn');
    const inputArea = this.panel.querySelector('#expgpt-chat-input');

    sendBtn.addEventListener('click', () => this.handleUserSend(inputArea, stopBtn, sendBtn));
    stopBtn.addEventListener('click', () => {
      ai.stop();
      stopBtn.classList.add('hidden');
      sendBtn.classList.remove('hidden');
    });

    clearBtn.addEventListener('click', () => {
      const container = this.panel.querySelector('#expgpt-chat-container');
      container.innerHTML = `
        <div class="expgpt-message system">
          <div class="bubble">Riwayat obrolan dibersihkan. Ruang kerja siap menerima instruksi baru.</div>
        </div>
      `;
      this.panel.querySelector('#expgpt-progress-box').classList.add('hidden');
    });

    // Tombol Form Penyimpanan Konfigurasi Pengaturan
    this.panel.querySelector('#expgpt-save-settings-btn').addEventListener('click', () => {
      settings.save({
        endpoint: this.panel.querySelector('#expgpt-set-endpoint').value,
        apiKey: this.panel.querySelector('#expgpt-set-apikey').value,
        model: this.panel.querySelector('#expgpt-set-model').value,
        temperature: this.panel.querySelector('#expgpt-set-temp').value,
        maxTokens: this.panel.querySelector('#expgpt-set-tokens').value,
        streaming: this.panel.querySelector('#expgpt-set-stream').checked
      });
      window.plugins.toast.showShort('Pengaturan ExpGPT Berhasil Disimpan!');
      chatTabBtn.click();
    });
  }

  togglePanel() {
    this.panel.classList.toggle('hidden');
  }

  loadSettingsToUI() {
    this.panel.querySelector('#expgpt-set-endpoint').value = settings.get('endpoint');
    this.panel.querySelector('#expgpt-set-apikey').value = settings.get('apiKey');
    this.panel.querySelector('#expgpt-set-model').value = settings.get('model');
    this.panel.querySelector('#expgpt-set-temp').value = settings.get('temperature');
    this.panel.querySelector('#expgpt-set-tokens').value = settings.get('maxTokens');
    this.panel.querySelector('#expgpt-set-stream').checked = settings.get('streaming');
  }

  appendMessage(role, text) {
    const container = this.panel.querySelector('#expgpt-chat-container');
    const msgDiv = document.createElement('div');
    msgDiv.className = `expgpt-message ${role}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerText = text;
    msgDiv.appendChild(bubble);

    if (role === 'assistant') {
      const actions = document.createElement('div');
      actions.className = 'msg-actions';
      
      const copyBtn = document.createElement('span');
      copyBtn.innerText = 'Copy';
      copyBtn.addEventListener('click', () => {
        cordova.plugins.clipboard.copy(text);
        window.plugins.toast.showShort('Teks berhasil disalin!');
      });

      const regenBtn = document.createElement('span');
      regenBtn.innerText = 'Regenerate';
      regenBtn.addEventListener('click', () => {
        if (this.lastUserMessage) {
          const input = this.panel.querySelector('#expgpt-chat-input');
          input.value = this.lastUserMessage;
          this.handleUserSend(input, this.panel.querySelector('#expgpt-stop-btn'), this.panel.querySelector('#expgpt-send-btn'));
        }
      });

      actions.appendChild(copyBtn);
      actions.appendChild(regenBtn);
      msgDiv.appendChild(actions);
    }

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
    return bubble;
  }

  handleUserSend(inputArea, stopBtn, sendBtn) {
    const text = inputArea.value.trim();
    if (!text) return;

    this.lastUserMessage = text;
    inputArea.value = "";
    this.appendMessage('user', text);

    stopBtn.classList.remove('hidden');
    sendBtn.classList.add('hidden');

    // Tampilkan animasi sedang berpikir (Thinking Animation)
    const container = this.panel.querySelector('#expgpt-chat-container');
    const thinkDiv = document.createElement('div');
    thinkDiv.className = 'expgpt-message assistant';
    thinkDiv.innerHTML = `<div class="bubble thinking-bubble"><span></span><span></span><span></span></div>`;
    container.appendChild(thinkDiv);
    container.scrollTop = container.scrollHeight;

    let aiBubble = null;
    const progressBox = this.panel.querySelector('#expgpt-progress-box');
    const progressText = this.panel.querySelector('#expgpt-progress-text');

    ai.sendMessage(text, {
      onChunk: (chunk) => {
        if (thinkDiv.parentNode) {
          thinkDiv.remove();
        }
        if (!aiBubble) {
          aiBubble = this.appendMessage('assistant', "");
        }
        aiBubble.innerText += chunk;
        container.scrollTop = container.scrollHeight;
      },
      onProgressUpdate: (progressMessage) => {
        progressBox.classList.remove('hidden');
        progressText.innerText = progressMessage;
      },
      onDone: () => {
        if (thinkDiv.parentNode) thinkDiv.remove();
        stopBtn.classList.add('hidden');
        sendBtn.classList.remove('hidden');
      },
      onError: (errMsg) => {
        if (thinkDiv.parentNode) thinkDiv.remove();
        stopBtn.classList.add('hidden');
        sendBtn.classList.remove('hidden');
        this.appendMessage('system', `Error: ${errMsg}`);
      }
    });
  }

  async destroy() {
    if (this.chatHead && this.chatHead.parentNode) {
      this.chatHead.parentNode.removeChild(this.chatHead);
    }
    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
    ai.stop();
  }
}

const expGptPlugin = new ExpGPTPlugin();

if (window.acode) {
  acode.setPluginInit('acode.plugin.expgpt', (baseUrl, $page, options) => {
    expGptPlugin.init(baseUrl, $page, options);
  });
  acode.setPluginUnmount('acode.plugin.expgpt', () => {
    expGptPlugin.destroy();
  });
}
