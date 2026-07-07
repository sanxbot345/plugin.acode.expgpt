class ExpFileSystem {
  constructor() {
    this.fsOperation = acode.require('fsOperation');
    this.editorManager = acode.require('editorManager');
    this.projectManager = acode.require('projectManager');
  }

  getActiveProjectUri() {
    const { activeProject } = this.projectManager;
    if (activeProject && activeProject.url) {
      return activeProject.url;
    }
    const activeFile = this.editorManager.activeFile;
    if (activeFile && activeFile.uri) {
      const parts = activeFile.uri.split('/');
      parts.pop();
      return parts.join('/');
    }
    return null;
  }

  generateProgressBar(current, total) {
    const percentage = Math.round((current / total) * 100);
    const progress = Math.round((percentage / 100) * 10);
    const filled = '█'.repeat(progress);
    const empty = '░'.repeat(10 - progress);
    return `${filled}${empty} ${percentage}%`;
  }

  async executeOperations(operations, onProgress) {
    const rootUri = this.getActiveProjectUri();
    if (!rootUri) {
      throw new Error("Tidak ada project aktif yang terbuka di workspace Acode.");
    }

    const total = operations.length;
    for (let i = 0; i < total; i++) {
      const op = operations[i];
      const targetUrl = `${rootUri}/${op.path}`.replace(/\/+/g, '/').replace('http:/', 'http://').replace('https:/', 'https://').replace('file:/', 'file:///');
      
      if (onProgress) {
        onProgress(`${op.description || 'Memproses...'}\n${this.generateProgressBar(i + 1, total)}`);
      }

      try {
        switch (op.action) {
          case 'create_folder':
            await this.createFolder(targetUrl);
            break;
          case 'create_file':
          case 'overwrite_file':
            await this.writeFile(targetUrl, op.content || '');
            break;
          case 'append_file':
            await this.appendToFile(targetUrl, op.content || '');
            break;
          case 'delete_file':
          case 'delete_folder':
            await this.deleteItem(targetUrl);
            break;
          case 'rename_file':
          case 'rename_folder':
            await this.renameItem(targetUrl, op.newName);
            break;
          default:
            throw new Error(`Aksi tidak dikenal: ${op.action}`);
        }
      } catch (err) {
        throw new Error(`Gagal mengeksekusi ${op.action} pada ${op.path}: ${err.message}`);
      }
    }
  }

  createFolder(url) {
    return new Promise((resolve, reject) => {
      const fs = this.fsOperation(url);
      fs.exists()
        .then(exists => {
          if (exists) return resolve();
          return this.fsOperation(this.getParentUrl(url)).createDirectory(this.getNameFromUrl(url));
        })
        .then(resolve)
        .catch(reject);
    });
  }

  writeFile(url, content) {
    return new Promise((resolve, reject) => {
      const parent = this.getParentUrl(url);
      const name = this.getNameFromUrl(url);
      this.createFolder(parent)
        .then(() => this.fsOperation(parent).createFile(name, content))
        .then(file => this.fsOperation(file).writeFile(content))
        .then(resolve)
        .catch(() => {
          this.fsOperation(url).writeFile(content).then(resolve).catch(reject);
        });
    });
  }

  async appendToFile(url, content) {
    const fs = this.fsOperation(url);
    let existingContent = "";
    if (await fs.exists()) {
      existingContent = await fs.readFile('utf-8');
    }
    return this.writeFile(url, existingContent + content);
  }

  deleteItem(url) {
    return this.fsOperation(url).delete();
  }

  renameItem(url, newName) {
    return this.fsOperation(url).rename(newName);
  }

  async readProjectStructure() {
    const rootUri = this.getActiveProjectUri();
    if (!rootUri) return "Tidak ada project aktif.";
    
    const structure = [];
    await this.scanDirectory(rootUri, "", structure);
    return structure.join('\n');
  }

  async scanDirectory(url, currentPath, structureList) {
    try {
      const contents = await this.fsOperation(url).lsDir();
      for (const item of contents) {
        const relativePath = currentPath ? `${currentPath}/${item.name}` : item.name;
        structureList.push(`${item.isDirectory ? '[DIR]' : '[FILE]'} ${relativePath}`);
        if (item.isDirectory) {
          await this.scanDirectory(item.url, relativePath, structureList);
        }
      }
    } catch (e) {
      // Mengabaikan error pembacaan subdirektori spesifik demi keberlanjutan scan
    }
  }

  async readFileContent(relativePath) {
    const rootUri = this.getActiveProjectUri();
    if (!rootUri) throw new Error("Tidak ada project aktif.");
    const targetUrl = `${rootUri}/${relativePath}`;
    return await this.fsOperation(targetUrl).readFile('utf-8');
  }

  getParentUrl(url) {
    const parts = url.split('/');
    parts.pop();
    return parts.join('/');
  }

  getNameFromUrl(url) {
    return url.split('/').pop();
  }
}

export default new ExpFileSystem();
