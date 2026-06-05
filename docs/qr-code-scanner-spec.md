# QR Code Scanner Specification

Spec date: 2026-06-05

This document wraps up the current production behavior of the Pyramid Challenge
QR Code Scanner. It is written as the handover reference for future maintenance
of the scanner frontend, Apps Script backend, and Google Sheet schema.

## Production Assets

| Item | Layer | Value | Notes |
| --- | --- | --- | --- |
| Scanner frontend | GitHub Pages / static hosting | `https://thepyramidchallenge.github.io/entrance-qr-scan/` | Root `index.html` serves the scanner directly. |
| GitHub repo | GitHub | `thepyramidchallenge/entrance-qr-scan` | Source for scanner frontend, Apps Script source, and docs. |
| Apps Script web app | Apps Script | `https://script.google.com/macros/s/AKfycbwpImYsJwBTIncEH3T4y9qx-GKKdxUUlq873LJxBFXkpF_srfiPGHLZE9w8_wwiARc/exec` | Configured in `frontend/config.js`. |
| Apps Script version marker | Apps Script | `2026-06-03-data-schema-v8` | Returned by backend responses. |
| Google Sheet database | Google Sheet | `1MWlGS3gMx0Ahfl1iFDSyL7ajRH0zaz5xIRPKwqMfIck` | Contains `Data`, `Student Info`, and `Attendance list`. |
| Scanner library | Browser dependency | `html5-qrcode@2.3.8` | Loaded from unpkg in root `index.html` and `frontend/index.html`. |
| Brand color | UI | `#14647F` | Header, primary buttons, focus rings, and success accents use this blue. |

## Component Ownership

| Layer | Primary responsibility | Owned functions | Not owned / avoid |
| --- | --- | --- | --- |
| GitHub Pages / static host | Staff-facing mobile scanner UI | Camera startup, scan dialog, manual input dialog, loading states, success/error display, JSONP calls to Apps Script. | Does not validate manual codes against master data and does not write directly to Google Sheets. |
| Apps Script | Backend authority and Sheet writer | Parses scanned QR content, validates manual input, maps records to `Data`, skips formula-managed columns, returns JSON/JSONP responses. | Does not render the UI and does not manage conditional formatting directly during normal scans. |
| Google Sheet | Operational database and formula layer | Stores student reference data, scan/manual records, formula-managed `Final_QRCode`, and attendance matching logic. | Should not rely on frontend-only validation for manual input. |
| Staff mobile browser | Capture device | Grants camera permission and scans QR codes with rear camera where possible. | Should not be treated as a trusted data store. |

## Frontend Workflow

| Step | Trigger | Frontend behavior | Backend call | Result |
| --- | --- | --- | --- | --- |
| Page load | Staff open scanner URL | Camera starts automatically; no location selection is shown. | None | Scanner is ready for QR capture. |
| QR detected | `html5-qrcode` scan success | Camera stops; confirmation dialog opens with decoded text and optional remark field. | None yet | Staff can cancel or confirm. |
| Scan cancel | Staff taps `取消` | Dialog closes, remark is cleared, camera restarts. | None | Back to scanner page. |
| Scan confirm | Staff taps `確認` after scan | Confirm button is disabled and shows animated three dots; status shows `正在處理...`. | JSONP request with `decodedText`, `remark`, and optional `key`. | On success, dialog closes, camera restarts, and `已成功登記🌟` shows for 5 seconds. |
| Manual open | Staff taps `手寫code` | Camera stops; manual dialog opens. | None yet | Staff can enter candidate code and optional remark. |
| Manual cancel | Staff taps `取消` | Dialog closes, fields are cleared, camera restarts. | None | Back to scanner page. |
| Manual confirm | Staff taps `確認` in manual dialog | Confirm button is disabled and shows animated three dots; status shows `正在處理...`. | JSONP request with `manualCode`, `remark`, and optional `key`. | Backend validates code. Success records the row; failure shows `你輸入的考生編號格式錯誤`. |

## UI Specification

| Area | Current behavior |
| --- | --- |
| Header | Shows The Pyramid Challenge logo and the text `QR Code Scanner`. |
| Header/button color | Uses `#14647F` as the only brand blue. Shadows and outlines may use the same RGB value with opacity. |
| Logo sizing | Logo is displayed at 130% of the original CSS size: mobile `min(468px, 94vw)`, desktop `min(598px, 78vw)`. |
| Scanner panel | Large camera area with rounded panel styling optimized for iPhone and Android staff use. |
| Bottom action | Fixed bottom `手寫code` button for manual candidate code entry. |
| Scan remark placeholder | `請輸入備註 (如有)` |
| Manual code placeholder | Two-line placeholder: `請輸入考生編號` and `(e.g. 0999)` |
| Manual remark placeholder | `請輸入備註 (如有)` |
| Loading state | Both scan-confirm and manual-confirm buttons show animated dots while request is pending. |
| Success state | `已成功登記🌟` appears at the bottom for 5 seconds in brand blue. |
| Error state | Manual validation failure shows `你輸入的考生編號格式錯誤`. |

## Google Sheet Schema

### Required Tabs

| Tab | Purpose | Notes |
| --- | --- | --- |
| `Data` | Append-only scanner output | Apps Script maps columns by header name. |
| `Student Info` | Manual-code validation source | `Student info` is accepted as a fallback tab name. |
| `Attendance list` | Attendance matching view | Conditional formatting is managed in Google Sheets. |

### `Data` Columns

| Column | Written by Apps Script | Source value | Notes |
| --- | --- | --- | --- |
| `Timestamp` | Yes | Current backend time | Used to find the next writable row. |
| `Full data` | Yes | Full scanned QR text or manual input | Manual records store the manual code here. |
| `Scanned data` | Yes | Parsed candidate code from scanned QR | Blank for manual records. |
| `Name` | Yes | Parsed name from scanned QR | Manual records use `NA`; parsed missing names use `NA`. |
| `Remark` | Yes | Optional staff remark | Comes from scan or manual dialog. |
| `Final_QRCode` | No | Google Sheets arrayformula | Apps Script must never write into this column. |
| `Manual input data` | Yes | Manual candidate code | Blank for scanned QR records. |

### `Student Info` Validation Columns

Manual input is validated against `Student Info` -> `Refined_QRcode`.

Supported header aliases:

- `Refined_QRcode`
- `Refined QRcode`
- `Refined QR code`
- `Refined_QRCode`

### `Attendance list`

Attendance highlighting should be handled by Google Sheets conditional
formatting. The intended rule is to turn the whole row green when the QR code in
`Attendance list` matches scanner output in `Data`, especially the `QRcode`
column.

## Backend API Map

| Entry point | Request | Caller | Behavior |
| --- | --- | --- | --- |
| `doGet` health/default | No `callback`, no scanner payload | Browser/manual test | Returns JSON with service name, version, spreadsheet ID, and `Data` sheet name. |
| `doGet` scan JSONP | `callback`, `decodedText`, optional `remark`, optional `key` | Frontend scan confirm | Records scanned QR data and returns JavaScript callback response. |
| `doGet` manual JSONP | `callback`, `manualCode`, optional `remark`, optional `key` | Frontend manual confirm | Validates manual code, records data if valid, returns JavaScript callback response. |
| `doPost` JSON/form | `decodedText` or `manualCode`, optional `remark`, optional `key` | Direct integrations/tests | Same record behavior as JSONP, returned as JSON. |

Optional security: if Apps Script property `SCANNER_API_KEY` is set, frontend
`API_KEY` must match it.

## Parsing And Validation

### Scanned QR Parsing

The backend parses scanned QR text with this shape:

```text
P4-YPYB0101(Ⅰ-A1) 王思諭 Wong Sze Yu Angie
```

Output:

| Field | Value |
| --- | --- |
| `Full data` | `P4-YPYB0101(Ⅰ-A1) 王思諭 Wong Sze Yu Angie` |
| `Scanned data` | `P4-YPYB0101(Ⅰ-A1)` |
| `Name` | `王思諭 Wong Sze Yu Angie` |

If the name part is missing, `Name` is saved as `NA`. If the QR text does not
match the expected pattern, the full text is still saved as `Scanned data` and
`Name` is saved as `NA`.

### Manual Code Validation

Manual input is cleaned before validation:

- Trim leading/trailing spaces.
- Remove internal whitespace.
- Normalize hyphen variants to `-`.
- Convert to uppercase.

The cleaned manual input is valid when it matches a cleaned
`Student Info` -> `Refined_QRcode` value exactly, or when the sheet value starts
with the manual input followed by `(` or `（`.

Manual record mapping:

| `Data` column | Value |
| --- | --- |
| `Timestamp` | Current backend time |
| `Full data` | Cleaned manual code |
| `Scanned data` | Blank |
| `Name` | `NA` |
| `Remark` | Optional manual remark |
| `Final_QRCode` | Not written |
| `Manual input data` | Cleaned manual code |

## Performance Decisions

| Decision | Details |
| --- | --- |
| JSONP transport | Used by the frontend to avoid CORS friction with Apps Script web apps. |
| Request timeout | Frontend JSONP timeout is 15 seconds. |
| Button loading state | Staff see animated dots immediately after tapping `確認`. |
| Cache `Refined_QRcode` | Apps Script caches cleaned validation codes for 5 minutes when payload size is under 90,000 characters. |
| Cache `Data` headers | Apps Script caches the header map for 5 minutes when no new header is added. |
| Timestamp-based next row | Apps Script finds the next writable row from `Timestamp`, so formulas in `Final_QRCode` do not make blank rows appear occupied. |
| Grouped writes | Apps Script writes contiguous column groups and skips formula-managed headers. |

## Deployment Notes

### Frontend

`frontend/config.js` must contain:

```js
window.SCANNER_CONFIG = {
  WEB_APP_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  API_KEY: '',
};
```

Camera access requires HTTPS. GitHub Pages or another HTTPS static host is
expected.

The staff-facing GitHub Pages URL is:

```text
https://thepyramidchallenge.github.io/entrance-qr-scan/
```

### Apps Script

From `backend/`:

```sh
clasp pull
clasp push -f
clasp deploy
```

If deployment is done in the Apps Script UI, deploy a new web app version after
`clasp push -f`, then keep `frontend/config.js` pointed at the active web app
URL.

## Maintenance Checklist

- Confirm `frontend/config.js` points to the intended Apps Script deployment.
- Confirm the deployed backend version marker is current.
- Confirm `Data`, `Student Info`, and `Attendance list` tabs exist.
- Confirm `Data` headers match the schema and `Final_QRCode` remains formula-managed.
- Confirm `Student Info` has `Refined_QRcode` or a supported alias.
- Confirm a valid manual code records into `Full data` and `Manual input data`.
- Confirm an invalid manual code returns `你輸入的考生編號格式錯誤`.
- Confirm a scanned QR record parses `Scanned data` and `Name`.
- Confirm the success message appears for 5 seconds after scan/manual success.

## Troubleshooting

| Symptom | Likely cause | Check |
| --- | --- | --- |
| Camera does not start | Browser permission, insecure host, or unsupported camera access | Use HTTPS and allow camera permission. |
| `請先在 frontend/config.js 設定 Apps Script Web App URL。` | Missing frontend config | Set `WEB_APP_URL`. |
| `你輸入的考生編號格式錯誤` | Manual code not found in `Student Info` -> `Refined_QRcode` | Check tab name, header name, and refreshed records. |
| Missing sheet/header error | Google Sheet tabs or headers were renamed | Restore expected names or supported aliases. |
| `Final_QRCode` not filling | Sheet formula issue | Apps Script intentionally skips this column; check the arrayformula. |
| Confirm takes longer after idle | Cache expired | First request after cache expiry refreshes validation/header caches. |
