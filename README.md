# Humanly AI

Humanly AI is a browser-based notebook page composer. Upload photos of notebook paper, type or paste content, preview the rendered pages, and export them as a multi-page PDF.

## Features

- Upload one or more notebook page images (JPG, PNG, or WEBP).
- Upload an already-written page as a visual reference.
- Estimate the reference page's dominant ink colour and a rough stroke slant locally in the browser.
- Choose from built-in handwriting-style fonts or use the sample-inspired approximation.
- Adjust writing size, line spacing, ink colour, and margins.
- Automatically estimate notebook ruling and a red left margin when the image makes that possible.
- Preview generated pages and navigate between them.
- Export the generated pages to a PDF.
- Reset the workspace at any time.
- No account or application backend is required; uploaded images and text are processed in the browser.

## Run locally

This is a static website. Open `index.html` in a modern browser, or serve the folder with a local static server.

For example, with Python installed:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

## Deploy to Vercel

Import this GitHub repository into Vercel and use the default static-site settings. The root directory should contain `index.html`; no build command is required. Vercel should serve the static files and deploy on pushes to the connected branch.

## Important limitation

The uploaded handwriting reference is **not** used to train a model or recreate every individual letter. The current implementation estimates a few visible traits (such as ink colour and approximate slant) and applies them to a built-in handwriting font. The output is therefore a style-inspired approximation, not an exact clone of a person's handwriting.

True personalized handwriting synthesis would require integrating a suitable handwriting-generation model, with its own runtime, licensing, hosting, and privacy considerations. Do not advertise the current browser-only feature as exact handwriting replication.

## Privacy

The reference image, notebook images, and typed content are processed in the browser and are not sent to a Humanly backend. The page loads web fonts and the jsPDF library from third-party CDNs, so those providers may receive normal network metadata when the page loads. No uploaded image is intentionally sent to those CDNs.

## Supported formats and limits

- Input images: JPG/JPEG, PNG, WEBP.
- Maximum upload size: 10 MB per image.
- Output: multi-page PDF.
- Very long documents are capped to avoid browser memory exhaustion; split extremely large content into smaller exports.
