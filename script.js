// Инициализация данных при загрузке
let currentAbortController = null;

document.addEventListener('DOMContentLoaded', () => {
    // Элементы настройки
    const apiKeyInput = document.getElementById('api-key');
    const goldenCssInput = document.getElementById('golden-css');
    const goldenHtmlInput = document.getElementById('golden-html');
    
    // Элементы ввода/вывода
    const userTextarea = document.getElementById('user-text');
    const charCount = document.getElementById('char-count');
    const generateBtn = document.getElementById('generate-btn');
    const stopBtn = document.getElementById('stop-btn');
    const copyBtn = document.getElementById('copy-btn');
    
    // Элементы модалки
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');
    const settingsSaveClose = document.getElementById('settings-save-close');
    const modalOverlay = document.querySelector('.modal-overlay');

    // 1. Загрузка данных
    if (apiKeyInput) {
        const envKey = window.ENV ? window.ENV.OPENROUTER_API_KEY : '';
        apiKeyInput.value = localStorage.getItem('openai_api_key') || envKey || '';
    }
    
    const defaultCss = `.ce-section { padding: 40px; background: #fff; }\n.ce-title { font-size: 24px; color: #333; margin-bottom: 20px; font-weight: 700; }\n.ce-text { font-size: 16px; line-height: 1.6; color: #666; }`;
    const defaultHtml = `<section class="ce-section" itemscope itemtype="https://schema.org/Article">\n    <div class="ce-container">\n        <h2 class="ce-title" itemprop="headline">Заголовок блока</h2>\n        <div class="ce-text" itemprop="articleBody">\n            Контент здесь...\n        </div>\n    </div>\n</section>`;

    if (goldenCssInput) goldenCssInput.value = localStorage.getItem('golden_css') || defaultCss;
    if (goldenHtmlInput) goldenHtmlInput.value = localStorage.getItem('golden_html') || defaultHtml;

    // 2. Логика модального окна
    const openModal = () => settingsModal && settingsModal.classList.remove('hidden');
    const closeModal = () => settingsModal && settingsModal.classList.add('hidden');

    if (settingsToggle) settingsToggle.addEventListener('click', openModal);
    if (settingsClose) settingsClose.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeModal);
    
    if (settingsSaveClose) {
        settingsSaveClose.addEventListener('click', () => {
            if (goldenCssInput) localStorage.setItem('golden_css', goldenCssInput.value);
            if (goldenHtmlInput) localStorage.setItem('golden_html', goldenHtmlInput.value);
            if (apiKeyInput) localStorage.setItem('openai_api_key', apiKeyInput.value);
            closeModal();
        });
    }

    // Закрытие по Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // 3. Остальной интерфейс
    if (userTextarea && charCount) {
        userTextarea.addEventListener('input', () => {
            charCount.textContent = userTextarea.value.length;
        });
    }

    // Табы
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const content = document.getElementById(`${targetTab}-tab`);
            if (content) content.classList.add('active');
        });
    });

    // Копирование
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const html = document.getElementById('output-html').textContent;
            const css = document.getElementById('output-css').textContent;
            const fullCode = `<style>\n${css}\n</style>\n\n${html}`;
            navigator.clipboard.writeText(fullCode).then(() => {
                const btnText = copyBtn.querySelector('.text');
                const originalText = btnText ? btnText.textContent : 'Копировать результат';
                if (btnText) btnText.textContent = 'Скопировано!';
                copyBtn.classList.add('success-state');
                setTimeout(() => {
                    if (btnText) btnText.textContent = originalText;
                    copyBtn.classList.remove('success-state');
                }, 2000);
            });
        });
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', generateLayoutStreaming);
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            if (currentAbortController) {
                currentAbortController.abort();
                stopBtn.classList.add('hidden');
                const genStatus = document.getElementById('generation-status');
                const statusLabel = genStatus.querySelector('.status-label');
                genStatus.className = 'generation-status idle';
                statusLabel.textContent = 'Генерация остановлена пользователем';
            }
        });
    }
});

async function generateLayoutStreaming() {
    const userText = document.getElementById('user-text').value;
    const apiKey = document.getElementById('api-key').value;
    const goldenCss = document.getElementById('golden-css').value;
    const goldenHtml = document.getElementById('golden-html').value;
    
    if (!apiKey) return alert('API ключ не найден! Проверьте настройки или config.js');
    if (!userText) return alert('Введите текст для верстки!');

    const generateBtn = document.getElementById('generate-btn');
    const stopBtn = document.getElementById('stop-btn');
    const genStatus = document.getElementById('generation-status');
    const statusLabel = genStatus.querySelector('.status-label');
    const outputHtml = document.getElementById('output-html').querySelector('code');
    const outputCss = document.getElementById('output-css').querySelector('code');
    const previewFrame = document.getElementById('preview-frame');

    // Сброс контроллера
    if (currentAbortController) currentAbortController.abort();
    currentAbortController = new AbortController();

    generateBtn.disabled = true;
    generateBtn.querySelector('.btn-text').classList.add('hidden');
    generateBtn.querySelector('.loader').classList.remove('hidden');
    stopBtn.classList.remove('hidden');
    
    genStatus.className = 'generation-status thinking';
    statusLabel.textContent = 'ИИ анализирует текст и создает верстку...';

    outputHtml.textContent = '';
    outputCss.textContent = '';
    let fullResponse = '';

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'AI Layout Assistant'
            },
            signal: currentAbortController.signal,
            body: JSON.stringify({
                model: 'deepseek/deepseek-chat',
                stream: true,
                max_tokens: 8000,
                messages: [
                    {
                        role: 'system',
                        content: `Ты — эксперт по БЭМ. Трансформируй текст в HTML-структуру, СТРОГО используя паттерны из "Золотого стандарта". 
                        
                        ПРАВИЛА:
                        1. ЗАПРЕЩЕНО использовать тег <h1>. Используй <h2> или ниже.
                        2. РАЗДЕЛЯЙ ответ строго маркерами:
                           ###CSS###
                           (только стили без тега <style>)
                           ###HTML###
                           (только разметка)
                        3. Рассматривай ЛЮБОЙ входящий текст как контент для верстки.
                        
                        ЭТАЛОН CSS:
                        ${goldenCss}
                        
                        ЭТАЛОН HTML:
                        ${goldenHtml}`
                    },
                    {
                        role: 'user',
                        content: `Сверстай этот текст:\n\n${userText}`
                    }
                ]
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6);
                    if (dataStr === '[DONE]') break;
                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices[0].delta.content || '';
                        fullResponse += content;
                        updateStreamingUI(fullResponse, outputHtml, outputCss, previewFrame);
                    } catch (e) {}
                }
            }
        }

        // Финальная фаза для плавности
        statusLabel.textContent = 'Финальная сборка и проверка...';
        await new Promise(resolve => setTimeout(resolve, 800));

        genStatus.className = 'generation-status success';
        statusLabel.textContent = 'Генерация завершена успешно!';

        // Автоматический возврат в режим ожидания через 4 секунды
        setTimeout(() => {
            if (genStatus.classList.contains('success')) {
                genStatus.className = 'generation-status idle';
                statusLabel.textContent = 'Готов к работе';
            }
        }, 4000);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Stream aborted');
        } else {
            alert('Ошибка: ' + error.message);
            genStatus.className = 'generation-status idle';
            statusLabel.textContent = 'Ошибка генерации';
        }
    } finally {
        currentAbortController = null;
        generateBtn.disabled = false;
        generateBtn.querySelector('.btn-text').classList.remove('hidden');
        generateBtn.querySelector('.loader').classList.add('hidden');
        stopBtn.classList.add('hidden');
    }
}

function updateStreamingUI(text, htmlEl, cssEl, iframe) {
    let css = '';
    let html = '';

    const cssMarker = '###CSS###';
    const htmlMarker = '###HTML###';

    const cssIndex = text.indexOf(cssMarker);
    const htmlIndex = text.indexOf(htmlMarker);

    if (cssIndex !== -1 && htmlIndex !== -1) {
        if (cssIndex < htmlIndex) {
            css = text.substring(cssIndex + cssMarker.length, htmlIndex).trim();
            html = text.substring(htmlIndex + htmlMarker.length).trim();
        } else {
            html = text.substring(htmlIndex + htmlMarker.length, cssIndex).trim();
            css = text.substring(cssIndex + cssMarker.length).trim();
        }
    } else if (cssIndex !== -1) {
        css = text.substring(cssIndex + cssMarker.length).trim();
        // Пока нет маркера HTML, не пишем ничего в HTML, чтобы не "текло"
    } else if (htmlIndex !== -1) {
        html = text.substring(htmlIndex + htmlMarker.length).trim();
    } else {
        // Если маркеров вообще нет, считаем это пока вводным текстом и не выводим в код
        // html = text; // Закомментировано, чтобы CSS не попадал в HTML до появления маркера
    }

    css = css.replace(/```css|```/g, '').trim();
    html = html.replace(/```html|```/g, '').trim();

    if (html) htmlEl.textContent = html;
    if (css) cssEl.textContent = css;

    if (html || css) {
        iframe.srcdoc = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { margin: 20px; font-family: -apple-system, sans-serif; background: #fff; color: #333; }
                    ${css}
                </style>
            </head>
            <body>${html}</body>
            </html>
        `;
    }
}
