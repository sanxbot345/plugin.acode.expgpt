import settings from './settings.js';
import fileSystem from './filesystem.js';

class ExpAI {
  constructor() {
    this.abortController = null;
  }

  buildSystemPrompt(projectStructure) {
    return `Anda adalah ExpGPT, AI Asisten Pembuat Workspace Kode Senior terintegrasi di Acode Editor.
Anda dibekali kemampuan mutlak untuk memodifikasi file-system workspace secara langsung lewat instruksi JSON khusus yang Anda sisipkan dalam balasan Anda.

KONDISI PROYEK AKTIF SAAT INI:
${projectStructure || "Kosong atau belum ada project dimuat."}

SISTEM INSTRUKSI OPERASI FILE SYSTEM:
Jika pengguna menyuruh membuat aplikasi, website toko, bot whatsapp, merestrukturisasi kode, mengedit, menghapus, atau mencari, Anda HARUS menuliskan teks markdown normal lalu menyisipkan satu blok JSON valid dalam penanda triple-backtick bertipe \`json-fs\`. Skrip internal kami akan memparsing blok tersebut dan mengeksekusinya secara berurutan secara otomatis. Jangan menyuruh pengguna mengetik manual atau menyalin kode secara eksternal jika operasi file system dapat menyelesaikannya.

Format penulisan blok perintah wajib:
\`\`\`json-fs
[
  {
    "action": "create_folder",
    "path": "src/components",
    "description": "Membuat folder komponen inti"
  },
  {
    "action": "create_file",
    "path": "src/components/Header.js",
    "content": "const Header = () => 'Hello World'; export default Header;",
    "description": "Membuat file Header inti"
  }
]
\`\`\`

Aksi aksi valid yang didukung sistem internal kami:
- "create_folder" (butuh "path")
- "create_file" (butuh "path", "content")
- "overwrite_file" (butuh "path", "content")
- "append_file" (butuh "path", "content")
- "delete_file" (butuh "path")
- "delete_folder" (butuh "path")
- "rename_file" (butuh "path", "newName")
- "rename_folder" (butuh "path", "newName")

Aturan Penting: Jangan gunakan placeholder di dalam properti "content". Tulis kode utuh terkompilasi dengan baik.`;
  }

  async sendMessage(userMessage, options = {}) {
    this.abortController = new AbortController();
    const { onChunk, onProgressUpdate, onDone, onError } = options;

    try {
      const apiKey = settings.get('apiKey');
      let endpoint = settings.get('endpoint').trim();
      const model = settings.get('model');
      const temperature = parseFloat(settings.get('temperature'));
      const maxTokens = parseInt(settings.get('maxTokens'));
      const streaming = settings.get('streaming');

      if (!apiKey) {
        throw new Error("API Key belum dikonfigurasi di pengaturan ExpGPT.");
      }

      if (!endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
      }

      const projectStr = await fileSystem.readProjectStructure();
      const systemPrompt = this.buildSystemPrompt(projectStr);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };

      const bodyData = {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: temperature,
        max_tokens: maxTokens,
        stream: streaming
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(bodyData),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      let fullResponseText = "";

      if (streaming) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let partialChunk = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          partialChunk += decoder.decode(value, { stream: true });
          const lines = partialChunk.split('\n');
          partialChunk = lines.pop();

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine === 'data: [DONE]') continue;
            if (cleanLine.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(cleanLine.slice(6));
                const content = parsed.choices[0]?.delta?.content || "";
                if (content) {
                  fullResponseText += content;
                  if (onChunk) onChunk(content);
                }
              } catch (e) {
                // Abaikan kesalahan parsial chunk stream JSON
              }
            }
          }
        }
      } else {
        const data = await response.json();
        fullResponseText = data.choices[0]?.message?.content || "";
        if (onChunk) onChunk(fullResponseText);
      }

      // Memeriksa dan memproses blok eksekusi FileSystem otomatis
      const jsonFsRegex = /```json-fs([\s\S]*?)```/g;
      const match = jsonFsRegex.exec(fullResponseText);
      
      if (match && match[1]) {
        try {
          if (onProgressUpdate) onProgressUpdate("Memparsing perintah sistem...");
          const operations = JSON.parse(match[1].trim());
          
          await fileSystem.executeOperations(operations, (progressMsg) => {
            if (onProgressUpdate) onProgressUpdate(progressMsg);
          });

          if (onProgressUpdate) onProgressUpdate("Selesai\n██████████ 100%");
        } catch (fsErr) {
          if (onProgressUpdate) onProgressUpdate(`[Error FS] ${fsErr.message}`);
        }
      }

      if (onDone) onDone(fullResponseText);

    } catch (err) {
      if (err.name === 'AbortError') {
        if (onProgressUpdate) onProgressUpdate("\n[Proses Dihentikan oleh Pengguna]");
      } else {
        if (onError) onError(err.message);
      }
    }
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}

export default new ExpAI();
