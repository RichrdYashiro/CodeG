// Инициализация данных при загрузке
let currentAbortController = null;
let lastIframeUpdate = 0;

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
    
    // Word Upload & Drop Zone
    const wordLoadBtn = document.getElementById('word-load-btn');
    const wordUploadInput = document.getElementById('word-upload');
    const dropZone = document.getElementById('drop-zone');
    const backToTextBtn = document.getElementById('back-to-text');
    
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

        // Очистка при вставке
        userTextarea.addEventListener('paste', (e) => {
            setTimeout(() => {
                userTextarea.value = cleanText(userTextarea.value);
                charCount.textContent = userTextarea.value.length;
            }, 10);
        });
    }

    function cleanText(text) {
        if (!text) return '';
        return text
            .replace(/\r\n/g, '\n') // Нормализация переносов
            .replace(/[ \t]+/g, ' ') // Убираем лишние пробелы в строке
            .replace(/\n\s*\n\s*\n+/g, '\n\n') // Заменяем 3+ пустых строки на 2
            .trim();
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
    
    // 4. Word File Handling & Drop Zone logic
    if (wordLoadBtn && wordUploadInput && dropZone) {
        // Переключение на Drop Zone
        wordLoadBtn.addEventListener('click', () => {
            userTextarea.classList.add('hidden');
            dropZone.classList.remove('hidden');
        });

        // Возврат к тексту
        if (backToTextBtn) {
            backToTextBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Чтобы не срабатывал клик по dropZone
                userTextarea.classList.remove('hidden');
                dropZone.classList.add('hidden');
            });
        }

        // Клик по drop-zone для выбора файла
        dropZone.addEventListener('click', () => wordUploadInput.click());

        // Drag & Drop события
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        });
        
        wordUploadInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
            e.target.value = ''; // Сброс
        });

        async function handleFiles(files) {
            const file = files[0];
            if (!file) return;

            if (file.size === 0) {
                return alert('Файл пуст! Пожалуйста, выберите корректный Word файл.');
            }
            
            // Проверка на расширение
            if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
                return alert('Пожалуйста, выберите Word файл (.docx или .doc)');
            }
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                const arrayBuffer = event.target.result;
                try {
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    if (userTextarea) {
                        const cleanedText = cleanText(result.value);
                        userTextarea.value = cleanedText;
                        charCount.textContent = userTextarea.value.length;
                        
                        // Возвращаемся к тексту, чтобы показать результат
                        userTextarea.classList.remove('hidden');
                        dropZone.classList.add('hidden');

                        // Визуальный фидбек
                        const originalText = wordLoadBtn.innerHTML;
                        wordLoadBtn.innerHTML = '<span class="icon">✅</span> Готово';
                        setTimeout(() => {
                            wordLoadBtn.innerHTML = originalText;
                        }, 2000);
                    }
                } catch (err) {
                    console.error('Mammoth detail error:', err);
                    alert('Ошибка при чтении Word файла. Убедитесь, что это корректный .docx файл.');
                }
            };
            reader.readAsArrayBuffer(file);
        }
    }
});

async function generateLayoutStreaming() {
    const userText = document.getElementById('user-text').value.trim();
    const apiKey = document.getElementById('api-key').value.trim();
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
    const outputSchema = document.getElementById('output-schema').querySelector('code');
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
                model: 'openrouter/free', // Универсальный роутер бесплатных моделей (самый надежный вариант)
                stream: true,
                max_tokens: 8000,
                messages: [
                    {
                        role: 'system',
                        content: `Ты — эксперт по БЭМ. Трансформируй текст в HTML-структуру, СТРОГО используя паттерны и классы из "Золотого стандарта". 
                        
                        ПРАВИЛА СТРУКТУРЫ:
                        1. "ЭТАЛОН HTML" — это ОБЩАЯ ОБЕРТКА (контейнер) для всей страницы/блока. 
                        2. НЕ ПОВТОРЯЙ <section class="ce-section"> для каждого абзаца. Используй его ОДИН РАЗ как корневой элемент всей верстки.
                        3. Внутри этого контейнера создавай логическую структуру (заголовки, списки, текстовые блоки), используя классы из эталона (например, ce-title, ce-text и т.д.).
                        4. ЗАПРЕЩЕНО использовать тег <h1>. Используй <h2> или ниже.
                        
                        ПРАВИЛА CSS:
                        1. РАЗДЕЛЯЙ ответ строго маркерами: ###CSS###, ###HTML### и ###SCHEMA###.
                        2. В блоке ###SCHEMA### сгенерируй JSON-LD микроразметку (например, Article или Product) для этого контента.
                        3. МИНИМИЗИРУЙ НОВЫЙ CSS. Сначала попытайся сверстать всё, используя ТОЛЬКО классы из "ЭТАЛОН CSS". 
                        4. НЕ ДУБЛИРУЙ стили из эталона. В блоке ###CSS### пиши ТОЛЬКО новые свойства.
                        4. Новые стили создавай только для уникальных элементов, если существующих классов не хватает для красоты.
                        5. Рассматривай ЛЮБОЙ входящий текст как контент для верстки.
                        
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

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('OpenRouter Error:', errorData);
            throw new Error(errorData.error?.message || `Ошибка сервера: ${response.status}`);
        }

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
                        updateStreamingUI(fullResponse, outputHtml, outputCss, outputSchema, previewFrame, false);
                    } catch (e) {}
                }
            }
        }

        // Финальный вызов для точности
        updateStreamingUI(fullResponse, outputHtml, outputCss, outputSchema, previewFrame, true);

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

function updateStreamingUI(text, htmlEl, cssEl, schemaEl, iframe, isFinal = false) {
    let css = '';
    let html = '';
    let schema = '';

    const cssMarker = '###CSS###';
    const htmlMarker = '###HTML###';
    const schemaMarker = '###SCHEMA###';

    // Поиск индексов всех маркеров
    const markers = [
        { id: 'css', index: text.indexOf(cssMarker), length: cssMarker.length },
        { id: 'html', index: text.indexOf(htmlMarker), length: htmlMarker.length },
        { id: 'schema', index: text.indexOf(schemaMarker), length: schemaMarker.length }
    ].filter(m => m.index !== -1).sort((a, b) => a.index - b.index);

    // Извлечение контента между маркерами
    for (let i = 0; i < markers.length; i++) {
        const start = markers[i].index + markers[i].length;
        const end = (i + 1 < markers.length) ? markers[i + 1].index : text.length;
        const content = text.substring(start, end).trim();

        if (markers[i].id === 'css') css = content;
        if (markers[i].id === 'html') html = content;
        if (markers[i].id === 'schema') schema = content;
    }

    css = css.replace(/```css|```/g, '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    html = html.replace(/```html|```/g, '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    schema = schema.replace(/```json|```|<script type="application\/ld\+json">|<\/script>/g, '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (html) htmlEl.textContent = html;
    if (css) cssEl.textContent = css;
    if (schema) schemaEl.textContent = schema;

    // Троттлинг обновления iframe для исключения мерцания
    const now = Date.now();
    if (now - lastIframeUpdate > 150 || isFinal) { // 150ms или финальный апдейт
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
            lastIframeUpdate = now;
        }
    }
}
