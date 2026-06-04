# Pyramid Challenge QR Scanner

Mobile-friendly QR scanner for staff check-in. The frontend is a static web app
hosted from `frontend/`, and the backend is a Google Apps Script web app in
`backend/` that writes scan/manual records into Google Sheets.

## Repository Structure

- `frontend/` - static scanner UI for GitHub Pages or any HTTPS static host.
- `backend/` - Google Apps Script project managed with clasp.

## Staff Workflow

### QR Code Scan

1. Staff open the scanner page on iPhone or Android.
2. The camera starts automatically.
3. After a QR code is scanned, staff may enter an optional remark.
4. Staff tap `確認`.
5. The frontend shows a three-dot loading animation while the record is being
   saved.
6. On success, the scanner shows `已成功登記🌟` for 5 seconds.

### Manual Code Entry

1. Staff tap `手寫code`.
2. The popup shows:
   - Candidate code input with placeholder:
     `請輸入考生編號`
     `(e.g. 0999)`
   - Optional remark input with placeholder `請輸入備註 (如有)`
   - `取消` and `確認` buttons
3. If staff tap `取消`, the popup closes and returns to the scanner.
4. If staff tap `確認`, the backend validates the input against
   `Student Info` -> `Refined_QRcode`.
5. If the code is not found, the popup shows `你輸入的考生編號格式錯誤`.
6. If the code is found, a record is written to `Data` and the scanner shows
   `已成功登記🌟` for 5 seconds.

## Google Sheet Setup

The Apps Script expects these tabs:

- `Data`
- `Student Info`
- `Attendance list`

The backend also accepts `Student info` as a fallback tab name, but the intended
tab name is `Student Info`.

### `Data` Columns

Keep these columns in `Data`:

| Column | Source | Notes |
| --- | --- | --- |
| `Timestamp` | Backend | Save time for each record. |
| `Full data` | Backend | Full scanned QR text, or manual input for manual records. |
| `Scanned data` | Backend | Parsed candidate code from scanned QR data. Blank for manual records. |
| `Name` | Backend | Parsed name from scanned QR data. Manual records use `NA`. |
| `Remark` | Frontend | Optional staff remark. |
| `Final_QRCode` | Google Sheets formula | Formula-managed. Apps Script must not write into this column. |
| `Manual input data` | Backend | Manual candidate code. Blank for scanned QR records. |

### `Student Info` Columns

Manual input validation uses the `Refined_QRcode` column under `Student Info`.
The backend also recognizes these header aliases:

- `Refined_QRcode`
- `Refined QRcode`
- `Refined QR code`
- `Refined_QRCode`

### `Attendance list`

Conditional formatting should be managed in Google Sheets. The intended behavior
is to turn the whole row green when the QR code in `Attendance list` matches the
scanner result recorded in `Data`, especially for the `QRcode` column.

## Backend Behavior

### Scanned QR Parsing

Examples:

| Full QR text | `Scanned data` | `Name` |
| --- | --- | --- |
| `P4-YPYB0101(Ⅰ-A1) 王思諭 Wong Sze Yu Angie` | `P4-YPYB0101(Ⅰ-A1)` | `王思諭 Wong Sze Yu Angie` |
| `P1-YPYA0101(1Z) 吳梓淳 Ng Tsz Shun` | `P1-YPYA0101(1Z)` | `吳梓淳 Ng Tsz Shun` |

If the parsed name is missing, `Name` is saved as `NA`.

### Manual Records

When staff enter a manual code and tap `確認`:

- The input is validated against `Student Info` -> `Refined_QRcode`.
- If not found, the backend returns `你輸入的考生編號格式錯誤`.
- If found, the backend writes a record to `Data`.

Manual record mapping:

| `Data` column | Value |
| --- | --- |
| `Timestamp` | Current time |
| `Full data` | Manual input |
| `Scanned data` | Blank |
| `Name` | `NA` |
| `Remark` | Optional remark |
| `Final_QRCode` | Not written by Apps Script |
| `Manual input data` | Manual input |

### Performance

The backend caches:

- `Student Info` -> `Refined_QRcode` values
- `Data` header mapping

The cache reduces confirmation time after the first request. Cache duration is
currently 5 minutes.

The backend finds the next writable row by checking the `Timestamp` column, so
the formula-managed `Final_QRCode` column does not make every row look occupied.

## Frontend Configuration

Copy `frontend/config.example.js` to `frontend/config.js`, then set:

```js
window.SCANNER_CONFIG = {
  WEB_APP_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  API_KEY: '',
};
```

Current deployed web app URL:

```text
https://script.google.com/macros/s/AKfycbwpImYsJwBTIncEH3T4y9qx-GKKdxUUlq873LJxBFXkpF_srfiPGHLZE9w8_wwiARc/exec
```

Optional: set the Apps Script property `SCANNER_API_KEY`. If it is set,
`frontend/config.js` must send the same `API_KEY`.

Deploy the `frontend/` folder to GitHub Pages or another HTTPS static host.
Camera access requires HTTPS on most mobile browsers.

## Apps Script Deployment

From `backend/`, use clasp:

```sh
clasp pull
clasp push -f
clasp deploy
```

If `clasp deploy` is not available for the active account, deploy a new web app
version from the Apps Script UI, then copy the deployment URL into
`frontend/config.js`.

After deployment, verify the active backend version by opening the web app URL or
checking a test request response.

## Development Checks

Useful local checks:

```sh
node --check backend/Code.js
node --check frontend/app.js
```

For frontend changes, test on a mobile-sized viewport and confirm:

- The camera starts automatically.
- The manual popup fits on the phone screen.
- Both `確認` buttons show the loading dots while saving.
- Success shows `已成功登記🌟` in blue for 5 seconds.

## Troubleshooting

### Manual Input Shows Format Error

`你輸入的考生編號格式錯誤` means the entered code was not found in
`Student Info` -> `Refined_QRcode` after normalization.

Check:

- The deployed Apps Script version is current.
- The tab is named `Student Info`.
- The validation column is named `Refined_QRcode` or one of the supported aliases.
- The code exists in the refreshed `Student Info` records.

### Missing Sheet or Header Error

Check the exact tab and column names in Google Sheets. The backend maps columns
by header name, so renamed headers must match the expected schema.

### `Final_QRCode` Is Blank

Apps Script intentionally does not write into `Final_QRCode`. Check the
arrayformula in Google Sheets.

### Confirmation Is Slow

The first request after cache expiry may be slower because the backend refreshes
`Student Info` validation data and `Data` headers. Requests are usually faster
after the cache is warm.

## Local Files

`backend/.clasp.json` is ignored because it contains local clasp project
configuration. `local-docs/` is also ignored for local-only notes.
