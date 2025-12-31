// Theme management
class ThemeManager {
  constructor() {
    this.theme = this.getStoredTheme() || this.detectTheme();
    this.init();
  }

  getStoredTheme() {
    return localStorage.getItem('rebebuca-theme');
  }

  detectTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  init() {
    this.applyTheme();
    this.bindEvents();
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
    // Update media visibility after theme change
    this.updateMediaVisibility();
  }

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('rebebuca-theme', theme);
    this.applyTheme();
  }

  toggleTheme() {
    const newTheme = this.theme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  updateMediaVisibility() {
    // Get current language
    const currentLang = document.documentElement.lang || 'en';
    const currentTheme = this.theme;

    // Update screenshots
    document.querySelectorAll('.screenshot-img').forEach(img => {
      const imgLang = img.dataset.lang;
      const imgTheme = img.dataset.theme;
      img.style.display = (imgLang === currentLang && imgTheme === currentTheme) ? 'block' : 'none';
    });

    // Update videos
    document.querySelectorAll('.demo-video').forEach(video => {
      const videoLang = video.dataset.lang;
      const shouldShow = videoLang === currentLang;
      video.style.display = shouldShow ? 'block' : 'none';
      // Pause hidden videos
      if (!shouldShow && !video.paused) {
        video.pause();
      }
    });
  }

  bindEvents() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!this.getStoredTheme()) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

// Initialize theme manager
const themeManager = new ThemeManager();

// Expose themeManager globally for i18n to use
window.themeManager = themeManager;

// Initialize media visibility after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  themeManager.updateMediaVisibility();
});

// Language toggle
const langToggle = document.getElementById('lang-toggle');
if (langToggle) {
  langToggle.addEventListener('click', () => {
    window.i18n.toggleLang();
  });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Navbar scroll effect
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// Intersection Observer for scroll animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.feature-card, .tech-category, .download-card').forEach((el, index) => {
  el.style.transitionDelay = `${index * 0.1}s`;
  observer.observe(el);
});

// Terminal typing animation
class TerminalTyping {
  constructor() {
    this.commands = [
      { prompt: '$', command: 'rebebuca list', delay: 1000 },
      { output: '  ● dev-server     [running]  PID: 12847', type: 'success', delay: 500 },
      { output: '  ● build-watch    [running]  PID: 12848', type: 'success', delay: 300 },
      { output: '  ○ test-runner    [stopped]', type: 'info', delay: 300 },
    ];
  }
}

// Process action buttons interaction
document.querySelectorAll('.process-action').forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    const item = this.closest('.process-item');
    const status = item.querySelector('.process-status');
    const isRunning = status.classList.contains('running');
    
    if (isRunning) {
      status.classList.remove('running');
      status.classList.add('stopped');
      this.classList.remove('stop');
      this.classList.add('start');
      this.textContent = 'Start';
      item.querySelector('.process-pid').textContent = 'PID: --';
    } else {
      status.classList.remove('stopped');
      status.classList.add('running');
      this.classList.remove('start');
      this.classList.add('stop');
      this.textContent = 'Stop';
      item.querySelector('.process-pid').textContent = 'PID: ' + Math.floor(Math.random() * 90000 + 10000);
    }
  });
});

// Floating nodes parallax effect
const nodes = document.querySelectorAll('.node');
let mouseX = 0, mouseY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX / window.innerWidth - 0.5;
  mouseY = e.clientY / window.innerHeight - 0.5;
});

function animateNodes() {
  nodes.forEach((node, index) => {
    const speed = (index + 1) * 0.5;
    const x = mouseX * speed * 30;
    const y = mouseY * speed * 30;
    node.style.transform = `translate(${x}px, ${y}px)`;
  });
  requestAnimationFrame(animateNodes);
}

animateNodes();

// Parallax effect for hero section
const heroLogo = document.querySelector('.hero-logo-img');
if (heroLogo) {
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    if (scrolled < window.innerHeight) {
      heroLogo.style.transform = `scale(${1 + scrolled * 0.0002})`;
    }
  });
}
