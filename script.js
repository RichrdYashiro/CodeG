// Инициализация данных при загрузке
let currentAbortController = null;
let lastIframeUpdate = 0;
let genTimerInterval = null;
let genStartTime = 0;
let isRefProcessing = false;

function startGenTimer() {
    const timerEl = document.getElementById('gen-timer');
    if (!timerEl) return;
    clearInterval(genTimerInterval);
    genStartTime = Date.now();
    genTimerInterval = setInterval(() => {
        const elapsed = (Date.now() - genStartTime) / 1000;
        timerEl.textContent = elapsed.toFixed(1) + 's';
    }, 100);
}

function stopGenTimer() {
    clearInterval(genTimerInterval);
}

document.addEventListener('DOMContentLoaded', () => {
    // Элементы настройки
    const apiKeyInput = document.getElementById('api-key');
    const goldenCssInput = document.getElementById('golden-css');
    const goldenHtmlInput = document.getElementById('golden-html');
    const schemaCheckboxes = document.getElementById('schema-checkboxes');
    const useSectionsCheck = document.getElementById('use-sections');
    const useContainerCheck = document.getElementById('use-container');
    
    // Элементы ввода/вывода
    const userTextarea = document.getElementById('user-text');
    const charCount = document.getElementById('char-count');
    const generateBtn = document.getElementById('generate-btn');
    const stopBtn = document.getElementById('stop-btn');
    const copyBtn = document.getElementById('copy-btn');
    const applyConfigBtn = document.getElementById('apply-config-btn');
    
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

    // Элементы фидбека
    const feedbackPanel = document.getElementById('feedback-panel');
    const feedbackText = document.getElementById('feedback-text');
    const refineBtn = document.getElementById('refine-btn');

    // 1. Загрузка данных
    if (apiKeyInput) {
        const envKey = window.ENV ? window.ENV.OPENROUTER_API_KEY : '';
        apiKeyInput.value = localStorage.getItem('openai_api_key') || envKey || '';
    }
    
    const defaultCss = `.ce-section { padding: 40px; background: #fff; }\n.ce-title { font-size: 24px; color: #333; margin-bottom: 20px; font-weight: 700; }\n.ce-text { font-size: 16px; line-height: 1.6; color: #666; }`;
    const defaultHtml = `<section class="ce-section" itemscope itemtype="https://schema.org/Article">\n    <div class="ce-container">\n        <h2 class="ce-title" itemprop="headline">Заголовок блока</h2>\n        <div class="ce-text" itemprop="articleBody">\n            Контент здесь...\n        </div>\n    </div>\n</section>`;

    if (goldenCssInput) goldenCssInput.value = localStorage.getItem('golden_css') || defaultCss;
    if (goldenHtmlInput) goldenHtmlInput.value = localStorage.getItem('golden_html') || defaultHtml;
    
    if (useSectionsCheck) useSectionsCheck.checked = localStorage.getItem('use_sections') !== 'false';
    if (useContainerCheck) useContainerCheck.checked = localStorage.getItem('use_container') !== 'false';

    const getSelectedSchemas = () => {
        const checked = document.querySelectorAll('#schema-checkboxes input:checked');
        return Array.from(checked).map(c => c.value);
    };

    const getSelectedHeadings = () => {
        const checked = document.querySelectorAll('#heading-checkboxes input:checked');
        return Array.from(checked).map(c => c.value);
    };

    const setSelectedSchemas = (schemas) => {
        document.querySelectorAll('#schema-checkboxes input').forEach(c => {
            c.checked = schemas.includes(c.value);
        });
    };

    const setSelectedHeadings = (headings) => {
        document.querySelectorAll('#heading-checkboxes input').forEach(c => {
            c.checked = headings.includes(c.value);
        });
    };

    try {
        const savedSchemas = JSON.parse(localStorage.getItem('schema_types') || '["auto"]');
        setSelectedSchemas(savedSchemas);
    } catch (e) {
        setSelectedSchemas(['auto']);
    }

    try {
        const savedHeadings = JSON.parse(localStorage.getItem('allowed_headings') || '["h2", "h3", "h4", "h5"]');
        setSelectedHeadings(savedHeadings);
    } catch (e) {
        setSelectedHeadings(['h2', 'h3', 'h4', 'h5']);
    }

    // 2. Логика модального окна
    const openModal = () => settingsModal && settingsModal.classList.remove('hidden');
    const closeModal = () => {
        if (isRefProcessing) return;
        if (settingsModal) settingsModal.classList.add('hidden');
    };

    if (settingsToggle) settingsToggle.addEventListener('click', openModal);
    if (settingsClose) settingsClose.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeModal);
    
    if (settingsSaveClose) {
        settingsSaveClose.addEventListener('click', () => {
            if (goldenCssInput) localStorage.setItem('golden_css', goldenCssInput.value);
            if (goldenHtmlInput) localStorage.setItem('golden_html', goldenHtmlInput.value);
            if (apiKeyInput) localStorage.setItem('openai_api_key', apiKeyInput.value);
            if (useSectionsCheck) localStorage.setItem('use_sections', useSectionsCheck.checked);
            if (useContainerCheck) localStorage.setItem('use_container', useContainerCheck.checked);
            localStorage.setItem('schema_types', JSON.stringify(getSelectedSchemas()));
            localStorage.setItem('allowed_headings', JSON.stringify(getSelectedHeadings()));
            
            const outputHtmlEl = document.getElementById('output-html');
            const hasContent = outputHtmlEl && outputHtmlEl.querySelector('code').textContent.trim().length > 0;
            
            closeModal();

            if (hasContent && applyConfigBtn) {
                applyConfigBtn.classList.remove('hidden');
            }
        });
    }

    if (applyConfigBtn) {
        applyConfigBtn.addEventListener('click', () => {
            applyConfigBtn.classList.add('hidden');
            refineLayoutStreaming("Примени измененные настройки конфигурации (теги заголовков, секции, контейнеры или микроразметку) к текущему коду. Не меняй контент и основной дизайн, только структуру согласно новым правилам конфигурации.");
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
        generateBtn.addEventListener('click', () => {
            if (feedbackPanel) feedbackPanel.classList.add('hidden');
            generateLayoutStreaming();
        });
    }

    if (refineBtn) {
        refineBtn.addEventListener('click', refineLayoutStreaming);
    }

    if (feedbackText) {
        feedbackText.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                refineLayoutStreaming();
            }
        });
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
        wordLoadBtn.addEventListener('click', () => {
            userTextarea.classList.add('hidden');
            dropZone.classList.remove('hidden');
        });

        if (backToTextBtn) {
            backToTextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userTextarea.classList.remove('hidden');
                dropZone.classList.add('hidden');
            });
        }

        dropZone.addEventListener('click', () => wordUploadInput.click());

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
            e.target.value = '';
        });

        async function handleFiles(files) {
            const file = files[0];
            if (!file) return;

            if (file.size === 0) return alert('Файл пуст!');
            if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) return alert('Пожалуйста, выберите Word файл');
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                const arrayBuffer = event.target.result;
                try {
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    if (userTextarea) {
                        const cleanedText = cleanText(result.value);
                        userTextarea.value = cleanedText;
                        charCount.textContent = userTextarea.value.length;
                        userTextarea.classList.remove('hidden');
                        dropZone.classList.add('hidden');
                    }
                } catch (err) {
                    alert('Ошибка при чтении Word файла');
                }
            };
            reader.readAsArrayBuffer(file);
        }

        // Resizer Logic
        const resizer = document.getElementById('panel-resizer');
        const appMain = document.querySelector('.app-main');
        let isResizing = false;

        if (resizer && appMain) {
            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizer.classList.add('active');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                
                // Предотвращаем "захват" мыши iframe-ом во время ресайза
                const iframe = document.getElementById('preview-frame');
                if (iframe) iframe.style.pointerEvents = 'none';
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                
                // Используем requestAnimationFrame для плавности
                requestAnimationFrame(() => {
                    if (!isResizing) return;
                    const containerRect = appMain.getBoundingClientRect();
                    const newWidth = e.clientX - containerRect.left;
                    
                    if (newWidth > 300 && newWidth < containerRect.width - 400) {
                        appMain.style.gridTemplateColumns = `${newWidth}px 10px 1fr`;
                    }
                });
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    resizer.classList.remove('active');
                    document.body.style.cursor = 'default';
                    document.body.style.userSelect = 'auto';
                    
                    const iframe = document.getElementById('preview-frame');
                    if (iframe) iframe.style.pointerEvents = 'auto';
                }
            });
        }
        // 5. Reference File Handling
        const refUploadBtn = document.getElementById('ref-upload-btn');
        const refUploadInput = document.getElementById('ref-upload-input');
        const refDropZone = document.getElementById('ref-drop-zone');

        if (refUploadBtn && refUploadInput && refDropZone) {
            refUploadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                refUploadInput.click();
            });

            refDropZone.addEventListener('click', () => refUploadInput.click());

            refUploadInput.addEventListener('change', (e) => {
                handleRefFile(e.target.files[0]);
                e.target.value = '';
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                refDropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    refDropZone.classList.add('drag-over');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                refDropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    refDropZone.classList.remove('drag-over');
                }, false);
            });

            refDropZone.addEventListener('drop', (e) => {
                handleRefFile(e.dataTransfer.files[0]);
            });

            async function handleRefFile(file) {
                if (!file) return;
                isRefProcessing = true;
                document.getElementById('modal-loading-overlay')?.classList.remove('hidden');
                
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const content = e.target.result;
                    await processReferenceWithAI(content);
                };
                reader.readAsText(file);
            }

            async function processReferenceWithAI(content) {
                const apiKey = apiKeyInput.value.trim();
                if (!apiKey) {
                    isRefProcessing = false;
                    document.getElementById('modal-loading-overlay')?.classList.add('hidden');
                    return alert('Для обработки файла нужен API ключ!');
                }

                const statusTitle = refDropZone.querySelector('strong');
                const originalTitle = statusTitle.textContent;
                
                refDropZone.classList.add('loading');
                statusTitle.textContent = 'ИИ анализирует файл...';

                try {
                    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify({
                            model: 'openrouter/free',
                            messages: [{
                                role: 'system',
                                content: 'Ты — помощник по верстке. Тебе дадут содержимое файла (HTML/CSS). Твоя задача: выделить из него чистый HTML-шаблон и чистый CSS. Верни ответ СТРОГО в формате: ###HTML### [код] ###CSS### [код].'
                            }, {
                                role: 'user',
                                content: `Раздели этот код на HTML и CSS:\n\n${content}`
                            }]
                        })
                    });

                    const data = await response.json();
                    if (data.error) throw new Error(data.error.message);
                    
                    const text = data.choices[0].message.content;
                    const htmlMatch = text.match(/###HTML###([\s\S]*?)(?=###CSS###|$)/);
                    const cssMatch = text.match(/###CSS###([\s\S]*?)$/);

                    if (htmlMatch && goldenHtmlInput) goldenHtmlInput.value = htmlMatch[1].trim();
                    if (cssMatch && goldenCssInput) goldenCssInput.value = cssMatch[1].trim();

                    statusTitle.textContent = 'Эталон успешно загружен!';
                } catch (err) {
                    alert('Ошибка при обработке эталона: ' + err.message);
                    statusTitle.textContent = 'Ошибка загрузки';
                } finally {
                    isRefProcessing = false;
                    document.getElementById('modal-loading-overlay')?.classList.add('hidden');
                    refDropZone.classList.remove('loading');
                    setTimeout(() => {
                        statusTitle.textContent = originalTitle;
                    }, 3000);
                }
            }
        }
    }
});

function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n\s*\n+/g, '\n\n')
        .trim();
}

async function generateLayoutStreaming() {
    const userText = document.getElementById('user-text').value.trim();
    const apiKey = document.getElementById('api-key').value.trim();
    const goldenCss = document.getElementById('golden-css').value;
    const goldenHtml = document.getElementById('golden-html').value;
    const useSections = document.getElementById('use-sections').checked;
    const useContainer = document.getElementById('use-container').checked;
    const allowedHeadings = Array.from(document.querySelectorAll('#heading-checkboxes input:checked')).map(c => c.value.toUpperCase());
    
    const checkedSchemas = Array.from(document.querySelectorAll('#schema-checkboxes input:checked')).map(c => c.value);
    const schemaPrompt = checkedSchemas.length === 0 
        ? "НЕ ГЕНЕРИРУЙ схему, оставь блок пустым."
        : `Сгенерируй JSON-LD микроразметку. ${checkedSchemas.includes('auto') ? 'Типы схем выбери автоматически исходя из контента.' : ''} ${checkedSchemas.filter(s => s !== 'auto').length > 0 ? 'ОБЯЗАТЕЛЬНО включи типы: ' + checkedSchemas.filter(s => s !== 'auto').join(', ') + '.' : ''}`;
    
    if (!apiKey) return alert('API ключ не найден!');
    if (!userText) return alert('Введите текст для верстки!');

    const generateBtn = document.getElementById('generate-btn');
    const stopBtn = document.getElementById('stop-btn');
    const feedbackPanel = document.getElementById('feedback-panel');
    const genStatus = document.getElementById('generation-status');
    const statusLabel = genStatus.querySelector('.status-label');
    const outputHtml = document.getElementById('output-html').querySelector('code');
    const outputCss = document.getElementById('output-css').querySelector('code');
    const outputSchema = document.getElementById('output-schema').querySelector('code');
    const previewFrame = document.getElementById('preview-frame');
    const applyConfigBtn = document.getElementById('apply-config-btn');

    if (currentAbortController) currentAbortController.abort();
    currentAbortController = new AbortController();

    generateBtn.disabled = true;
    generateBtn.querySelector('.btn-text').classList.add('hidden');
    generateBtn.querySelector('.loader').classList.remove('hidden');
    stopBtn.classList.remove('hidden');
    
    genStatus.className = 'generation-status thinking';
    statusLabel.textContent = 'Подключение к ИИ...';
    startGenTimer();

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
                model: 'openrouter/free',
                stream: true,
                max_tokens: 8000,
                messages: [
                    {
                        role: 'system',
                        content: `Ты — эксперт по БЭМ. Трансформируй текст в HTML-структуру, СТРОГО используя паттерны и классы из "Золотого стандарта". 
                        
                        ПРАВИЛА СТРУКТУРЫ:
                        1. "ЭТАЛОН HTML" — это ОБЩАЯ ОБЕРТКА (контейнер) для всей страницы/блока. 
                        2. ${useSections ? 'Используй <section class="ce-section"> как КОРНЕВОЙ элемент всей верстки.' : 'НЕ ИСПОЛЬЗУЙ тег <section> как обертку. Сразу начинай с контента или контейнера.'}
                        3. ${useContainer ? 'Внутри корневого элемента ОБЯЗАТЕЛЬНО добавь центрирующую обертку (например, <div class="ce-container">).' : 'НЕ ИСПОЛЬЗУЙ центрирующую обертку (container).'}
                        4. Внутри создавай логическую структуру (заголовки, списки, текстовые блоки), используя классы из эталона (например, ce-title, ce-text и т.д.).
                        5. ${allowedHeadings.length > 0 ? 'ИСПОЛЬЗУЙ ТОЛЬКО следующие теги заголовков: ' + allowedHeadings.join(', ') + '.' : 'НЕ ИСПОЛЬЗУЙ теги заголовков.'}
                        6. В блоке ###CSS### пиши ТОЛЬКО новые свойства.
                        
                        ПРАВИЛА CSS:
                        1. РАЗДЕЛЯЙ ответ строго маркерами: ###CSS###, ###HTML### и ###SCHEMA###.
                        2. В блоке ###SCHEMA### ${schemaPrompt}
                        3. МИНИМИЗИРУЙ НОВЫЙ CSS. Сначала попытайся сверстать всё, используя ТОЛЬКО классы из "ЭТАЛОН CSS". 
                        4. НЕ ДУБЛИРУЙ стили из эталона. В блоке ###CSS### пиши ТОЛЬКО новые свойства.
                        4. Новые стили создавай только для уникальных элементов, если существующих классов не хватает для красоты.
                        5. Рассматривай ЛЮБОЙ входящий текст как контент для верстки. ОБЯЗАТЕЛЬНО перенеси ВЕСЬ текст пользователя в HTML. НЕ СОКРАЩАЙ, не обобщай и не выбрасывай фрагменты текста. Каждый абзац и каждое предложение должны найти свое место в верстке.
                        
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
            throw new Error(errorData.error?.message || `Ошибка сервера: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        statusLabel.textContent = 'Создание верстки...';

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

        updateStreamingUI(fullResponse, outputHtml, outputCss, outputSchema, previewFrame, true);

        if (!fullResponse.trim()) {
            throw new Error('ИИ вернул пустой ответ. Проверьте API ключ или попробуйте другую модель.');
        }

        if (!fullResponse.includes('###HTML###') && !fullResponse.includes('###CSS###')) {
            throw new Error('ИИ вернул ответ в неправильном формате (отсутствуют маркеры ###HTML### или ###CSS###). Попробуйте еще раз.');
        }

        genStatus.className = 'generation-status success';
        statusLabel.textContent = 'Готово!';
        stopGenTimer();
        
        if (applyConfigBtn) applyConfigBtn.classList.add('hidden');
        if (feedbackPanel) feedbackPanel.classList.remove('hidden');

    } catch (error) {
        if (error.name !== 'AbortError') {
            alert('Ошибка: ' + error.message);
            genStatus.className = 'generation-status idle';
        }
    } finally {
        currentAbortController = null;
        generateBtn.disabled = false;
        generateBtn.querySelector('.btn-text').classList.remove('hidden');
        generateBtn.querySelector('.loader').classList.add('hidden');
        stopBtn.classList.add('hidden');
    }
}

async function refineLayoutStreaming(customMessage = null) {
    const feedbackText = customMessage || document.getElementById('feedback-text').value.trim();
    const apiKey = document.getElementById('api-key').value.trim();
    const goldenCss = document.getElementById('golden-css').value;
    const goldenHtml = document.getElementById('golden-html').value;
    
    const checkedSchemas = Array.from(document.querySelectorAll('#schema-checkboxes input:checked')).map(c => c.value);
    const schemaPrompt = checkedSchemas.length === 0 
        ? "НЕ ГЕНЕРИРУЙ схему."
        : `Обнови или создай JSON-LD микроразметку. ${checkedSchemas.includes('auto') ? 'Типы выбери автоматически.' : ''} ${checkedSchemas.filter(s => s !== 'auto').length > 0 ? 'Используй типы: ' + checkedSchemas.filter(s => s !== 'auto').join(', ') + '.' : ''}`;
    
    const useSections = document.getElementById('use-sections').checked;
    const useContainer = document.getElementById('use-container').checked;
    const allowedHeadings = Array.from(document.querySelectorAll('#heading-checkboxes input:checked')).map(c => c.value.toUpperCase());
    
    const currentHtml = document.getElementById('output-html').textContent;
    const currentCss = document.getElementById('output-css').textContent;
    const userText = document.getElementById('user-text').value.trim();

    if (!feedbackText) return alert('Введите, что нужно исправить!');
    if (!apiKey) return alert('API ключ не найден!');

    const refineBtn = document.getElementById('refine-btn');
    const stopBtn = document.getElementById('stop-btn');
    const genStatus = document.getElementById('generation-status');
    const statusLabel = genStatus.querySelector('.status-label');
    const outputHtml = document.getElementById('output-html').querySelector('code');
    const outputCss = document.getElementById('output-css').querySelector('code');
    const outputSchema = document.getElementById('output-schema').querySelector('code');
    const previewFrame = document.getElementById('preview-frame');
    const applyConfigBtn = document.getElementById('apply-config-btn');

    if (currentAbortController) currentAbortController.abort();
    currentAbortController = new AbortController();

    refineBtn.disabled = true;
    refineBtn.querySelector('.btn-text').classList.add('hidden');
    refineBtn.querySelector('.loader').classList.remove('hidden');
    stopBtn.classList.remove('hidden');

    genStatus.className = 'generation-status thinking';
    statusLabel.textContent = 'Внесение правок...';
    startGenTimer();

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
                model: 'openrouter/free',
                stream: true,
                max_tokens: 8000,
                messages: [
                    {
                        role: 'system',
                        content: `Ты — эксперт по БЭМ. Ты должен ИСПРАВИТЬ существующую верстку на основе пожеланий пользователя.
                        
                        ИСХОДНЫЕ ДАННЫЕ:
                        - Текст: ${userText}
                        - Текущий HTML: ${currentHtml}
                        - Текущий CSS: ${currentCss}
                        
                        ПРАВИЛА ИСПРАВЛЕНИЯ:
                        1. Сохраняй структуру БЭМ и классы из эталонов.
                        2. ${useSections ? 'ОБЯЗАТЕЛЬНО используй <section> как обертку.' : 'НЕ ИСПОЛЬЗУЙ <section>.'}
                        3. ${useContainer ? 'ОБЯЗАТЕЛЬНО используй контейнер-центровщик.' : 'НЕ ИСПОЛЬЗУЙ контейнер-центровщик.'}
                        4. ${allowedHeadings.length > 0 ? 'ИСПОЛЬЗУЙ ТОЛЬКО следующие теги заголовков: ' + allowedHeadings.join(', ') + '.' : 'НЕ ИСПОЛЬЗУЙ теги заголовков.'}
                        5. Вноси ТОЛЬКО те изменения, о которых просит пользователь. Сохраняй ВЕСЬ исходный текст, если не было команды его сократить.
                        6. РАЗДЕЛЯЙ ответ строго маркерами: ###CSS###, ###HTML### и ###SCHEMA###.
                        7. В блоке ###SCHEMA### ${schemaPrompt}
                        8. В блоке ###CSS### пиши ТОЛЬКО дополнительные или измененные стили.
                        6. Ответ должен быть ПОЛНЫМ кодом HTML и CSS.
                        
                        ЭТАЛОН CSS:
                        ${goldenCss}
                        
                        ЭТАЛОН HTML:
                        ${goldenHtml}`
                    },
                    {
                        role: 'user',
                        content: `ПОЖЕЛАНИЕ ПОЛЬЗОВАТЕЛЯ: ${feedbackText}`
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `Ошибка сервера: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        statusLabel.textContent = 'Обновление кода...';

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

        updateStreamingUI(fullResponse, outputHtml, outputCss, outputSchema, previewFrame, true);

        if (!fullResponse.trim()) {
            throw new Error('ИИ вернул пустой ответ при внесении правок.');
        }

        genStatus.className = 'generation-status success';
        statusLabel.textContent = 'Правки внесены!';
        stopGenTimer();
        document.getElementById('feedback-text').value = '';

    } catch (error) {
        if (error.name !== 'AbortError') {
            alert('Ошибка при внесении правок: ' + error.message);
            genStatus.className = 'generation-status idle';
        }
        stopGenTimer();
    } finally {
        currentAbortController = null;
        refineBtn.disabled = false;
        refineBtn.querySelector('.btn-text').classList.remove('hidden');
        refineBtn.querySelector('.loader').classList.add('hidden');
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

    const markers = [
        { id: 'css', index: text.indexOf(cssMarker), length: cssMarker.length },
        { id: 'html', index: text.indexOf(htmlMarker), length: htmlMarker.length },
        { id: 'schema', index: text.indexOf(schemaMarker), length: schemaMarker.length }
    ].filter(m => m.index !== -1).sort((a, b) => a.index - b.index);

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

    const now = Date.now();
    if (now - lastIframeUpdate > 150 || isFinal) {
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
