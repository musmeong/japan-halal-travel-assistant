const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const sessionListEl = document.getElementById('session-list');
const newSessionBtn = document.getElementById('new-session-btn');
const clearAllBtn = document.getElementById('clear-all-btn');

// File Upload Elements
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');
const filePreviewContainer = document.getElementById('file-preview-container');
const fileNameSpan = document.getElementById('file-name');
const removeFileBtn = document.getElementById('remove-file-btn');

// State
let sessions = {};
let currentSessionId = null;
let selectedFile = null;      // Holds the raw File object
let selectedFileData = null;  // Holds { mimeType, data (base64) }

// --- Initialization ---
function init() {
  loadSessions();

  if (Object.keys(sessions).length === 0) {
    createNewSession();
  } else {
    const sessionIds = Object.keys(sessions).sort((a, b) => b - a);
    switchSession(sessionIds[0]);
  }
}

// --- Local Storage Management ---
function saveSessions() {
  // Be careful, storing a lot of base64 images in localStorage can hit the 5MB limit quickly.
  // In a real production app, files would be uploaded to S3/CloudStorage, and only URLs saved here.
  try {
    localStorage.setItem('gemini_chat_sessions', JSON.stringify(sessions));
  } catch (e) {
    console.warn("Storage warning: Could not save session to localStorage (likely Exceeded Quota from large attachments). It will only be available for this session.");
    // If we fail to save, the app will continue to run from memory during this visit.
  }
}

function loadSessions() {
  const data = localStorage.getItem('gemini_chat_sessions');
  if (data) {
    sessions = JSON.parse(data);
  }
}

// --- File Handling UI ---
attachBtn.addEventListener('click', () => {
  fileInput.click(); // Trigger the hidden file input
});

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  selectedFile = file;

  // Convert file to Base64 for Gemini inlineData
  try {
    const base64String = await fileToBase64(file);
    const base64Data = base64String.split(',')[1];

    selectedFileData = {
      mimeType: file.type,
      data: base64Data,
      fileName: file.name
    };

    // Render preview above input
    filePreviewContainer.classList.remove('hidden');
    filePreviewContainer.innerHTML = '';

    // Add Thumbnail or Icon depending on mimeType
    if (file.type.startsWith('image/')) {
      filePreviewContainer.innerHTML += `<img src="data:${file.type};base64,${base64Data}" style="max-height: 60px; border-radius: 4px; margin-right: 10px;" alt="preview"/>`;
    } else {
      filePreviewContainer.innerHTML += `<span class="attachment-icon" style="font-size: 1.5rem; margin-right: 10px;">📎</span>`;
    }

    filePreviewContainer.innerHTML += `
      <span class="file-name" style="flex: 1;">${file.name}</span>
      <button type="button" id="remove-file-btn" class="remove-file-btn">&times;</button>
    `;

    // Reattach event listener for the dynamically added remove button
    document.getElementById('remove-file-btn').addEventListener('click', clearFileSelection);

  } catch (error) {
    console.error("Error reading file:", error);
    alert("Failed to read file.");
    clearFileSelection();
  }
});

removeFileBtn.addEventListener('click', () => {
  clearFileSelection();
});

function clearFileSelection() {
  selectedFile = null;
  selectedFileData = null;
  fileInput.value = ''; // reset input
  filePreviewContainer.classList.add('hidden');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// --- Image Clipboard Pasting (Ctrl+V) ---
document.addEventListener('paste', (e) => {
  const items = e.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      // We found an image in the clipboard!
      const file = items[i].getAsFile();
      if (file) {
        // We cannot call an anonymous function, so we inject the file directly into the DOM input
        // and manually trigger the "change" event so the existing listener handles it!
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
      }
      break;
    }
  }
});

// --- Session Management ---
function createNewSession() {
  const id = Date.now().toString();
  sessions[id] = {
    title: `Session ${Object.keys(sessions).length + 1}`,
    history: []
  };
  saveSessions();
  switchSession(id);
}

function switchSession(id) {
  currentSessionId = id;
  chatBox.innerHTML = '';
  clearFileSelection(); // Ensure we don't carry over file selection across sessions

  const history = sessions[id].history;
  history.forEach(msg => {
    // If msg has inlineData (meaning it had an attachment), render a clip icon.
    // If it is a model message, render as HTML.
    const isBot = msg.role !== 'user';

    // Globally replace literal "\n" strings with actual newlines before parsing
    const formattedText = msg.text ? msg.text.replace(/\\n/g, '\n') : "";

    const textToRender = isBot ? marked.parse(formattedText) : formattedText;

    // Crucial fix: Pass the isBot boolean as the isHtml argument so appendMessage uses innerHTML
    appendMessage(isBot ? 'bot' : 'user', textToRender, isBot, msg.inlineData ? msg.inlineData : null);
  });

  renderSidebar();
}

function deleteSession(id, event) {
  event.stopPropagation();

  delete sessions[id];
  saveSessions();

  if (Object.keys(sessions).length === 0) {
    createNewSession();
  } else if (currentSessionId === id) {
    switchSession(Object.keys(sessions)[0]);
  } else {
    renderSidebar();
  }
}

function clearAllSessions() {
  if (confirm('Are you sure you want to delete all sessions? This cannot be undone.')) {
    sessions = {};
    saveSessions();
    createNewSession();
  }
}

// --- UI Rendering ---
function renderSidebar() {
  sessionListEl.innerHTML = '';
  const sortedIds = Object.keys(sessions).sort((a, b) => b - a);

  sortedIds.forEach(id => {
    const session = sessions[id];

    const div = document.createElement('div');
    div.classList.add('session-item');
    if (id === currentSessionId) div.classList.add('active');

    const titleSpan = document.createElement('span');
    titleSpan.textContent = session.title;
    if (titleSpan.textContent.length > 20) {
      titleSpan.textContent = titleSpan.textContent.substring(0, 20) + '...';
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '&times;';
    deleteBtn.classList.add('delete-session-btn');
    deleteBtn.title = "Delete session";
    deleteBtn.onclick = (e) => deleteSession(id, e);

    div.onclick = () => switchSession(id);

    div.appendChild(titleSpan);
    div.appendChild(deleteBtn);
    sessionListEl.appendChild(div);
  });
}

// --- Chat Logic ---
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  // We allow submitting an empty text ONLY if a file is attached
  if (!userMessage && !selectedFileData) return;

  if (sessions[currentSessionId].history.length === 0) {
    // Determine title
    sessions[currentSessionId].title = userMessage || (selectedFileData ? `File: ${selectedFileData.fileName}` : "New Session");
  }

  // 1. Add user message to UI
  appendMessage('user', userMessage, false, selectedFileData ? selectedFileData : null);
  input.value = '';

  // 2. Add message to history payload
  const payloadMessage = { role: 'user', text: userMessage };
  if (selectedFileData) {
    payloadMessage.inlineData = {
      mimeType: selectedFileData.mimeType,
      data: selectedFileData.data,
      fileName: selectedFileData.fileName // custom property for UI rendering later
    };
  }

  sessions[currentSessionId].history.push(payloadMessage);
  saveSessions();
  renderSidebar();

  // Clear file out of UI BEFORE request goes out
  clearFileSelection();

  // 3. Show a temporary "Thinking..." bot message
  const thinkingMsgDiv = appendMessage('bot', 'Thinking...');

  try {
    // 4. Send Request
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation: sessions[currentSessionId].history })
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();

    // 5. Success
    if (data && data.result) {
      // Sometimes APIs return the literal string "\n" instead of an actual newline character.
      // We must globally replace \\n with a real newline \n so marked.parse can render paragraphs and lists properly.
      const formattedText = data.result.replace(/\\n/g, '\n');

      thinkingMsgDiv.innerHTML = marked.parse(formattedText);
      sessions[currentSessionId].history.push({ role: 'model', text: formattedText });
      saveSessions();
    } else {
      thinkingMsgDiv.textContent = 'Sorry, no response received.';
    }

  } catch (error) {
    console.error('Chat error:', error);
    thinkingMsgDiv.textContent = 'Failed to get response from server.';
  }
});

// Helper function to add a message to the chat box
function appendMessage(sender, text, isHtml = false, inlineData = null) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);

  let finalContent = '';

  // If there was an attachment, render a rich preview
  if (inlineData) {
    if (inlineData.mimeType.startsWith('image/')) {
      finalContent += `<div style="margin-bottom: 12px;"><img src="data:${inlineData.mimeType};base64,${inlineData.data}" style="max-height: 200px; max-width: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" alt="${inlineData.fileName}"></div>`;
    } else if (inlineData.mimeType.startsWith('audio/')) {
      finalContent += `<div style="margin-bottom: 12px;"><audio controls src="data:${inlineData.mimeType};base64,${inlineData.data}" style="max-width: 100%; width: 250px;"></audio></div>`;
    } else if (inlineData.mimeType.startsWith('video/')) {
      finalContent += `<div style="margin-bottom: 12px;"><video controls src="data:${inlineData.mimeType};base64,${inlineData.data}" style="max-height: 250px; border-radius: 8px;"></video></div>`;
    } else {
      // Fallback to text + clip for PDFs or unsupported types
      finalContent += `<div style="font-size: 0.8rem; margin-bottom: 5px; opacity: 0.8; font-weight: bold;"><span class="attachment-icon">📎</span> ${inlineData.fileName}</div>`;
    }
  }

  if (text) {
    if (isHtml) {
      // Because we use marked.parse(), the text is ALREADY HTML 
      // (e.g. <p>Hello</p><ul><li>World</li></ul>)
      finalContent += text;
    } else {
      // Escape HTML for safety on user input so they can't inject scripts
      const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      finalContent += `<span>${safeText}</span>`;
    }
  }

  msg.innerHTML = finalContent;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msg;
}

// Event Listeners for sidebar
newSessionBtn.addEventListener('click', createNewSession);
clearAllBtn.addEventListener('click', clearAllSessions);

// --- Help Modal Logic ---
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeModalBtn = document.getElementById('close-modal-btn');

helpBtn.addEventListener('click', () => {
  helpModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
  helpModal.classList.add('hidden');
});

// Close modal if user clicks outside the modal content box
helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) {
    helpModal.classList.add('hidden');
  }
});

// Start
init();
