document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    // Elements
    const viewCreate = document.getElementById('view-create');
    const viewRead = document.getElementById('view-read');
    const viewLoading = document.getElementById('view-loading');
    const viewError = document.getElementById('view-error');
    
    const codeInput = document.getElementById('codeInput');
    const btnShare = document.getElementById('btnShare');
    const shareResult = document.getElementById('shareResult');
    const shareUrl = document.getElementById('shareUrl');
    const btnCopyUrl = document.getElementById('btnCopyUrl');
    
    const codeDisplay = document.getElementById('codeDisplay');
    const btnCopyCode = document.getElementById('btnCopyCode');
    const btnNew = document.getElementById('btnNew');
    const btnBackError = document.getElementById('btnBackError');
    
    // View Router
    function showView(viewElement) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            v.classList.add('hidden');
        });
        viewElement.classList.remove('hidden');
        // Small timeout to allow display:block to apply before animation
        setTimeout(() => {
            viewElement.classList.add('active');
        }, 10);
    }
    
    // Routing Logic
    if (path === '/' || path === '/index.html') {
        showView(viewCreate);
    } else {
        const id = path.substring(1);
        if (/^\d+$/.test(id)) {
            fetchCode(id);
        } else {
            showView(viewError);
            document.getElementById('errorMessage').innerText = "Érvénytelen link formátum.";
        }
    }
    
    // Create new snippet
    btnShare.addEventListener('click', async () => {
        const code = codeInput.value.trim();
        if (!code) {
            alert('Kérlek, először adj meg egy kódot.');
            return;
        }
        
        btnShare.disabled = true;
        btnShare.innerHTML = '<span>Létrehozás...</span><div class="loader" style="width: 18px; height: 18px; border-width: 2px; margin-bottom: 0;"></div>';
        
        try {
            const response = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                const fullUrl = window.location.origin + data.url;
                shareUrl.value = fullUrl;
                shareResult.classList.remove('hidden');
            } else {
                alert('Hiba: ' + data.error);
            }
        } catch (err) {
            alert('Nem sikerült csatlakozni a szerverhez.');
        } finally {
            btnShare.disabled = false;
            btnShare.innerHTML = '<span>Titkos Link Létrehozása</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        }
    });
    
    // Fetch code
    async function fetchCode(id) {
        showView(viewLoading);
        
        try {
            const response = await fetch(`/api/code/${id}`);
            const data = await response.json();
            
            if (response.ok) {
                codeDisplay.textContent = data.code;
                showView(viewRead);
            } else {
                showView(viewError);
                if (response.status === 404) {
                    document.getElementById('errorMessage').innerText = "Ez a kód nem létezik, vagy már megtekintették és véglegesen megsemmisült.";
                } else {
                    document.getElementById('errorMessage').innerText = data.error || "Hiba történt.";
                }
            }
        } catch (err) {
            showView(viewError);
            document.getElementById('errorMessage').innerText = "Nem sikerült csatlakozni a szerverhez.";
        }
    }
    
    // Copy URLs
    btnCopyUrl.addEventListener('click', () => {
        shareUrl.select();
        document.execCommand('copy');
        
        const originalHtml = btnCopyUrl.innerHTML;
        btnCopyUrl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
        setTimeout(() => {
            btnCopyUrl.innerHTML = originalHtml;
        }, 2000);
    });
    
    btnCopyCode.addEventListener('click', () => {
        navigator.clipboard.writeText(codeDisplay.textContent).then(() => {
            const originalHtml = btnCopyCode.innerHTML;
            btnCopyCode.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Másolva!';
            setTimeout(() => {
                btnCopyCode.innerHTML = originalHtml;
            }, 2000);
        });
    });
    
    // Navigation
    btnNew.addEventListener('click', () => {
        window.location.href = '/';
    });
    
    btnBackError.addEventListener('click', () => {
        window.location.href = '/';
    });
    
    // --- Chat Logic ---
    const logoBtn = document.getElementById('logoBtn');
    const chatWindow = document.getElementById('chatWindow');
    const btnCloseChat = document.getElementById('btnCloseChat');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const btnSendChat = document.getElementById('btnSendChat');
    
    // Toggle Chat with Keyboard Shortcut (Alt + C)
    document.addEventListener('keydown', (e) => {
        // Check for Alt + C (case insensitive)
        if (e.altKey && e.key.toLowerCase() === 'c') {
            e.preventDefault(); // Prevent default browser behavior if any
            chatWindow.classList.toggle('hidden');
            if (!chatWindow.classList.contains('hidden')) {
                chatInput.focus();
                scrollToBottom();
            }
        }
    });
    
    btnCloseChat.addEventListener('click', () => {
        chatWindow.classList.add('hidden');
    });
    
    // Initialize Socket
    let socket;
    try {
        socket = io();
    } catch(e) {
        console.warn('Socket.io not loaded.');
    }

    if (socket) {
        socket.on('chatHistory', (history) => {
            chatMessages.innerHTML = '';
            history.forEach(appendMessage);
            scrollToBottom();
        });

        socket.on('newMessage', (msg) => {
            appendMessage(msg);
            scrollToBottom();
        });

        function appendMessage(msg) {
            const div = document.createElement('div');
            div.className = 'chat-message';
            div.textContent = msg.text;
            
            const timeSpan = document.createElement('span');
            timeSpan.className = 'chat-time';
            timeSpan.textContent = msg.time;
            div.appendChild(timeSpan);
            
            chatMessages.appendChild(div);
            // Add some margin bottom for the absolute time
            div.style.marginBottom = '18px';
        }

        function sendMessage() {
            const text = chatInput.value.trim();
            if (text) {
                socket.emit('sendMessage', { text });
                chatInput.value = '';
            }
        }

        btnSendChat.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        function scrollToBottom() {
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 50);
        }
    }
});
