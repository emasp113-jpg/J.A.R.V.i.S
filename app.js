// ==================== JARVIS AI - Core Logic ====================

const STORAGE_KEYS = {
  name: 'jarvis_name',
  apiKey: 'jarvis_apikey',
  model: 'jarvis_model',
  voice: 'jarvis_voice',
  memory: 'jarvis_memory',
  chatHistory: 'jarvis_chat'
};

// State
let state = {
  name: localStorage.getItem(STORAGE_KEYS.name) || 'Señor',
  apiKey: localStorage.getItem(STORAGE_KEYS.apiKey) || '',
  model: localStorage.getItem(STORAGE_KEYS.model) || 'gemini-2.0-flash',
  voiceEnabled: localStorage.getItem(STORAGE_KEYS.voice) !== 'false',
  memoryEnabled: localStorage.getItem(STORAGE_KEYS.memory) !== 'false',
  chatHistory: JSON.parse(localStorage.getItem(STORAGE_KEYS.chatHistory) || '[]'),
  currentScreen: 'home'
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
  loadSettingsToUI();
  renderChatHistory();
  setupEventListeners();
  updateUserName();
  
  // Welcome message if empty
  if (state.chatHistory.length === 0) {
    addBotMessage(`Hola de nuevo, ${state.name}. Sistemas online. ¿Cómo puedo asistirte hoy?`);
  }
});

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const el = document.getElementById('current-time');
  if (el) el.textContent = time;
  const cmdTime = document.getElementById('command-time');
  if (cmdTime) {
    cmdTime.textContent = now.toLocaleString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
}

function updateUserName() {
  const el = document.getElementById('user-name');
  if (el) el.textContent = state.name;
}

// ==================== NAVIGATION ====================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId + '-screen');
  if (target) {
    target.classList.add('active');
    state.currentScreen = screenId;
  }

  // Update bottom nav
  document.querySelectorAll('.bottom-nav .nav-btn[data-screen]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === screenId);
  });
}

function setupEventListeners() {
  // Bottom nav
  document.querySelectorAll('.bottom-nav .nav-btn[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  // Categories
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.category;
      if (cat === 'chat') {
        showScreen('chat');
      } else {
        // Open chat with category context
        showScreen('chat');
        const prompts = {
          estudio: 'Quiero ayuda con estudios o aprendizaje.',
          juegos: 'Hablemos de videojuegos o juegos en general.',
          deportes: 'Quiero hablar de deportes.',
          coches: 'Hablemos de coches y automóviles.',
          vida: 'Necesito consejos para la vida diaria.'
        };
        if (prompts[cat]) {
          document.getElementById('chat-input').value = prompts[cat];
        }
      }
    });
  });

  // Tools
  document.querySelectorAll('.tool-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      handleTool(tool);
    });
  });

  // Chat send
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Mic button (placeholder for voice)
  document.getElementById('mic-btn').addEventListener('click', () => {
    showToast('🎤 Escuchando... (próximamente voz completa)');
    // Aquí se integraría Web Speech API o Capacitor Speech
  });
}

// ==================== CHAT ====================
function renderChatHistory() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = '';
  state.chatHistory.forEach(msg => {
    const div = document.createElement('div');
    div.className = `message ${msg.role === 'user' ? 'user' : 'bot'}`;
    div.textContent = msg.content;
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

function addBotMessage(text) {
  state.chatHistory.push({ role: 'assistant', content: text });
  saveChat();
  renderChatHistory();
  if (state.voiceEnabled) speak(text);
}

function addUserMessage(text) {
  state.chatHistory.push({ role: 'user', content: text });
  saveChat();
  renderChatHistory();
}

function saveChat() {
  localStorage.setItem(STORAGE_KEYS.chatHistory, JSON.stringify(state.chatHistory));
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  addUserMessage(text);

  // Show typing indicator
  const container = document.getElementById('chat-messages');
  const typing = document.createElement('div');
  typing.className = 'message bot';
  typing.id = 'typing';
  typing.textContent = 'JARVIS está pensando...';
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;

  try {
    const reply = await callGemini(text);
    document.getElementById('typing')?.remove();
    addBotMessage(reply);
  } catch (err) {
    document.getElementById('typing')?.remove();
    addBotMessage('Lo siento, ocurrió un error: ' + err.message + '\n\nVerifica tu API Key en Ajustes.');
  }
}

async function callGemini(userMessage) {
  if (!state.apiKey) {
    throw new Error('No hay API Key configurada. Ve a Ajustes y pega tu clave de Google AI Studio.');
  }

  const systemPrompt = `Eres JARVIS, el asistente de IA personal inspirado en Iron Man. 
Hablas en español de forma elegante, útil, un poco sarcástico pero siempre respetuoso.
Te diriges al usuario como "${state.name}".
Responde de forma concisa pero completa. Sé proactivo.`;

  const history = state.chatHistory.slice(-10).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  // Add system as first message if needed
  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Entendido. Sistemas online. ¿En qué puedo asistirte?' }] },
    ...history
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${state.model}:generateContent?key=${state.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1024
      }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('Respuesta vacía del modelo');
  return reply.trim();
}

// ==================== VOICE ====================
function speak(text) {
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'es-ES';
  utter.rate = 1.05;
  window.speechSynthesis.speak(utter);
}

// ==================== SETTINGS ====================
function loadSettingsToUI() {
  document.getElementById('setting-name').value = state.name;
  document.getElementById('setting-apikey').value = state.apiKey;
  document.getElementById('setting-model').value = state.model;
  document.getElementById('setting-voice').checked = state.voiceEnabled;
  document.getElementById('setting-memory').checked = state.memoryEnabled;
  document.getElementById('current-model').textContent = state.model;
}

function saveSettings() {
  state.name = document.getElementById('setting-name').value.trim() || 'Señor';
  state.apiKey = document.getElementById('setting-apikey').value.trim();
  state.model = document.getElementById('setting-model').value;
  state.voiceEnabled = document.getElementById('setting-voice').checked;
  state.memoryEnabled = document.getElementById('setting-memory').checked;

  localStorage.setItem(STORAGE_KEYS.name, state.name);
  localStorage.setItem(STORAGE_KEYS.apiKey, state.apiKey);
  localStorage.setItem(STORAGE_KEYS.model, state.model);
  localStorage.setItem(STORAGE_KEYS.voice, state.voiceEnabled);
  localStorage.setItem(STORAGE_KEYS.memory, state.memoryEnabled);

  updateUserName();
  document.getElementById('current-model').textContent = state.model;
  showToast('✅ Configuración guardada');
}

function clearChat() {
  if (confirm('¿Borrar todo el historial de chat?')) {
    state.chatHistory = [];
    saveChat();
    renderChatHistory();
    addBotMessage(`Chat reiniciado. ¿En qué puedo ayudarte, ${state.name}?`);
    showToast('Chat borrado');
  }
}

function showAbout() {
  alert('JARVIS v1.0.0\n\nAsistente de IA personal inspirado en Iron Man.\nDesarrollado con ❤️\n\nUsa Google Gemini API.');
}

// ==================== TOOLS ====================
function handleTool(tool) {
  showScreen('chat');
  const prompts = {
    calculator: 'Actúa como una calculadora avanzada. Estoy listo para hacer cálculos.',
    notes: 'Quiero guardar una nota. Pregúntame qué quiero anotar.',
    timer: 'Ayúdame a configurar un temporizador o pomodoro.',
    translator: 'Actúa como traductor. Dime a qué idioma quieres traducir y el texto.',
    ideas: 'Genera 5 ideas creativas e innovadoras sobre un tema que yo te diga.'
  };
  document.getElementById('chat-input').value = prompts[tool] || '';
  document.getElementById('chat-input').focus();
}

// ==================== TOAST ====================
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// Expose for HTML onclick
window.showScreen = showScreen;
window.saveSettings = saveSettings;
window.clearChat = clearChat;
window.showAbout = showAbout;
