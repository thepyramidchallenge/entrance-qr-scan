const config = window.SCANNER_CONFIG || {};
const dialogBackdrop = document.getElementById('dialog-backdrop');
const confirmDialog = document.getElementById('confirm-dialog');
const decodedTextElement = document.getElementById('decoded-text');
const remarkInput = document.getElementById('remark');
const dialogError = document.getElementById('error-message');
const scannerError = document.getElementById('scanner-error');
const statusMessage = document.getElementById('status');
const cancelButton = document.getElementById('cancel-button');
const confirmButton = document.getElementById('confirm-button');
const manualCodeButton = document.getElementById('manual-code-button');
const manualDialog = document.getElementById('manual-dialog');
const manualCodeInput = document.getElementById('manual-code');
const manualDialogError = document.getElementById('manual-error-message');
const manualCancelButton = document.getElementById('manual-cancel-button');
const manualConfirmButton = document.getElementById('manual-confirm-button');

let lastDecodedText = '';
let isProcessing = false;
let html5QrCode = null;
let isScannerStarting = false;
let scannerStartPromise = null;

cancelButton.addEventListener('click', cancelScan);
confirmButton.addEventListener('click', confirmScan);
manualCodeButton.addEventListener('click', openManualDialog);
manualCancelButton.addEventListener('click', closeManualDialog);
manualConfirmButton.addEventListener('click', confirmManualCode);
document.addEventListener('DOMContentLoaded', startScanning);

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

  scannerStartPromise = html5QrCode.start(
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
  dialogBackdrop.hidden = false;
  await stopScanning();
}

async function stopScanning() {
  if (isScannerStarting && scannerStartPromise) {
    await scannerStartPromise;
  }

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
  dialogBackdrop.hidden = true;
  remarkInput.value = '';
  setError('');
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
      key: config.API_KEY || '',
    });

    if (!result.ok) {
      throw new Error(result.message || '錄入資料失敗，請重試。');
    }

    confirmDialog.hidden = true;
    dialogBackdrop.hidden = true;
    remarkInput.value = '';
    lastDecodedText = '';
    setStatus('已記錄，正在重新啟動掃描...');
    startScanning();
  } catch (error) {
    setError(error.message || '錄入資料失敗，請重試。');
    setStatus('');
  } finally {
    isProcessing = false;
    setButtonsDisabled(false);
  }
}

async function openManualDialog() {
  if (isProcessing) {
    return;
  }

  await stopScanning();
  manualDialog.hidden = false;
  dialogBackdrop.hidden = false;
  manualCodeInput.value = '';
  setManualError('');
  setStatus('');
  manualCodeInput.focus();
}

function closeManualDialog() {
  manualDialog.hidden = true;
  dialogBackdrop.hidden = true;
  manualCodeInput.value = '';
  setManualError('');
  startScanning();
}

async function confirmManualCode() {
  if (isProcessing) {
    return;
  }

  const manualCode = manualCodeInput.value.trim();
  if (!manualCode) {
    setManualError('請輸入考生編號');
    return;
  }

  if (!config.WEB_APP_URL) {
    setManualError('請先在 frontend/config.js 設定 Apps Script Web App URL。');
    return;
  }

  isProcessing = true;
  setManualButtonsDisabled(true);
  setStatus('正在處理...');
  setManualError('');

  try {
    const result = await recordManualCodeWithJsonp({
      manualCode,
      key: config.API_KEY || '',
    });

    if (!result.ok) {
      throw new Error(result.message || '錄入資料失敗，請重試。');
    }

    manualDialog.hidden = true;
    dialogBackdrop.hidden = true;
    manualCodeInput.value = '';
    startScanning();
    setStatus(result.message || '已成功紀錄');
  } catch (error) {
    setManualError(error.message || '你輸入的考生編號格式錯誤');
    setStatus('');
  } finally {
    isProcessing = false;
    setManualButtonsDisabled(false);
  }
}

function recordManualCodeWithJsonp(payload) {
  return recordWithJsonp(payload);
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

function setManualButtonsDisabled(disabled) {
  manualConfirmButton.disabled = disabled;
  manualCancelButton.disabled = disabled;
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

function setManualError(message) {
  manualDialogError.textContent = message;
  manualDialogError.hidden = !message;
}
