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

// Fetch latest version info from R2
async function updateDownloadLinks() {
  try {
    const response = await fetch('https://download.m7s.live/rb/latest.json');
    const data = await response.json();
    const version = data.version;
    const versionTag = `v${version}`;
    
    // Update version display
    const versionEl = document.getElementById('current-version');
    if (versionEl) {
      versionEl.textContent = versionTag;
    }
    
    // Update macOS download link
    const macosLink = document.getElementById('download-macos');
    if (macosLink) {
      macosLink.href = `https://download.m7s.live/rb/${versionTag}/macos/Rebebuca.dmg`;
    }
    
    // Update Windows download link
    const windowsLink = document.getElementById('download-windows');
    if (windowsLink) {
      windowsLink.href = `https://download.m7s.live/rb/${versionTag}/nsis/Rebebuca_${version}_x64-setup.exe`;
    }
  } catch (error) {
    console.error('Failed to fetch latest version info:', error);
  }
}

// Fetch latest version on page load
updateDownloadLinks();
