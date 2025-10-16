async function translateWithService(service, model, subtitle, lang, tone, separator, noCensor, apiKeys, settings) {
    const prompt = settings.prompt.replace('{LANG}', lang).replace('{TONE}', tone).replace('{TEXT}', subtitle.text) + (noCensor ? '\nعدم سانسور محتوای صریح.' : '');
    let retryCount = 0;
    const maxRetries = settings.retryAttempts || 3;
    const baseDelay = settings.initialDelay || 2000;
    const maxDelay = settings.maxDelay || 30000;

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // مدیریت خطاهای قبلی
    if (window.lastRateLimitError) {
        const timeSinceError = Date.now() - window.lastRateLimitError;
        if (timeSinceError < 60000) { // کمتر از یک دقیقه
            await wait(Math.min(maxDelay, settings.delay * 2));
        }
    }

    async function makeAPIRequest() {
        let response;
        try {
            if (service === 'gemini') {
                response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKeys.gemini
                    },
                    body: JSON.stringify({ 
                        contents: [{ parts: [{ text: prompt }] }],
                        safetySettings: [
                            { category: 'HARM_CATEGORY_DANGEROUS', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                        ],
                        generationConfig: {
                            temperature: 0.3, // کاهش خلاقیت برای ترجمه‌های دقیق‌تر
                            topK: 40,
                            topP: 0.8, // کاهش برای نتایج محافظه‌کارانه‌تر
                            maxOutputTokens: 1024,
                            stopSequences: ["---"] // توقف در نشانگر پایان ترجمه
                        }
                    })
                });
            } else if (service === 'deepseek') {
                response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKeys.deepseek}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model,
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                        max_tokens: 1024
                    })
                });
            } else if (service === 'huggingface') {
                response = await fetch('https://api-inference.huggingface.co/models/facebook/nllb-200-distilled-600M', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKeys.huggingface || ''}`
                    },
                    body: JSON.stringify({
                        inputs: subtitle.text,
                        parameters: {
                            src_lang: 'eng_Latn',
                            tgt_lang: lang === 'فارسی' ? 'pes_Arab' : 'eng_Latn'
                        }
                    })
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
                    body: JSON.stringify({
                        model,
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                        max_tokens: 1024
                    })
                });
            }

            if (!response.ok) {
                const status = response.status;
                if (status === 429) {
                    window.lastRateLimitError = Date.now();
                    throw new Error('RATE_LIMIT');
                } else if (status >= 500) {
                    throw new Error('SERVICE_UNAVAILABLE');
                }
                throw new Error(`خطای API: ${status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            if (error.message === 'RATE_LIMIT') {
                const backoffDelay = Math.min(maxDelay, baseDelay * Math.pow(2, retryCount));
                console.warn(`Rate limit hit, waiting ${backoffDelay}ms before retry...`);
                await wait(backoffDelay);
            }
            throw error;
        }
    }

    while (retryCount < maxRetries) {
        try {
            const data = await makeAPIRequest();
            
            if (service === 'huggingface') {
                return data[0]?.translatedText || 'خطا در ترجمه';
            } else {
                let translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text ||
                                   data.choices?.[0]?.message?.content ||
                                   'خطا در ترجمه';

                // پردازش و تمیز کردن متن ترجمه شده
                translatedText = translatedText
                    .split('---')
                    .pop() // فقط آخرین بخش بعد از جداکننده
                    .replace(/<[^>]+>/g, '') // حذف تگ‌های <>
                    .replace(/^\s*[\r\n]/gm, '') // حذف خطوط خالی
                    .trim();

                return translatedText || 'خطا در ترجمه';
            }
        } catch (error) {
            retryCount++;
            console.warn(`تلاش ${retryCount} از ${maxRetries} با خطا مواجه شد:`, error.message);
            
            if (retryCount === maxRetries) {
                throw new Error(`خطا پس از ${maxRetries} تلاش: ${error.message}`);
            }

            // تاخیر نمایی قبل از تلاش مجدد
            const retryDelay = Math.min(maxDelay, baseDelay * Math.pow(2, retryCount - 1));
            await wait(retryDelay);
        }
    }

    throw new Error('خطای نامشخص در ترجمه');
}