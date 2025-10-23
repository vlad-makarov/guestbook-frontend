https://guestbook-backend-8kmv.onrender.com
const ENTRIES_PER_PAGE = 5;

let currentUser = null;
let currentToken = null;
let currentView = 'all';
let currentSort = 'new'; // new, old, author-asc, author-desc
let currentSearch = '';
let currentPage = 1;
let allEntries = [];
let myEntries = [];

// Инициализация темы
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    updateThemeButton(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-bs-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
}

function updateThemeButton(theme) {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// Глобальные функции
window.logout = function() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    currentToken = null;
    currentUser = null;
    showAuth();
    showMessage('Вы вышли из системы', 'info');
};

window.editEntry = async function(id, text) {
    document.getElementById('editEntryId').value = id;
    document.getElementById('editText').value = text;
    document.getElementById('editCharCount').textContent = text.length;
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    modal.show();
};

window.deleteEntry = async function(id) {
    if (!confirm('Удалить запись? Это действие нельзя отменить.')) return;
    
    try {
        const response = await fetch(`${API_URL}/entries/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': currentToken }
        });
        if (response.ok) {
            showMessage('Запись удалена', 'success');
            // Обновляем ОБА набора записей
            await loadAllEntries();
        } else {
            const error = await response.json();
            showMessage(error.detail || 'Ошибка удаления', 'danger');
        }
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showMessage('Ошибка соединения', 'danger');
    }
};

// Вспомогательные функции
function formatDateTime(dateStr) {
    return dateStr;
}

function getAvatarUrl(username) {
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(username)}&backgroundColor=ffdfbf,ffd5dc,ffccdd,b5b0ff,d1d0ff`;
}

function filterAndSortEntries(entries) {
    let filtered = entries;
    
    if (currentSearch) {
        const term = currentSearch.toLowerCase();
        filtered = entries.filter(entry => 
            entry.text.toLowerCase().includes(term) || 
            entry.author.toLowerCase().includes(term)
        );
    }
    
    filtered.sort((a, b) => {
        switch (currentSort) {
            case 'old':
                return new Date(a.created_at.split('.').reverse().join('-')) - 
                       new Date(b.created_at.split('.').reverse().join('-'));
            case 'author-asc':
                return a.author.localeCompare(b.author);
            case 'author-desc':
                return b.author.localeCompare(a.author);
            case 'new':
            default:
                return new Date(b.created_at.split('.').reverse().join('-')) - 
                       new Date(a.created_at.split('.').reverse().join('-'));
        }
    });
    
    return filtered;
}

function updateStats() {
    if (!currentUser) return;
    
    const total = allEntries.length;
    const mine = myEntries.length;
    const stats = document.getElementById('statsBar');
    if (stats) {
        stats.textContent = `Всего записей: ${total} • Ваши записи: ${mine}`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    
    currentToken = localStorage.getItem('token');
    currentUser = localStorage.getItem('username');
    
    setupEvents();
    
    if (currentToken && currentUser) {
        verifyToken();
    } else {
        showAuth();
    }
});

async function verifyToken() {
    try {
        const response = await fetch(API_URL + '/verify', {
            headers: { 'Authorization': currentToken }
        });
        if (response.ok) {
            showApp();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Ошибка проверки токена:', error);
        logout();
    }
}

function setupEvents() {
    document.getElementById('loginForm')?.addEventListener('submit', e => { e.preventDefault(); login(); });
    
    document.getElementById('registerForm')?.addEventListener('submit', e => { 
        e.preventDefault(); 
        const pass1 = document.getElementById('regPassword').value;
        const pass2 = document.getElementById('regPasswordConfirm').value;
        if (pass1 !== pass2) {
            showMessage('Пароли не совпадают', 'danger');
            return;
        }
        register(); 
    });

    document.getElementById('entryForm')?.addEventListener('submit', e => { e.preventDefault(); addEntry(); });
    document.getElementById('entryText')?.addEventListener('input', e => {
        document.getElementById('charCount').textContent = e.target.value.length;
    });
    document.getElementById('editText')?.addEventListener('input', e => {
        document.getElementById('editCharCount').textContent = e.target.value.length;
    });

    document.getElementById('saveEditBtn')?.addEventListener('click', async () => {
        const id = document.getElementById('editEntryId').value;
        const text = document.getElementById('editText').value.trim();
        if (!text) {
            showMessage('Текст не может быть пустым', 'danger');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/entries/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': currentToken
                },
                body: JSON.stringify({ text })
            });
            if (response.ok) {
                bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
                showMessage('Запись обновлена', 'success');
                loadEntries(currentView);
            } else {
                const error = await response.json();
                showMessage(error.detail || 'Ошибка редактирования', 'danger');
            }
        } catch (error) {
            console.error('Ошибка редактирования:', error);
            showMessage('Ошибка соединения', 'danger');
        }
    });

    document.getElementById('viewAllBtn')?.addEventListener('click', () => {
        document.getElementById('viewAllBtn').classList.add('btn-primary');
        document.getElementById('viewAllBtn').classList.remove('btn-outline-primary');
        document.getElementById('viewMyBtn').classList.add('btn-outline-secondary');
        document.getElementById('viewMyBtn').classList.remove('btn-secondary');
        loadEntries('all');
    });

    document.getElementById('viewMyBtn')?.addEventListener('click', () => {
        document.getElementById('viewMyBtn').classList.add('btn-secondary');
        document.getElementById('viewMyBtn').classList.remove('btn-outline-secondary');
        document.getElementById('viewAllBtn').classList.add('btn-outline-primary');
        document.getElementById('viewAllBtn').classList.remove('btn-primary');
        loadEntries('my');
    });

    document.getElementById('sortSelect')?.addEventListener('change', e => {
        currentSort = e.target.value;
        renderEntries();
    });

    document.getElementById('searchInput')?.addEventListener('input', e => {
        currentSearch = e.target.value;
        currentPage = 1;
        renderEntries();
    });

    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);

    // Админ-панель
    if (currentUser === 'administrator') {
        document.getElementById('clearAllBtn')?.addEventListener('click', clearAllEntries);
        document.getElementById('generatePdfBtn')?.addEventListener('click', generatePdfReport);
    }
}

async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) {
        showMessage('Заполните все поля', 'danger');
        return;
    }
    if (username.length < 2 || username.length > 20) {
        showMessage('Имя пользователя должно быть от 2 до 20 символов', 'danger');
        return;
    }
    try {
        showMessage('Выполняется вход...', 'info');
        const response = await fetch(API_URL + '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (response.ok) {
            const data = await response.json();
            currentToken = data.token;
            currentUser = data.username;
            localStorage.setItem('token', currentToken);
            localStorage.setItem('username', currentUser);
            showApp();
            showMessage('Успешный вход!', 'success');
            document.getElementById('loginForm').reset();
        } else {
            const error = await response.json();
            showMessage(error.detail || 'Ошибка входа', 'danger');
        }
    } catch (error) {
        console.error('Ошибка соединения:', error);
        showMessage('Ошибка соединения. Проверьте, запущен ли бэкенд на порту 8000.', 'danger');
    }
}

async function register() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    if (!username || !password) {
        showMessage('Заполните все поля', 'danger');
        return;
    }
    if (username.length < 2 || username.length > 20) {
        showMessage('Имя пользователя должно быть от 2 до 20 символов', 'danger');
        return;
    }
    if (password.length < 3) {
        showMessage('Пароль должен быть не менее 3 символов', 'danger');
        return;
    }
    try {
        showMessage('Регистрация...', 'info');
        const response = await fetch(API_URL + '/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (response.ok) {
            showMessage('Регистрация успешна! Теперь войдите.', 'success');
            document.getElementById('registerForm').reset();
            const loginTab = new bootstrap.Tab(document.getElementById('login-tab'));
            loginTab.show();
        } else {
            const error = await response.json();
            showMessage(error.detail || 'Ошибка регистрации', 'danger');
        }
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        showMessage('Ошибка соединения', 'danger');
    }
}

async function addEntry() {
    const text = document.getElementById('entryText').value.trim();
    if (!text) {
        showMessage('Введите текст сообщения', 'danger');
        return;
    }
    if (text.length > 500) {
        showMessage('Сообщение не должно превышать 500 символов', 'danger');
        return;
    }
    try {
        const response = await fetch(API_URL + '/entries', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': currentToken
            },
            body: JSON.stringify({ text })
        });
        if (response.ok) {
            document.getElementById('entryText').value = '';
            document.getElementById('charCount').textContent = '0';
            
            // Обновляем ОБА набора записей
            await loadAllEntries(); // ← ключевое изменение
            
            showMessage('Запись добавлена!', 'success');
            document.getElementById('entriesList').scrollIntoView({ behavior: 'smooth' });
        } else {
            const error = await response.json();
            showMessage(error.detail || 'Ошибка добавления записи', 'danger');
        }
    } catch (error) {
        console.error('Ошибка добавления:', error);
        showMessage('Ошибка соединения', 'danger');
    }
}

async function loadAllEntries() {
    try {
        const allResponse = await fetch(API_URL + '/entries');
        if (allResponse.ok) {
            allEntries = await allResponse.json();
        }
        
        const myResponse = await fetch(API_URL + '/entries/me', {
            headers: { 'Authorization': currentToken }
        });
        if (myResponse.ok) {
            myEntries = await myResponse.json();
        }
        
        currentView = 'all';
        currentPage = 1;
        renderEntries();
        updateStats();
    } catch (error) {
        console.error('Ошибка загрузки записей:', error);
    }
}

async function loadEntries(view = 'all') {
    try {
        let response;
        if (view === 'my') {
            response = await fetch(API_URL + '/entries/me', {
                headers: { 'Authorization': currentToken }
            });
            if (response.ok) {
                myEntries = await response.json();
            }
        } else {
            response = await fetch(API_URL + '/entries');
            if (response.ok) {
                allEntries = await response.json();
            }
        }

        currentView = view;
        currentPage = 1;
        renderEntries();
        if (currentUser) updateStats();
    } catch (error) {
        console.error('Ошибка загрузки записей:', error);
    }
}

function renderEntries() {
    const entries = currentView === 'my' ? myEntries : allEntries;
    const processed = filterAndSortEntries(entries);
    const start = (currentPage - 1) * ENTRIES_PER_PAGE;
    const paginated = processed.slice(start, start + ENTRIES_PER_PAGE);
    displayEntries(paginated);
    renderPagination(processed.length);
}

function displayEntries(entries) {
    const container = document.getElementById('entriesList');
    if (entries.length === 0) {
        container.innerHTML = '<div class="text-muted text-center p-3">Записей нет</div>';
    } else {
        container.innerHTML = entries.map(entry => {
            const isOwn = entry.author === currentUser;
            const safeText = entry.text.replace(/`/g, '\\`').replace(/\\/g, '\\\\');
            const avatar = getAvatarUrl(entry.author);
            const displayTime = formatDateTime(entry.created_at);
            return `
                <div class="card mb-3 fade-in">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="d-flex align-items-center">
                                <img src="${avatar}" class="avatar" alt="${entry.author}">
                                <strong class="text-primary">${entry.author}</strong>
                            </div>
                            <div class="text-end">
                                <div class="text-muted small">${displayTime}</div>
                            </div>
                        </div>
                        <p class="mb-0 mt-2">${entry.text}</p>
                        ${isOwn ? `
                            <div class="entry-actions mt-2">
                                <button class="btn btn-sm btn-outline-warning" onclick="window.editEntry(${entry.id}, \`${safeText}\`)">✏️ Редактировать</button>
                                <button class="btn btn-sm btn-outline-danger ms-1" onclick="window.deleteEntry(${entry.id})">🗑 Удалить</button>
                            </div>
                        ` : (currentUser === 'administrator' ? `
                            <div class="entry-actions mt-2">
                                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteEntry(${entry.id})">🗑 Удалить (админ)</button>
                            </div>
                        ` : '')}
                    </div>
                </div>
            `;
        }).join('');
    }
}

function renderPagination(total) {
    const totalPages = Math.ceil(total / ENTRIES_PER_PAGE);
    const nav = document.getElementById('paginationNav');
    const list = document.getElementById('paginationList');
    
    if (totalPages <= 1) {
        nav.classList.add('hidden');
        return;
    }
    
    nav.classList.remove('hidden');
    list.innerHTML = '';

    const siblings = 1;
    const boundary = 1;

    const range = (start, end) => {
        const length = end - start + 1;
        return Array.from({ length }, (_, i) => start + i);
    };

    const shouldShowDots = (start, end) => end - start > 1;

    let pages = [];
    const leftBoundary = range(1, Math.min(boundary, totalPages));
    const rightBoundary = range(
        Math.max(totalPages - boundary + 1, boundary + 1),
        totalPages
    );

    const centerStart = Math.max(leftBoundary[leftBoundary.length - 1] + 1, currentPage - siblings);
    const centerEnd = Math.min(rightBoundary[0] - 1, currentPage + siblings);
    const center = centerStart <= centerEnd ? range(centerStart, centerEnd) : [];

    pages = [...leftBoundary];
    if (shouldShowDots(leftBoundary[leftBoundary.length - 1], center[0])) {
        pages.push('dots');
    }
    pages = [...pages, ...center];
    if (shouldShowDots(center[center.length - 1], rightBoundary[0])) {
        pages.push('dots');
    }
    pages = [...pages, ...rightBoundary];

    pages = pages.filter((page, index) => {
        if (page === 'dots') return true;
        return pages.indexOf(page) === index;
    });

    pages.forEach(page => {
        if (page === 'dots') {
            const li = document.createElement('li');
            li.className = 'page-item disabled';
            li.innerHTML = '<span class="page-link">…</span>';
            list.appendChild(li);
        } else {
            const li = document.createElement('li');
            li.className = `page-item ${page === currentPage ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#">${page}</a>`;
            li.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = page;
                renderEntries();
            });
            list.appendChild(li);
        }
    });
}

function showApp() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
    
    const navSection = document.getElementById('navAuthSection');
    navSection.innerHTML = `
        <div class="d-flex align-items-center gap-2">
            <span style="color: white; font-weight: bold;">Привет, ${currentUser}!</span>
            <button type="button" class="btn btn-outline-light btn-sm" onclick="window.logout()">
                Выйти
            </button>
        </div>
    `;
    
    // Показать панель администратора?
    const isAdmin = currentUser === 'administrator';
    const adminPanel = document.getElementById('adminPanel');
    if (isAdmin) {
        adminPanel.classList.remove('hidden');
        // Назначить обработчики (на случай, если setupEvents вызывался до входа)
        setTimeout(() => {
            document.getElementById('clearAllBtn')?.addEventListener('click', clearAllEntries);
            document.getElementById('generatePdfBtn')?.addEventListener('click', generatePdfReport);
        }, 100);
    } else {
        adminPanel.classList.add('hidden');
    }
    
    loadAllEntries();
}

function showAuth() {
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('navAuthSection').innerHTML = '';
    loadEntries('all');
}

function showMessage(text, type) {
    const oldAlert = document.querySelector('.alert');
    if (oldAlert) oldAlert.remove();
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show mt-3`;
    alert.innerHTML = `${text}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    document.querySelector('.container').prepend(alert);
    setTimeout(() => { if (alert.parentNode) alert.remove(); }, 5000);
}

// === АДМИН-ФУНКЦИИ ===

async function clearAllEntries() {
    if (!confirm('⚠️ Вы уверены? Это удалит ВСЕ записи безвозвратно!')) return;
    
    try {
        const response = await fetch(API_URL + '/entries/clear', {
            method: 'DELETE',
            headers: { 'Authorization': currentToken }
        });

        if (response.ok) {
            showMessage('Вся гостевая книга очищена!', 'success');
            loadAllEntries();
        } else {
            // Попробуем прочитать ответ как JSON
            let errorMessage = 'Ошибка очистки';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || 'Ошибка сервера';
            } catch (e) {
                // Если не JSON — покажем статус
                errorMessage = `Ошибка ${response.status}: ${response.statusText}`;
            }
            showMessage(errorMessage, 'danger');
        }
    } catch (error) {
        console.error('Ошибка очистки:', error);
        showMessage('Ошибка соединения с сервером', 'danger');
    }
}

function generatePdfReport() {
    const fromInput = document.getElementById('pdfFrom').value;
    const toInput = document.getElementById('pdfTo').value;

    if (!fromInput || !toInput) {
        showMessage('Выберите обе даты', 'warning');
        return;
    }

    const fromDate = new Date(fromInput);
    const toDate = new Date(toInput);

    if (fromDate > toDate) {
        showMessage('Начальная дата не может быть позже конечной', 'danger');
        return;
    }

    const allRecords = [...allEntries];
    const uniqueIds = new Set(allRecords.map(e => e.id));
    for (const entry of myEntries) {
        if (!uniqueIds.has(entry.id)) {
            allRecords.push(entry);
        }
    }

    const filtered = allRecords.filter(entry => {
        const datePart = entry.created_at.split(' ')[0];
        const timePart = entry.created_at.split(' ')[1] || "00:00";
        const [day, month, year] = datePart.split('.').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        const entryDate = new Date(year, month - 1, day, hour, minute);
        return entryDate >= fromDate && entryDate <= toDate;
    });

    if (filtered.length === 0) {
        showMessage('Нет записей за указанный период', 'info');
        return;
    }

    // Сортировка
    filtered.sort((a, b) => {
        const dateA = new Date(a.created_at.split(' ')[0].split('.').reverse().join('-') + 'T' + a.created_at.split(' ')[1]);
        const dateB = new Date(b.created_at.split(' ')[0].split('.').reverse().join('-') + 'T' + b.created_at.split(' ')[1]);
        return dateB - dateA;
    });

    // Создаём HTML для PDF
    let pdfContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px;">
            <h2 style="text-align: center; margin-bottom: 20px;">Гостевая книга — отчёт</h2>
            <p style="text-align: center; margin-bottom: 30px; font-size: 14px;">
                Период: ${fromInput.replace('T', ' ')} — ${toInput.replace('T', ' ')}
            </p>
    `;

    filtered.forEach(entry => {
        pdfContent += `
            <div style="border-bottom: 1px solid #eee; padding: 15px 0; margin-bottom: 15px;">
                <div style="font-weight: bold; color: #0d6efd;">${entry.author}</div>
                <div style="font-size: 12px; color: #666; margin: 5px 0;">${entry.created_at}</div>
                <div style="margin-top: 8px; white-space: pre-wrap;">${entry.text}</div>
            </div>
        `;
    });

    pdfContent += `</div>`;

    // Создаём временный элемент
    const element = document.createElement('div');
    element.innerHTML = pdfContent;
    document.body.appendChild(element);

    // Генерация PDF
    const opt = {
        margin: 10,
        filename: `guestbook_${fromInput.slice(0,10)}_${toInput.slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        document.body.removeChild(element);
        showMessage('PDF сформирован и скачан!', 'success');
    });
}