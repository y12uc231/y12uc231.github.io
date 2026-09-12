# Satyapriya Krishna — frontier intelligence

Static research portfolio for [satyapriyakrishna.com](https://satyapriyakrishna.com), hosted with GitHub Pages.

The page opens with a small explorer walking through a rolling loss landscape, stopping to read and follow new ideas. Fifty attributed quotations rotate every seven seconds, with highlighted phrases and linked sources. Selected work rotates in groups of four, starting with TurnBench; the full publication list stays available below. Hover, keyboard focus, pause controls, reduced-motion preferences, and hidden tabs suspend the relevant motion.

## Update content

- Edit `index.html` for the introduction, news, biography, and contact information.
- Edit `data/publications.json` for the selected publications, then run `python3 scripts/build.py` to regenerate the publication section in `index.html`.
- Edit `data/quotes.json` for quotations, author/source links, and the exact phrases highlighted in each quote; the same build command renders them.
- Edit `css/portfolio.css` for the design.
- Edit `js/explorer-world.js` for the landscape and character choreography.
- The original CV, custom domain, assets, and resource page are retained.

Run `python3 -m http.server 8765 --bind 127.0.0.1` from the repository to preview locally. No package installation is required; Three.js is vendored in `js/vendor/` with its license. `python3 scripts/build.py` creates a distributable static copy in `dist/`; the tracked root `index.html` remains directly deployable by GitHub Pages.

## Content sources

The publication selection was checked against [Google Scholar](https://scholar.google.com/citations?user=Q5bfPlkAAAAJ&hl=en), then verified against the linked publisher, proceedings, or preprint pages on September 6, 2026. Publications are a curated snapshot, not a live Scholar scraper. Preprints are labeled explicitly. Venue years refer to the published version when available.

The February 2026 Sesame joining date and current voice-model work were supplied by Satya. Biography, historical news, service, and profile links come from the previous website. The updated news also includes the public [TurnBench project](https://turnbench.sesame.com/) and D-REX paper.

The private design preview uses the same source and static output, with its configuration in `.openai/hosting.json`.
