let apiKeys = JSON.parse(localStorage.getItem('apiKeys')) || {
    gemini: '',
    deepseek: '',
    openrouter: ''
};
let settings = JSON.parse(localStorage.getItem('translateSettings')) || {
    delay: 4000,
    separator: '\n',
    tone: 'رسمی',
    prompt: 'ترجمه متن زیرنویس داخل <> به {LANG}. دستورات: - معنای اصلی رو حفظ کن. - لحن {TONE} رو اتخاذ کن. - جریان طبیعی برای گفتگو داشته باشه. - طول متن مناسب زیرنویس باشه. - دقیقاً تعداد خطوط اصلی رو نگه دار. - فقط متن ترجمه‌شده رو با --- جدا کن. <{TEXT}>',
    noCensor: false
};

if (apiKeys.gemini) {
    document.getElementById('apiKey').value = apiKeys.gemini;
    document.getElementById('translateBtn').disabled = false;
}

document.getElementById('delay').value = settings.delay;
document.getElementById('separator').value = settings.separator;
document.getElementById('tone').value = settings.tone;
document.getElementById('prompt').value = settings.prompt;
document.getElementById('noCensor').checked = settings.noCensor;

function saveSettings() {
    settings = {
        delay: parseInt(document.getElementById('delay').value) || 4000,
        separator: document.getElementById('separator').value || '\n',
        tone: document.getElementById('tone').value || 'رسمی',
        prompt: document.getElementById('prompt').value || settings.prompt,
        noCensor: document.getElementById('noCensor').checked
    };
    localStorage.setItem('translateSettings', JSON.stringify(settings));
}

document.getElementById('delay').addEventListener('change', saveSettings);
document.getElementById('separator').addEventListener('change', saveSettings);
document.getElementById('tone').addEventListener('change', saveSettings);
document.getElementById('prompt').addEventListener('change', saveSettings);
document.getElementById('noCensor').addEventListener('change', saveSettings);

const serviceLinks = {
    gemini: 'https://aistudio.google.com/app/apikey',
    deepseek: 'https://platform.deepseek.com/api_keys',
    openrouter: 'https://openrouter.ai/keys',
    huggingface: 'https://huggingface.co/settings/tokens'
};

document.getElementById('service').addEventListener('change', (e) => {
    const service = e.target.value;
    document.getElementById('apiKey').value = apiKeys[service] || '';
    document.getElementById('apiKey').style.display = service === 'huggingface' ? 'none' : 'block';
    document.getElementById('apiKeyLink').href = serviceLinks[service];
    fetchModels(service);
});

document.getElementById('addKeyBtn').addEventListener('click', () => {
    const keyInput = document.getElementById('apiKey');
    keyInput.style.display = keyInput.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('apiKey').addEventListener('change', (e) => {
    const service = document.getElementById('service').value;
    apiKeys[service] = e.target.value;
    localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
    document.getElementById('translateBtn').disabled = !apiKeys[service] && service !== 'huggingface';
    fetchModels(service);
});

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const videoUploadArea = document.getElementById('videoUploadArea');
const videoInput = document.getElementById('videoInput');
const fileSelect = document.getElementById('fileSelect');
const audioInput = document.getElementById('audioInput');
const sttBtn = document.getElementById('sttBtn');
const sttProgress = document.getElementById('sttProgress');
const sttBar = document.getElementById('sttBar');
const sttStatus = document.getElementById('sttStatus');

let subtitleFiles = [];
let currentSubtitles = [];
let currentFileType = 'srt';
let hasVideo = false;
let assStyles = {};

uploadArea.addEventListener('dragover', (e) => e.preventDefault());
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileInput.files = e.dataTransfer.files;
    loadSubtitles(e.dataTransfer.files);
});
document.querySelector('#uploadArea button').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => loadSubtitles(e.target.files));

videoUploadArea.addEventListener('dragover', (e) => e.preventDefault());
videoUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    videoInput.files = e.dataTransfer.files;
    loadVideo(e.dataTransfer.files[0]);
});
document.querySelector('#videoUploadArea button').addEventListener('click', () => videoInput.click());
videoInput.addEventListener('change', (e) => loadVideo(e.target.files[0]));

audioInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        sttBtn.disabled = false;
    }
});
sttBtn.addEventListener('click', () => transcribeAudioToSRT());

let whisper = null;
async function initializeWhisper() {
    if (!whisper) {
        try {
            whisper = await WhisperFactory.create({
                model: 'base', // می‌تونی به 'tiny' تغییر بدی برای سرعت بیشتر (کمتر دقیق)
                language: 'multilingual', // برای فارسی/انگلیسی
                downloadProgressCallback: (progress) => {
                    sttProgress.classList.remove('hidden');
                    sttBar.style.width = `${progress * 100}%`;
                    sttStatus.textContent = `دانلود مدل: ${Math.round(progress * 100)}%`;
                }
            });
            sttStatus.textContent = 'آماده برای تبدیل صدا';
        } catch (error) {
            console.error('خطا در بارگذاری Whisper:', error);
            alert('خطا در بارگذاری Whisper: ' + error.message);
            sttProgress.classList.add('hidden');
        }
    }
}

async function transcribeAudioToSRT() {
    if (!audioInput.files[0]) {
        alert('لطفاً فایل صوتی انتخاب کنید.');
        return;
    }
    await initializeWhisper();
    if (!whisper) return;

    const file = audioInput.files[0];
    const arrayBuffer = await file.arrayBuffer();
    sttProgress.classList.remove('hidden');
    sttStatus.textContent = 'در حال تبدیل صدا به متن...';

    try {
        const result = await whisper.transcribe({
            audio: arrayBuffer,
            progressCallback: (progress) => {
                sttBar.style.width = `${progress * 100}%`;
            }
        });

        const segments = result.segments;
        let srtContent = '';
        segments.forEach((segment, index) => {
            const start = new Date(segment.start * 1000).toISOString().substr(11, 12).replace('.', ',');
            const end = new Date(segment.end * 1000).toISOString().substr(11, 12).replace('.', ',');
            srtContent += `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}\n\n`;
        });

        const fileObj = {
            file: new File([srtContent], `${file.name}.srt`, { type: 'text/plain' }),
            type: 'srt',
            subtitles: parseSrt(srtContent),
            translated: [],
            progress: 100,
            styles: {}
        };
        subtitleFiles.push(fileObj);
        fileSelect.innerHTML = '<option value="">فایلی انتخاب نشده</option>';
        subtitleFiles.forEach((f, idx) => {
            const option = document.createElement('option');
            option.value = idx;
            option.textContent = f.file.name;
            fileSelect.appendChild(option);
        });
        fileSelect.value = subtitleFiles.length - 1;
        currentSubtitles = fileObj.subtitles;
        currentFileType = 'srt';
        assStyles = {};
        document.getElementById('output').value = srtContent;
        renderPreview(currentSubtitles, []);
        if (hasVideo) {
            updateVideoSubtitles(currentSubtitles, currentFileType, assStyles);
        }
        updateProgressBars();
        sttProgress.classList.add('hidden');
        sttStatus.textContent = 'تبدیل با موفقیت انجام شد!';
        audioInput.value = '';
        sttBtn.disabled = true;
    } catch (error) {
        console.error('خطا در تبدیل صدا:', error);
        alert('خطا در تبدیل صدا: ' + error.message);
        sttProgress.classList.add('hidden');
    }
}

function loadSubtitles(files) {
    if (!files || files.length === 0) {
        alert('لطفاً حداقل یک فایل انتخاب کنید.');
        return;
    }
    subtitleFiles = Array.from(files).map(file => ({
        file,
        type: file.name.endsWith('.vtt') ? 'vtt' : file.name.endsWith('.ssa') || file.name.endsWith('.ass') ? 'ssa' : 'srt',
        subtitles: [],
        translated: [],
        progress: 0,
        styles: {}
    }));
    fileSelect.innerHTML = '<option value="">فایلی انتخاب نشده</option>';
    subtitleFiles.forEach((fileObj, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = fileObj.file.name;
        fileSelect.appendChild(option);
    });
    if (subtitleFiles.length > 0) {
        fileSelect.value = '0';
        loadSingleSubtitleFile(subtitleFiles[0]);
    }
}

function loadSingleSubtitleFile(fileObj) {
    const { file, type } = fileObj;
    currentFileType = type;
    currentSubtitles = [];
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            if (type === 'ssa') {
                const { subtitles, styles } = parseSsa(e.target.result);
                currentSubtitles = subtitles;
                fileObj.subtitles = subtitles;
                fileObj.styles = styles;
            } else {
                currentSubtitles = type === 'srt' ? parseSrt(e.target.result) : parseVtt(e.target.result);
                fileObj.subtitles = currentSubtitles;
                fileObj.styles = {};
            }
            document.getElementById('translateBtn').disabled = currentSubtitles.length === 0 || !document.getElementById('model').value;
            document.getElementById('output').value = '';
            document.getElementById('previewTable').innerHTML = '';
            renderPreview(currentSubtitles, fileObj.translated);
            updateProgressBars();
            if (hasVideo && fileObj.translated.length > 0) {
                updateVideoSubtitles(fileObj.translated, currentFileType, fileObj.styles);
            }
        } catch (error) {
            console.error('خطا در پارس فایل:', error);
            alert(`خطا در خواندن فایل ${file.name}: ${error.message}`);
        }
    };
    reader.onerror = () => alert(`خطا در خواندن فایل ${file.name}!`);
    reader.readAsText(file);
}

fileSelect.addEventListener('change', (e) => {
    const index = e.target.value;
    if (index !== '') {
        currentSubtitles = subtitleFiles[index].subtitles;
        currentFileType = subtitleFiles[index].type;
        assStyles = subtitleFiles[index].styles;
        document.getElementById('output').value = subtitleFiles[index].translated.length > 0
            ? subtitleFiles[index].translated.map(sub => `${sub.index}\n${sub.timecode}\n${sub.text}\n\n`).join('')
            : '';
        renderPreview(currentSubtitles, subtitleFiles[index].translated);
        if (hasVideo) {
            updateVideoSubtitles(subtitleFiles[index].translated.length > 0 ? subtitleFiles[index].translated : subtitleFiles[index].subtitles, currentFileType, subtitleFiles[index].styles);
        }
    }
});

function loadVideo(file) {
    if (!file) {
        hasVideo = false;
        return;
    }
    hasVideo = true;
    const videoPlayer = document.getElementById('videoPlayer');
    const videoSource = document.getElementById('videoSource');
    videoSource.src = URL.createObjectURL(file);
    videoPlayer.load();
    if (subtitleFiles[parseInt(fileSelect.value)]?.translated.length > 0) {
        updateVideoSubtitles(subtitleFiles[parseInt(fileSelect.value)].translated, currentFileType, subtitleFiles[parseInt(fileSelect.value)].styles);
    }
}

function parseSrt(content) {
    const subtitles = [];
    const blocks = content.split('\n\n');
    for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length >= 3) {
            const index = lines[0];
            const timecode = lines[1];
            const text = lines.slice(2).join('\n');
            subtitles.push({ index, timecode, text });
        }
    }
    if (subtitles.length === 0) throw new Error('فایل SRT خالی یا نامعتبر است.');
    return subtitles;
}

function parseVtt(content) {
    const subtitles = [];
    const blocks = content.split('\n\n').filter(block => !block.startsWith('WEBVTT'));
    let index = 1;
    for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length >= 2) {
            const timecode = lines[0];
            const text = lines.slice(1).join('\n');
            subtitles.push({ index: String(index++), timecode, text });
        }
    }
    if (subtitles.length === 0) throw new Error('فایل VTT خالی یا نامعتبر است.');
    return subtitles;
}

function parseSsa(content) {
    const subtitles = [];
    const styles = {};
    const lines = content.split('\n');
    let index = 1;
    let inStyles = false;
    let inDialogue = false;

    for (const line of lines) {
        if (line.startsWith('[V4+ Styles]')) {
            inStyles = true;
            continue;
        }
        if (line.startsWith('[Events]')) {
            inStyles = false;
            inDialogue = true;
            continue;
        }
        if (inStyles && line.startsWith('Style:')) {
            const parts = line.split(',');
            if (parts.length >= 8) {
                const styleName = parts[0].replace('Style: ', '');
                styles[styleName] = {
                    font: parts[1],
                    fontsize: parts[2],
                    primaryColour: parts[3]
                };
            }
        }
        if (inDialogue && line.startsWith('Dialogue:')) {
            const parts = line.split(',');
            if (parts.length >= 10) {
                const timecode = `${parts[1]} --> ${parts[2]}`;
                const text = parts.slice(9).join(',').replace(/{.*?}/g, '');
                const style = parts[3];
                subtitles.push({ index: String(index++), timecode, text, style });
            }
        }
    }
    if (subtitles.length === 0) throw new Error('فایل SSA/ASS خالی یا نامعتبر است.');
    return { subtitles, styles };
}

async function fetchModels(service) {
    const modelSelect = document.getElementById('model');
    modelSelect.innerHTML = '<option value="">در حال بارگذاری مدل‌ها...</option>';
    try {
        if (service === 'gemini') {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKeys.gemini}`);
            if (!response.ok) throw new Error(`خطا: ${response.status}`);
            const data = await response.json();
            const models = data.models.filter(m => m.name.includes('gemini')).map(m => m.name.replace('models/', ''));
            modelSelect.innerHTML = '<option value="">مدل را انتخاب کنید</option>';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
        } else if (service === 'deepseek') {
            modelSelect.innerHTML = '<option value="">مدل را انتخاب کنید</option>';
            ['DeepSeek-Pro', 'DeepSeek-RAG'].forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
        } else if (service === 'huggingface') {
            modelSelect.innerHTML = '<option value="facebook/nllb-200-distilled-600M">NLLB-200 (Multilingual)</option>';
        } else if (service === 'openrouter') {
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: { 'Authorization': `Bearer ${apiKeys.openrouter}` }
            });
            if (!response.ok) throw new Error(`خطا: ${response.status}`);
            const data = await response.json();
            const models = data.data.filter(m => m.id.includes('grok') || m.id.includes('gpt-3.5')).map(m => m.id);
            modelSelect.innerHTML = '<option value="">مدل را انتخاب کنید</option>';
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model;
                option.textContent = model;
                modelSelect.appendChild(option);
            });
        }
        document.getElementById('translateBtn').disabled = !apiKeys[service] && service !== 'huggingface' || !modelSelect.value;
    } catch (error) {
        console.error('خطا در گرفتن مدل‌ها:', error);
        alert('خطا در بارگذاری مدل‌ها: ' + error.message);
        modelSelect.innerHTML = '<option value="">خطا در بارگذاری</option>';
    }
}

document.getElementById('model').addEventListener('change', () => {
    const service = document.getElementById('service').value;
    document.getElementById('translateBtn').disabled = !apiKeys[service] && service !== 'huggingface' || !document.getElementById('model').value;
});

function loadTranslationHistory(filter = '', sortNewest = true) {
    const history = JSON.parse(localStorage.getItem('translationHistory')) || [];
    const historySelect = document.getElementById('historySelect');
    let filteredHistory = filter ? history.filter(item => item.language === filter) : history;
    filteredHistory.sort((a, b) => sortNewest ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
    historySelect.innerHTML = '<option value="">ترجمه‌ای انتخاب نشده</option>';
    filteredHistory.forEach((item, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `ترجمه ${new Date(item.timestamp).toLocaleString('fa-IR')} (${item.language}, ${item.fileName})`;
        historySelect.appendChild(option);
    });
}

document.getElementById('historyFilter').addEventListener('change', (e) => {
    const sortNewest = document.getElementById('sortHistoryBtn').textContent.includes('جدید به قدیم');
    loadTranslationHistory(e.target.value, sortNewest);
});

document.getElementById('sortHistoryBtn').addEventListener('click', (e) => {
    const sortNewest = e.target.textContent.includes('جدید به قدیم');
    e.target.textContent = sortNewest ? 'مرتب‌سازی (قدیم به جدید)' : 'مرتب‌سازی (جدید به قدیم)';
    loadTranslationHistory(document.getElementById('historyFilter').value, !sortNewest);
});

document.getElementById('historySelect').addEventListener('change', (e) => {
    const history = JSON.parse(localStorage.getItem('translationHistory')) || [];
    const index = e.target.value;
    if (index) {
        const item = history[index];
        document.getElementById('output').value = item.output;
        currentSubtitles = item.subtitles;
        currentFileType = item.fileType;
        assStyles = item.styles || {};
        renderPreview(item.subtitles, item.translated);
        if (hasVideo) {
            updateVideoSubtitles(item.translated.length > 0 ? item.translated : item.subtitles, item.fileType, item.styles);
        }
    } else {
        document.getElementById('output').value = '';
        document.getElementById('previewTable').innerHTML = '';
        if (hasVideo) {
            updateVideoSubtitles([], currentFileType, {});
        }
    }
});

function renderPreview(original, translated) {
    const previewTable = document.getElementById('previewTable');
    previewTable.innerHTML = '';
    original.forEach((sub, i) => {
        const row = document.createElement('tr');
        const translatedText = translated[i]?.text || 'در انتظار ترجمه';
        row.innerHTML = `
            <td class="border p-3">${sub.index}</td>
            <td class="border p-3">${sub.timecode}</td>
            <td class="border p-3">${sub.text}</td>
            <td class="border p-3"><textarea class="w-full p-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" data-index="${i}">${translatedText}</textarea></td>
        `;
        previewTable.appendChild(row);
    });

    const textareas = previewTable.querySelectorAll('textarea');
    textareas.forEach(ta => {
        ta.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            const fileIndex = parseInt(fileSelect.value);
            if (fileIndex >= 0) {
                subtitleFiles[fileIndex].translated[index] = { ...original[index], text: e.target.value };
                const outputSrt = subtitleFiles[fileIndex].translated.map(sub => `${sub.index}\n${sub.timecode}\n${sub.text}\n\n`).join('');
                document.getElementById('output').value = outputSrt;
                if (hasVideo) {
                    updateVideoSubtitles(subtitleFiles[fileIndex].translated, currentFileType, subtitleFiles[fileIndex].styles);
                }
                const history = JSON.parse(localStorage.getItem('translationHistory')) || [];
                const lastIndex = history.findIndex(h => h.fileName === subtitleFiles[fileIndex].file.name && h.language === document.getElementById('language').value);
                if (lastIndex >= 0) {
                    history[lastIndex].output = outputSrt;
                    history[lastIndex].translated = subtitleFiles[fileIndex].translated;
                    localStorage.setItem('translationHistory', JSON.stringify(history));
                }
            }
        });
    });
}

function updateProgressBars() {
    const progressBars = document.getElementById('progressBars');
    progressBars.innerHTML = '';
    subtitleFiles.forEach(fileObj => {
        const progressDiv = document.createElement('div');
        progressDiv.className = 'mb-2';
        progressDiv.innerHTML = `
            <p class="text-gray-600">${fileObj.file.name}</p>
            <div class="w-full bg-gray-200 rounded-full h-4">
                <div class="bg-blue-500 h-4 rounded-full transition-all duration-500" style="width: ${fileObj.progress}%"></div>
            </div>
            <p class="text-sm text-gray-500">${fileObj.progress}%</p>
        `;
        progressBars.appendChild(progressDiv);
    });
}

function sanitizeClassName(name) {
    return name.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function convertToVtt(subtitles, fileType, styles = {}) {
    let vtt = 'WEBVTT\n\n';
    subtitles.forEach(sub => {
        let timecode = sub.timecode;
        if (fileType === 'srt') {
            timecode = timecode.replace(',', '.');
        }
        const style = styles[sub.style] || {};
        const cssStyle = style.font ? `::cue { font-family: ${style.font}; font-size: ${style.fontsize || '16'}px; color: ${style.primaryColour || '#ffffff'}; }` : '';
        vtt += `${timecode}\n${cssStyle}\n${sub.text}\n\n`;
    });
    return vtt;
}

function updateVideoSubtitles(subtitles, fileType, styles = {}) {
    if (!hasVideo || !subtitles || subtitles.length === 0) {
        const subtitleTrack = document.getElementById('subtitleTrack');
        subtitleTrack.removeAttribute('src');
        return;
    }
    const vttContent = convertToVtt(subtitles, fileType, styles);
    const blob = new Blob([vttContent], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const subtitleTrack = document.getElementById('subtitleTrack');
    subtitleTrack.src = url;
    subtitleTrack.srcLang = document.getElementById('language').value || 'fa';
    subtitleTrack.label = `زیرنویس (${document.getElementById('language').value})`;
    subtitleTrack.default = true;
}

async function translateWithService(service, model, subtitle, lang, tone, separator, noCensor) {
    const prompt = settings.prompt.replace('{LANG}', lang).replace('{TONE}', tone).replace('{TEXT}', subtitle.text) + (noCensor ? '\nعدم سانسور محتوای صریح.' : '');
    let response;
    try {
        if (service === 'gemini') {
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKeys.gemini },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
        } else if (service === 'deepseek') {
            response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKeys.deepseek}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] })
            });
        } else if (service === 'huggingface') {
            response = await fetch('https://api-inference.huggingface.co/models/facebook/nllb-200-distilled-600M', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeys.huggingface || ''}` },
                body: JSON.stringify({ inputs: subtitle.text, parameters: { src_lang: 'eng_Latn', tgt_lang: lang === 'فارسی' ? 'pes_Arab' : 'eng_Latn' } })
            });
        } else if (service === 'openrouter') {
            response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKeys.openrouter}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Subtitle Translator'
                },
                body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] })
            });
        }
        if (!response.ok) throw new Error(`خطای API: ${response.status}`);
        const data = await response.json();
        if (service === 'huggingface') {
            return data[0]?.translatedText || 'خطا در ترجمه';
        } else {
            return data.candidates?.[0]?.content?.parts?.[0]?.text?.split('---').join(separator) || data.choices?.[0]?.message?.content?.split('---').join(separator) || 'خطا در ترجمه';
        }
    } catch (error) {
        throw error;
    }
}

document.getElementById('translateBtn').addEventListener('click', async () => {
    if (subtitleFiles.length === 0 || !document.getElementById('model').value) {
        alert('لطفاً فایل زیرنویس و مدل AI را انتخاب کنید.');
        return;
    }
    const service = document.getElementById('service').value;
    if (service !== 'huggingface' && !apiKeys[service]) {
        alert('لطفاً کلید API را وارد کنید.');
        return;
    }

    const languageSelect = document.getElementById('language');
    const modelSelect = document.getElementById('model');
    const lang = languageSelect.value || 'فارسی';
    const model = modelSelect.value;
    const delay = settings.delay;
    const separator = settings.separator;
    const tone = settings.tone;
    const noCensor = settings.noCensor;
    const outputArea = document.getElementById('output');
    const spinner = document.getElementById('spinner');
    spinner.style.display = 'inline-block';
    document.getElementById('translateBtn').disabled = true;

    let fallbackServices = ['huggingface', 'deepseek'].filter(s => s !== service);
    if (service === 'openrouter') {
        fallbackServices = ['huggingface', 'deepseek'];
    }

    for (let fileIndex = 0; fileIndex < subtitleFiles.length; fileIndex++) {
        const fileObj = subtitleFiles[fileIndex];
        if (!fileObj.subtitles.length) continue;

        currentSubtitles = fileObj.subtitles;
        currentFileType = fileObj.type;
        assStyles = fileObj.styles;
        let translated = [];
        outputArea.value = `در حال ترجمه فایل ${fileIndex + 1} از ${subtitleFiles.length}: ${fileObj.file.name}... (0%)\n`;
        fileObj.progress = 0;
        if (fileIndex === parseInt(fileSelect.value)) {
            renderPreview(currentSubtitles, translated);
        }
        updateProgressBars();

        for (let i = 0; i < currentSubtitles.length; i++) {
            const subtitle = currentSubtitles[i];
            let retries = 0;
            const maxRetries = 3;
            let currentService = service;

            while (retries < maxRetries) {
                try {
                    const translatedText = await translateWithService(currentService, model, subtitle, lang, tone, separator, noCensor);
                    translated.push({ ...subtitle, text: translatedText });
                    fileObj.progress = Math.round((i + 1) / currentSubtitles.length * 100);
                    outputArea.value = `در حال ترجمه فایل ${fileIndex + 1} از ${subtitleFiles.length}: ${fileObj.file.name}... (${fileObj.progress}%)\n`;
                    if (fileIndex === parseInt(fileSelect.value)) {
                        renderPreview(currentSubtitles, translated);
                        if (hasVideo) {
                            updateVideoSubtitles(translated, currentFileType, fileObj.styles);
                        }
                    }
                    updateProgressBars();
                    break;
                } catch (error) {
                    console.error(`خطا در ترجمه خط ${i + 1} از ${fileObj.file.name} با ${currentService}:`, error);
                    retries++;
                    if (retries >= maxRetries && fallbackServices.length > 0) {
                        currentService = fallbackServices.shift();
                        retries = 0;
                        outputArea.value += `سوئیچ به ${currentService}...\n`;
                        continue;
                    } else if (retries >= maxRetries) {
                        alert(`خطا در ترجمه خط ${i + 1} از ${fileObj.file.name}: ${error.message}`);
                        outputArea.value = `ترجمه ${fileObj.file.name} متوقف شد.`;
                        spinner.style.display = 'none';
                        document.getElementById('translateBtn').disabled = false;
                        return;
                    }
                }
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        if (translated.length === 0) continue;

        let outputSrt = '';
        translated.forEach(sub => {
            outputSrt += `${sub.index}\n${sub.timecode}\n${sub.text}\n\n`;
        });
        fileObj.translated = translated;
        if (fileIndex === parseInt(fileSelect.value)) {
            document.getElementById('output').value = outputSrt;
            if (hasVideo) {
                updateVideoSubtitles(translated, currentFileType, fileObj.styles);
            }
        }

        const history = JSON.parse(localStorage.getItem('translationHistory')) || [];
        history.push({
            timestamp: Date.now(),
            language: lang,
            output: outputSrt,
            subtitles: currentSubtitles,
            translated: translated,
            fileType: currentFileType,
            fileName: fileObj.file.name,
            styles: fileObj.styles
        });
        if (history.length > 10) history.shift();
        localStorage.setItem('translationHistory', JSON.stringify(history));
        loadTranslationHistory();

        const sanitizedFileName = sanitizeClassName(fileObj.file.name);
        const existingDownloadBtn = document.querySelector(`.download-btn-${sanitizedFileName}`);
        if (existingDownloadBtn) existingDownloadBtn.remove();
        const downloadBtn = document.createElement('button');
        downloadBtn.className = `download-btn-${sanitizedFileName} bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition duration-300 hover:scale-105 mt-2 w-full`;
        downloadBtn.textContent = `دانلود ${fileObj.file.name} ترجمه‌شده`;
        downloadBtn.onclick = () => download(outputSrt, `translated_${fileObj.file.name}`, 'text/plain');
        outputArea.parentNode.appendChild(downloadBtn);
    }

    spinner.style.display = 'none';
    document.getElementById('translateBtn').disabled = false;
    outputArea.value = subtitleFiles[parseInt(fileSelect.value)]?.translated.length > 0
        ? subtitleFiles[parseInt(fileSelect.value)].translated.map(sub => `${sub.index}\n${sub.timecode}\n${sub.text}\n\n`).join('')
        : 'ترجمه تمام فایل‌ها تکمیل شد.';
});

document.getElementById('newTranslateBtn').addEventListener('click', () => {
    if (subtitleFiles.length > 0 && subtitleFiles.some(f => f.translated.length > 0)) {
        const history = JSON.parse(localStorage.getItem('translationHistory')) || [];
        subtitleFiles.forEach(fileObj => {
            if (fileObj.translated.length > 0) {
                const outputSrt = fileObj.translated.map(sub => `${sub.index}\n${sub.timecode}\n${sub.text}\n\n`).join('');
                history.push({
                    timestamp: Date.now(),
                    language: document.getElementById('language').value || 'فارسی',
                    output: outputSrt,
                    subtitles: fileObj.subtitles,
                    translated: fileObj.translated,
                    fileType: fileObj.type,
                    fileName: fileObj.file.name,
                    styles: fileObj.styles
                });
            }
        });
        if (history.length > 10) history.shift();
        localStorage.setItem('translationHistory', JSON.stringify(history));
        loadTranslationHistory();
    }

    subtitleFiles = [];
    currentSubtitles = [];
    currentFileType = 'srt';
    assStyles = {};
    hasVideo = false;
    document.getElementById('fileInput').value = '';
    document.getElementById('videoInput').value = '';
    document.getElementById('audioInput').value = '';
    document.getElementById('fileSelect').innerHTML = '<option value="">فایلی انتخاب نشده</option>';
    document.getElementById('language').value = 'فارسی';
    document.getElementById('model').value = '';
    document.getElementById('output').value = '';
    document.getElementById('previewTable').innerHTML = '';
    document.getElementById('historySelect').value = '';
    document.getElementById('historyFilter').value = '';
    document.getElementById('progressBars').innerHTML = '';
    document.getElementById('translateBtn').disabled = true;
    document.querySelectorAll('[class*="download-btn"]').forEach(btn => btn.remove());
    updateVideoSubtitles([], currentFileType, {});
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.pause();
    document.getElementById('videoSource').src = '';
    videoPlayer.load();
});

function download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

if (apiKeys.gemini) {
    document.getElementById('service').value = 'gemini';
    fetchModels('gemini');
} else {
    document.getElementById('service').value = 'huggingface';
    fetchModels('huggingface');
}