const config = window.SCANNER_CONFIG || {};
const locationView = document.getElementById('location-view');
const scannerView = document.getElementById('scanner-view');
const backButton = document.getElementById('back-button');
const currentLocation = document.getElementById('current-location');
const confirmDialog = document.getElementById('confirm-dialog');
const decodedTextElement = document.getElementById('decoded-text');
const remarkInput = document.getElementById('remark');
const dialogError = document.getElementById('error-message');
const scannerError = document.getElementById('scanner-error');
const statusMessage = document.getElementById('status');
const cancelButton = document.getElementById('cancel-button');
const confirmButton = document.getElementById('confirm-button');

let lastDecodedText = '';
let lastLocation = '';
let isProcessing = false;
let html5QrCode = null;
let isScannerStarting = false;

document.querySelectorAll('[data-location]').forEach((button) => {
  button.addEventListener('click', () => selectLocation(button.dataset.location));
});

backButton.addEventListener('click', goBack);
cancelButton.addEventListener('click', cancelScan);
confirmButton.addEventListener('click', confirmScan);

function selectLocation(location) {
  lastLocation = location;
  locationView.hidden = true;
  scannerView.hidden = false;
  backButton.classList.add('is-visible');
  currentLocation.textContent = `你現在處於：${lastLocation}`;
  startScanning();
}

async function goBack() {
  await stopScanning();
  scannerView.hidden = true;
  locationView.hidden = false;
  confirmDialog.hidden = true;
  backButton.classList.remove('is-visible');
  currentLocation.textContent = '';
  setStatus('');
}

function startScanning() {
  if (isScannerStarting || (html5QrCode && html5QrCode.isScanning)) {
    return;
  }

  setStatus('');
  setError('');

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode('qr-reader');
  }

  isScannerStarting = true;
  const qrboxSize = Math.min(window.innerWidth * 0.8, 520);

  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: qrboxSize, height: qrboxSize } },
    onScanSuccess,
    () => {}
  ).catch((error) => {
    setError(`無法啟動相機：${error && error.message ? error.message : error}`);
  }).finally(() => {
    isScannerStarting = false;
  });
}

async function onScanSuccess(decodedText) {
  lastDecodedText = decodedText;
  decodedTextElement.textContent = decodedText;
  confirmDialog.hidden = false;
  backButton.classList.remove('is-visible');
  await stopScanning();
}

async function stopScanning() {
  if (!html5QrCode || !html5QrCode.isScanning) {
    return;
  }

  try {
    await html5QrCode.stop();
  } catch (error) {
    console.warn('Failed to stop scanner', error);
  }
}

function cancelScan() {
  confirmDialog.hidden = true;
  remarkInput.value = '';
  setError('');
  backButton.classList.add('is-visible');
  startScanning();
}

async function confirmScan() {
  if (isProcessing) {
    return;
  }

  if (!lastDecodedText) {
    setError('沒有掃描到 QR code');
    return;
  }

  if (!config.WEB_APP_URL) {
    setError('請先在 frontend/config.js 設定 Apps Script Web App URL。');
    return;
  }

  isProcessing = true;
  setButtonsDisabled(true);
  setStatus('正在處理...');
  setError('');

  try {
    const result = await recordWithJsonp({
      decodedText: lastDecodedText,
      remark: remarkInput.value,
      location: lastLocation,
      key: config.API_KEY || '',
    });

    if (!result.ok) {
      throw new Error(result.message || '錄入資料失敗，請重試。');
    }

    confirmDialog.hidden = true;
    remarkInput.value = '';
    lastDecodedText = '';
    setStatus('已記錄，正在重新啟動掃描...');
    backButton.classList.add('is-visible');
    startScanning();
  } catch (error) {
    setError(error.message || '錄入資料失敗，請重試。');
    setStatus('');
  } finally {
    isProcessing = false;
    setButtonsDisabled(false);
  }
}

function recordWithJsonp(payload) {
  return new Promise((resolve, reject) => {
    const callbackName = `scannerCallback_${Date.now()}_${Math.round(Math.random() * 100000)}`;
    const script = document.createElement('script');
    const url = new URL(config.WEB_APP_URL);
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Apps Script backend 未有回應，請檢查網絡或部署設定。'));
    }, 15000);

    Object.entries(payload).forEach(([key, value]) => {
      url.searchParams.set(key, value || '');
    });
    url.searchParams.set('callback', callbackName);

    window[callbackName] = (response) => {
      cleanup();
      resolve(response);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('無法連接 Apps Script backend。'));
    };

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function setButtonsDisabled(disabled) {
  confirmButton.disabled = disabled;
  cancelButton.disabled = disabled;
}

function setStatus(message) {
  statusMessage.textContent = message;
  statusMessage.hidden = !message;
}

function setError(message) {
  const target = confirmDialog.hidden ? scannerError : dialogError;
  const inactive = confirmDialog.hidden ? dialogError : scannerError;

  target.textContent = message;
  target.hidden = !message;
  inactive.textContent = '';
  inactive.hidden = true;
}
