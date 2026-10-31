// HUMANLY AI — browser-based handwriting-style page composer
// Uploaded images and text are processed locally in this browser.

const $ = (id) => document.getElementById(id);

const paperUpload = $("paperUpload");
const sampleUpload = $("sampleUpload");
const uploadBox = $("uploadBox");
const sampleUploadBox = $("sampleUploadBox");
const samplePreviewWrap = $("samplePreviewWrap");
const sampleImage = $("sampleImage");
const sampleName = $("sampleName");
const removeSampleBtn = $("removeSampleBtn");
const downloadSheetBtn = $("downloadSheetBtn");
const handwritingStatus = $("handwritingStatus");
const pageFilesList = $("pageFilesList");
const contentInput = $("contentInput");
const wordCount = $("wordCount");
const fontSelector = $("fontSelector");
const fontSize = $("fontSize");
const fontSizeValue = $("fontSizeValue");
const lineSpacing = $("lineSpacing");
const lineSpacingValue = $("lineSpacingValue");
const topMargin = $("topMargin");
const sideMargin = $("sideMargin");
const autoAlign = $("autoAlign");
const alignmentStatus = $("alignmentStatus");
const inkColor = $("inkColor");
const fontSample = $("fontSample");
const generateBtn = $("generateBtn");
const emptyState = $("emptyState");
const paperPreview = $("paperPreview");
const paperImage = $("paperImage");
const renderedText = $("renderedText");
const previewStatus = $("previewStatus");
const pageInfo = $("pageInfo");
const pageCounter = $("pageCounter");
const prevPageBtn = $("prevPageBtn");
const nextPageBtn = $("nextPageBtn");
const downloadBtn = $("downloadBtn");
const errorMessage = $("errorMessage");

const MAX_FILE_SIZE = 10 * 1024 * 1024;
let pageFiles = [];
let pageURLs = [];
let sampleURL = null;
let generatedPages = [];
let currentPageIndex = 0;
let handwritingGlyphs = new Map();
const CALIBRATION_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?!\'-+=()";

const FONT_MAP = {
  cursive: { css: '"Caveat", cursive', canvas: '"Caveat"' },
  casual: { css: '"Patrick Hand", cursive', canvas: '"Patrick Hand"' },
  neat: { css: '"Kalam", cursive', canvas: '"Kalam"' },
  personal: { css: '"Patrick Hand", cursive', canvas: '"Patrick Hand"' }
};

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}
function clearError() {
  showError("");
}
function markPreviewStale() {
  if (!generatedPages.length) return;
  generatedPages = [];
  paperImage.removeAttribute("src");
  updateNavigation();
  pageInfo.textContent = "Settings changed — generate a fresh preview";
  previewStatus.textContent = "Preview needs refresh";
}
function revokeURLs(urls) {
  urls.forEach((url) => URL.revokeObjectURL(url));
}
function validateImage(file) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return "Choose a JPG, PNG, or WEBP image.";
  if (file.size > MAX_FILE_SIZE) return "Each image must be 10 MB or smaller.";
  return "";
}
function updateWordCount() {
  const text = contentInput.value.trim();
  const count = text ? text.split(/\s+/u).length : 0;
  wordCount.textContent = `${count} ${count === 1 ? "word" : "words"}`;
}
function fontFamily() {
  return FONT_MAP[fontSelector.value] || FONT_MAP.cursive;
}
function updateFontControls() {
  fontSizeValue.textContent = `${fontSize.value} px`;
  lineSpacingValue.textContent = `${(Number(lineSpacing.value) / 10).toFixed(1)}×`;
  fontSample.style.fontFamily = fontFamily().css;
  fontSample.style.fontSize = `${Math.min(Number(fontSize.value), 32)}px`;
  renderedText.style.fontFamily = fontFamily().css;
}
function cleanNumber(input, fallback, min, max) {
  const n = Number(input.value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

contentInput.addEventListener("input", () => { updateWordCount(); markPreviewStale(); });
fontSelector.addEventListener("change", () => { updateFontControls(); markPreviewStale(); });
autoAlign.addEventListener("change", () => { alignmentStatus.textContent = autoAlign.checked ? "Automatic alignment is on. Detection runs when you generate a preview." : "Auto-align is off. Your manual margins and line spacing will be used."; markPreviewStale(); });
[topMargin, sideMargin, inkColor].forEach((control) => control.addEventListener("change", markPreviewStale));
fontSize.addEventListener("input", () => { updateFontControls(); markPreviewStale(); });
lineSpacing.addEventListener("input", () => { updateFontControls(); markPreviewStale(); });

sampleUpload.addEventListener("change", async () => {
  clearError();
  const file = sampleUpload.files && sampleUpload.files[0];
  if (!file) return;
  const issue = validateImage(file);
  if (issue) {
    showError(issue);
    sampleUpload.value = "";
    return;
  }
  if (sampleURL) URL.revokeObjectURL(sampleURL);
  sampleURL = URL.createObjectURL(file);
  sampleImage.src = sampleURL;
  sampleName.textContent = file.name;
  samplePreviewWrap.hidden = false;
  sampleUploadBox.hidden = true;
  handwritingStatus.textContent = "Reading your handwriting sheet… keep this tab open.";
  try {
    const image = await loadImage(sampleURL);
    const result = extractHandwritingGlyphs(image);
    handwritingGlyphs = result.glyphs;
    if (handwritingGlyphs.size < 12) {
      handwritingGlyphs = new Map();
      throw new Error("I couldn't find enough handwritten characters. Please upload a clear photo of the entire printed sheet, with all boxes visible.");
    }
    fontSelector.value = "personal";
    updateFontControls();
    markPreviewStale();
    const missing = CALIBRATION_CHARS.split("").filter((char) => !handwritingGlyphs.has(char));
    handwritingStatus.textContent = "Your handwriting is ready: " + handwritingGlyphs.size + " of " + CALIBRATION_CHARS.length + " characters detected." + (missing.length ? " Some unclear characters will use a fallback handwriting style." : "");
    if (contentInput.value.trim() && pageURLs.length) await generatePreview();
  } catch (error) {
    handwritingStatus.textContent = "Couldn't read that sheet. Try a brighter, straight-on photo with the whole page visible.";
    showError(error.message || "Couldn't extract your handwriting. Please try another image.");
  }
});
removeSampleBtn.addEventListener("click", () => {
  if (sampleURL) URL.revokeObjectURL(sampleURL);
  sampleURL = null;
  handwritingGlyphs = new Map();
  sampleImage.removeAttribute("src");
  sampleUpload.value = "";
  samplePreviewWrap.hidden = true;
  sampleUploadBox.hidden = false;
  handwritingStatus.textContent = "Upload a completed handwriting sheet to personalize the generated text.";
  if (fontSelector.value === "personal") fontSelector.value = "casual";
  updateFontControls();
  markPreviewStale();
});

paperUpload.addEventListener("change", () => {
  clearError();
  const files = Array.from(paperUpload.files || []);
  if (!files.length) return;
  const badFile = files.find((file) => validateImage(file));
  if (badFile) {
    showError(`${badFile.name}: ${validateImage(badFile)}`);
    paperUpload.value = "";
    return;
  }
  revokeURLs(pageURLs);
  pageFiles = files;
  pageURLs = files.map((file) => URL.createObjectURL(file));
  generatedPages = [];
  renderFileList();
  uploadBox.querySelector("h3").textContent = `${files.length} notebook page${files.length === 1 ? "" : "s"} selected`;
  uploadBox.querySelector("p").textContent = "Click to change your selected pages";
  pageInfo.textContent = `${files.length} template page${files.length === 1 ? "" : "s"} uploaded`;
  updateNavigation();
  if (contentInput.value.trim()) generatePreview();
});
function renderFileList() {
  pageFilesList.replaceChildren();
  pageFiles.forEach((file, index) => {
    const row = document.createElement("div");
    row.className = "file-item";
    const name = document.createElement("span");
    name.textContent = `${index + 1}. ${file.name}`;
    const size = document.createElement("span");
    size.textContent = `${(file.size / 1024).toFixed(0)} KB`;
    row.append(name, size);
    pageFilesList.append(row);
  });
  pageFilesList.hidden = pageFiles.length === 0;
}

// The printable sheet uses a fixed A4 grid. Upload a flat, full-page photo/scan for best extraction.
downloadSheetBtn.addEventListener("click", () => {
  clearError();
  const library = window.jspdf;
  if (!library || !library.jsPDF) {
    showError("The PDF library hasn't loaded. Check your internet connection and reload the page.");
    return;
  }
  const { jsPDF } = library;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const startX = 18, startY = 35, cellW = 29, cellH = 19, columns = 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.setTextColor(30, 30, 45);
  pdf.text("HUMANLY AI — MY HANDWRITING", 105, 16, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(85, 85, 100);
  pdf.text("Write each character once, naturally, inside its box. Keep the full page visible when taking a photo.", 105, 23, { align: "center" });
  pdf.text("Use dark pen or pencil. Do not write over the small character label.", 105, 28, { align: "center" });
  CALIBRATION_CHARS.split("").forEach((char, index) => {
    const col = index % columns, row = Math.floor(index / columns);
    const x = startX + col * cellW, y = startY + row * cellH;
    pdf.setDrawColor(205, 207, 220);
    pdf.setLineWidth(0.2);
    pdf.rect(x, y, cellW, cellH);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(125, 125, 140);
    pdf.text(char === "'" ? "apostrophe" : char, x + 2, y + 3.6);
  });
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 115);
  pdf.text("Tip: Keep letters separate. This first version learns individual characters, not connected cursive strokes.", 105, 272, { align: "center" });
  pdf.save("humanly-ai-my-handwriting-sheet.pdf");
});

function extractHandwritingGlyphs(image) {
  const sheetW = 1000, sheetH = Math.round(sheetW * 297 / 210);
  const normalized = document.createElement("canvas");
  normalized.width = sheetW;
  normalized.height = sheetH;
  const nctx = normalized.getContext("2d", { willReadFrequently: true });
  nctx.fillStyle = "#fff";
  nctx.fillRect(0, 0, sheetW, sheetH);
  nctx.drawImage(image, 0, 0, sheetW, sheetH);

  const glyphs = new Map();
  const startX = 18 / 210 * sheetW, startY = 35 / 297 * sheetH;
  const cellW = 29 / 210 * sheetW, cellH = 19 / 297 * sheetH;
  const columns = 6;
  CALIBRATION_CHARS.split("").forEach((char, index) => {
    const col = index % columns, row = Math.floor(index / columns);
    const x = Math.round(startX + col * cellW + cellW * 0.10);
    const y = Math.round(startY + row * cellH + cellH * 0.27);
    const w = Math.round(cellW * 0.80), h = Math.round(cellH * 0.58);
    const crop = document.createElement("canvas");
    crop.width = w; crop.height = h;
    const cctx = crop.getContext("2d", { willReadFrequently: true });
    cctx.drawImage(normalized, x, y, w, h, 0, 0, w, h);
    const pixels = cctx.getImageData(0, 0, w, h);
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const p = (py * w + px) * 4;
        const r = pixels.data[p], g = pixels.data[p + 1], b = pixels.data[p + 2];
        const brightness = (r + g + b) / 3;
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        if (brightness < 165 || (brightness < 195 && chroma > 35)) {
          minX = Math.min(minX, px); minY = Math.min(minY, py);
          maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
        }
      }
    }
    if (maxX - minX < 2 || maxY - minY < 3) return;
    const pad = 2;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
    const gw = maxX - minX + 1, gh = maxY - minY + 1;
    const glyph = document.createElement("canvas");
    glyph.width = gw; glyph.height = gh;
    const gctx = glyph.getContext("2d");
    const out = gctx.createImageData(gw, gh);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const src = ((gy + minY) * w + (gx + minX)) * 4;
        const dst = (gy * gw + gx) * 4;
        const r = pixels.data[src], g = pixels.data[src + 1], b = pixels.data[src + 2];
        const brightness = (r + g + b) / 3;
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        const strength = brightness < 165 ? (165 - brightness) / 165 : (brightness < 195 && chroma > 35 ? (195 - brightness) / 195 : 0);
        out.data[dst] = 0; out.data[dst + 1] = 0; out.data[dst + 2] = 0;
        out.data[dst + 3] = Math.max(0, Math.min(255, Math.round(strength * 255)));
      }
    }
    gctx.putImageData(out, 0, 0);
    glyphs.set(char, { canvas: glyph, aspect: gw / gh });
  });
  return { glyphs };
}

function personalCharacterWidth(char, size, measure) {
  if (char === " ") return size * 0.34;
  const glyph = handwritingGlyphs.get(char);
  if (!glyph) return Math.max(size * 0.25, measure.measureText(char).width);
  return Math.max(size * 0.22, Math.min(size * 1.25, glyph.aspect * size * 0.78)) + size * 0.035;
}
function wrapPersonalizedText(measure, text, maxWidth, size) {
  const lines = [];
  for (const paragraph of text.split(/\r?\n/u)) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    let line = "", width = 0;
    for (const word of paragraph.trim().split(/\s+/u)) {
      let wordWidth = 0;
      for (const char of word) wordWidth += personalCharacterWidth(char, size, measure);
      const spaceWidth = line ? personalCharacterWidth(" ", size, measure) : 0;
      if (line && width + spaceWidth + wordWidth > maxWidth) {
        lines.push(line); line = word; width = wordWidth;
      } else {
        line += (line ? " " : "") + word;
        width += spaceWidth + wordWidth;
      }
    }
    lines.push(line);
  }
  return lines;
}
const tintedGlyphCache = new Map();
function drawPersonalizedLine(ctx, line, x, y, size, maxWidth, baselineMode) {
  let cursor = x;
  const glyphHeight = size * 0.82;
  const baseline = baselineMode === "alphabetic" ? y : y + glyphHeight;
  for (const char of line) {
    if (char === " ") { cursor += size * 0.34; continue; }
    const glyph = handwritingGlyphs.get(char);
    if (!glyph) {
      ctx.font = getCanvasFont(size);
      ctx.textBaseline = baselineMode;
      ctx.fillText(char, cursor, y);
      cursor += Math.max(size * 0.25, ctx.measureText(char).width) + size * 0.035;
      continue;
    }
    const drawH = glyphHeight;
    const drawW = Math.max(size * 0.22, Math.min(size * 1.25, glyph.aspect * drawH));
    const cacheKey = inkColor.value + "|" + char;
    let tinted = tintedGlyphCache.get(cacheKey);
    if (!tinted) {
      tinted = document.createElement("canvas");
      tinted.width = glyph.canvas.width; tinted.height = glyph.canvas.height;
      const tctx = tinted.getContext("2d");
      tctx.drawImage(glyph.canvas, 0, 0);
      tctx.globalCompositeOperation = "source-in";
      tctx.fillStyle = inkColor.value;
      tctx.fillRect(0, 0, tinted.width, tinted.height);
      tintedGlyphCache.set(cacheKey, tinted);
    }
    ctx.drawImage(tinted, cursor, baseline - drawH, drawW, drawH);
    cursor += drawW + size * 0.035;
    if (cursor > x + maxWidth) break;
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("One of the uploaded images could not be read."));
    image.src = url;
  });
}
function getCanvasFont(size) {
  return `${size}px ${fontFamily().canvas}`;
}

// Estimate ruled lines and a red left margin from a downscaled page image.
// Returns normalized measurements so the result also works on large phone photos.
function detectPageLayout(image) {
  const sampleWidth = 420;
  const scale = sampleWidth / image.naturalWidth;
  const sampleHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight);
  const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);

  const xStart = Math.floor(sampleWidth * 0.12);
  const xEnd = Math.floor(sampleWidth * 0.90);
  const scanWidth = xEnd - xStart;
  const rowScores = new Float32Array(sampleHeight);
  const redColumnScores = new Uint16Array(sampleWidth);

  for (let y = 0; y < sampleHeight; y++) {
    let marked = 0;
    for (let x = xStart; x < xEnd; x++) {
      const p = (y * sampleWidth + x) * 4;
      const red = data[p], green = data[p + 1], blue = data[p + 2];
      const brightness = (red + green + blue) / 3;
      const saturatedRule = Math.max(red, green, blue) - Math.min(red, green, blue) > 28
        && brightness < 245;
      if (brightness < 218 || saturatedRule) marked++;
    }
    rowScores[y] = marked / scanWidth;

    for (let x = 0; x < Math.floor(sampleWidth * 0.48); x++) {
      const p = (y * sampleWidth + x) * 4;
      const red = data[p], green = data[p + 1], blue = data[p + 2];
      if (red > 125 && red > green * 1.35 && red > blue * 1.25 && green < 175) {
        redColumnScores[x]++;
      }
    }
  }

  // A ruled line usually spans much of the page width and creates a sharp row peak.
  const candidates = [];
  for (let y = 1; y < sampleHeight - 1; y++) {
    if (rowScores[y] > 0.24 && rowScores[y] >= rowScores[y - 1] && rowScores[y] >= rowScores[y + 1]) {
      candidates.push(y);
    }
  }
  const lines = [];
  for (const y of candidates) {
    const last = lines[lines.length - 1];
    if (last && y - last.end <= 3) {
      last.end = y;
      last.center = (last.start + last.end) / 2;
      last.score = Math.max(last.score, rowScores[y]);
    } else {
      lines.push({ start: y, end: y, center: y, score: rowScores[y] });
    }
  }

  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i].center - lines[i - 1].center;
    if (gap >= 12 * scale && gap <= 80 * scale) gaps.push(gap);
  }
  let detectedSpacing = null;
  if (gaps.length >= 2) {
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    detectedSpacing = sortedGaps[Math.floor(sortedGaps.length / 2)] / scale;
  }

  let redMarginX = -1;
  let redBest = 0;
  for (let x = 2; x < Math.floor(sampleWidth * 0.48); x++) {
    if (redColumnScores[x] > redBest) {
      redBest = redColumnScores[x];
      redMarginX = x;
    }
  }
  const hasRedMargin = redMarginX >= 0 && redBest / sampleHeight > 0.12;
  const hasRuling = detectedSpacing !== null && lines.length >= 3;
  const firstLine = hasRuling ? lines.find((line) => line.center > sampleHeight * 0.04) : null;

  return {
    hasRuling,
    hasRedMargin,
    lineSpacing: hasRuling ? detectedSpacing : null,
    firstLineY: firstLine ? firstLine.center / scale : null,
    leftMarginX: hasRedMargin ? redMarginX / scale : null,
    sampleLineCount: lines.length
  };
}
function wrapText(context, text, maxWidth) {
  const output = [];
  for (const paragraph of text.split(/\r?\n/u)) {
    if (!paragraph.trim()) {
      output.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.trim().split(/\s+/u)) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width > maxWidth && line) {
        output.push(line);
        // Keep a single very long word intact instead of silently dropping it.
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) output.push(line);
  }
  return output;
}
async function buildPages() {
  const content = contentInput.value.trim();
  if (!content) throw new Error("Enter the content you want to place on the pages.");
  if (!pageURLs.length) throw new Error("Upload at least one notebook page first.");

  if (fontSelector.value === "personal" && handwritingGlyphs.size < 12) {
    throw new Error("To use your own handwriting, download the handwriting sheet, fill it in, and upload a clear photo first.");
  }
  await document.fonts.ready;
  const images = await Promise.all(pageURLs.map(loadImage));
  const first = images[0];
  const pageWidth = first.naturalWidth;
  const pageHeight = first.naturalHeight;
  const size = Number(fontSize.value);
  const manualLeading = Number(lineSpacing.value) / 10;
  const fallbackTop = cleanNumber(topMargin, 10, 3, 30) / 100 * pageHeight;
  const fallbackSide = cleanNumber(sideMargin, 8, 3, 25) / 100 * pageWidth;
  const layouts = images.map((image) => autoAlign.checked ? detectPageLayout(image) : null);
  const firstLayout = layouts[0];
  const hasDetectedRuling = Boolean(autoAlign.checked && firstLayout && firstLayout.hasRuling);
  const lineHeight = hasDetectedRuling ? firstLayout.lineSpacing : size * manualLeading;
  const top = hasDetectedRuling && firstLayout.firstLineY !== null
    ? firstLayout.firstLineY
    : fallbackTop;
  const side = autoAlign.checked && firstLayout && firstLayout.hasRedMargin
    ? Math.min(pageWidth * 0.35, firstLayout.leftMarginX + pageWidth * 0.025)
    : fallbackSide;
  const rightSide = fallbackSide;
  const usableWidth = Math.max(40, pageWidth - side - rightSide);

  if (autoAlign.checked) {
    const messages = [];
    if (hasDetectedRuling) messages.push(`ruled lines detected (~${Math.round(firstLayout.lineSpacing)} px apart)`);
    else messages.push("no reliable ruling found; using your line-spacing setting");
    if (firstLayout && firstLayout.hasRedMargin) messages.push("left margin detected");
    else messages.push("using your side-margin setting");
    alignmentStatus.textContent = `Auto-align: ${messages.join(" · ")}.`;
  } else {
    alignmentStatus.textContent = "Auto-align is off. Your manual margins and line spacing are being used.";
  }

  const measuringCanvas = document.createElement("canvas");
  const measure = measuringCanvas.getContext("2d");
  measure.font = getCanvasFont(size);
  const usePersonal = fontSelector.value === "personal" && handwritingGlyphs.size >= 12;
  const lines = usePersonal ? wrapPersonalizedText(measure, content, usableWidth, size) : wrapText(measure, content, usableWidth);
  const bottomPadding = Math.max(lineHeight, pageHeight * 0.06);
  const maxLines = Math.max(1, Math.floor((pageHeight - top - bottomPadding) / lineHeight) + 1);
  const chunks = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(lines.slice(i, i + maxLines));
  }

  const result = [];
  for (let pageIndex = 0; pageIndex < chunks.length; pageIndex++) {
    const backgroundIndex = Math.min(pageIndex, images.length - 1);
    const background = images[backgroundIndex];
    const layout = layouts[backgroundIndex];
    const pageTop = autoAlign.checked && layout && layout.hasRuling && layout.firstLineY !== null
      ? layout.firstLineY
      : fallbackTop;
    const pageSide = autoAlign.checked && layout && layout.hasRedMargin
      ? Math.min(pageWidth * 0.35, layout.leftMarginX + pageWidth * 0.025)
      : fallbackSide;
    const pageLineHeight = autoAlign.checked && layout && layout.hasRuling
      ? layout.lineSpacing
      : size * manualLeading;
    const pageRight = fallbackSide;
    const pageUsableWidth = Math.max(40, pageWidth - pageSide - pageRight);
    const canvas = document.createElement("canvas");
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageWidth, pageHeight);
    ctx.drawImage(background, 0, 0, pageWidth, pageHeight);
    ctx.font = getCanvasFont(size);
    ctx.fillStyle = inkColor.value;
    ctx.textBaseline = autoAlign.checked && layout && layout.hasRuling ? "alphabetic" : "top";
    ctx.textAlign = "left";
    chunks[pageIndex].forEach((line, lineIndex) => {
      const y = pageTop + lineIndex * pageLineHeight;
      if (usePersonal) drawPersonalizedLine(ctx, line, pageSide, y, size, pageUsableWidth, ctx.textBaseline);
      else ctx.fillText(line, pageSide, y, pageUsableWidth);
    });
    result.push({
      dataURL: canvas.toDataURL("image/jpeg", 0.94),
      width: pageWidth,
      height: pageHeight,
      lines: chunks[pageIndex].length
    });
  }
  return result;
}

async function generatePreview() {
  clearError();
  generateBtn.disabled = true;
  generateBtn.textContent = "Preparing preview…";
  previewStatus.textContent = "Rendering pages";
  try {
    generatedPages = await buildPages();
    currentPageIndex = 0;
    showPage(0);
    previewStatus.textContent = "Preview ready";
    downloadBtn.disabled = false;
    pageInfo.textContent = `${generatedPages.length} page${generatedPages.length === 1 ? "" : "s"} ready to export`;
  } catch (error) {
    generatedPages = [];
    updateNavigation();
    showError(error.message || "Could not generate the preview. Try another image or smaller text.");
    previewStatus.textContent = "Needs attention";
    downloadBtn.disabled = true;
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<span>✦</span> Generate Preview <span class="button-arrow">→</span>';
  }
}
function showPage(index) {
  if (!generatedPages.length) return;
  currentPageIndex = Math.max(0, Math.min(index, generatedPages.length - 1));
  const page = generatedPages[currentPageIndex];
  paperImage.src = page.dataURL;
  paperPreview.style.aspectRatio = `${page.width} / ${page.height}`;
  paperPreview.hidden = false;
  emptyState.hidden = true;
  // Text is already rendered into the page image for an accurate preview/export match.
  renderedText.textContent = "";
  renderedText.style.display = "none";
  updateNavigation();
}
function updateNavigation() {
  const total = generatedPages.length;
  pageCounter.textContent = `Page ${total ? currentPageIndex + 1 : 0} of ${total}`;
  prevPageBtn.disabled = total === 0 || currentPageIndex === 0;
  nextPageBtn.disabled = total === 0 || currentPageIndex >= total - 1;
  if (!total) {
    paperPreview.hidden = true;
    emptyState.hidden = false;
    previewStatus.textContent = "Waiting for input";
    downloadBtn.disabled = true;
  }
}
generateBtn.addEventListener("click", generatePreview);
prevPageBtn.addEventListener("click", () => showPage(currentPageIndex - 1));
nextPageBtn.addEventListener("click", () => showPage(currentPageIndex + 1));

downloadBtn.addEventListener("click", () => {
  clearError();
  if (!generatedPages.length) {
    showError("Generate a preview before exporting.");
    return;
  }
  const jspdf = window.jspdf;
  if (!jspdf || !jspdf.jsPDF) {
    showError("The PDF library did not load. Check your internet connection and reload the page.");
    return;
  }
  downloadBtn.disabled = true;
  const original = downloadBtn.textContent;
  downloadBtn.textContent = "Preparing PDF…";
  try {
    const { jsPDF } = jspdf;
    const first = generatedPages[0];
    const orientation = first.width > first.height ? "landscape" : "portrait";
    const pdf = new jsPDF({
      orientation,
      unit: "pt",
      format: [first.width * 0.75, first.height * 0.75],
      compress: true
    });
    generatedPages.forEach((page, index) => {
      if (index > 0) pdf.addPage([page.width * 0.75, page.height * 0.75], page.width > page.height ? "landscape" : "portrait");
      pdf.addImage(page.dataURL, "JPEG", 0, 0, page.width * 0.75, page.height * 0.75, undefined, "FAST");
    });
    pdf.save("humanly-ai-pages.pdf");
  } catch (error) {
    console.error(error);
    showError("PDF export failed. Please regenerate the preview and try again.");
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = original;
  }
});

window.addEventListener("beforeunload", () => {
  revokeURLs(pageURLs);
  if (sampleURL) URL.revokeObjectURL(sampleURL);
});

updateWordCount();
updateFontControls();
updateNavigation();
