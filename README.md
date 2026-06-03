# Pyramid Challenge Entrance QR Scanner

This repo separates the scanner frontend from the Google Apps Script backend.

## Structure

- `frontend/` - static QR scanner app for GitHub Pages or any HTTPS static host.
- `backend/` - Google Apps Script project connected by clasp to the legacy Sheet-bound script.

## Backend

The backend writes rows to the `Data` sheet in this order:

1. Timestamp
2. Full data
3. Scanned data
4. Name
5. Remark
6. Final_QRCode
7. Manual input data

Manual code entry is validated against the `QRcode` column in `Student info`
before the code is written to `Data`.

From `backend/`, use clasp:

```sh
clasp pull
clasp push
clasp deploy
```

After deployment, copy the Apps Script Web App URL into `frontend/config.js`.

Current Web App URL:

```text
https://script.google.com/macros/s/AKfycbwpImYsJwBTIncEH3T4y9qx-GKKdxUUlq873LJxBFXkpF_srfiPGHLZE9w8_wwiARc/exec
```

Optional: set the script property `SCANNER_API_KEY`. If it is set, the frontend must send the same `API_KEY` in `frontend/config.js`.

## Frontend

Copy `frontend/config.example.js` to `frontend/config.js`, then set:

```js
window.SCANNER_CONFIG = {
  WEB_APP_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  API_KEY: '',
};
```

Deploy the `frontend/` folder to GitHub Pages.
