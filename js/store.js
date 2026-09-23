/**
 * Cat Game Store - Material Design 3 Dynamic Theme Engine & Store Controller
 */

// Accent Color Presets from official screenshots
const PRESET_COLORS = [
  '#2563eb', // Deep Blue
  '#3b82f6', // Vibrant Blue
  '#7c3aed', // Purple
  '#1e293b', // Midnight Navy
  '#0d9488', // Teal
  '#6ba4e8', // Soft Sky Blue (Default)
  '#f97316', // Sunset Coral
  '#18181b'  // Obsidian
];

function hexToRgb(hex) {
  const cleanHex = hex.replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function setAccentColor(hexColor) {
  if (!hexColor || !/^#[0-9A-Fa-f]{6}$/.test(hexColor)) return;

  const root = document.documentElement;
  const rgb = hexToRgb(hexColor);

  root.style.setProperty('--md-primary', hexColor);
  root.style.setProperty('--md-primary-hover', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.88)`);
  root.style.setProperty('--md-primary-container', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`);
  root.style.setProperty('--md-on-primary-container', hexColor);

  // Update active swatch indicator
  document.querySelectorAll('.swatch-btn').forEach(btn => {
    if (btn.dataset.color && btn.dataset.color.toLowerCase() === hexColor.toLowerCase()) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update color input value
  const colorInput = document.getElementById('customColorPicker');
  if (colorInput) {
    colorInput.value = hexColor;
  }

  localStorage.setItem('catgame_accent_color', hexColor);
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Accent Color
  const savedColor = localStorage.getItem('catgame_accent_color') || '#6ba4e8';
  setAccentColor(savedColor);

  // Swatch click handlers
  document.querySelectorAll('.swatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.color) {
        setAccentColor(btn.dataset.color);
      }
    });
  });

  // Custom Color Input
  const colorInput = document.getElementById('customColorPicker');
  if (colorInput) {
    colorInput.addEventListener('input', (e) => {
      setAccentColor(e.target.value);
    });
  }

  // 2. Theme Drawer Toggle
  const themeDrawer = document.getElementById('themeDrawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const openDrawerBtn = document.getElementById('openDrawerBtn');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');

  function openDrawer() {
    if (themeDrawer && drawerBackdrop) {
      themeDrawer.classList.add('active');
      drawerBackdrop.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeDrawer() {
    if (themeDrawer && drawerBackdrop) {
      themeDrawer.classList.remove('active');
      drawerBackdrop.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  if (openDrawerBtn) openDrawerBtn.addEventListener('click', openDrawer);
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

  // 3. Mobile Navigation Toggle
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const mobileNav = document.getElementById('mobileNav');

  if (mobileMenuToggle && mobileNav) {
    mobileMenuToggle.addEventListener('click', () => {
      mobileNav.classList.toggle('active');
    });

    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('active');
      });
    });
  }

  // 4. FAQ Accordion
  document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
      const faqItem = button.parentElement;
      const answer = faqItem.querySelector('.faq-answer');
      const isActive = faqItem.classList.contains('active');

      // Close other FAQs
      document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
        item.querySelector('.faq-answer').style.maxHeight = null;
      });

      if (!isActive) {
        faqItem.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // 5. Copy Command Helper
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.copy;
      navigator.clipboard.writeText(code).then(() => {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
        btn.style.backgroundColor = 'rgba(16, 185, 129, 0.4)';
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.style.backgroundColor = '';
        }, 2000);
      });
    });
  });
});
