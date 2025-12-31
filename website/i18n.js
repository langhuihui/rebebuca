// Internationalization (i18n) support
const translations = {
  en: {
    // Navigation
    'nav.features': 'Features',
    'nav.tech': 'Tech Stack',
    'nav.download': 'Download',
    
    // Hero
    'hero.title': 'Powerful Run Configuration Management Tool',
    'hero.subtitle': 'A modern desktop application that helps developers quickly manage and execute various commands and scripts. Start, stop, and monitor your processes with ease.',
    'hero.download': 'Download Now',
    'hero.viewGithub': 'View on GitHub',
    'hero.screenshotPlaceholder': 'Screenshot Placeholder',
    
    // Features
    'features.title': 'Features',
    'features.quickLaunch.title': 'Quick Launch',
    'features.quickLaunch.desc': 'Create and run configurations with one click, no need to memorize complex commands',
    'features.realtime.title': 'Real-time Output',
    'features.realtime.desc': 'View command execution results in real-time with multi-tab support',
    'features.config.title': 'Configuration Management',
    'features.config.desc': 'Support for advanced options like working directory and environment variables',
    'features.history.title': 'History Tracking',
    'features.history.desc': 'Automatically save run history for easy re-execution',
    'features.ui.title': 'Modern UI',
    'features.ui.desc': 'Beautiful interface built with Naive UI, supporting dark and light themes',
    'features.crossPlatform.title': 'Cross-platform',
    'features.crossPlatform.desc': 'Supports Windows, macOS, and Linux',
    
    // Screenshot
    'screenshot.title': 'Application Preview',
    'screenshot.placeholder': 'Application Screenshot Placeholder',
    
    // Tech Stack
    'tech.title': 'Tech Stack',
    'tech.frontend': 'Frontend',
    'tech.backend': 'Backend',
    'tech.vue': 'Progressive JavaScript framework',
    'tech.typescript': 'Type-safe JavaScript superset',
    'tech.naiveui': 'Modern Vue 3 component library',
    'tech.pinia': 'Lightweight state management',
    'tech.vite': 'Next generation build tool',
    'tech.tauri': 'Lightweight desktop app framework',
    'tech.rust': 'Systems programming language',
    
    // Download
    'download.title': 'Download',
    'download.desc': 'Choose the version for your operating system',
    'download.macos': '.dmg / .app',
    'download.windows': '.exe / .msi',
    'download.linux': '.AppImage / .deb',
    'download.note': 'All releases are available on GitHub Releases',
    
    // Footer
    'footer.issues': 'Issues',
    'footer.license': 'License',
    'footer.copyright': 'Released under GPL-3.0 License'
  },
  zh: {
    // Navigation
    'nav.features': '功能特点',
    'nav.tech': '技术栈',
    'nav.download': '下载',
    
    // Hero
    'hero.title': '强大的运行配置管理工具',
    'hero.subtitle': '一个现代化的桌面应用，帮助开发者快速管理和执行各种命令与脚本。轻松启动、停止和监控你的进程。',
    'hero.download': '立即下载',
    'hero.viewGithub': '查看 GitHub',
    'hero.screenshotPlaceholder': '截图占位符',
    
    // Features
    'features.title': '功能特点',
    'features.quickLaunch.title': '快速启动',
    'features.quickLaunch.desc': '一键创建和运行配置，无需记忆复杂命令',
    'features.realtime.title': '实时输出',
    'features.realtime.desc': '实时查看命令执行结果，支持多标签页同时运行',
    'features.config.title': '配置管理',
    'features.config.desc': '支持工作目录、环境变量等高级配置选项',
    'features.history.title': '历史记录',
    'features.history.desc': '自动保存运行历史，方便重复执行',
    'features.ui.title': '现代化 UI',
    'features.ui.desc': '基于 Naive UI 的精美界面，支持明暗主题',
    'features.crossPlatform.title': '跨平台',
    'features.crossPlatform.desc': '支持 Windows、macOS 和 Linux',
    
    // Screenshot
    'screenshot.title': '应用预览',
    'screenshot.placeholder': '应用截图占位符',
    
    // Tech Stack
    'tech.title': '技术栈',
    'tech.frontend': '前端',
    'tech.backend': '后端',
    'tech.vue': '渐进式 JavaScript 框架',
    'tech.typescript': '类型安全的 JavaScript 超集',
    'tech.naiveui': '现代化的 Vue 3 组件库',
    'tech.pinia': '轻量级状态管理',
    'tech.vite': '下一代前端构建工具',
    'tech.tauri': '轻量级桌面应用框架',
    'tech.rust': '系统级编程语言',
    
    // Download
    'download.title': '下载',
    'download.desc': '选择适合您操作系统的版本',
    'download.macos': '.dmg / .app',
    'download.windows': '.exe / .msi',
    'download.linux': '.AppImage / .deb',
    'download.note': '所有版本都可以在 GitHub Releases 页面下载',
    
    // Footer
    'footer.issues': '问题反馈',
    'footer.license': '许可证',
    'footer.copyright': '基于 GPL-3.0 许可证发布'
  }
};

// i18n class
class I18n {
  constructor() {
    this.currentLang = this.getStoredLang() || this.detectLang();
    this.init();
  }

  getStoredLang() {
    return localStorage.getItem('rebebuca-lang');
  }

  detectLang() {
    const browserLang = navigator.language || navigator.userLanguage;
    return browserLang.startsWith('zh') ? 'zh' : 'en';
  }

  init() {
    this.updatePageLang();
    this.updateLangButton();
  }

  setLang(lang) {
    this.currentLang = lang;
    localStorage.setItem('rebebuca-lang', lang);
    this.updatePageLang();
    this.updateLangButton();
  }

  toggleLang() {
    const newLang = this.currentLang === 'en' ? 'zh' : 'en';
    this.setLang(newLang);
  }

  updatePageLang() {
    document.documentElement.lang = this.currentLang;
    
    // Update all elements with data-i18n attribute
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.t(key);
      if (translation) {
        el.textContent = translation;
      }
    });

    // Update page title
    const titleKey = this.currentLang === 'zh' 
      ? 'Rebebuca - 运行配置管理工具' 
      : 'Rebebuca - Run Configuration Management Tool';
    document.title = titleKey;
  }

  updateLangButton() {
    const langBtn = document.querySelector('.lang-text');
    if (langBtn) {
      langBtn.textContent = this.currentLang === 'en' ? '中文' : 'English';
    }
  }

  t(key) {
    return translations[this.currentLang]?.[key] || translations['en']?.[key] || key;
  }
}

// Export for use in main.js
window.i18n = new I18n();
