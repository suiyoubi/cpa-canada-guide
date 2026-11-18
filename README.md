# CPA program guide

A study and program-management guide to Canada's CPA certification: the current program (CPA PEP and the Common Final Examination, ending Dec 31, 2028) and the new CPA Professional Program starting in 2027, compared across Ontario, Quebec, the West and Atlantic Canada. Compiled Nov 17, 2026 from official CPA sources; every statement carries a citation.

## What is here

| Path | What it is |
|---|---|
| `CPA-Professional-Program-Guide.html` | **Main guide.** Interactive, with note-taking. Open in Chrome or Edge on a computer. This is the file to work on. |
| `CPA-Professional-Program-Guide-Phone.html` | Reading copy for phones. No scripts; everything is written into the page. Generated from the main guide, never edited by hand. |
| `references/README.md` | Download links for the official source documents. The documents are not stored here; see that page for where to get them and where to save them. |
| `build/` | The sources both HTML files are generated from, and the build script. |

## Rebuilding

Both HTML files are generated; edit the sources in `build/`, not the HTML.

```bash
python3 build/build.py build CPA-Professional-Program-Guide.html
```

- `body.html` holds the page text, `data.js` the facts and source list, `app.js` the charts and tables, `notes.js` the note-taking feature, `style.css` the design.
- Notes already saved into the main guide are carried over by the build.
- The phone copy is baked from `build/prerender.json`, a capture of the rendered page. If `body.html`, `data.js` or `app.js` changed, the build reports the capture as stale and does not write the phone copy. To refresh it:
  1. `python3 build/tools/serve.py . build/prerender.json 8765`
  2. open `http://localhost:8765/CPA-Professional-Program-Guide.html` in Chrome and run `build/tools/capture.js` in the console
  3. run the build again

## Status (Nov 18, 2026)

Done:

- Part A, current program; Part B, new program; transition rules, pathway finder, planning notes, old-versus-new comparison, open items, 140 cited sources.
- "Universities" sections for both programs: what a university can deliver by region, programs with links, generic example pathways.
- Note-taking in the main guide (notes stored in the browser and saved into the file).
- Separate script-free phone copy.

Not done:

- **Shared notes for a team.** Designed, not built: the guide stays read-only on a shared drive and each person's notes and wording suggestions go into their own file in a `notes/` folder, merged by the page on load. Needs Chrome or Edge on a computer.
- Several facts were still unpublished or inconsistent at the source; they are listed in the guide's "Open items" section.

## Sources and copyright

The guide summarizes and cites publications of the CPA bodies; it is not affiliated with or endorsed by them. Their documents are not redistributed here. `references/README.md` lists the official download address for each one, and every statement in the guide links to its source. The "local copy" links inside the guide work only after you download the documents into `references/`.
