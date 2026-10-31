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

const FONT_MAP = {
  cursive: { css: '"Caveat", cursive', canvas: '"Caveat"' },
  casual: { css: '"Patrick Hand", cursive', canvas: '"Patrick Hand"' },
  neat: { css: '"Kalam", cursive', canvas: '"Kalam"' }
};

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}
function clearError() {
  showError("");
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

contentInput.addEventListener("input", updateWordCount);
fontSelector.addEventListener("change", updateFontControls);
autoAlign.addEventListener("change", () => { alignmentStatus.textContent = autoAlign.checked ? "Automatic alignment is on. Detection runs when you generate a preview." : "Auto-align is off. Your manual margins and line spacing will be used."; });
fontSize.addEventListener("input", updateFontControls);
lineSpacing.addEventListener("input", updateFontControls);

sampleUpload.addEventListener("change", () => {
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
});
removeSampleBtn.addEventListener("click", () => {
  if (sampleURL) URL.revokeObjectURL(sampleURL);
  sampleURL = null;
  sampleImage.removeAttribute("src");
  sampleUpload.value = "";
  samplePreviewWrap.hidden = true;
  sampleUploadBox.hidden = false;
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
  const lines = wrapText(measure, content, usableWidth);
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
      const y = ctx.textBaseline === "alphabetic"
        ? pageTop + lineIndex * pageLineHeight
        : pageTop + lineIndex * pageLineHeight;
      ctx.fillText(line, pageSide, y, pageUsableWidth);
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
