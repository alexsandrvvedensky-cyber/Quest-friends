let tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

let currentUser = null;
let allQuestions = [];
let userQuestions = [];

const STORAGE_KEYS = {
    USERS: 'qf_users',
    QUESTIONS: 'qf_questions',
    CURRENT_USER: 'qf_current_user'
};

function initData() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) localStorage.setItem(STORAGE_KEYS.USERS, '[]');
    if (!localStorage.getItem(STORAGE_KEYS.QUESTIONS)) localStorage.setItem(STORAGE_KEYS.QUESTIONS, '[]');
}

function registerOrLogin(telegramUser) {
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS));
    let user = users.find(u => u.telegramId === telegramUser.id);
    if (!user) {
        user = {
            id: 'user_' + Date.now(),
            telegramId: telegramUser.id,
            firstName: telegramUser.first_name || 'Аноним',
            username: telegramUser.username || '',
            createdAt: new Date().toISOString(),
            questions: []
        };
        users.push(user);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    currentUser = user;
    const userNameSpan = document.getElementById('userName');
    if (userNameSpan) userNameSpan.textContent = currentUser.firstName;
    return user;
}

function loadQuestions() {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS)) || [];
    userQuestions = all.filter(q => q.authorId === currentUser.id);
    allQuestions = all.filter(q => q.authorId !== currentUser.id);
    renderQuestionsList();
    renderMyQuestions();
}

function publishQuestion(questionData) {
    const questions = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS)) || [];
    const newQuestion = {
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        authorId: currentUser.id,
        authorName: currentUser.firstName,
        createdAt: new Date().toISOString(),
        text: questionData.text,
        options: questionData.options,
        correctOption: parseInt(questionData.correctOption),
        answers: 0
    };
    questions.push(newQuestion);
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));

    if (!currentUser.questions) currentUser.questions = [];
    currentUser.questions.push(newQuestion.id);

    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS));
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    if (userIndex !== -1) users[userIndex] = currentUser;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));

    tg.showAlert('✅ Вопрос опубликован!');
    loadQuestions();
    showScreen('feed');
}

function renderQuestionsList() {
    const container = document.getElementById('questionsList');
    if (!container) return;

    if (!allQuestions || allQuestions.length === 0) {
        container.innerHTML = '<p class="hint">😢 Пока нет вопросов. Создайте первый!</p>';
        return;
    }

    container.innerHTML = allQuestions.map(q => `
        <div class="question-card" data-id="${q.id}">
            <div class="question-header">
                <span class="question-author">👤 ${q.authorName || 'Пользователь'}</span>
            </div>
            <div class="question-text">${q.text}</div>
            <div class="question-options">
                ${q.options.map((opt, idx) => `
                    <button class="option-btn" onclick="window.handleAnswer('${q.id}', ${idx})">
                        ${String.fromCharCode(65 + idx)}. ${opt}
                    </button>
                `).join('')}
            </div>
            <div class="question-footer">
                <span>👥 ${q.answers || 0} ответов</span>
            </div>
        </div>
    `).join('');
}

function renderMyQuestions() {
    const container = document.getElementById('myQuestionsContainer');
    if (!container) return;
    if (!userQuestions || userQuestions.length === 0) {
        container.innerHTML = '<p class="hint">У вас пока нет вопросов</p>';
        return;
    }
    container.innerHTML = userQuestions.map(q => `
        <div class="question-card">
            <div class="question-text">${q.text}</div>
            <div class="question-footer"><span>👥 ${q.answers || 0} ответов</span></div>
        </div>
    `).join('');
    const countSpan = document.getElementById('myQuestionsCount');
    if (countSpan) countSpan.textContent = userQuestions.length;
}

window.handleAnswer = function(questionId, optionIndex) {
    const questions = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS)) || [];
    const question = questions.find(q => q.id === questionId);
    if (!question) return;
    const isCorrect = (optionIndex === question.correctOption);
    if (isCorrect) {
        tg.showAlert('✅ Правильно!');
        question.answers = (question.answers || 0) + 1;
        localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
        loadQuestions();
    } else {
        tg.showAlert('❌ Не совпало');
    }
};

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const activeScreen = document.getElementById(screenName + 'Screen');
    if (activeScreen) activeScreen.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.screen === screenName) btn.classList.add('active');
    });
    if (screenName === 'feed' && currentUser) {
        loadQuestions();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initData();
    if (tg.initDataUnsafe?.user) {
        registerOrLogin(tg.initDataUnsafe.user);
    } else {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) loadingScreen.innerHTML = '<p>Откройте через Telegram</p>';
        return;
    }

    loadQuestions();
    showScreen('feed');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => showScreen(btn.dataset.screen));
    });

    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) profileBtn.addEventListener('click', () => showScreen('profile'));

    const createNewBtn = document.getElementById('createNewBtn');
    if (createNewBtn) createNewBtn.addEventListener('click', () => showScreen('create'));

    const publishBtn = document.getElementById('publishQuestionBtn');
    if (publishBtn) {
        publishBtn.addEventListener('click', () => {
            const text = document.getElementById('questionText')?.value.trim();
            const options = [
                document.getElementById('opt0')?.value.trim() || '',
                document.getElementById('opt1')?.value.trim() || '',
                document.getElementById('opt2')?.value.trim() || '',
                document.getElementById('opt3')?.value.trim() || ''
            ];
            const correctOption = document.querySelector('input[name="correctOption"]:checked')?.value;

            if (!text) { tg.showAlert('Напишите вопрос!'); return; }
            if (options.some(opt => !opt)) { tg.showAlert('Заполните все варианты'); return; }
            if (correctOption === undefined) { tg.showAlert('Выберите правильный ответ'); return; }

            publishQuestion({ text, options, correctOption });

            const textArea = document.getElementById('questionText');
            if (textArea) textArea.value = '';
            options.forEach((_, i) => {
                const optInput = document.getElementById(`opt${i}`);
                if (optInput) optInput.value = '';
            });
        });
    }

    if (tg.MainButton) {
        tg.MainButton.setText('Закрыть');
        tg.MainButton.onClick(() => tg.close());
    }
});
