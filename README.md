# CPA program guide

A study and program-management guide to Canada's CPA certification: the current program (CPA PEP and the Common Final Examination, ending Dec 31, 2028) and the new CPA Professional Program starting in 2027, compared across Ontario, Quebec, the West and Atlantic Canada. Compiled Nov 17, 2026 from official CPA sources; every statement carries a citation.

## What is here

| Path | What it is |
|---|---|
| `CPA-Professional-Program-Guide.html` | **Main guide.** Interactive, with note-taking. Open in Chrome or Edge on a computer. This is the file to work on. |
| `CPA-Professional-Program-Guide-Phone.html` | Reading copy for phones. No scripts; everything is written into the page. Generated from the main guide, never edited by hand. |
| `references/README.md` | Download links for the official source documents. The documents are not stored here; see that page for where to get them and where to save them. |
| `notes/` | Where each person's notes are saved when a team shares the guide from a shared drive. Only its README and marker file are in this repository; the notes themselves are never pushed. See "Sharing with a team" below. |
| `build/` | The sources both HTML files are generated from, and the build script. |
| `AUDIT-2026-11-18.md` | Record of the reference audit: what was checked, what was found, and every change made. |

## References

Every statement carries a citation code, and every citation records where in its source the statement is supported: a short locating phrase copied from the source and, for PDFs, the page number. These live in `build/evidence.js`.

- In the guide, select a citation code to see the source, the phrase and the page, with a button that opens a web source at that passage or a PDF at that page. The Sources section lists every passage cited from each source.
- In the sources (`build/body.html`, `build/data.js`), a citation is written `[[ON14:e12,W13:e13]]`: source id, colon, evidence id. The build reports any citation that has no evidence entry; there should be none.
- To check all citations against the live sources again: `python3 build/tools/check_evidence.py`. It reports any phrase that is no longer on its page and any PDF page number that has moved.

Rule for new content: no statement without a source, and no citation without a located passage. Chart labels and tooltips cannot hold a citation, so their sources go in the chart's caption.

## Sharing with a team

No server is needed, only a folder everyone can read and write (a network drive, or a folder synced by OneDrive, SharePoint or Google Drive).

1. Copy `CPA-Professional-Program-Guide.html` and the `notes/` folder to the shared folder.
2. Each person opens the guide from that folder in **Chrome or Edge on a computer**. **Everyone's notes show straight away**: reading needs no connection, no name and no permission.
3. To add notes, reply, or accept changes so that others see them, a person connects once: a prompt beside the Notes button offers **Connect**, the browser asks them to choose the folder that holds the guide (a page is never allowed to open a folder by itself), and the guide asks for the name others should see. Later visits reconnect by themselves or with one click on **Reconnect**. A note written before connecting is kept on that computer and says so; it is shared as soon as the person connects.
   - If there is no `notes` folder next to the guide, the Notes panel says so and asks whether to create it there or use one kept elsewhere.
4. Select text in the guide and choose **Note** or **Suggest wording**. Everyone's notes appear together, each marked with its author. Others can reply, resolve a note, or accept or reject a suggestion.

How it stays safe with several people: each person's browser writes only that person's own files in `notes/` (`<name>.json`, and `<name>.js`, a copy that can be read without connecting) and reads everyone else's, checking again every 20 seconds. The one shared file, `people.js`, only lists who has notes; every browser re-adds anyone missing, so it repairs itself. Nobody writes the guide itself, so replacing it with a rebuilt version loses no notes.

Accepted wording suggestions do not rewrite the guide on the spot. An accepted change stays marked in the text for everyone (original struck through, new wording with a tick) and is counted as "accepted, awaiting rebuild". **Accepted changes** in the Notes panel exports the ones still waiting; apply them to the sources in `build/`, rebuild, and replace the shared file. Once the rebuilt guide contains the new wording, the suggestion closes by itself as "now in the guide".

Limits: there is no login, so names are on trust. Safari, Firefox and phones cannot write to a folder; there, **Import** opens other people's files read-only. The guide must be opened from the drive as a file, not inside a SharePoint or Drive web page.

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
- Shared notes for a team: per-person files in `notes/`, replies, resolve, wording suggestions with accept and reject, export of accepted changes. Tested in Chrome against a simulated folder with several people; not yet tried on a real shared drive, with the browser's folder picker, or in Edge.
- Separate script-free phone copy.
- Reviewer notes (Nov 18, 2026): nine new sections answering Cylvia Tang's notes (regional check of the headline facts, entry and transcripts, full schedule, experience in detail, training providers, experience carry-over, attempts and readmission, international candidates, every published fee). Findings live in `build/research.js`; each is one sourced statement with a located passage. Replies to her notes are in `notes/guide-update.json`.
- Reference audit (Nov 18, 2026): all 1,190 citations checked against their sources, 152 statements corrected, every citation now a deep link to the passage or PDF page. See `AUDIT-2026-11-18.md`.

Not done:

- Several facts were still unpublished or inconsistent at the source; they are listed in the guide's "Open items" section.

## Sources and copyright

The guide summarizes and cites publications of the CPA bodies; it is not affiliated with or endorsed by them. Their documents are not redistributed here. `references/README.md` lists the official download address for each one, and every statement in the guide links to its source. The "local copy" links inside the guide work only after you download the documents into `references/`.
