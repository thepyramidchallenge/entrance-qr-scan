# Add-On Trial Web App Specification

Source reference: `Add-On Trial Planning_v1.0.xlsx`, provided on 2026-06-05.

This document records the current production specification described in the
source workbook. It is a reference spec for the Add-On Trial web app and is kept
separate from the QR scanner implementation notes.

## Production Assets

| Item | Layer | Value | Notes |
| --- | --- | --- | --- |
| Spec version | v1.0 | 2026-06-05 | Updated after the Cloud Run upload bridge was deployed. |
| Production frontend | GitHub Pages | `https://hkycaa.github.io/yc-add-on-items/` | Root of the `main` branch. |
| Google Sheet database | Google Sheet | `1ZY23Cx5PYEQ5GSc_VrXBIMnHirLhh6F0uFsUtCt2Eqo` | Uses `_CLEAN`, `PRODUCT LIST`, `WEBAPP_CONFIG`, and `RAW_ADD`. |
| Apps Script web app | Apps Script | `AKfycbzYPo_Yix46JXfEM1nXSXffo7UFO7XfPwyE4S6raf8GVmgRCKHdbt1E3ZAvU1Lwh2Hg` | Current deployed version `@15`. |
| Cloud Run upload API | Cloud Run | `https://hkycaa-add-on-upload-difkgqkl2q-df.a.run.app` | Receives multipart uploads and forwards them to Apps Script. |
| GitHub repo | GitHub | `HKYCAA/yc-add-on-items` | Source for frontend, docs, Apps Script source, and Cloud Run service source. |

## Component Ownership

| Layer | Primary responsibility | Owned functions | Not owned / avoid |
| --- | --- | --- | --- |
| Google Sheet | Database and editable operations config | Frontline/admin users maintain source data and product/config values. | Does not host UI, perform private validation logic, or handle multipart upload. |
| Apps Script | Backend authority and Sheet/Drive writer | Validates lookup, creates lookupToken, returns products/config, submits `RAW_ADD`, receives upload bridge file, creates Drive file. | Does not render frontend or receive browser multipart directly. |
| Cloud Run | Upload transport bridge | Receives browser multipart file, enforces max size, forwards base64 file server-to-server to Apps Script. | Does not own contestant validation, final submission, cart logic, or Drive file ownership. |
| GitHub Pages | Frontend application hosting | Guided form, validation UI, cart calculation, Apps Script calls, Cloud Run upload call, summary page. | Does not store records or trusted source data. |
| Google Drive | Payment slip file storage | Stores uploaded payment slips created by Apps Script as `info@hkycaa.org`. | Does not hold structured submission data. |

## End-To-End Workflow

| Step | Primary layer | Reads from | Writes to | Notes |
| --- | --- | --- | --- | --- |
| Load form | GitHub Pages | Apps Script config API, `WEBAPP_CONFIG` | Browser DOM | Fetches title, intro, and competition photo URL. Falls back to defaults. |
| Result lookup | Apps Script | `_CLEAN` | `lookupToken` in CacheService | User enters name, YOB, and entry number. Apps Script validates identity and returns public fields. |
| Candidate verification | GitHub Pages | Lookup response | UI only | Displays contestant, award, and existing purchase fields. No write yet. |
| Product listing | Apps Script + Google Sheet | `PRODUCT LIST` | Frontend product map/cart | Product status, price, and description come from Sheet; frontend calculates cart line totals. |
| Payment details | GitHub Pages | Cart total | UI state only | Payment method/payee required only if total payable is greater than HK$0. |
| Payment slip upload | Cloud Run + Apps Script | Browser file input | Google Drive file and metadata | Frontend uploads JPG/PNG/PDF/HEIC to Cloud Run; Cloud Run forwards to Apps Script; Apps Script writes Drive file. |
| Final submit | Apps Script | `lookupToken`, cart, contact info, payment metadata | `RAW_ADD` row | Apps Script validates token and appends a submission row. |
| Summary page | GitHub Pages | Submit response and submitted payload | UI only | Shows success, submission ID, purchased items, total, and optional payment metadata. |

## Form Section Map

| Section | Owning layers | Source / storage | Fields / outputs | Notes |
| --- | --- | --- | --- | --- |
| Section 0 Header | Google Sheet + GitHub Pages | `WEBAPP_CONFIG` | `competitionName`, `formTitle`, `formIntro`, `competitionPhotoUrl` | Google Sheet controls content shown above the form. |
| Section 1 Result Check | GitHub Pages + Apps Script | `_CLEAN` | Name, YOB, entry number, confirm button | Frontend validates required fields; Apps Script is the source of truth. |
| Section 2 Candidate Verification | Apps Script + GitHub Pages | `_CLEAN` public fields | Candidate display/update fields | Shows candidate data, purchase history, and contact correction fields. |
| Section 3 Add-On Items | Google Sheet + GitHub Pages | `PRODUCT LIST` | Cart items and total payable | Prices/status from Sheet; calculation in frontend. |
| Section 4 Payment Upload | GitHub Pages + Cloud Run + Apps Script | File input, payment method, payee name | Drive file metadata | Visible and required only when total payable is greater than HK$0. |
| Section 5 Submission | GitHub Pages + Apps Script | Visible fields, cart, upload metadata, lookupToken | `RAW_ADD` | Shows validation popup for incomplete mandatory fields. |
| Section 6 Summary | GitHub Pages | Submit response | UI only | Supports another-winner flow and editing submitted data. |

## Data Stores

| Store | Platform | Data type | Used by | Key fields | Rules |
| --- | --- | --- | --- | --- | --- |
| `_CLEAN` | Google Sheet | Input/source data | Apps Script lookup and Section 2 display | `IND_CODE`, `NAME_CHI`, `NAME_EN`, `YOB`, award fields, purchase totals | Do not write form submissions here. |
| `PRODUCT LIST` | Google Sheet | Admin config | Apps Script products API, frontend product cards/cart | Product code, name, description, photo, shelfStatus, price | `OFF` hides product/variant; `GREY OUT` disables. |
| `WEBAPP_CONFIG` | Google Sheet | Admin config | Apps Script config API and Section 0 | `competitionName`, `formTitle`, `formIntro`, `competitionPhotoUrl` | Use blank or valid HTTPS URL; `NA` is treated as empty in frontend. |
| `RAW_ADD` | Google Sheet | Submission log | Apps Script submit action | Timestamp, SubmissionId, PreviousSubmissionId, contact/payment/cart columns, payment metadata | Each submit appends a row; edits also append a new row. |
| Drive upload folder | Google Drive | File storage | Apps Script upload bridge | Payment slip files and Drive URLs | File metadata is copied to `RAW_ADD`. |

## API Map

| Service | Method | Endpoint / action | Caller | Purpose |
| --- | --- | --- | --- | --- |
| Apps Script | GET | `action=config` | GitHub Pages | Reads `WEBAPP_CONFIG` and returns Section 0 content. |
| Apps Script | GET | `action=lookup` | GitHub Pages | Validates entry number/name/YOB against `_CLEAN` and creates `lookupToken`. |
| Apps Script | GET | `action=products` | GitHub Pages | Returns `PRODUCT LIST` rows for Section 3. |
| Apps Script | POST/GET | `action=submit` | GitHub Pages | Validates `lookupToken` and appends `RAW_ADD` row. |
| Apps Script | POST | `action=uploadPaymentSlip` | Cloud Run | Receives base64 file from Cloud Run and creates Drive file. |
| Cloud Run | GET | `/health` | Ops / frontend checks | Reports service health and upload bridge config. |
| Cloud Run | POST | `/upload` | GitHub Pages | Receives multipart file and returns Drive metadata from Apps Script bridge. |

## Operational Rules

- Do not edit original Apps Script files `Code.gs`, `Code v2.gs`, or `Code add.gs`; add-on web app code lives in `AddonTrialWebApp.gs`.
- Keep frontend copies in sync. Root files are the GitHub Pages source; `frontend/` is a synced source copy.
- Cloud Run exists because it can receive browser multipart uploads; Apps Script writes Drive files because service accounts have no ordinary My Drive storage quota.
- Update the query string in `index.html` when `app.js` or `styles.css` changes for GitHub Pages cache busting.
- `lookupToken` is stored in CacheService for one hour and is never written to `RAW_ADD`.
- Editing submitted data appends a new `RAW_ADD` row with `PreviousSubmissionId`; existing rows are not overwritten.
- For upload testing, use `/health` and a small multipart POST, then remove `TEST_UPLOAD` files from Drive after testing.

## Maintenance Checklist

- Confirm Apps Script deployed version matches the documented production version.
- Confirm Google Sheet tabs and key columns still match this spec after operational changes.
- Confirm Cloud Run `/health` succeeds before testing uploads.
- Confirm GitHub Pages cache-busting query strings are updated after frontend asset changes.
- Confirm payment-slip metadata is present in `RAW_ADD` after a paid test submission.
