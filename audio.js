document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const apiKeyInput = document.getElementById('apiKey');
    const addKeyBtn = document.getElementById('addKeyBtn');
    const audioFileInput = document.getElementById('audioFileInput');
    const audioUploadArea = document.getElementById('audioUploadArea');
    const transcribeBtn = document.getElementById('transcribeBtn');
    const newTranscribeBtn = document.getElementById('newTranscribeBtn');
    const outputArea = document.getElementById('output');
    const progressBar = document.getElementById('progressBar');
    const spinner = document.getElementById('spinner');
    const downloadSrtBtn = document.getElementById('downloadSrtBtn');
    const downloadTxtBtn = document.getElementById('downloadTxtBtn');
    const modeApi = document.getElementById('modeApi');
    const modeLocal = document.getElementById('modeLocal');
    const apiKeySection = document.getElementById('apiKeySection');
    const localModelSection = document.getElementById('localModelSection');
    const localModelInput = document.getElementById('localModelInput');
    const localModelStatus = document.getElementById('localModelStatus');

    let audioFile = null;
    let apiKey = localStorage.getItem('whisperApiKey');
    let localModelFile = null;
    let transcribeMode = 'api';

    // Initialize
    if (apiKey) {
        apiKeyInput.value = apiKey;
        transcribeBtn.disabled = false;
    }
    downloadSrtBtn.disabled = true;
    downloadTxtBtn.disabled = true;

    // حالت انتخاب بین API و لوکال
    modeApi.addEventListener('change', () => {
        if (modeApi.checked) {
            transcribeMode = 'api';
            apiKeySection.classList.remove('hidden');
            localModelSection.classList.add('hidden');
            updateTranscribeButton();
        }
    });
    modeLocal.addEventListener('change', () => {
        if (modeLocal.checked) {
            transcribeMode = 'local';
            apiKeySection.classList.add('hidden');
            localModelSection.classList.remove('hidden');
            updateTranscribeButton();
        }
    });
    localModelInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            localModelFile = e.target.files[0];
            localModelStatus.textContent = `مدل انتخاب شد: ${localModelFile.name}`;
        } else {
            localModelFile = null;
            localModelStatus.textContent = '';
        }
        updateTranscribeButton();
    });

    // Event Listeners
    addKeyBtn.addEventListener('click', () => {
        apiKeyInput.classList.toggle('hidden');
    });

    apiKeyInput.addEventListener('change', () => {
        localStorage.setItem('whisperApiKey', apiKeyInput.value);
        apiKey = apiKeyInput.value;
        updateTranscribeButton();
    });

    audioUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        audioUploadArea.classList.add('border-blue-500');
    });

    audioUploadArea.addEventListener('dragleave', () => {
        audioUploadArea.classList.remove('border-blue-500');
    });

    audioUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        audioUploadArea.classList.remove('border-blue-500');
        const files = e.dataTransfer.files;
        handleFiles(files);
    });

    audioFileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    audioUploadArea.addEventListener('click', () => {
        audioFileInput.click();
    });

    transcribeBtn.addEventListener('click', startTranscription);
    newTranscribeBtn.addEventListener('click', resetForm);

    downloadSrtBtn.addEventListener('click', () => downloadOutput('srt'));
    downloadTxtBtn.addEventListener('click', () => downloadOutput('txt'));

    // Functions
    function handleFiles(files) {
        if (files.length > 0) {
            audioFile = files[0];
            audioUploadArea.querySelector('p').textContent = `فایل انتخاب‌شده: ${audioFile.name}`;
            updateTranscribeButton();
        }
    }

    function updateTranscribeButton() {
        if (transcribeMode === 'api') {
            transcribeBtn.disabled = !(audioFile && (apiKey || true)); // HuggingFace بدون کلید هم کار می‌کند
        } else {
            transcribeBtn.disabled = !(audioFile && localModelFile);
        }
    }

    async function startTranscription() {
        spinner.style.display = 'block';
        transcribeBtn.disabled = true;
        outputArea.value = '';
        try {
            if (transcribeMode === 'api') {
                // HuggingFace API (بدون کلید هم کار می‌کند)
                let modelName = document.getElementById('whisperModel').value;
                let apiUrl = `https://api-inference.huggingface.co/models/openai/whisper-${modelName}`;
                let triedSmall = false;
                let response, data;
                const formData = new FormData();
                formData.append('file', audioFile);
                formData.append('language', document.getElementById('language').value);
                const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};

                while (true) {
                    response = await fetch(apiUrl, {
                        method: 'POST',
                        headers,
                        body: formData
                    });
                    if (response.status === 401 || response.status === 403) {
                        if (!triedSmall && modelName !== 'small') {
                            // تلاش با مدل رایگان‌تر
                            modelName = 'small';
                            apiUrl = 'https://api-inference.huggingface.co/models/openai/whisper-small';
                            triedSmall = true;
                            outputArea.value = 'مدل انتخاب‌شده فقط برای کاربران پولی فعال است. تلاش با مدل رایگان‌تر...';
                            continue;
                        } else {
                            outputArea.value = 'دسترسی به مدل انتخاب‌شده وجود ندارد یا کلید معتبر نیست.\nلطفاً مدل کوچک‌تر را انتخاب کنید یا از حالت لوکال استفاده کنید.';
                            alert('دسترسی به مدل انتخاب‌شده وجود ندارد یا کلید معتبر نیست.\nبرای تبدیل بدون محدودیت، حالت لوکال را انتخاب کنید.');
                            return;
                        }
                    }
                    break;
                }
                if (!response.ok) {
                    throw new Error('API پاسخ نداد یا محدودیت اعمال شد.');
                }
                data = await response.json();
                outputArea.value = data.text || (data.error ? data.error : 'متنی دریافت نشد.');
            } else {
                // اجرای لوکال whisper.cpp-web (نیازمند WASM و مدل)
                outputArea.value = 'در حال بارگذاری مدل و اجرای تبدیل لوکال...\n(این قابلیت نیازمند پیاده‌سازی whisper.cpp-web است)';
                alert('در نسخه فعلی فقط API HuggingFace فعال است. برای اجرای لوکال باید whisper.cpp-web را اضافه کنید.');
            }
            downloadSrtBtn.disabled = false;
            downloadTxtBtn.disabled = false;
        } catch (error) {
            console.error('Error:', error);
            alert('خطا در تبدیل فایل: ' + error.message);
        } finally {
            spinner.style.display = 'none';
            transcribeBtn.disabled = false;
        }
    }

    function resetForm() {
        audioFile = null;
        audioUploadArea.querySelector('p').textContent = 'فایل‌های صوتی (MP3، WAV، M4A) یا ویدیویی را اینجا رها کنید';
        outputArea.value = '';
        downloadSrtBtn.disabled = true;
        downloadTxtBtn.disabled = true;
        updateTranscribeButton();
    }

    function downloadOutput(format) {
        const text = outputArea.value;
        const filename = `transcript.${format}`;
        const blob = new Blob([format === 'srt' ? convertToSRT(text) : text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function convertToSRT(text) {
        // تبدیل متن به فرمت SRT
        // این یک نمونه ساده است و باید بر اساس نیاز پروژه تکمیل شود
        const lines = text.split('\n');
        let srt = '';
        lines.forEach((line, index) => {
            if (line.trim()) {
                srt += `${index + 1}\n`;
                // زمان‌بندی پیش‌فرض برای هر خط
                const startTime = formatTime(index * 3);
                const endTime = formatTime((index + 1) * 3);
                srt += `${startTime} --> ${endTime}\n`;
                srt += `${line}\n\n`;
            }
        });
        return srt;
    }

    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},000`;
    }
});