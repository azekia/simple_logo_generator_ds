'use strict';

/* ============================================================
   Simple Logo Generator · DS
   Genera logos tipográficos (SVG y PNG) en el navegador.
   - El texto se recorta al área de tinta real de los glifos.
   - Los SVG incluyen la fuente embebida (woff2 en base64)
     para que se vean igual en cualquier equipo.
   ============================================================ */

/* ------------------------------------------------------------
   Referencias del DOM
   ------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

const els = {
  form: $('logo-form'),
  text: $('logo-text'),
  font: $('font-name'),
  fontList: $('google-fonts'),
  letterPicker: $('letter-color'),
  letterText: $('letter-color-text'),
  letterRgb: $('letter-color-rgb'),
  bgPicker: $('bg-color'),
  bgText: $('bg-color-text'),
  bgRgb: $('bg-color-rgb'),
  kerning: $('kerning'),
  kerningValue: $('kerning-value'),
  padding: $('padding'),
  paddingValue: $('padding-value'),
  weight: $('font-weight'),
  generate: $('generate'),
  clear: $('clear'),
  status: $('status'),
  notice: $('notice'),
  content: $('results-content'),
  count: $('results-count'),
  meta: $('results-meta'),
};

/* ------------------------------------------------------------
   Datos estáticos
   ------------------------------------------------------------ */

const FONT_SUGGESTIONS = [
  'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Inter', 'Raleway',
  'Oswald', 'Nunito', 'Work Sans', 'DM Sans', 'Space Grotesk', 'Sora', 'Outfit',
  'Manrope', 'Rubik', 'Barlow', 'Barlow Condensed', 'Archivo', 'Archivo Black',
  'Anton', 'Bebas Neue', 'Righteous', 'Lobster', 'Pacifico', 'Playfair Display',
  'Merriweather', 'Libre Baskerville', 'Josefin Sans', 'Quicksand', 'Comfortaa',
  'Fredoka', 'Caveat', 'Dancing Script', 'Great Vibes', 'Abril Fatface',
  'Alfa Slab One', 'Bungee', 'Titan One', 'Chivo', 'Epilogue', 'Figtree',
  'Fira Sans', 'IBM Plex Sans', 'Karla', 'League Spartan', 'Lexend', 'Mulish',
  'Plus Jakarta Sans', 'Public Sans', 'Red Hat Display', 'Roboto Slab',
  'Roboto Mono', 'Signika', 'Syne', 'Teko', 'Ubuntu', 'Unbounded', 'Urbanist',
  'Zilla Slab',
];

/* Peso tipográfico -> nombre legible */
const WEIGHT_NAMES = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

const WEIGHT_VALUES = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/* Sufijos de peso admitidos en el nombre de la fuente */
const WEIGHT_SUFFIXES = [
  ['extra bold', 800],
  ['extrabold', 800],
  ['ultra bold', 800],
  ['ultrabold', 800],
  ['semi bold', 600],
  ['semibold', 600],
  ['demi bold', 600],
  ['demibold', 600],
  ['extra light', 200],
  ['extralight', 200],
  ['ultra light', 200],
  ['ultralight', 200],
  ['hairline', 100],
  ['thin', 100],
  ['light', 300],
  ['book', 400],
  ['regular', 400],
  ['normal', 400],
  ['medium', 500],
  ['bold', 700],
  ['black', 900],
  ['heavy', 900],
];

/* Variantes que se generan para cada versión (texto completo / inicial) */
const VARIANTS = [
  { id: 'svg-color', format: 'svg', tone: 'color' },
  { id: 'png-80-color-transparent', format: 'png', height: 80, tone: 'color' },
  { id: 'png-80-color-background', format: 'png', height: 80, tone: 'color', background: true },
  { id: 'png-400-color-transparent', format: 'png', height: 400, tone: 'color' },
  { id: 'png-400-color-background', format: 'png', height: 400, tone: 'color', background: true },
  { id: 'svg-black', format: 'svg', tone: 'black' },
  { id: 'png-80-black-transparent', format: 'png', height: 80, tone: 'black' },
  { id: 'png-400-black-transparent', format: 'png', height: 400, tone: 'black' },
  { id: 'svg-white', format: 'svg', tone: 'white' },
  { id: 'png-80-white-transparent', format: 'png', height: 80, tone: 'white' },
  { id: 'png-400-white-transparent', format: 'png', height: 400, tone: 'white' },
];

const TONE_LABELS = { color: 'Color', black: 'Negro', white: 'Blanco' };

const EMPTY_MESSAGE = 'Aún no hay logos. Configura las opciones y pulsa «Generar Logos».';

const BASE_FONT_SIZE = 240;
const MAX_SQUARE_SIDE = 12000;

/* ------------------------------------------------------------
   Estado
   ------------------------------------------------------------ */

const state = {
  urls: [],
  busy: false,
  fontCache: new Map(),
  googleCache: new Map(),
  stylesheets: new Map(),
  googleNetwork: 'unknown', // 'unknown' | 'ok' | 'down'
  networkProbe: null,
  embedding: 'unknown', // 'unknown' | 'ok' | 'off' (lectura del CSS bloqueada)
};

/* ------------------------------------------------------------
   Utilidades generales
   ------------------------------------------------------------ */

/**
 * Cede el hilo para que el navegador pinte el estado antes de generar.
 * Incluye un temporizador de respaldo: requestAnimationFrame se pausa en
 * pestañas ocultas y no queremos bloquear la generación por eso.
 */
const nextFrame = () =>
  new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    requestAnimationFrame(finish);
    window.setTimeout(finish, 60);
  });

function setStatus(message, kind = '') {
  els.status.textContent = message || '';
  if (kind) els.status.dataset.kind = kind;
  else delete els.status.dataset.kind;
}

function setNotice(message) {
  if (!message) {
    els.notice.hidden = true;
    els.notice.textContent = '';
    return;
  }
  els.notice.hidden = false;
  els.notice.textContent = message;
}

function setBusy(busy) {
  state.busy = busy;
  els.generate.disabled = busy;
  els.clear.disabled = busy;
  els.form.toggleAttribute('aria-busy', busy);
}

function slugify(value) {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'logo'
  );
}

function firstGrapheme(value) {
  const text = value.trim();
  if (!text) return '·';
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' });
    for (const part of segmenter.segment(text)) return part.segment;
  }
  return Array.from(text)[0];
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]);
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value, signed = false) {
  const rounded = Math.round(Number(value) || 0);
  if (signed && rounded > 0) return `+${rounded} %`;
  return `${rounded} %`;
}

/* ------------------------------------------------------------
   Colores
   ------------------------------------------------------------ */

function normalizeHex(value) {
  let hex = String(value).trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    hex = hex.split('').map((character) => character + character).join('');
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toUpperCase()}`;
  return null;
}

function hexToRgb(hex) {
  const numeric = Number.parseInt(hex.slice(1), 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

function rgbLabel(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

function bindColor(picker, textInput, rgbElement) {
  const paint = (hex) => {
    rgbElement.textContent = rgbLabel(hex);
  };

  paint(picker.value);

  picker.addEventListener('input', () => {
    const hex = normalizeHex(picker.value) || '#000000';
    textInput.value = hex;
    textInput.classList.remove('is-invalid');
    paint(hex);
  });

  textInput.addEventListener('input', () => {
    const hex = normalizeHex(textInput.value);
    if (!hex) {
      textInput.classList.add('is-invalid');
      return;
    }
    textInput.classList.remove('is-invalid');
    picker.value = hex.toLowerCase();
    paint(hex);
  });

  textInput.addEventListener('blur', () => {
    const hex = normalizeHex(textInput.value) || normalizeHex(picker.value) || '#000000';
    textInput.value = hex;
    textInput.classList.remove('is-invalid');
    picker.value = hex.toLowerCase();
    paint(hex);
  });
}

function readColor(textInput, picker) {
  return normalizeHex(textInput.value) || normalizeHex(picker.value) || '#000000';
}

function bindRange(input, output, signed = false) {
  const paint = () => {
    const label = formatPercent(input.value, signed);
    output.textContent = label;
    input.setAttribute('aria-valuetext', label);
  };
  paint();
  input.addEventListener('input', paint);
}

/* ------------------------------------------------------------
   Tipografías
   ------------------------------------------------------------ */

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');

function quoteFamily(name) {
  return `"${String(name).replace(/["\\]/g, '')}"`;
}

function parseFontName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  const lower = name.toLowerCase();

  for (const [suffix, weight] of WEIGHT_SUFFIXES) {
    if (lower.endsWith(` ${suffix}`)) {
      const family = name.slice(0, name.length - suffix.length - 1).trim();
      if (family) return { family, weight, weightExplicit: true };
    }
  }

  const numeric = lower.match(/^(.*\S)\s+([1-9]00)$/);
  if (numeric) {
    return { family: numeric[1].trim(), weight: Number(numeric[2]), weightExplicit: true };
  }

  return { family: name, weight: 400, weightExplicit: false };
}

function isFontAvailable(family, weight) {
  const probe = 'BESbswy0123456789ÁÉÍÓÚñÑ@#&';
  const bases = ['monospace', 'serif', 'sans-serif'];
  measureCtx.letterSpacing = '0px';

  return bases.some((base) => {
    measureCtx.font = `${weight} 72px ${quoteFamily(family)}, ${base}`;
    const withFamily = measureCtx.measureText(probe).width;
    measureCtx.font = `${weight} 72px ${base}`;
    const withoutFamily = measureCtx.measureText(probe).width;
    return Math.abs(withFamily - withoutFamily) > 0.5;
  });
}

/** ¿La familia ya está registrada como webfont (cargada desde Google) en esta página? */
function hasWebFontFace(family) {
  const key = String(family).toLowerCase().replace(/["']/g, '');
  for (const face of document.fonts) {
    if (face.family.toLowerCase().replace(/["']/g, '') === key) return true;
  }
  return false;
}

async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { signal: controller.signal, mode: 'cors', credentials: 'omit' });
  } finally {
    window.clearTimeout(timer);
  }
}

function toBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/** Detecta el formato real de la fuente a partir de la URL de Google Fonts. */
function fontFormatInfo(url) {
  const clean = String(url).split(/[?#]/)[0].toLowerCase();
  if (clean.endsWith('.woff')) return { mime: 'font/woff', format: 'woff' };
  if (clean.endsWith('.otf')) return { mime: 'font/otf', format: 'opentype' };
  if (clean.endsWith('.ttf')) return { mime: 'font/ttf', format: 'truetype' };
  return { mime: 'font/woff2', format: 'woff2' };
}

/** Extrae las caras @font-face (con su subset) del CSS de Google Fonts. */
function extractFaces(css) {
  const faces = [];
  const subsetRe = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/gi;
  let match;

  while ((match = subsetRe.exec(css))) {
    const body = match[2];
    const urlMatch = body.match(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/i);
    const weightMatch = body.match(/font-weight\s*:\s*([^;]+);/i);
    if (urlMatch) {
      faces.push({
        subset: match[1].toLowerCase(),
        url: urlMatch[1],
        weight: weightMatch ? weightMatch[1].trim() : '',
      });
    }
  }

  if (!faces.length) {
    const faceRe = /@font-face\s*\{([^}]*)\}/gi;
    while ((match = faceRe.exec(css))) {
      const body = match[1];
      const urlMatch = body.match(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/i);
      const weightMatch = body.match(/font-weight\s*:\s*([^;]+);/i);
      if (urlMatch) {
        faces.push({
          subset: 'all',
          url: urlMatch[1],
          weight: weightMatch ? weightMatch[1].trim() : '',
        });
      }
    }
  }

  return faces;
}

/**
 * Carga una hoja de estilos de Google Fonts mediante <link>.
 * Las hojas de estilo externas no están sujetas a CORS, así que este es el
 * método fiable para validar y cargar la familia. Devuelve true si cargó.
 */
async function addFontStylesheet(href, timeout = 6000) {
  if (state.stylesheets.has(href)) return state.stylesheets.get(href);

  const promise = new Promise((resolve) => {
    let timer = null;
    let settled = false;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      if (timer) window.clearTimeout(timer);
      resolve(ok);
    };

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.logoFont = '1';
    link.addEventListener('load', () => finish(true), { once: true });
    link.addEventListener('error', () => finish(false), { once: true });
    document.head.append(link);
    timer = window.setTimeout(() => finish(false), timeout);
  });

  state.stylesheets.set(href, promise);
  return promise;
}

/**
 * Comprueba si Google Fonts es accesible usando una familia válida.
 * Así distinguimos "esa familia no existe" (400) de "no hay conexión".
 */
async function probeGoogleNetwork() {
  if (state.googleNetwork === 'ok') return true;
  if (state.googleNetwork === 'down') return false;

  if (!state.networkProbe) {
    state.networkProbe = (async () => {
      try {
        const response = await fetchWithTimeout(
          'https://fonts.googleapis.com/css2?family=Roboto&display=swap',
          4000
        );
        return response.ok;
      } catch {
        return false;
      }
    })();
  }

  const reachable = await state.networkProbe;
  state.googleNetwork = reachable ? 'ok' : 'down';
  return reachable;
}

/**
 * Carga una familia desde Google Fonts.
 * 1. Registra la hoja con <link> (sin CORS) para validar familia y peso.
 * 2. Comprueba que la fuente se aplica realmente midiendo texto.
 * 3. Si es posible, descarga el woff2 para embeberlo en los SVG.
 * Devuelve { dataUri, weight, format } o null.
 */
async function loadGoogleFont(family, weight) {
  const cacheKey = `${family.toLowerCase()}|${weight || 'any'}`;
  if (state.googleCache.has(cacheKey)) return state.googleCache.get(cacheKey);
  if (state.googleNetwork === 'down') return null;

  const familyParam = encodeURIComponent(family).replace(/%20/g, '+');
  const axis = weight ? `:wght@${weight}` : '';
  const cssUrl = `https://fonts.googleapis.com/css2?family=${familyParam}${axis}&display=swap`;

  const linked = await addFontStylesheet(cssUrl);
  if (!linked) {
    await probeGoogleNetwork();
    state.googleCache.set(cacheKey, null);
    return null;
  }

  state.googleNetwork = 'ok';
  const usedWeight = weight || 400;

  try {
    await Promise.race([
      document.fonts.load(`${usedWeight} 80px ${quoteFamily(family)}`, 'zenon BESbswy'),
      new Promise((resolve) => window.setTimeout(resolve, 6000)),
    ]);
  } catch {
    /* La comprobación por medición decide si sirve. */
  }

  if (!isFontAvailable(family, usedWeight)) {
    state.googleCache.set(cacheKey, null);
    return null;
  }

  // Embeber la fuente en los SVG es opcional: si el CSS no se puede leer
  // (CORS), los SVG referencian la familia por nombre y todo sigue funcionando.
  let embed = null;
  if (state.embedding !== 'off') {
    try {
      const cssResponse = await fetchWithTimeout(cssUrl, 4000);
      if (!cssResponse.ok) throw new Error('No se pudo leer el CSS de la fuente');
      const css = await cssResponse.text();
      const faces = extractFaces(css);
      if (!faces.length) throw new Error('CSS sin caras @font-face');

      const latinFaces = faces.filter((face) => face.subset === 'latin');
      const pool = latinFaces.length ? latinFaces : faces;
      const wanted = weight ? pool.find((face) => Number.parseFloat(face.weight) === weight) : null;
      const face = wanted || pool[pool.length - 1];

      let faceWeight = Number.parseFloat(face.weight);
      if (!Number.isFinite(faceWeight)) faceWeight = usedWeight;
      // Rango variable ("100 900"): nos quedamos con el peso solicitado.
      if (/\d+\s+\d+/.test(face.weight)) faceWeight = usedWeight;

      const format = fontFormatInfo(face.url);
      const response = await fetchWithTimeout(face.url, 8000);
      if (!response.ok) throw new Error('No se pudo descargar la fuente');

      embed = {
        dataUri: `data:${format.mime};base64,${toBase64(new Uint8Array(await response.arrayBuffer()))}`,
        weight: faceWeight,
        format: format.format,
      };
      state.embedding = 'ok';
    } catch {
      embed = null;
      state.embedding = 'off';
    }
  }

  const result = {
    dataUri: embed ? embed.dataUri : null,
    weight: embed ? embed.weight : usedWeight,
    format: embed ? embed.format : 'woff2',
  };

  state.googleCache.set(cacheKey, result);
  return result;
}

/**
 * Resuelve la tipografía solicitada:
 *  1. Copia instalada en el equipo (instantánea, sin red ni errores).
 *  2. Google Fonts: familia + peso y, si falla, familia sin peso.
 *  3. Montserrat ExtraBold como respaldo.
 *  4. Tipografía del sistema.
 */
async function resolveFont(raw, forcedWeight = null) {
  const requested = String(raw || '').trim().replace(/\s+/g, ' ') || 'Gilroy Extrabold';
  const parsed = parseFontName(requested);
  const weight = forcedWeight ?? parsed.weight;
  const cacheKey = `${requested.toLowerCase()}|${forcedWeight ?? 'auto'}`;
  if (state.fontCache.has(cacheKey)) return state.fontCache.get(cacheKey);

  const notes = [];
  let font = null;

  // 1) Fuente instalada en el equipo (y que no sea una webfont ya cargada).
  const localCandidates = [...new Set([parsed.family, requested])].filter(Boolean);
  const installed = localCandidates.find(
    (name) => isFontAvailable(name, weight) && !hasWebFontFace(name)
  );
  if (installed) {
    font = {
      family: installed,
      usedWeight: weight,
      cssStack: `${localCandidates.map(quoteFamily).join(', ')}, "Segoe UI", Arial, sans-serif`,
      embed: null,
      source: 'local',
    };
    notes.push(`Se usa la copia instalada en el equipo de «${requested}».`);
  }

  // 2) Google Fonts.
  if (!font) {
    const attempts = [];
    if (forcedWeight) {
      attempts.push([parsed.family, forcedWeight]);
      attempts.push([parsed.family, null]);
    } else if (parsed.weightExplicit) {
      attempts.push([parsed.family, parsed.weight]);
      attempts.push([parsed.family, null]);
    } else {
      attempts.push([parsed.family, null]);
    }

    for (const [family, attemptWeight] of attempts) {
      const loaded = await loadGoogleFont(family, attemptWeight);
      if (loaded) {
        font = {
          family,
          usedWeight: loaded.weight || attemptWeight || 400,
          cssStack: `${quoteFamily(family)}, sans-serif`,
          embed: loaded.dataUri,
          fontFormat: loaded.format || 'woff2',
          source: 'google',
        };
        if (forcedWeight && loaded.weight && loaded.weight !== forcedWeight) {
          const available = WEIGHT_NAMES[loaded.weight] || loaded.weight;
          notes.push(
            `«${family}» no tiene el peso ${forcedWeight} en Google Fonts; se ha usado ${available}.`
          );
        }
        break;
      }
      if (state.googleNetwork === 'down') break;
    }
  }

  // 3) Respaldo visual: Montserrat ExtraBold.
  if (!font && state.googleNetwork !== 'down') {
    const backup = await loadGoogleFont('Montserrat', 800);
    if (backup) {
      font = {
        family: 'Montserrat',
        usedWeight: 800,
        cssStack: `${quoteFamily('Montserrat')}, "Segoe UI", Arial, sans-serif`,
        embed: backup.dataUri,
        fontFormat: backup.format || 'woff2',
        source: 'backup',
      };
      notes.push(`«${requested}» no está disponible. Se ha usado Montserrat ExtraBold como respaldo.`);
    }
  }

  // 4) Tipografía del sistema.
  if (!font) {
    font = {
      family: 'sans-serif',
      usedWeight: 800,
      cssStack: '"Segoe UI", Arial, sans-serif',
      embed: null,
      source: 'fallback',
    };
    notes.push(
      state.googleNetwork === 'down'
        ? `No se pudo conectar con Google Fonts y «${requested}» no está instalada. Se ha usado la tipografía del sistema.`
        : `No se pudo cargar «${requested}» desde Google Fonts ni está instalada. Se ha usado la tipografía del sistema.`
    );
  }

  if ((font.source === 'google' || font.source === 'backup') && !font.embed) {
    notes.push('La tipografía no se ha podido incrustar en los SVG; esos archivos la referencian por nombre.');
  }

  const result = { ...font, requested, notes };
  state.fontCache.set(cacheKey, result);
  return result;
}

function fontLabel(font) {
  if (font.source === 'fallback') return 'tipografía del sistema';
  const weightName = WEIGHT_NAMES[font.usedWeight] || String(font.usedWeight);
  const familyKey = String(font.family).toLowerCase().replace(/[\s-]+/g, '');
  const weightKey = weightName.toLowerCase();
  if (familyKey.endsWith(weightKey)) return font.family;
  return `${font.family} ${weightName}`.trim();
}

async function ensureFontReady(font) {
  try {
    await document.fonts.load(`${font.usedWeight} 100px ${font.cssStack}`, 'zenon BESbswy');
  } catch {
    /* Fuentes locales: no necesitan carga previa. */
  }
  try {
    await Promise.race([document.fonts.ready, new Promise((resolve) => window.setTimeout(resolve, 3000))]);
  } catch {
    /* Nada que hacer. */
  }
}

/* ------------------------------------------------------------
   Medición del texto
   ------------------------------------------------------------ */

/**
 * Aplica el kerning como letter-spacing proporcional al tamaño de fuente.
 * Un 10 % equivale a 0.1 em de separación extra entre letras.
 */
function applyLetterSpacing(context, fontSize, kerningPct) {
  if (!('letterSpacing' in context)) return;
  const spacing = ((Number(kerningPct) || 0) / 100) * fontSize;
  context.letterSpacing = `${spacing}px`;
}

/**
 * Rectángulo de tinta de un texto para un tamaño de fuente concreto.
 */
function measureAt(text, font, fontSize, kerningPct = 0) {
  measureCtx.font = `${font.usedWeight} ${fontSize}px ${font.cssStack}`;
  applyLetterSpacing(measureCtx, fontSize, kerningPct);
  const metrics = measureCtx.measureText(text);

  const left = metrics.actualBoundingBoxLeft ?? 0;
  const right = metrics.actualBoundingBoxRight ?? metrics.width;
  const ascent = metrics.actualBoundingBoxAscent ?? fontSize * 0.75;
  const descent = metrics.actualBoundingBoxDescent ?? fontSize * 0.2;

  return {
    left,
    ascent,
    width: Math.max(1, left + right),
    height: Math.max(1, ascent + descent),
  };
}

/** Rectángulo de tinta medido a BASE_FONT_SIZE (para el SVG). */
function textBounds(text, font, kerningPct = 0) {
  return measureAt(text, font, BASE_FONT_SIZE, kerningPct);
}

/* ------------------------------------------------------------
   Generación de imágenes
   ------------------------------------------------------------ */

function canvasToBlob(canvas) {
  if (typeof canvas.toBlob === 'function') {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo crear el PNG.'));
      }, 'image/png');
    });
  }

  return fetch(canvas.toDataURL('image/png')).then((response) => response.blob());
}

/**
 * Recorta una imagen PNG al rectángulo de tinta real de los píxeles.
 * Medir en canvas no es exacto a tamaños grandes (redondeos del motor de
 * fuentes), así que el recorte definitivo se calcula sobre el alfa dibujado.
 */
function renderPng(text, font, { height, color, background, kerning = 0, padding = 0, square = false }) {
  const paddingRatio = Math.max(0, padding) / 100;
  const paddingPx = (height * paddingRatio) / (1 + paddingRatio * 2);
  const innerHeight = Math.max(1, height - paddingPx * 2);

  const base = textBounds(text, font, kerning);
  const probeMargin = Math.ceil(innerHeight * 0.25) + 12;

  const drawProbe = (fontSize) => {
    const bounds = measureAt(text, font, fontSize, kerning);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(bounds.width) + probeMargin * 2);
    canvas.height = Math.max(1, Math.ceil(bounds.height) + probeMargin * 2);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.font = `${font.usedWeight} ${fontSize}px ${font.cssStack}`;
    applyLetterSpacing(context, fontSize, kerning);
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.fillStyle = color;
    context.fillText(text, probeMargin + bounds.left, probeMargin + bounds.ascent);
    return canvas;
  };

  const alphaBounds = (canvas) => {
    const width = canvas.width;
    const canvasHeight = canvas.height;
    const data = canvas.getContext('2d').getImageData(0, 0, width, canvasHeight).data;
    let minX = width;
    let minY = canvasHeight;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < canvasHeight; y += 1) {
      const row = y * width;
      for (let x = 0; x < width; x += 1) {
        if (data[(row + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < 0) return null;
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  };

  let fontSize = (BASE_FONT_SIZE * innerHeight) / base.height;
  let probe = drawProbe(fontSize);
  let ink = alphaBounds(probe);

  // Segundo pase: acercamos el tamaño de fuente a la altura de tinta pedida.
  if (ink && Math.abs(ink.height - innerHeight) > 1) {
    fontSize *= innerHeight / ink.height;
    const secondProbe = drawProbe(fontSize);
    const secondInk = alphaBounds(secondProbe);
    if (secondInk && Math.abs(secondInk.height - innerHeight) < Math.abs(ink.height - innerHeight)) {
      probe = secondProbe;
      ink = secondInk;
    }
  }

  if (!ink) throw new Error('No se pudo medir el texto.');

  const scale = innerHeight / ink.height;
  const croppedWidth = Math.max(1, Math.ceil(ink.width * scale + paddingPx * 2));
  const croppedHeight = height;
  const side = Math.max(croppedWidth, croppedHeight);

  if (square && side > MAX_SQUARE_SIDE) {
    throw new Error('SQUARE_TOO_LARGE');
  }

  const width = square ? side : croppedWidth;
  const outHeight = square ? side : croppedHeight;
  const offsetX = square ? (side - croppedWidth) / 2 : 0;
  const offsetY = square ? (side - croppedHeight) / 2 : 0;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = outHeight;

  const context = canvas.getContext('2d');
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, outHeight);
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    probe,
    ink.x,
    ink.y,
    ink.width,
    ink.height,
    offsetX + paddingPx,
    offsetY + paddingPx,
    croppedWidth - paddingPx * 2,
    croppedHeight - paddingPx * 2
  );

  return { canvas, width, height: outHeight };
}

function svgFontFamily(font) {
  return `${String(font.family).replace(/['"\\]/g, '')}`;
}

function renderSvg(text, font, { color, kerning = 0, padding = 0, square = false }) {
  const bounds = textBounds(text, font, kerning);
  const paddingRatio = Math.max(0, padding) / 100;
  const paddingPx = bounds.height * paddingRatio;

  const innerWidth = bounds.width + paddingPx * 2;
  const innerHeight = bounds.height + paddingPx * 2;
  const side = Math.max(innerWidth, innerHeight);
  const width = round(square ? side : innerWidth, 2);
  const height = round(square ? side : innerHeight, 2);
  const offsetX = square ? (side - innerWidth) / 2 : 0;
  const offsetY = square ? (side - innerHeight) / 2 : 0;
  const x = round(bounds.left + paddingPx + offsetX, 3);
  const y = round(bounds.ascent + paddingPx + offsetY, 3);
  const letterSpacing = round((kerning / 100) * BASE_FONT_SIZE, 3);
  const family = svgFontFamily(font);

  const embeddedFace = font.embed
    ? `<style>@font-face{font-family:'${family}';src:url("${font.embed}") format("${font.fontFormat || 'woff2'}");font-weight:${font.usedWeight};font-style:normal;font-display:block;}</style>`
    : '';

  const fontFamily = font.embed
    ? `'${family}', sans-serif`
    : font.cssStack.replace(/"/g, "'");

  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img">` +
    embeddedFace +
    `<text x="${x}" y="${y}" ` +
    `font-family="${escapeXml(fontFamily)}" font-size="${BASE_FONT_SIZE}" ` +
    `font-weight="${font.usedWeight}" letter-spacing="${letterSpacing}" ` +
    `fill="${color}" xml:space="preserve">${escapeXml(text)}</text>` +
    `</svg>`;

  return { svg, width, height };
}

/* ------------------------------------------------------------
   Construcción de la galería
   ------------------------------------------------------------ */

function variantDescription(spec, colors, square = false) {
  if (spec.format === 'svg') {
    return `Vectorial · ${square ? 'cuadrado' : 'recortado'} · fondo transparente`;
  }
  if (spec.background) return `${square ? 'Cuadrado' : 'Recortado'} · fondo ${colors.bg.toUpperCase()}`;
  return `${square ? 'Cuadrado' : 'Recortado'} · fondo transparente`;
}

async function buildGroup({ kicker, title, text, font, colors, kerning, padding, square = false }) {
  const items = [];
  let skipped = 0;

  for (const spec of VARIANTS) {
    const color =
      spec.tone === 'color' ? colors.text : spec.tone === 'black' ? '#000000' : '#FFFFFF';
    const background = spec.background ? colors.bg : null;

    let blob;
    let width;
    let height;
    let svgText = null;

    if (spec.format === 'svg') {
      const rendered = renderSvg(text, font, { color, kerning, padding, square });
      blob = new Blob([rendered.svg], { type: 'image/svg+xml;charset=utf-8' });
      width = rendered.width;
      height = rendered.height;
      svgText = rendered.svg;
    } else {
      let rendered;
      try {
        rendered = renderPng(text, font, {
          color,
          background,
          height: spec.height,
          kerning,
          padding,
          square,
        });
      } catch (error) {
        if (square && error.message === 'SQUARE_TOO_LARGE') {
          skipped += 1;
          continue;
        }
        throw error;
      }
      blob = await canvasToBlob(rendered.canvas);
      width = rendered.width;
      height = rendered.height;
    }

    const url = URL.createObjectURL(blob);
    state.urls.push(url);

    items.push({
      spec,
      url,
      blob,
      width,
      height,
      svgText,
      title: spec.format === 'svg' ? 'SVG' : `PNG · ${spec.height} px`,
      toneLabel: TONE_LABELS[spec.tone],
      meta: `${variantDescription(spec, colors, square)} · ${Math.round(width)} × ${Math.round(height)} px`,
      alt: `Logo «${text}» en ${spec.format.toUpperCase()}, ${variantDescription(spec, colors, square).toLowerCase()}`,
      filename: `${slugify(text)}-${spec.id}${square ? '-square' : ''}.${spec.format}`,
    });
  }

  return { kicker, title, items, skipped };
}

function createCard(item) {
  const card = document.createElement('article');
  card.className = 'logo-card';

  const head = document.createElement('div');
  head.className = 'logo-card__head';

  const title = document.createElement('h4');
  title.textContent = item.title;

  const chip = document.createElement('span');
  chip.className = `chip chip--${item.spec.tone}`;
  chip.textContent = item.toneLabel;

  head.append(title, chip);

  const preview = document.createElement('div');
  preview.className = 'logo-card__preview';
  if (item.spec.format === 'svg' || !item.spec.background) preview.classList.add('is-transparent');

  if (item.svgText) {
    // SVG en línea: usa la tipografía ya cargada en la página, así la vista
    // previa coincide siempre con el recorte calculado.
    preview.innerHTML = item.svgText.replace(/^<\?xml[^>]*\?>\s*/, '');
    preview.classList.add('is-inline');
    preview.setAttribute('role', 'img');
    preview.setAttribute('aria-label', item.alt);
  } else {
    const image = document.createElement('img');
    image.src = item.url;
    image.alt = item.alt;
    image.decoding = 'async';
    preview.append(image);
  }

  const foot = document.createElement('div');
  foot.className = 'logo-card__foot';

  const meta = document.createElement('p');
  meta.className = 'logo-card__meta';
  meta.textContent = item.meta;

  const download = document.createElement('a');
  download.className = 'btn btn--small';
  download.href = item.url;
  download.download = item.filename;
  download.textContent = 'Descargar';

  foot.append(meta, download);
  card.append(head, preview, foot);

  return card;
}

function renderResults(groups, metaText) {
  const fragment = document.createDocumentFragment();

  for (const group of groups) {
    const section = document.createElement('section');
    section.className = 'logo-group';

    const head = document.createElement('div');
    head.className = 'logo-group__head';

    const kicker = document.createElement('p');
    kicker.className = 'section-kicker';
    kicker.textContent = group.kicker;

    const title = document.createElement('h3');
    title.className = 'logo-group__title';
    title.textContent = group.title;

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `${group.items.length} archivos`;

    head.append(kicker, title, badge);

    const grid = document.createElement('div');
    grid.className = 'logo-grid';
    for (const item of group.items) grid.append(createCard(item));

    section.append(head, grid);
    fragment.append(section);
  }

  els.content.replaceChildren();
  els.content.append(fragment);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  els.count.textContent = `${total} logos`;
  els.meta.textContent = metaText;
}

/* ------------------------------------------------------------
   Limpiar
   ------------------------------------------------------------ */

function clearResults({ silent = false } = {}) {
  for (const url of state.urls) URL.revokeObjectURL(url);
  state.urls = [];

  const empty = document.createElement('p');
  empty.className = 'empty';
  empty.textContent = EMPTY_MESSAGE;
  els.content.replaceChildren(empty);

  els.count.textContent = '';
  els.meta.textContent = '';

  if (!silent) {
    setStatus('Logos eliminados.');
    setNotice('');
  }
}

/* ------------------------------------------------------------
   Acción principal
   ------------------------------------------------------------ */

async function handleGenerate(event) {
  if (event) event.preventDefault();
  if (state.busy) return;

  const rawText = els.text.value.trim();
  if (!rawText) {
    setStatus('Escribe el texto del logo o deja el valor por defecto «zenon».', 'error');
    els.text.focus();
    return;
  }

  const text = rawText.replace(/\s+/g, ' ').slice(0, 40);
  const requestedFont = els.font.value.trim() || 'Gilroy Extrabold';
  const weightSelection = els.weight.value;
  const forcedWeight = weightSelection === 'auto' ? null : Number(weightSelection) || null;
  const colors = {
    text: readColor(els.letterText, els.letterPicker),
    bg: readColor(els.bgText, els.bgPicker),
  };
  const kerning = clamp(Number(els.kerning.value) || 0, -20, 50);
  const padding = clamp(Number(els.padding.value) || 0, 0, 50);

  setBusy(true);
  clearResults({ silent: true });
  setNotice('');
  setStatus('Cargando la tipografía…');

  try {
    const font = await resolveFont(requestedFont, forcedWeight);
    await ensureFontReady(font);
    await nextFrame();

    setStatus('Generando logos…');
    await nextFrame();

    const initial = firstGrapheme(text);
    const groups = [];
    groups.push(
      await buildGroup({
        kicker: '01 / Texto completo',
        title: `Texto completo · recortado · «${text}»`,
        text,
        font,
        colors,
        kerning,
        padding,
        square: false,
      })
    );
    groups.push(
      await buildGroup({
        kicker: '02 / Texto completo · cuadrado',
        title: `Texto completo · cuadrado · «${text}»`,
        text,
        font,
        colors,
        kerning,
        padding,
        square: true,
      })
    );
    groups.push(
      await buildGroup({
        kicker: '03 / Letra inicial',
        title: `Letra inicial · recortada · «${initial}»`,
        text: initial,
        font,
        colors,
        kerning,
        padding,
        square: false,
      })
    );
    groups.push(
      await buildGroup({
        kicker: '04 / Letra inicial · cuadrada',
        title: `Letra inicial · cuadrada · «${initial}»`,
        text: initial,
        font,
        colors,
        kerning,
        padding,
        square: true,
      })
    );

    renderResults(
      groups,
      `Tipografía: ${fontLabel(font)} · Kerning ${formatPercent(kerning, true)} · ` +
        `Padding ${formatPercent(padding)} · Letra ${colors.text} · Fondo ${colors.bg}`
    );

    const total = groups.reduce((sum, group) => sum + group.items.length, 0);
    const skipped = groups.reduce((sum, group) => sum + (group.skipped || 0), 0);
    const notes = [...font.notes];
    if (skipped) {
      notes.push(
        `Se han omitido ${skipped} versiones cuadradas de 400 px porque el texto es demasiado ancho para el canvas del navegador.`
      );
    }

    setStatus(`Listo: ${total} logos generados con ${fontLabel(font)}.`, 'ok');
    if (notes.length) setNotice(notes.join(' '));

    document.querySelector('.results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error(error);
    setStatus('No se pudieron generar los logos. Revisa la tipografía e inténtalo de nuevo.', 'error');
  } finally {
    setBusy(false);
  }
}

/* ------------------------------------------------------------
   Arranque de la interfaz
   ------------------------------------------------------------ */

function fillFontSuggestions() {
  const fragment = document.createDocumentFragment();
  for (const name of FONT_SUGGESTIONS) {
    const option = document.createElement('option');
    option.value = name;
    fragment.append(option);
  }
  els.fontList.append(fragment);
}

function fillWeightOptions() {
  const fragment = document.createDocumentFragment();
  for (const weight of WEIGHT_VALUES) {
    const option = document.createElement('option');
    option.value = String(weight);
    option.textContent = `${weight} · ${WEIGHT_NAMES[weight]}`;
    fragment.append(option);
  }
  els.weight.append(fragment);
}

function init() {
  fillFontSuggestions();
  fillWeightOptions();
  bindColor(els.letterPicker, els.letterText, els.letterRgb);
  bindColor(els.bgPicker, els.bgText, els.bgRgb);
  bindRange(els.kerning, els.kerningValue, true);
  bindRange(els.padding, els.paddingValue, false);

  els.form.addEventListener('submit', handleGenerate);
  els.clear.addEventListener('click', () => clearResults());
}

init();
