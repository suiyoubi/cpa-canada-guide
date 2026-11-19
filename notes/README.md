# Shared notes folder

This folder is where the guide keeps everyone's notes when a team shares it from a shared drive. Keep it next to `CPA-Professional-Program-Guide.html`.

- Each person gets two files named after them: `jane-doe.json` (their notes) and `jane-doe.js` (the same notes in a form the guide can show to someone who has not connected).
- `people.js` lists who has notes here, so the guide knows which files to show. Every browser adds anyone who is missing, so it repairs itself if a change is lost.
- A person's browser only ever writes that person's own file. It reads everyone else's. That is why two people can work at the same time without overwriting each other.
- Replies to someone else's note, and decisions on it (resolve, accept, reject), are stored in the file of the person who made them.
- `folder.js` is a marker: it is how the guide knows a notes folder sits next to it. Leave it in place.
- Do not edit these files by hand, and do not delete someone's file unless you mean to remove all of their notes.
- If your sync tool creates a "conflicted copy" of a file, leave it: the guide reads both copies and merges them.

Notes files are personal working material, so this repository ignores them (`notes/*.json` and `notes/*.js`). Only this page and the marker are tracked.
