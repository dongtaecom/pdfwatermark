// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// State Management
const state = {
  files: [], // Array of { id, file, arrayBuffer, pdfLibDoc, previewCanvas }
  ipAddress: '조회 중...',
  userName: '홍길동 (보안팀)',
  currentTime: '',
  options: {
    fontSize: 10,
    opacity: 0.18,
    angle: 45,
    spacing: 160,
    color: '#666666'
  }
};

// DOM Elements
const userNameInput = document.getElementById('userNameInput');
const ipInput = document.getElementById('ipInput');
const timeInput = document.getElementById('timeInput');
const refreshIpBtn = document.getElementById('refreshIpBtn');

const fontSizeInput = document.getElementById('fontSizeInput');
const opacityInput = document.getElementById('opacityInput');
const angleInput = document.getElementById('angleInput');
const spacingInput = document.getElementById('spacingInput');
const colorInput = document.getElementById('colorInput');

const fontSizeVal = document.getElementById('fontSizeVal');
const opacityVal = document.getElementById('opacityVal');
const angleVal = document.getElementById('angleVal');
const spacingVal = document.getElementById('spacingVal');
const colorHexText = document.getElementById('colorHexText');

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileListContainer = document.getElementById('fileListContainer');
const batchActions = document.getElementById('batchActions');
const downloadZipBtn = document.getElementById('downloadZipBtn');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  fetchIpAddress();
  bindEvents();
});

// Update clock every second
function initClock() {
  const updateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    state.currentTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    timeInput.value = state.currentTime;
  };
  updateTime();
  setInterval(updateTime, 1000);
}

// Fetch public IP using fallback APIs
async function fetchIpAddress() {
  ipInput.value = '조회 중...';
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    state.ipAddress = data.ip;
  } catch (err) {
    try {
      const fallback = await fetch('https://api.myip.com');
      const data = await fallback.json();
      state.ipAddress = data.ip;
    } catch (e) {
      state.ipAddress = '192.168.0.1 (로컬)';
    }
  }
  ipInput.value = state.ipAddress;
  renderAllPreviews();
}

// Bind User Interface Events
function bindEvents() {
  // Input changes
  userNameInput.addEventListener('input', (e) => {
    state.userName = e.target.value.trim() || '출력자 정보 없음';
    renderAllPreviews();
  });

  ipInput.addEventListener('input', (e) => {
    state.ipAddress = e.target.value.trim();
    renderAllPreviews();
  });

  refreshIpBtn.addEventListener('click', fetchIpAddress);

  // Style Sliders
  fontSizeInput.addEventListener('input', (e) => {
    state.options.fontSize = parseInt(e.target.value);
    fontSizeVal.textContent = state.options.fontSize;
    renderAllPreviews();
  });

  opacityInput.addEventListener('input', (e) => {
    state.options.opacity = parseFloat(e.target.value);
    opacityVal.textContent = state.options.opacity;
    renderAllPreviews();
  });

  angleInput.addEventListener('input', (e) => {
    state.options.angle = parseInt(e.target.value);
    angleVal.textContent = state.options.angle;
    renderAllPreviews();
  });

  spacingInput.addEventListener('input', (e) => {
    state.options.spacing = parseInt(e.target.value);
    spacingVal.textContent = state.options.spacing;
    renderAllPreviews();
  });

  colorInput.addEventListener('input', (e) => {
    state.options.color = e.target.value;
    colorHexText.textContent = e.target.value;
    renderAllPreviews();
  });

  // File Upload Handlers
  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFilesSelect(e.target.files);
    }
  });

  // ZIP Download Handler
  downloadZipBtn.addEventListener('click', downloadAllAsZip);
}

// Process Uploaded Files
async function handleFilesSelect(fileList) {
  const newFiles = Array.from(fileList).filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

  if (newFiles.length === 0) {
    alert('PDF 파일만 업로드할 수 있습니다.');
    return;
  }

  for (const file of newFiles) {
    const arrayBuffer = await file.arrayBuffer();
    const fileId = 'pdf_' + Math.random().toString(36).substr(2, 9);
    state.files.push({
      id: fileId,
      file: file,
      name: file.name,
      size: file.size,
      arrayBuffer: arrayBuffer
    });
  }

  renderFileListUI();
}

// Render File List and Preview Containers
function renderFileListUI() {
  if (state.files.length === 0) {
    fileListContainer.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-file-circle-plus"></i>
        <p>PDF 파일을 업로드하면 미리보기 및 개별/일괄 다운로드가 활성화됩니다.</p>
      </div>`;
    batchActions.style.display = 'none';
    return;
  }

  batchActions.style.display = 'block';
  fileListContainer.innerHTML = '';

  state.files.forEach((fileItem) => {
    const itemCard = document.createElement('div');
    itemCard.className = 'file-item-card';
    itemCard.id = `item-${fileItem.id}`;

    const formattedSize = (fileItem.size / (1024 * 1024)).toFixed(2) + ' MB';

    itemCard.innerHTML = `
      <div class="file-item-header">
        <div class="file-info">
          <i class="fa-solid fa-file-pdf"></i>
          <div>
            <div class="file-name">${escapeHtml(fileItem.name)}</div>
            <div class="file-size">${formattedSize}</div>
          </div>
        </div>
        <div class="file-actions">
          <button class="btn btn-primary" onclick="downloadSinglePdf('${fileItem.id}')">
            <i class="fa-solid fa-download"></i> 다운로드
          </button>
          <button class="btn btn-danger" onclick="removeFile('${fileItem.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
      <div class="preview-viewport">
        <canvas id="canvas-${fileItem.id}"></canvas>
      </div>
    `;

    fileListContainer.appendChild(itemCard);
    renderSinglePreview(fileItem);
  });
}

// Remove File from List
function removeFile(fileId) {
  state.files = state.files.filter(f => f.id !== fileId);
  renderFileListUI();
}

// Helper: Hex Color to RGB (0 ~ 1)
function hexToRgb(hex) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return { r, g, b };
}

// Render Watermark Preview on Canvas using PDF.js
async function renderSinglePreview(fileItem) {
  const canvas = document.getElementById(`canvas-${fileItem.id}`);
  if (!canvas) return;

  try {
    // Load PDF using pdf.js for page rendering
    const loadingTask = pdfjsLib.getDocument({ data: fileItem.arrayBuffer.slice(0) });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1); // Render first page for preview

    const viewport = page.getViewport({ scale: 1.2 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    // Render PDF page background
    await page.render(renderContext).promise;

    // Draw Watermark Grid over Canvas
    drawWatermarkOnCanvas(ctx, viewport.width, viewport.height);
  } catch (err) {
    console.error('Failed to render PDF preview:', err);
  }
}

// Draw repeated watermark grid on HTML5 Canvas
function drawWatermarkOnCanvas(ctx, width, height) {
  const lines = [
    `[출력자] ${state.userName}`,
    `[시각] ${state.currentTime}`,
    `[IP] ${state.ipAddress}`
  ];

  const fontSize = state.options.fontSize * 1.2; // scale visually for canvas
  const spacing = state.options.spacing;
  const angle = (state.options.angle * Math.PI) / 180;
  const opacity = state.options.opacity;
  const color = state.options.color;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px sans-serif`;

  // Dynamic grid coverage with rotation
  const diagonal = Math.sqrt(width * width + height * height);

  ctx.translate(width / 2, height / 2);
  ctx.rotate(-angle);

  const startX = -diagonal;
  const endX = diagonal;
  const startY = -diagonal;
  const endY = diagonal;

  for (let y = startY; y < endY; y += spacing) {
    for (let x = startX; x < endX; x += spacing * 1.5) {
      lines.forEach((line, idx) => {
        ctx.fillText(line, x, y + (idx * fontSize * 1.2));
      });
    }
  }

  ctx.restore();
}

// Re-render all active canvas previews (when slider/inputs change)
function renderAllPreviews() {
  state.files.forEach(fileItem => {
    renderSinglePreview(fileItem);
  });
}

// Generate Watermarked PDF using pdf-lib
async function generateWatermarkedPdfBytes(fileItem) {
  const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
  const pdfDoc = await PDFDocument.load(fileItem.arrayBuffer.slice(0));
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();

  const watermarkText = `[PRINT] ${state.userName} | ${state.currentTime} | IP: ${state.ipAddress}`;
  const rgbColor = hexToRgb(state.options.color);
  const fontSize = state.options.fontSize;
  const opacity = state.options.opacity;
  const angle = state.options.angle;
  const spacing = state.options.spacing;

  for (const page of pages) {
    const { width, height } = page.getSize();
    const diagonal = Math.sqrt(width * width + height * height);

    // Overlay repeated grid
    for (let y = -diagonal; y < diagonal; y += spacing) {
      for (let x = -diagonal; x < diagonal; x += spacing * 1.8) {
        page.drawText(watermarkText, {
          x: x,
          y: y,
          size: fontSize,
          font: font,
          color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
          opacity: opacity,
          rotate: degrees(angle)
        });
      }
    }
  }

  return await pdfDoc.save();
}

// Download Individual PDF
async function downloadSinglePdf(fileId) {
  const fileItem = state.files.find(f => f.id === fileId);
  if (!fileItem) return;

  try {
    const pdfBytes = await generateWatermarkedPdfBytes(fileItem);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    
    // Append _watermarked to original name
    const originalName = fileItem.name.replace(/\.[^/.]+$/, "");
    link.href = URL.createObjectURL(blob);
    link.download = `${originalName}_watermarked.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    console.error('Failed to generate watermarked PDF:', err);
    alert('PDF 워터마크 생성 중 오류가 발생했습니다.');
  }
}

// Download All PDFs as a ZIP archive
async function downloadAllAsZip() {
  if (state.files.length === 0) return;

  const zip = new JSZip();
  downloadZipBtn.disabled = true;
  downloadZipBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 워터마크 처리 중...';

  try {
    for (const fileItem of state.files) {
      const pdfBytes = await generateWatermarkedPdfBytes(fileItem);
      const originalName = fileItem.name.replace(/\.[^/.]+$/, "");
      zip.file(`${originalName}_watermarked.pdf`, pdfBytes);
    }

    const zipContent = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipContent);
    link.download = `watermarked_documents_${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    console.error('Failed to create ZIP package:', err);
    alert('ZIP 압축 파일 생성 중 오류가 발생했습니다.');
  } finally {
    downloadZipBtn.disabled = false;
    downloadZipBtn.innerHTML = '<i class="fa-solid fa-file-zipper"></i> 일괄 다운로드 (ZIP)';
  }
}

// Helper: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}
