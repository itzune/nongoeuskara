# Nongoeuskara — Web Demo

Basque (Euskara) dialect and sub-dialect identification running entirely in
the browser using WebAssembly (fastText).

## 🌐 Website

[https://itzune.eus/nongoeuskara/](https://itzune.eus/nongoeuskara/)

## How it works

1. A 423KB WebAssembly module (fastText compiled via Emscripten) loads in the browser
2. The default model — a 12-class azpieuskalki (sub-dialect) model (~31MB) — is downloaded on page load and runs on every keystroke, highlighting the predicted zone on the map
3. Clicking the info (i) icon opens the "Emaitza xehetuak" modal, which lazy-loads two additional models (~34MB) for a full 3-tier hierarchical classification:
   - Tier 1 (binary): batua vs dialectal
   - Tier 2 (dialect): 5-class euskalkiak
   - Tier 3 (sub-dialect): 12-class azpieuskalkiak

## Model

| Model | Size | Description |
|-------|------|-------------|
| Azpieuskalki (quantized) | ~31MB | 12-class sub-dialect — the default model, loaded on page load |
| Binary (web) | ~21MB | batua vs dialectal — lazy-loaded in the details modal |
| Dialect (web) | ~13MB | 5-class euskalkiak — lazy-loaded in the details modal |
| **Total** | **~65MB** | |

The azpieuskalki model was updated (June 2026) with additional data to fix classification issues with Zuberotarra (Souletin).

Models are hosted at [itzune/zeineuski](https://huggingface.co/itzune/zeineuski).

## Development

```bash
npm install
npm run dev      # Start dev server at localhost:3000
npm run build    # Build for production
npm run preview  # Preview production build
```

The WASM binary (`fastText.common.wasm`) must be placed in `public/`:
```bash
cp node_modules/fasttext.wasm.js/dist/core/fastText.common.wasm public/
```

## Data Sources

The classification models are trained on the following datasets:

| Source | Content | Type |
|--------|---------|------|
| [Ahotsak.eus](https://ahotsak.eus/) | Oral history transcriptions from 300+ Basque municipalities (municipality → azpieuskalki mapping) | Spoken |
| [Catalog of Basque Dialects](https://github.com/hitz-zentroa/Catalog-of-Basque-Dialects) | 18th-20th century annotated dialectal texts by HitZ Zentroa | Written |
| [Klasikoak](https://klasikoak.armiarma.eus/) | Classical Basque literature (author birthplace → dialect) | Written |
| [SÜ AZIA](https://web.archive.org/web/20110920103304/http://www.suazia.com) | Zuberotarra pastoral plays + blog articles | Written |

For full details, see the [Zeineuski training data documentation](https://github.com/itzune/zeineuski#training-data-sources).

## Deployment

GitHub Actions automatically builds and deploys on every push to `main`. The site is served from the `gh-pages` branch.

You can also deploy manually:

```bash
npm run build      # Vite build → dist/
npm run deploy     # gh-pages -d dist (pushes dist/ to gh-pages branch)
```

## Related

- [Zeineuski](https://github.com/itzune/zeineuski) — Python/CLI tools, model training, evaluation
- [itzune/zeineuski](https://huggingface.co/itzune/zeineuski) — Hugging Face models
