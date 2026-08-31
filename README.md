# ClothesTracker

A mobile-first website for tracking how often you wear **pants**, **shorts**, and **sweaters & hoodies**. Each piece stores wears since the last wash (this one resets) and a lifetime total (this one does not).

**Live app:** [https://nicolaspenam.github.io/ClothesTracker/](https://nicolaspenam.github.io/ClothesTracker/)

> Enable GitHub Pages after merging: **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**. The link above will work once Pages is on. A `.nojekyll` file is included so GitHub serves the app as-is.

## What it does

- Add a clothing item with a name, type, and optional first-used date
- Tap **Today** while adding to fill in the current day
- **+1** / **−1** wears since wash (for typos). Lifetime total moves with those buttons
- **Washed** sets wears-since-wash back to 0 and leaves the lifetime total alone
- Import and export a Google Sheets-friendly CSV (download, copy, paste, or share on Android)
- Works offline after the first visit, and can be installed on Android as an app

Everything is stored in this browser on this device. Export a CSV if you want a backup or a spreadsheet.

## Install on Android

1. Open the live app in Chrome
2. Tap the browser menu (⋮)
3. Choose **Install app** or **Add to Home screen**
4. Open **Clothes** from your home screen — it runs full-screen

If Chrome shows an install banner in the app, you can use that too.

## Google Sheets import / export

CSV columns:

| Name | Type | First Used | Uses Since Wash | Total Uses | Id |
| --- | --- | --- | --- | --- | --- |
| Navy chinos | Pants | 2026-03-12 | 3 | 47 | _(optional)_ |

**Type** must be `Pants`, `Shorts`, or `Sweaters & Hoodies`. Hoodie/sweater aliases are accepted on import. **First Used** is optional; `YYYY-MM-DD` is best. The **Id** column is optional and keeps the same item when you merge an export back in.

**Export to Sheets**

1. In the app, open **Import / Export**
2. **Download CSV** or **Copy CSV**
3. In Google Sheets: **File → Import**, or paste into cell A1

**Import from Sheets**

1. **File → Download → Comma Separated Values (.csv)**, or select the table and copy it
2. In the app, choose the file or paste into the import box
3. Pick **Replace everything** or **Update matching Ids, add the rest**
4. Import

A starter spreadsheet is in [`sample-wardrobe.csv`](sample-wardrobe.csv).

## Run locally

The app is static files. Use any local server (needed for the installable / offline bits):

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080

```bash
npm test
```

## Privacy

No account and no server. Data stays in `localStorage` until you clear site data or import a replacement CSV.
