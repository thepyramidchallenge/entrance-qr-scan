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

## Requirement Overview

| Area | Current requirement / decision | Status | Notes |
| --- | --- | --- | --- |
| Staff URL | Staff should open the root GitHub Pages URL without `/frontend/`. | Implemented | Root `index.html` serves the scanner directly. |
| Camera startup | Scanner camera turns on automatically when the page loads. | Implemented | Uses rear camera where supported through `facingMode: environment`. |
| Location selection | No registration/front-door location selection is required. | Removed | Scanner records no location field. |
| QR scan confirmation | Scanned QR data is shown before staff confirm recording. | Implemented | Staff can add optional remark or cancel. |
| Manual fallback | Staff can tap `手寫code` to manually record a candidate code. | Implemented | Manual dialog includes candidate code and optional remark. |
| Manual validation | Manual candidate code must match `Student Info` -> `Refined_QRcode`. | Implemented | Backend validates before writing to `Data`. |
| Google Sheet writes | All successful scan/manual actions append or write a mapped row into `Data`. | Implemented | Header mapping is name-based. |
| Formula-managed column | `Final_QRCode` must never be written by Apps Script. | Mandatory | Google Sheets arrayformula owns this column. |
| Staff feedback | Both confirm buttons show loading dots; success shows `已成功登記🌟`. | Implemented | Success message displays for 5 seconds. |
| Branding | Header includes company logo and `QR Code Scanner`; blue is `#14647F`. | Implemented | Other blue shades should not be introduced. |
| Performance | Manual validation and data header lookup are cached briefly. | Implemented | Cache TTL is 5 minutes. |
| Documentation | README links to this scanner-specific handover spec. | Implemented | Non-scanner project content is out of scope. |

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

## Sections And Fields

| Section | UI name / element | Type | Mandatory | Source / destination | Validation / logic | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Header | Company logo | Image | Yes | `frontend/assets/tpc-logo-header-eng.png` | Must render at root URL and `/frontend/` URL. | Alt text is `The Pyramid Challenge`. |
| Header | `QR Code Scanner` | View-only heading | Yes | Static HTML | Must remain visible. | User specifically requested this wording. |
| Scanner | Camera reader | Camera/video region | Yes | Browser camera via `html5-qrcode` | Starts on page load. Stops while dialogs are open. | Shows scan area inside `#qr-reader`. |
| Scanner | `手寫code` | Button | Yes | Frontend action | Opens manual dialog and stops scanner. | Fixed at bottom for mobile use. |
| Scan dialog | Decoded QR text | View-only text | Yes after scan | `decodedText` from QR reader | Empty decoded text cannot be confirmed. | Sent to backend as `decodedText`. |
| Scan dialog | Remark | Text input | No | `Data` -> `Remark` | No format validation. | Placeholder: `請輸入備註 (如有)`. |
| Scan dialog | Error message | View-only text | No | Frontend/backend error | Hidden when no error. | Used for scan recording errors. |
| Manual dialog | Candidate code | Textarea | Yes | `Student Info` validation; `Data` write | Trimmed in frontend; cleaned/validated in backend. | Placeholder is two lines: `請輸入考生編號` and `(e.g. 0999)`. |
| Manual dialog | Remark | Text input | No | `Data` -> `Remark` | No format validation. | Placeholder: `請輸入備註 (如有)`. |
| Manual dialog | Error message | View-only text | No | Backend validation error | Hidden when no error. | Shows `你輸入的考生編號格式錯誤` for invalid manual input. |
| Global status | Status toast | View-only text | No | Frontend state / backend success message | Hidden when empty. | Success is shown for 5 seconds. |

## Buttons And Actions

| Button | Context | Enabled when | Action | Failure behavior | Success behavior |
| --- | --- | --- | --- | --- | --- |
| `手寫code` | Scanner page | No request is processing | Stops scanner and opens manual dialog. | If scanner stop fails, error is logged in console and dialog still opens if possible. | Manual dialog appears with empty fields. |
| `取消` | Scan dialog | Dialog is open and request is not processing | Closes scan dialog, clears remark, restarts scanner. | None expected. | Returns to scanner page. |
| `確認` | Scan dialog | Dialog is open, request is not processing, decoded text exists, `WEB_APP_URL` exists | Sends JSONP request with scanned text and remark. | Shows backend/network error in scan dialog; clears processing status. | Writes row, closes dialog, restarts scanner, shows `已成功登記🌟`. |
| `取消` | Manual dialog | Dialog is open and request is not processing | Closes manual dialog, clears manual code and remark, restarts scanner. | None expected. | Returns to scanner page. |
| `確認` | Manual dialog | Dialog is open, request is not processing, manual code is non-empty, `WEB_APP_URL` exists | Sends JSONP request with manual code and remark. | Shows manual error, usually `你輸入的考生編號格式錯誤`; clears processing status. | Writes row, closes dialog, restarts scanner, shows success message. |

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

## User-Facing Text

| Context | Text | When shown |
| --- | --- | --- |
| Header title | `QR Code Scanner` | Always visible at top of scanner. |
| Manual entry button | `手寫code` | Always visible at bottom scanner action bar. |
| Cancel buttons | `取消` | Scan and manual dialogs. |
| Confirm buttons | `確認` | Scan and manual dialogs before loading state. |
| Confirm loading | `.`, `..`, `...` | Animated on the active confirm button while request is pending. |
| Processing status | `正在處理...` | After staff taps either confirm button. |
| Success status | `已成功登記🌟` | After successful scan or manual record. |
| Scan remark placeholder | `請輸入備註 (如有)` | Scan confirmation dialog. |
| Manual code placeholder line 1 | `請輸入考生編號` | Manual dialog candidate code field. |
| Manual code placeholder line 2 | `(e.g. 0999)` | Manual dialog candidate code field. |
| Manual remark placeholder | `請輸入備註 (如有)` | Manual dialog remark field. |
| Empty scan error | `沒有掃描到 QR code` | Scan confirm attempted without decoded text. |
| Empty manual error | `請輸入考生編號` | Manual confirm attempted with blank input. |
| Missing config error | `請先在 frontend/config.js 設定 Apps Script Web App URL。` | Confirm attempted without configured backend URL. |
| Invalid manual code | `你輸入的考生編號格式錯誤` | Backend cannot find the cleaned manual code in `Student Info`. |
| Backend timeout | `Apps Script backend 未有回應，請檢查網絡或部署設定。` | JSONP request exceeds 15 seconds. |
| Backend connection error | `無法連接 Apps Script backend。` | JSONP script load fails. |
| Camera startup error | `無法啟動相機：...` | Browser/camera start fails. |

## Google Sheet Schema

### Required Tabs

| Tab | Purpose | Notes |
| --- | --- | --- |
| `Data` | Append-only scanner output | Apps Script maps columns by header name. |
| `Student Info` | Manual-code validation source | `Student info` is accepted as a fallback tab name. |
| `Attendance list` | Attendance matching view | Conditional formatting is managed in Google Sheets. |

### Sheet Ownership Rules

| Sheet | Owned by | Write mode | Rules |
| --- | --- | --- | --- |
| `Data` | Apps Script + Google Sheets formulas | Apps Script writes mapped row values; Sheets owns formulas. | Keep only expected scanner columns unless intentionally extending schema. |
| `Student Info` | Operations / Google Sheet data refresh | Read-only for scanner. | Refresh records here; do not let scanner write here. |
| `Attendance list` | Operations / Google Sheet formulas and formatting | Read-only for scanner. | Conditional formatting should compare attendance QR values with scanner output. |

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

### Record Type Matrix

| Record type | `Full data` | `Scanned data` | `Name` | `Remark` | `Manual input data` |
| --- | --- | --- | --- | --- | --- |
| Scanned QR | Full decoded QR text | Parsed candidate code from decoded text | Parsed name or `NA` | Optional scan remark | Blank |
| Manual code | Cleaned manual code | Blank | `NA` | Optional manual remark | Cleaned manual code |

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

### Backend Helper Contract

| Helper / area | Responsibility | Important behavior |
| --- | --- | --- |
| `recordData` | Record a scanned QR result. | Requires decoded text, parses candidate/name, writes mapped `Data` row. |
| `recordManualCode` | Record a manual code result. | Cleans and validates manual code before writing mapped `Data` row. |
| `parseStudentInfo_` | Split scanned QR text into candidate code and name. | Expected pattern is first non-space code containing parentheses, then optional name. |
| `cleanCandidateCode_` | Normalize candidate codes for matching. | Trims, removes whitespace, normalizes hyphen variants, uppercases. |
| `candidateCodesMatch_` | Compare manual input with sheet values. | Allows exact match or manual prefix before `(` / `（`. |
| `getQrCodeLookupSheet_` | Resolve validation source sheet. | Looks for `Student Info`, then `Student info`. |
| `getHeaderColumnIndex_` | Resolve required headers by name/alias. | Normalizes headers by trimming, lowercasing, and removing spaces. |
| `ensureDataHeaders_` / `getHeaderMap_` | Maintain `Data` headers. | Adds missing expected headers and caches header map when stable. |
| `getNextWritableRow_` | Find row for the next record. | Uses `Timestamp` column, not formula-filled columns. |
| `writeMappedRows_` | Write row data efficiently. | Groups contiguous writable columns and skips `Final_QRCode`. |
| `validateApiKey_` | Optional request protection. | Enforces `SCANNER_API_KEY` only when script property exists. |

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

## Current Limitations And Future Options

| Item | Current status | Reason | Future approach |
| --- | --- | --- | --- |
| Offline scanning | Not supported | Apps Script and Google Sheets require network access. | Add local queue + retry only if staff need unstable-network support. |
| Duplicate prevention | Not enforced in frontend | Current workflow records each successful confirmation. | Add backend duplicate check against `Final_QRCode` or recent `Data` rows if duplicate prevention becomes required. |
| Admin dashboard | Out of scope | Google Sheets is the operations interface. | Build a read-only dashboard only if staff need non-Sheet reporting. |
| Location tracking | Removed | Registration/front-door split is no longer required. | Reintroduce only if operations again require separate checkpoints. |
| Direct CORS fetch | Not used | Apps Script web app CORS behavior is awkward for static hosting. | Keep JSONP unless backend moves to a CORS-friendly service. |
| Camera selection UI | Not exposed | Staff are expected to use mobile rear camera by default. | Add camera picker only if staff report wrong-camera issues. |
| Automated end-to-end test | Partial/manual | Camera and Apps Script deployment make full automation harder. | Add a mock backend mode for UI regression tests if the project grows. |

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

| Check | Expected result |
| --- | --- |
| Root URL opens | `https://thepyramidchallenge.github.io/entrance-qr-scan/` loads scanner without `/frontend/` in the visible link. |
| Frontend config | `frontend/config.js` points to the intended Apps Script deployment. |
| Backend version | Apps Script health/default response returns the expected version marker. |
| Required tabs | `Data`, `Student Info`, and `Attendance list` exist. |
| Data schema | `Data` headers match the schema and `Final_QRCode` remains formula-managed. |
| Validation source | `Student Info` has `Refined_QRcode` or a supported alias. |
| Valid manual code | Records into `Full data` and `Manual input data`; `Name` is `NA`. |
| Invalid manual code | Returns `你輸入的考生編號格式錯誤` and writes no row. |
| Scanned QR record | Parses `Scanned data` and `Name`; `Manual input data` stays blank. |
| Success feedback | `已成功登記🌟` appears for 5 seconds after scan/manual success. |
| Loading feedback | Active `確認` button shows animated dots while backend request is pending. |

## Troubleshooting

| Symptom | Likely cause | Check |
| --- | --- | --- |
| Camera does not start | Browser permission, insecure host, or unsupported camera access | Use HTTPS and allow camera permission. |
| `請先在 frontend/config.js 設定 Apps Script Web App URL。` | Missing frontend config | Set `WEB_APP_URL`. |
| `你輸入的考生編號格式錯誤` | Manual code not found in `Student Info` -> `Refined_QRcode` | Check tab name, header name, and refreshed records. |
| Missing sheet/header error | Google Sheet tabs or headers were renamed | Restore expected names or supported aliases. |
| `Final_QRCode` not filling | Sheet formula issue | Apps Script intentionally skips this column; check the arrayformula. |
| Confirm takes longer after idle | Cache expired | First request after cache expiry refreshes validation/header caches. |
