document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('chat-page')) {
        initChatPage();
    }
});

let currentChatId = null;
let conversationHistory = [];
let isTypingEnabled = true; // Animasi ketik aktif secara default

// Objek untuk menyimpan versi model yang tersedia
const modelVersions = {
    gemini: [
        { value: 'gemini-1.5-flash', text: 'Gemini 1.5 Flash' },
        { value: 'gemini-1.0-pro', text: 'Gemini 1.0 Pro' }
    ],
    chatgpt: [
        { value: 'gpt-3.5-turbo', text: 'GPT-3.5 Turbo' },
        { value: 'gpt-4', text: 'GPT-4' }
    ],
    choco: [] // Choco AI tidak punya pilihan versi
};

function initChatPage() {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const newChatButton = document.getElementById('new-chat-btn');
    const modelSelector = document.getElementById('model-selector');
    const typingToggle = document.getElementById('typing-toggle');
    const donateButton = document.getElementById('donate-button');
    const donationModal = document.getElementById('donation-modal');
    const closeModal = document.querySelector('.close-button');

    // Event Listeners Utama
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    newChatButton.addEventListener('click', startNewChat);
    modelSelector.addEventListener('change', updateVersionSelector);
    updateVersionSelector(); // Panggil saat load

    // Toggle Animasi Ketik
    if (typingToggle) {
        typingToggle.addEventListener('change', () => {
            isTypingEnabled = typingToggle.checked;
        });
    }
    
    // Modal Donasi
    if (donateButton) {
        donateButton.addEventListener('click', () => {
            window.open('https://saweria.co/namakamu', '_blank'); // Ganti dengan link Saweria Anda
            if(donationModal) donationModal.style.display = 'block';
        });
    }
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            if(donationModal) donationModal.style.display = 'none';
        });
    }
    window.addEventListener('click', (event) => {
        if (event.target == donationModal) {
            donationModal.style.display = 'none';
        }
    });


    // Event listener untuk item histori yang sudah ada
    document.querySelectorAll('.history-item').forEach(item => {
        item.querySelector('.history-title')?.addEventListener('click', () => loadChat(item.dataset.chatId));
        item.querySelector('.delete-icon')?.addEventListener('click', (e) => handleDeleteChat(e, item.dataset.chatId));
    });

    // Mulai timer sesi
    startSessionTimer();
}

function updateVersionSelector() {
    const modelSelector = document.getElementById('model-selector');
    const versionSelector = document.getElementById('model-version');
    const selectedModel = modelSelector.value;
    
    versionSelector.innerHTML = '';

    if (modelVersions[selectedModel] && modelVersions[selectedModel].length > 0) {
        modelVersions[selectedModel].forEach(version => {
            const option = document.createElement('option');
            option.value = version.value;
            option.textContent = version.text;
            versionSelector.appendChild(option);
        });
        versionSelector.style.display = 'block';
    } else {
        versionSelector.style.display = 'none';
    }
}

function startNewChat() {
    currentChatId = null;
    conversationHistory = [];
    document.getElementById('chat-window').innerHTML = `<div class="message assistant"><div class="sender">ASSISTANT</div><div class="message-content">Pilih histori di samping atau mulai percakapan baru.</div></div>`;
    document.getElementById('message-input').value = '';
    document.getElementById('message-input').focus();
    document.querySelectorAll('.history-item.active').forEach(item => item.classList.remove('active'));
}

async function loadChat(chatId) {
    startNewChat();
    currentChatId = chatId;
    document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.history-item[data-chat-id="${chatId}"]`)?.classList.add('active');
    document.getElementById('chat-window').innerHTML = ''; // Kosongkan window

    try {
        const response = await fetch(`/api/chat/history/${chatId}`);
        if (!response.ok) throw new Error('Gagal memuat histori chat.');

        const history = await response.json();
        conversationHistory = history;
        
        history.forEach(msg => {
            appendMessage(msg.role, msg.content, false, false); // Jangan pakai typing saat load histori
        });
    } catch (error) {
        console.error('Error:', error);
        appendMessage('assistant', `Error: ${error.message}`);
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const prompt = messageInput.value.trim();
    if (!prompt) return;

    const model = document.getElementById('model-selector').value;
    const version = document.getElementById('model-version').value;

    appendMessage('user', prompt, false, false);
    messageInput.value = '';
    const loadingMessage = appendMessage('assistant', '...', true, false);

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model, version, history: conversationHistory }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);
        
        loadingMessage.classList.remove('loading');
        const contentDiv = loadingMessage.querySelector('.message-content');
        
        if (isTypingEnabled) {
            typeWriter(data.response, contentDiv, () => {
                addEmojiReactions(loadingMessage, data.chat_id, data.response);
            });
        } else {
            contentDiv.innerHTML = formatAIResponse(data.response);
            addEmojiReactions(loadingMessage, data.chat_id, data.response);
        }

        conversationHistory.push({ role: 'user', content: prompt });
        conversationHistory.push({ role: 'assistant', content: data.response });
        
        if (!currentChatId) {
            currentChatId = data.chat_id;
            addNewChatItemToSidebar(prompt, data.chat_id);
        }
    } catch (error) {
        console.error('Error:', error);
        loadingMessage.classList.remove('loading');
        loadingMessage.querySelector('.message-content').textContent = `Maaf, terjadi kesalahan: ${error.message}`;
    }
}

function appendMessage(sender, text, isLoading = false, useTyping = false) {
    const chatWindow = document.getElementById('chat-window');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    if (isLoading) messageDiv.classList.add('loading');
    
    messageDiv.innerHTML = `<div class="sender">${sender}</div><div class="message-content"></div>`;
    const contentDiv = messageDiv.querySelector('.message-content');
    
    if(isLoading) {
        contentDiv.textContent = '...';
    } else {
        if(useTyping && isTypingEnabled) {
             typeWriter(text, contentDiv);
        } else {
            contentDiv.innerHTML = formatAIResponse(text);
        }
    }
    
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return messageDiv;
}

function typeWriter(text, element, callback, speed = 20) {
    let i = 0;
    element.innerHTML = "";
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else if (callback) {
            callback();
        }
    }
    type();
}


function addNewChatItemToSidebar(title, chatId) {
    const historyList = document.querySelector('.history-list');
    const newItem = document.createElement('li');
    newItem.classList.add('history-item', 'active');
    newItem.dataset.chatId = chatId;
    
    newItem.innerHTML = `
        <span class="history-title">${title.substring(0, 25) + '...'}</span>
        <div class="history-actions">
            <span class="fav-icon">☆</span>
            <span class="delete-icon" title="Hapus Histori">❌</span>
        </div>
    `;
    document.querySelectorAll('.history-item.active').forEach(item => item.classList.remove('active'));
    newItem.querySelector('.history-title').addEventListener('click', () => loadChat(chatId));
    newItem.querySelector('.delete-icon').addEventListener('click', (e) => handleDeleteChat(e, chatId));
    historyList.prepend(newItem);
}

async function handleDeleteChat(event, chatId) {
    event.stopPropagation();
    if (confirm('Apakah Anda yakin ingin menghapus percakapan ini?')) {
        try {
            const response = await fetch(`/api/chat/delete/${chatId}`, { method: 'POST' });
            if (!response.ok) throw new Error('Gagal menghapus chat.');
            const historyItem = event.target.closest('.history-item');
            historyItem.remove();
            if (currentChatId == chatId) startNewChat();
        } catch (error) {
            console.error('Error deleting chat:', error);
            alert(error.message);
        }
    }
}

function formatAIResponse(text) {
    const escapeHTML = (str) => str.replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]));
    if (!text) return '';
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)\n```/g;
    let lastIndex = 0;
    let result = '';
    text.replace(codeBlockRegex, (match, lang, code, offset) => {
        result += escapeHTML(text.substring(lastIndex, offset)).replace(/\n/g, '<br>');
        const escapedCode = escapeHTML(code);
        result += `<pre><code class="language-${lang}">${escapedCode}</code></pre>`;
        lastIndex = offset + match.length;
    });
    if (lastIndex < text.length) {
        result += escapeHTML(text.substring(lastIndex)).replace(/\n/g, '<br>');
    }
    return result;
}

function startSessionTimer(timeout = 300000, interval = 60000) { // 5 menit, cek tiap 1 menit
    let sessionStartTime = Date.now();
    setInterval(() => {
        if (Date.now() - sessionStartTime >= timeout) {
            alert("Sudah 5 menit, mau istirahat dulu?");
            sessionStartTime = Date.now(); // Reset timer
        }
    }, interval);
}

function addEmojiReactions(messageDiv, chatId, responseText) {
    if (!messageDiv || messageDiv.classList.contains('user')) return;
    if (messageDiv.querySelector('.emoji-reactions')) return; // Jangan tambahkan jika sudah ada
    const emojiList = ['😂', '❤️', '🔥', '😡'];
    const reactionsDiv = document.createElement('div');
    reactionsDiv.className = 'emoji-reactions';
    emojiList.forEach(emoji => {
        const button = document.createElement('button');
        button.className = 'emoji-button';
        button.textContent = emoji;
        button.onclick = (e) => sendEmojiReaction(e, chatId, responseText, emoji);
        reactionsDiv.appendChild(button);
    });
    messageDiv.appendChild(reactionsDiv);
}

async function sendEmojiReaction(event, chatId, responseText, emoji) {
    const button = event.target;
    button.disabled = true;
    try {
        const response = await fetch('/api/feedback/emoji', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, response_text: responseText, emoji: emoji }),
        });
        if (!response.ok) throw new Error('Gagal mengirim reaksi.');
        button.style.borderColor = 'green';
    } catch (error) {
        console.error('Error sending emoji reaction:', error);
        button.style.borderColor = 'red';
    } finally {
        setTimeout(() => { button.disabled = false; button.style.borderColor = ''; }, 2000);
    }
}