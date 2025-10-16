// توابع پارسر زیرنویس
function parseSrt(content) {
    const subtitles = [];
    // نرمال‌سازی خط جدید و حذف BOM
    const normalizedContent = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // جدا کردن بلوک‌ها با در نظر گرفتن فاصله‌های اضافی
    const blocks = normalizedContent.split(/\n\s*\n/).filter(block => block.trim());
    
    for (const block of blocks) {
        const lines = block.trim().split('\n').filter(line => line.trim());
        if (lines.length >= 3) {
            // بررسی اعتبار شماره زیرنویس
            const index = lines[0].trim();
            if (!/^\d+$/.test(index)) continue;

            // بررسی اعتبار تایم‌کد
            const timecode = lines[1].trim();
            if (!/^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/.test(timecode)) continue;

            // ترکیب خطوط متن باقیمانده
            const text = lines.slice(2).join('\n').trim();
            if (text) {
                subtitles.push({ index, timecode, text });
            }
        }
    }
    if (subtitles.length === 0) throw new Error('فایل SRT خالی یا نامعتبر است.');
    return subtitles;
}

function parseVtt(content) {
    const subtitles = [];
    // حذف WEBVTT و خطوط خالی اضافی
    const normalizedContent = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalizedContent.split(/\n\s*\n/).filter(block => !block.startsWith('WEBVTT') && block.trim());
    let index = 1;

    for (const block of blocks) {
        const lines = block.trim().split('\n').filter(line => line.trim());
        if (lines.length >= 2) {
            // بررسی تایم‌کد
            const timecode = lines[0].trim().replace('.', ',');
            if (!/^\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,\.]\d{3}/.test(timecode)) continue;

            // ترکیب خطوط متن
            const text = lines.slice(1).join('\n').trim();
            if (text) {
                subtitles.push({ index: String(index++), timecode, text });
            }
        }
    }
    if (subtitles.length === 0) throw new Error('فایل VTT خالی یا نامعتبر است.');
    return subtitles;
}

function parseSsa(content) {
    const subtitles = [];
    const styles = {};
    const normalizedContent = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n');
    let index = 1;
    let inStyles = false;
    let inEvents = false;

    for (const line of lines) {
        if (line.startsWith('[V4+ Styles]')) {
            inStyles = true;
            inEvents = false;
            continue;
        }
        if (line.startsWith('[Events]')) {
            inStyles = false;
            inEvents = true;
            continue;
        }

        if (inStyles && line.startsWith('Style: ')) {
            const parts = line.substring(7).split(',');
            if (parts.length >= 4) {
                const styleName = parts[0].trim();
                styles[styleName] = {
                    font: parts[1].trim(),
                    size: parts[2].trim(),
                    color: parts[3].trim()
                };
            }
        }

        if (inEvents && line.startsWith('Dialogue: ')) {
            const parts = line.substring(10).split(',');
            if (parts.length >= 9) {
                const start = parts[1].trim();
                const end = parts[2].trim();
                const style = parts[3].trim();
                const text = parts.slice(9).join(',').replace(/{[^}]*}/g, '').trim();

                if (text) {
                    subtitles.push({
                        index: String(index++),
                        timecode: `${start} --> ${end}`,
                        text,
                        style
                    });
                }
            }
        }
    }

    if (subtitles.length === 0) throw new Error('فایل SSA/ASS خالی یا نامعتبر است.');
    return { subtitles, styles };
}

// عملیات کمکی
function formatTimecode(timecode) {
    return timecode.replace('.', ',');
}

// Export functions
window.parseSrt = parseSrt;
window.parseVtt = parseVtt;
window.parseSsa = parseSsa;