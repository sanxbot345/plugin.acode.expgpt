class ExpSettings {
  constructor() {
    this.storageKey = 'expgpt_config_settings';
    this.defaults = {
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey: '',
      model: 'gemini-2.5-flash',
      temperature: 0.7,
      maxTokens: 2048,
      streaming: true
    };
    this.config = this.load();
  }

  load() {
    const saved = localStorage.getItem(this.storageKey);
    if (!saved) {
      return { ...this.defaults };
    }
    try {
      return { ...this.defaults, ...JSON.parse(saved) };
    } catch (e) {
      return { ...this.defaults };
    }
  }

  save(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(this.storageKey, JSON.stringify(this.config));
  }

  get(key) {
    return this.config[key];
  }

  getAll() {
    return this.config;
  }
}

export default new ExpSettings();
