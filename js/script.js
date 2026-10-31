
// ========================================
// HUMANLY AI
// Frontend Interactions
// ========================================

// Get HTML elements

const paperUpload = document.getElementById("paperUpload");
const uploadBox = document.getElementById("uploadBox");

const contentInput = document.getElementById("contentInput");
const wordCount = document.getElementById("wordCount");

const fontSelector = document.getElementById("fontSelector");
const fontSize = document.getElementById("fontSize");
const fontSizeValue = document.getElementById("fontSizeValue");

const generateBtn = document.getElementById("generateBtn");

const emptyState = document.getElementById("emptyState");
const paperPreview = document.getElementById("paperPreview");
const paperImage = document.getElementById("paperImage");
const renderedText = document.getElementById("renderedText");

const previewStatus = document.getElementById("previewStatus");
const pageInfo = document.getElementById("pageInfo");
const downloadBtn = document.getElementById("downloadBtn");


// Store the selected image

let selectedImageURL = null;


// ========================================
// 1. Count Words
// ========================================

contentInput.addEventListener("input", () => {

    const text = contentInput.value.trim();

    const words = text
        ? text.split(/\s+/).length
        : 0;

    wordCount.textContent =
        `${words} ${words === 1 ? "word" : "words"}`;

});


// ========================================
// 2. Upload Notebook Page
// ========================================

paperUpload.addEventListener("change", () => {

    const file = paperUpload.files[0];

    if (!file) {
        return;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {

        alert("Please upload a JPG, PNG, or WEBP image.");

        paperUpload.value = "";

        return;
    }

    if (file.size > 10 * 1024 * 1024) {

        alert("Please upload an image smaller than 10 MB.");

        paperUpload.value = "";

        return;
    }

    if (selectedImageURL) {
        URL.revokeObjectURL(selectedImageURL);
    }

    selectedImageURL = URL.createObjectURL(file);

    paperImage.src = selectedImageURL;
    paperImage.hidden = false;

    uploadBox.querySelector("h3").textContent = file.name;

    uploadBox.querySelector("p").textContent =
        "Notebook page uploaded successfully";

    pageInfo.textContent = "Notebook page uploaded";

    updatePreview();

});


// ========================================
// 3. Update Font Size
// ========================================

fontSize.addEventListener("input", () => {

    fontSizeValue.textContent =
        `${fontSize.value} px`;

    renderedText.style.fontSize =
        `${fontSize.value}px`;

});


// ========================================
// 4. Update Handwriting Style
// ========================================

fontSelector.addEventListener("change", () => {

    updateFontStyle();

});


function updateFontStyle() {

    renderedText.classList.remove(
        "font-cursive",
        "font-casual",
        "font-neat"
    );

    const selectedStyle = fontSelector.value;

    if (selectedStyle === "cursive") {

        renderedText.classList.add("font-cursive");

    } else if (selectedStyle === "casual") {

        renderedText.classList.add("font-casual");

    } else if (selectedStyle === "neat") {

        renderedText.classList.add("font-neat");

    }

}


// ========================================
// 5. Generate Preview
// ========================================

generateBtn.addEventListener("click", () => {

    const content = contentInput.value.trim();

    if (!selectedImageURL) {

        alert("Please upload a notebook page first.");

        return;
    }

    if (!content) {

        alert("Please enter the content you want to preview.");

        return;
    }

    updatePreview();

});


function updatePreview() {

    const content = contentInput.value.trim();

    if (!selectedImageURL || !content) {
        return;
    }

    renderedText.textContent = content;

    renderedText.style.fontSize =
        `${fontSize.value}px`;

    updateFontStyle();

    emptyState.style.display = "none";
    paperPreview.style.display = "block";

    previewStatus.textContent = "Preview ready";

    downloadBtn.disabled = false;

}


// ========================================
// 6. Export PDF
// ========================================

downloadBtn.addEventListener("click", async () => {

    if (!selectedImageURL || !contentInput.value.trim()) {
        return;
    }

    downloadBtn.disabled = true;

    const originalLabel = downloadBtn.textContent;

    downloadBtn.textContent = "Preparing PDF...";

    try {

        const { jsPDF } = window.jspdf;

        if (!jsPDF) {
            throw new Error("PDF library did not load.");
        }

        const image = new Image();

        image.src = selectedImageURL;

        await new Promise((resolve, reject) => {

            image.onload = resolve;

            image.onerror = () => {
                reject(new Error("Could not load the notebook image."));
            };

        });

        // Match the PDF page to the uploaded image proportions.

        const pageWidth = image.naturalWidth;
        const pageHeight = image.naturalHeight;

        const orientation =
            pageWidth > pageHeight ? "landscape" : "portrait";

        const pdf = new jsPDF({
            orientation,
            unit: "px",
            format: [pageWidth, pageHeight],
            hotfixes: ["px_scaling"]
        });

        // Place the uploaded notebook page in the PDF.

        pdf.addImage(
            image,
            "JPEG",
            0,
            0,
            pageWidth,
            pageHeight
        );

        // Render the text using the selected handwriting font.
        // The browser canvas uses the same fonts as the preview.

        await document.fonts.ready;

        const canvas = document.createElement("canvas");

        const context = canvas.getContext("2d");

        const scale = 2;

        canvas.width = pageWidth * scale;
        canvas.height = pageHeight * scale;

        context.scale(scale, scale);

        context.font =
            `${fontSize.value}px ${getCanvasFontFamily()}`;

        context.fillStyle = "#202020";

        context.textBaseline = "top";

        const horizontalPadding = pageWidth * 0.08;
        const topPadding = pageHeight * 0.08;

        const maxTextWidth =
            pageWidth - horizontalPadding * 2;

        const lineHeight =
            Number(fontSize.value) * 1.8;

        const lines = wrapText(
            context,
            contentInput.value.trim(),
            maxTextWidth
        );

        lines.forEach((line, index) => {

            context.fillText(
                line,
                horizontalPadding,
                topPadding + index * lineHeight
            );

        });

        const textImage = canvas.toDataURL("image/png");

        pdf.addImage(
            textImage,
            "PNG",
            0,
            0,
            pageWidth,
            pageHeight
        );

        pdf.save("humanly-ai-preview.pdf");

    } catch (error) {

        console.error(error);

        alert(
            "PDF export failed. Please check your internet connection and try again."
        );

    } finally {

        downloadBtn.disabled = false;

        downloadBtn.textContent = originalLabel;

    }

});


// ========================================
// 7. Select Canvas Font
// ========================================

function getCanvasFontFamily() {

    const selectedStyle = fontSelector.value;

    if (selectedStyle === "casual") {
        return '"Patrick Hand"';
    }

    if (selectedStyle === "neat") {
        return '"Kalam"';
    }

    return '"Caveat"';

}


// ========================================
// 8. Wrap Long Text
// ========================================

function wrapText(context, text, maxWidth) {

    const paragraphs = text.split("\n");

    const lines = [];

    paragraphs.forEach((paragraph) => {

        if (paragraph.trim() === "") {

            lines.push("");

            return;
        }

        const words = paragraph.split(/\s+/);

        let currentLine = "";

        words.forEach((word) => {

            const testLine = currentLine
                ? `${currentLine} ${word}`
                : word;

            const width =
                context.measureText(testLine).width;

            if (width > maxWidth && currentLine) {

                lines.push(currentLine);

                currentLine = word;

            } else {

                currentLine = testLine;

            }

        });

        if (currentLine) {
            lines.push(currentLine);
        }

    });

    return lines;

}


// ========================================
// 9. Load Default Font
// ========================================

updateFontStyle();

console.log("HUMANLY AI frontend initialized.");
