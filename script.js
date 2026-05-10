// Инициализация данных при загрузке
let currentAbortController = null;
let lastIframeUpdate = 0;
let genTimerInterval = null;
let genStartTime = 0;
let isRefProcessing = false;

// История версток
let layoutHistory = [];
let historyIndex = -1;

// Стек секций (Конструктор)
let layoutStack = [];

// Данные для Vision
let currentVisionBase64 = null;

async function pushToHistory(html, css, schema) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Локальное сохранение
    layoutHistory.push({ html, css, schema, timestamp: timeStr });
    historyIndex = layoutHistory.length - 1;

    // Сохранение в MySQL через PHP
    try {
        await fetch('api.php?action=save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html, css, schema, name: timeStr })
        });
    } catch (e) {
        console.error('Ошибка сохранения в БД:', e);
    }
}

async function updateHistoryUI() {
    const historyModal = document.getElementById('history-modal');
    const historyGrid = document.getElementById('history-grid');
    const emptyState = document.getElementById('history-modal-empty');
    if (!historyGrid || !emptyState) return;

    try {
        const response = await fetch('api.php?action=list');
        const dbHistory = await response.json();

        if (!dbHistory || dbHistory.length === 0) {
            historyGrid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        historyGrid.innerHTML = '';
        
        dbHistory.forEach((item) => {
            const card = document.createElement('div');
            card.className = `history-card`;
            
            const previewText = (item.preview || '').replace(/<[^>]*>?/gm, ' ').trim() + '...';
            
            card.innerHTML = `
                <div class="history-card-header">
                    <span class="history-card-time">${item.timestamp}</span>
                    <span class="history-card-version">ID: ${item.id}</span>
                </div>
                <div class="history-card-preview">${previewText}</div>
            `;
            
            card.onclick = () => loadVersionFromDB(item.id);
            historyGrid.appendChild(card);
        });
    } catch (e) {
        console.error('Ошибка загрузки истории:', e);
    }
}

async function loadVersionFromDB(id) {
    try {
        const response = await fetch(`api.php?action=get&id=${id}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const outputHtml = document.getElementById('output-html').querySelector('code');
        const outputCss = document.getElementById('output-css').querySelector('code');
        const outputSchema = document.getElementById('output-schema').querySelector('code');
        const previewFrame = document.getElementById('preview-frame');

        updateStreamingUI(`###HTML###${data.html_code}###CSS###${data.css_code}###SCHEMA###${data.schema_json}`, outputHtml, outputCss, outputSchema, previewFrame, true);
        
        document.getElementById('history-modal').classList.add('hidden');
    } catch (e) {
        alert('Ошибка загрузки версии: ' + e.message);
    }
}

function jumpToHistory(index) {
    if (index >= 0 && index < layoutHistory.length) {
        historyIndex = index;
        const state = layoutHistory[historyIndex];
        
        const outputHtml = document.getElementById('output-html').querySelector('code');
        const outputCss = document.getElementById('output-css').querySelector('code');
        const outputSchema = document.getElementById('output-schema').querySelector('code');
        const previewFrame = document.getElementById('preview-frame');
        
        if (outputHtml) outputHtml.textContent = state.html;
        if (outputCss) outputCss.textContent = state.css;
        if (outputSchema) outputSchema.textContent = state.schema;
        
        updateStreamingUI(`###HTML###${state.html}###CSS###${state.css}###SCHEMA###${state.schema}`, outputHtml, outputCss, outputSchema, previewFrame, true);
        
        updateHistoryUI();
    }
}

function navigateHistory(direction) {
    jumpToHistory(historyIndex + direction);
}

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
    
    // File Upload & Drop Zone
    const fileLoadBtn = document.getElementById('file-load-btn');
    const fileUploadInput = document.getElementById('file-upload');
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

    // Управление модальным окном истории
    const historyToggle = document.getElementById('history-toggle');
    const historyModal = document.getElementById('history-modal');
    const closeHistory = document.getElementById('close-history');
    if (historyToggle) {
        historyToggle.addEventListener('click', () => {
            updateHistoryUI();
            historyModal.classList.remove('hidden');
        });
    }
    if (closeHistory) {
        closeHistory.addEventListener('click', () => historyModal.classList.add('hidden'));
    }

    // Переключение вкладок ввода
    const inputTabs = document.querySelectorAll('[data-input-tab]');
    inputTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            inputTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const targetId = tab.dataset.inputTab + '-input-tab';
            document.querySelectorAll('.input-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Vision Upload
    const visionDropZone = document.getElementById('vision-drop-zone');
    const visionUpload = document.getElementById('vision-upload');
    const visionPreview = document.getElementById('vision-preview');
    const visionImgPreview = document.getElementById('vision-img-preview');
    const clearVision = document.getElementById('clear-vision');

    if (visionDropZone) {
        visionDropZone.addEventListener('click', () => visionUpload.click());
        visionDropZone.addEventListener('dragover', (e) => { e.preventDefault(); visionDropZone.classList.add('drag-over'); });
        visionDropZone.addEventListener('dragleave', () => visionDropZone.classList.remove('drag-over'));
        visionDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            visionDropZone.classList.remove('drag-over');
            handleVisionFile(e.dataTransfer.files[0]);
        });
    }

    if (visionUpload) {
        visionUpload.addEventListener('change', (e) => handleVisionFile(e.target.files[0]));
    }

    if (clearVision) {
        clearVision.addEventListener('click', () => {
            currentVisionBase64 = null;
            visionPreview.classList.add('hidden');
            visionDropZone.classList.remove('hidden');
        });
    }

    function handleVisionFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            currentVisionBase64 = e.target.result;
            visionImgPreview.src = currentVisionBase64;
            visionPreview.classList.remove('hidden');
            visionDropZone.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }

    // Конструктор (Стек)
    const addToStackBtn = document.getElementById('add-to-stack-btn');
    if (addToStackBtn) {
        addToStackBtn.addEventListener('click', () => {
            const html = document.getElementById('output-html').querySelector('code').textContent;
            const css = document.getElementById('output-css').querySelector('code').textContent;
            if (!html) return alert('Сначала сгенерируйте блок!');
            
            layoutStack.push({ html, css });
            alert(`Блок добавлен в стек! Всего блоков: ${layoutStack.length}`);
            
            // Если блоков больше 1, предлагаем "Собрать всё"
            if (layoutStack.length > 1) {
                const combinedHtml = layoutStack.map(s => s.html).join('\n\n');
                const combinedCss = layoutStack.map(s => s.css).join('\n\n');
                // Можно добавить кнопку "Просмотреть весь стек"
            }
        });
    }
    
    // --- АВТОРИЗАЦИЯ (Логика) ---
    const authBtn = document.getElementById('auth-btn');
    const authModal = document.getElementById('auth-modal');
    const closeAuth = document.getElementById('close-auth');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const toggleAuthMode = document.getElementById('toggle-auth-mode');
    const authTitle = document.getElementById('auth-title');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');
    const displayUsername = document.getElementById('display-username');

    let isLoginMode = true;

    async function checkAuthStatus() {
        try {
            const res = await fetch('api.php?action=check_auth');
            const data = await res.json();
            if (data.logged_in) {
                authBtn.classList.add('hidden');
                userInfo.classList.remove('hidden');
                displayUsername.textContent = data.username;
            } else {
                authBtn.classList.remove('hidden');
                userInfo.classList.add('hidden');
            }
        } catch (e) {}
    }

    if (authBtn) {
        authBtn.addEventListener('click', () => authModal.classList.remove('hidden'));
    }
    if (closeAuth) {
        closeAuth.addEventListener('click', () => authModal.classList.add('hidden'));
    }

    if (toggleAuthMode) {
        toggleAuthMode.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            authTitle.textContent = isLoginMode ? 'Войти в аккаунт' : 'Регистрация';
            authSubmitBtn.textContent = isLoginMode ? 'Войти' : 'Создать аккаунт';
            toggleAuthMode.textContent = isLoginMode ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти';
        });
    }

    if (authSubmitBtn) {
        authSubmitBtn.addEventListener('click', async () => {
            const username = document.getElementById('auth-username').value.trim();
            const password = document.getElementById('auth-password').value.trim();
            if (!username || !password) return alert('Заполните все поля');

            const action = isLoginMode ? 'login' : 'register';
            try {
                const res = await fetch(`api.php?action=${action}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (data.success) {
                    if (isLoginMode) {
                        alert('Успешный вход!');
                        authModal.classList.add('hidden');
                        checkAuthStatus();
                    } else {
                        alert('Регистрация успешна! Теперь войдите.');
                        isLoginMode = true;
                        authTitle.textContent = 'Войти в аккаунт';
                        authSubmitBtn.textContent = 'Войти';
                    }
                } else {
                    alert(data.error);
                }
            } catch (e) {
                alert('Ошибка сервера');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('api.php?action=logout');
            location.reload();
        });
    }

    checkAuthStatus();

    // 4. Word File Handling & Drop Zone logic
    if (fileLoadBtn && fileUploadInput && dropZone) {
        fileLoadBtn.addEventListener('click', () => {
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

        dropZone.addEventListener('click', () => fileUploadInput.click());

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
        
        fileUploadInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
            e.target.value = '';
        });

        async function handleFiles(files) {
            const file = files[0];
            if (!file) return;

            if (file.size === 0) return alert('Файл пуст!');
            
            const fileName = file.name.toLowerCase();
            const extension = fileName.substring(fileName.lastIndexOf('.'));
            
            try {
                let extractedText = '';
                
                if (extension === '.docx' || extension === '.doc') {
                    const arrayBuffer = await file.arrayBuffer();
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    extractedText = result.value;
                } else if (extension === '.pdf') {
                    extractedText = await extractTextFromPDF(file);
                } else if (extension === '.pptx') {
                    extractedText = await extractTextFromPPTX(file);
                } else if (extension === '.txt') {
                    extractedText = await file.text();
                } else {
                    return alert('Поддерживаются форматы Word (.docx), PDF (.pdf), PowerPoint (.pptx) и Текст (.txt)');
                }

                if (userTextarea && extractedText) {
                    const cleanedText = cleanText(extractedText);
                    userTextarea.value = cleanedText;
                    charCount.textContent = userTextarea.value.length;
                    userTextarea.classList.remove('hidden');
                    dropZone.classList.add('hidden');
                } else if (!extractedText) {
                    alert('Не удалось извлечь текст из файла или файл пуст.');
                }
            } catch (err) {
                console.error(err);
                alert('Ошибка при чтении файла: ' + err.message);
            }
        }

        async function extractTextFromPDF(file) {
            const arrayBuffer = await file.arrayBuffer();
            const pdfjsLib = window['pdfjs-dist/build/pdf'];
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            let fullText = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n\n';
            }
            
            return fullText;
        }

        async function extractTextFromPPTX(file) {
            const arrayBuffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            let fullText = '';
            
            // Находим все файлы слайдов в ppt/slides/
            const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
            
            // Сортируем слайды по номеру
            slideFiles.sort((a, b) => {
                const numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
                const numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
                return numA - numB;
            });

            for (const slidePath of slideFiles) {
                const slideXml = await zip.file(slidePath).async('string');
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(slideXml, 'application/xml');
                
                // Извлекаем текст из тегов <a:t>
                const textNodes = xmlDoc.getElementsByTagName('a:t');
                let slideText = '';
                for (let i = 0; i < textNodes.length; i++) {
                    slideText += textNodes[i].textContent + ' ';
                }
                
                if (slideText.trim()) {
                    fullText += `--- Слайд ${slidePath.match(/slide(\d+)\.xml/)[1]} ---\n${slideText}\n\n`;
                }
            }
            
            return fullText;
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
    stopBtn.classList.remove('hidden');
    
    genStatus.className = 'generation-status thinking';
    statusLabel.textContent = 'Подключение к ИИ...';
    startGenTimer();

    outputHtml.textContent = '';
    outputCss.textContent = '';
    let fullResponse = '';

    try {
        const tableInstruction = `7. ПРАВИЛО ТАБЛИЦ: Если данные выглядят как табличные, ОБЯЗАТЕЛЬНО используй тег <table> с классами ce-table, ce-table__row, ce-table__cell.`;

        const systemContent = `Ты — эксперт по БЭМ. Трансформируй текст в HTML-структуру, СТРОГО используя паттерны и классы из "Золотого стандарта". 
                
        ПРАВИЛА СТРУКТУРЫ:
        1. "ЭТАЛОН HTML" — это ОБЩАЯ ОБЕРТКА (контейнер) для всей страницы/блока. 
        2. ${useSections ? 'Используй <section class="ce-section"> как КОРНЕВОЙ элемент всей верстки.' : 'НЕ ИСПОЛЬЗУЙ тег <section> как обертку. Сразу начинай с контента или контейнера.'}
        3. ${useContainer ? 'Внутри корневого элемента ОБЯЗАТЕЛЬНО добавь центрирующую обертку (например, <div class="ce-container">).' : 'НЕ ИСПОЛЬЗУЙ центрирующую обертку (container).'}
        4. Внутри создавай логическую структуру, используя классы из эталона (ce-title, ce-text и т.д.).
        5. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать любые теги заголовков (H1-H6), кроме: ${allowedHeadings.length > 0 ? allowedHeadings.join(', ') : 'ЗАГОЛОВКИ ЗАПРЕЩЕНЫ'}.
        6. В блоке ###CSS### всегда пиши ПОЛНЫЙ набор стилей для данной верстки.
        ${tableInstruction}
        
        ПРАВИЛА CSS:
        1. РАЗДЕЛЯЙ ответ строго маркерами: ###CSS###, ###HTML### и ###SCHEMA###.
        2. В блоке ###SCHEMA### ${schemaPrompt}
        3. МИНИМИЗИРУЙ НОВЫЙ CSS. Сначала попытайся сверстать всё, используя ТОЛЬКО классы из "ЭТАЛОН CSS". 
        4. НЕ ДУБЛИРУЙ стили из эталона. В блоке ###CSS### пиши ТОЛЬКО новые свойства.
        5. Перенеси ВЕСЬ текст пользователя в HTML. НЕ СОКРАЩАЙ контент.
        
        ЭТАЛОН CSS:
        ${goldenCss}
        
        ЭТАЛОН HTML:
        ${goldenHtml}`;

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
                    { role: 'system', content: systemContent },
                    { role: 'user', content: `Сверстай этот текст:\n\n${userText}` }
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
        pushToHistory(outputHtml.textContent, outputCss.textContent, outputSchema.textContent);

        if (!fullResponse.trim()) throw new Error('ИИ вернул пустой ответ.');

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
                        
                        ПРАВИЛА ИСПРАВЛЕНИЯ (КРИТИЧЕСКИ ВАЖНО):
                        1. Сохраняй структуру БЭМ и классы из эталонов.
                        2. ${useSections ? 'ОБЯЗАТЕЛЬНО используй <section> как обертку.' : 'НЕ ИСПОЛЬЗУЙ <section>.'}
                        3. ${useContainer ? 'ОБЯЗАТЕЛЬНО используй контейнер-центровщик.' : 'НЕ ИСПОЛЬЗУЙ контейнер-центровщик.'}
                        4. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО использовать любые теги заголовков, кроме: ${allowedHeadings.length > 0 ? allowedHeadings.join(', ') : 'ЗАГОЛОВКИ ЗАПРЕЩЕНЫ'}.
                        5. ИСПОЛЬЗУЙ ТОЛЬКО ТЕКСТ ПОЛЬЗОВАТЕЛЯ: "${userText}". Не придумывай свои названия компаний, адреса или контент, если их нет в исходном тексте.
                        6. В блоке ###HTML### и ###CSS### возвращай ВЕСЬ КОД ПОЛНОСТЬЮ. 
                        7. ЗАПРЕЩЕНО использовать комментарии типа "код остается без изменений" или "...". Если ты так напишешь, пользователь увидит пустой экран. Пиши каждую строчку кода от начала до конца.
                        8. РАЗДЕЛЯЙ ответ строго маркерами: ###CSS###, ###HTML### и ###SCHEMA###.
                        9. В блоке ###SCHEMA### ${schemaPrompt}
                        10. Максимально сохраняй текущую структуру, если правка не требует её изменения. Вноси только точечные правки согласно пожеланию.
                        
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
        
        // Сохраняем в историю
        pushToHistory(outputHtml.textContent, outputCss.textContent, outputSchema.textContent);

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

    const now = Date.now();
    const shouldUpdateText = (now - (window._lastTextUpdate || 0) > 100) || isFinal;

    if (shouldUpdateText) {
        if (html) htmlEl.textContent = html;
        if (css) cssEl.textContent = css;
        if (schema) schemaEl.textContent = schema;
        window._lastTextUpdate = now;
    }

    if (now - lastIframeUpdate > 400 || isFinal) {
        if (html || css) {
            iframe.srcdoc = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { margin: 20px; font-family: -apple-system, sans-serif; background: #fff; color: #333; }
                        /* Стили эталона */
                        ${document.getElementById('golden-css')?.value || ''}
                        /* Новые стили от ИИ */
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
