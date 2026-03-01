const { Marked } = require("marked");
const { markedHighlight } = require("marked-highlight");
const hljs = require("highlight.js");
const { shell } = require("electron");

const API_BASE = "http://127.0.0.1:44755";

const marked = new Marked(
    markedHighlight({
        langPrefix: "hljs language-",
        highlight(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
    })
);

marked.setOptions({
    breaks: true,
    gfm: true,
});

const messagesEl = document.getElementById("messages");
const welcomeEl = document.getElementById("welcome");
const inputEl = document.getElementById("message-input");
const sendBtn = document.getElementById("btn-send");
const themeBtn = document.getElementById("btn-theme");
const settingsBtn = document.getElementById("btn-settings");
const ghostBtn = document.getElementById("btn-ghost");
const modelBtn = document.getElementById("btn-model-select");
const modelPopover = document.getElementById("model-popover");
const modalOverlay = document.getElementById("modal-overlay");
const apiKeyInput = document.getElementById("api-key-input");
const saveKeyBtn = document.getElementById("btn-save-key");
const toggleKeyBtn = document.getElementById("btn-toggle-key");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const iconMoon = document.getElementById("icon-moon");
const iconSun = document.getElementById("icon-sun");
const getKeyLink = document.getElementById("get-key-link");
const hljsThemeLink = document.getElementById("hljs-theme");

// New UI Elements
const btnAttach = document.getElementById("btn-attach");
const btnSearch = document.getElementById("btn-search");
const btnCode = document.getElementById("btn-code");
const imageUpload = document.getElementById("image-upload");
const imagePreview = document.getElementById("image-preview");
const previewImg = document.getElementById("preview-img");
const btnRemoveImg = document.getElementById("btn-remove-img");

const systemPromptInput = document.getElementById("system-prompt-input");
const tempSlider = document.getElementById("temp-slider");
const tempVal = document.getElementById("temp-val");

// State Variables
let isProcessing = false;
let currentModel = "gemini-3.1-pro-preview-customtools";
let currentThinkingLevel = "none"; // Disabled by default until toggle is checked
let useSearch = true; // Web Grounding default ON
let useCode = false;
let attachedImageBase64 = null;
let attachedImageMimeType = null;

function initTheme() {
    const saved = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", saved);
    updateThemeIcons(saved);
    updateHljsTheme(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    updateThemeIcons(next);
    updateHljsTheme(next);
}

function updateThemeIcons(theme) {
    if (theme === "dark") {
        iconMoon.style.display = "block";
        iconSun.style.display = "none";
    } else {
        iconMoon.style.display = "none";
        iconSun.style.display = "block";
    }
}

function updateHljsTheme(theme) {
    if (theme === "dark") {
        hljsThemeLink.href = "node_modules/highlight.js/styles/github-dark.min.css";
    } else {
        hljsThemeLink.href = "node_modules/highlight.js/styles/github.min.css";
    }
}

async function checkStatus() {
    try {
        const res = await fetch(`${API_BASE}/chat/status`);
        const data = await res.json();
        if (data.api_key_set) {
            statusDot.className = "connected";
            statusText.textContent = "Connected to Gemini";
            return true;
        } else {
            statusDot.className = "disconnected";
            statusText.textContent = "API key not set";
            return false;
        }
    } catch {
        statusDot.className = "disconnected";
        statusText.textContent = "Server not running";
        return false;
    }
}

async function setApiKey(key) {
    const res = await fetch(`${API_BASE}/chat/api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key }),
    });
    return res.ok;
}

function showModal() {
    modalOverlay.classList.remove("hidden");
    apiKeyInput.focus();
}

function hideModal() {
    modalOverlay.classList.add("hidden");
}

function addMessage(role, content, extraNodes = []) {
    const chatContainer = document.getElementById("chat-container");
    if (chatContainer.classList.contains("chat-empty")) {
        if (document.startViewTransition) {
            document.startViewTransition(() => {
                chatContainer.classList.remove("chat-empty");
            });
        } else {
            chatContainer.classList.remove("chat-empty");
        }
    }

    if (welcomeEl) {
        // We keep welcome in DOM now to let CSS handle it
    }

    const msgEl = document.createElement("div");
    msgEl.className = "message";

    const innerEl = document.createElement("div");
    innerEl.className = "message-inner";

    const headerEl = document.createElement("div");
    headerEl.className = "message-header";

    const avatarEl = document.createElement("div");
    avatarEl.className = `message-avatar ${role}`;
    avatarEl.textContent = role === "user" ? "Y" : "G";

    const roleEl = document.createElement("span");
    roleEl.className = "message-role";
    roleEl.textContent = role === "user" ? "You" : "Gemini";

    headerEl.appendChild(avatarEl);
    headerEl.appendChild(roleEl);

    const contentEl = document.createElement("div");
    contentEl.className = "message-content";

    if (extraNodes.length > 0) {
        extraNodes.forEach(node => contentEl.appendChild(node));
    }

    if (role === "user") {
        const textNode = document.createElement("div");
        textNode.textContent = content;
        contentEl.appendChild(textNode);
    } else {
        const markdownNode = document.createElement("div");
        markdownNode.innerHTML = renderMarkdown(content);
        addCopyButtons(markdownNode);
        contentEl.appendChild(markdownNode);
    }

    innerEl.appendChild(headerEl);
    innerEl.appendChild(contentEl);
    msgEl.appendChild(innerEl);
    messagesEl.appendChild(msgEl);
    scrollToBottom();

    return contentEl;
}

function addTypingIndicator() {
    const chatContainer = document.getElementById("chat-container");
    if (chatContainer.classList.contains("chat-empty")) {
        if (document.startViewTransition) {
            document.startViewTransition(() => {
                chatContainer.classList.remove("chat-empty");
            });
        } else {
            chatContainer.classList.remove("chat-empty");
        }
    }


    const msgEl = document.createElement("div");
    msgEl.className = "message";
    msgEl.id = "typing-message";

    const innerEl = document.createElement("div");
    innerEl.className = "message-inner";

    const headerEl = document.createElement("div");
    headerEl.className = "message-header";

    const avatarEl = document.createElement("div");
    avatarEl.className = "message-avatar assistant";
    avatarEl.textContent = "G";

    const roleEl = document.createElement("span");
    roleEl.className = "message-role";
    roleEl.textContent = "Gemini";

    headerEl.appendChild(avatarEl);
    headerEl.appendChild(roleEl);

    const contentEl = document.createElement("div");
    contentEl.className = "message-content";

    // Phase 1: Connecting indicator with three dots
    const connectingEl = document.createElement("div");
    connectingEl.className = "connecting-indicator";
    connectingEl.id = "connecting-phase";
    connectingEl.innerHTML = `
        <div class="dot-group">
            <span></span><span></span><span></span>
        </div>
        <span class="status-text">Bağlantı kuruluyor...</span>
    `;

    contentEl.appendChild(connectingEl);
    innerEl.appendChild(headerEl);
    innerEl.appendChild(contentEl);
    msgEl.appendChild(innerEl);
    messagesEl.appendChild(msgEl);
    scrollToBottom();

    return contentEl;
}

function switchToThinkingPhase() {
    const connectingEl = document.getElementById("connecting-phase");
    if (!connectingEl) return;

    const thinkingEl = document.createElement("div");
    thinkingEl.className = "thinking-indicator";
    thinkingEl.id = "thinking-phase";
    thinkingEl.innerHTML = `
        <svg class="think-icon" viewBox="0 0 24 24">
            <circle class="think-circle" cx="12" cy="12" r="6" />
            <circle class="think-dot" cx="9" cy="12" r="1.2" />
            <circle class="think-dot" cx="12" cy="12" r="1.2" />
            <circle class="think-dot" cx="15" cy="12" r="1.2" />
        </svg>
        <span class="status-text">Düşünüyor...</span>
    `;

    connectingEl.replaceWith(thinkingEl);
}

function addThinkingSection(parentEl, thoughtText) {
    // Parse thought text into lines for timeline
    const lines = thoughtText.split('\n').filter(l => l.trim());
    const summaryLine = lines[0] || 'Düşünüyor...';
    const detailLines = lines.slice(1);

    // Check if thought chain already exists
    let chainEl = parentEl.querySelector(".thought-chain");
    if (chainEl) {
        // Update existing
        const summaryEl = chainEl.querySelector(".thought-summary");
        const bodyEl = chainEl.querySelector(".thought-chain-body");
        summaryEl.textContent = summaryLine;
        bodyEl.innerHTML = '';
        const timelineEl = buildTimeline(detailLines);
        bodyEl.appendChild(timelineEl);
        return;
    }

    chainEl = document.createElement("div");
    chainEl.className = "thought-chain";

    // Header: sparkle + summary + chevron
    const headerEl = document.createElement("div");
    headerEl.className = "thought-chain-header";

    const sparkle = `<svg class="thought-sparkle" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"/></svg>`;

    const summaryEl = document.createElement("span");
    summaryEl.className = "thought-summary";
    summaryEl.textContent = summaryLine;

    const chevron = `<svg class="thought-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;

    headerEl.innerHTML = sparkle;
    headerEl.appendChild(summaryEl);
    headerEl.insertAdjacentHTML("beforeend", chevron);

    // Body: vertical timeline
    const bodyEl = document.createElement("div");
    bodyEl.className = "thought-chain-body";
    const timelineEl = buildTimeline(detailLines);
    bodyEl.appendChild(timelineEl);

    headerEl.addEventListener("click", () => {
        headerEl.classList.toggle("expanded");
        bodyEl.classList.toggle("visible");
    });

    chainEl.appendChild(headerEl);
    chainEl.appendChild(bodyEl);

    // Insert before any existing indicator
    const indicator = parentEl.querySelector(".connecting-indicator, .thinking-indicator");
    if (indicator) {
        parentEl.insertBefore(chainEl, indicator);
    } else {
        parentEl.appendChild(chainEl);
    }

    scrollToBottom();
}

function buildTimeline(lines) {
    const timelineEl = document.createElement("div");
    timelineEl.className = "thought-timeline";

    const icons = [
        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    ];

    lines.forEach((line, idx) => {
        const item = document.createElement("div");
        item.className = "thought-timeline-item";

        const iconEl = document.createElement("div");
        iconEl.className = "thought-timeline-icon";
        iconEl.innerHTML = icons[idx % icons.length];

        const textEl = document.createElement("div");
        textEl.className = "thought-timeline-text";
        textEl.textContent = line.trim();

        item.appendChild(iconEl);
        item.appendChild(textEl);
        timelineEl.appendChild(item);
    });

    return timelineEl;
}

function removeTypingIndicator() {
    const el = document.getElementById("typing-message");
    if (el) el.remove();
}

function addToolCall(parentEl, name, args, status) {
    const toolEl = document.createElement("div");
    toolEl.className = "tool-call";

    const headerEl = document.createElement("div");
    headerEl.className = "tool-call-header";

    const chevron = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;

    const nameEl = document.createElement("span");
    nameEl.className = "tool-call-name";
    nameEl.textContent = name;

    const statusEl = document.createElement("span");
    statusEl.className = "tool-call-status";
    statusEl.textContent = status || "running...";

    headerEl.innerHTML = chevron;
    headerEl.appendChild(nameEl);
    headerEl.appendChild(statusEl);

    const bodyEl = document.createElement("div");
    bodyEl.className = "tool-call-body";
    bodyEl.textContent = typeof args === "string" ? args : JSON.stringify(args, null, 2);

    headerEl.addEventListener("click", () => {
        headerEl.classList.toggle("expanded");
        bodyEl.classList.toggle("visible");
    });

    toolEl.appendChild(headerEl);
    toolEl.appendChild(bodyEl);

    const indicatorEl = parentEl.querySelector(".connecting-indicator, .thinking-indicator");
    if (indicatorEl) {
        parentEl.insertBefore(toolEl, indicatorEl);
    } else {
        parentEl.appendChild(toolEl);
    }

    scrollToBottom();

    return { statusEl, bodyEl };
}

function renderMarkdown(text) {
    let html = marked.parse(text);

    html = html.replace(/<pre><code(.*?)>/g, (match, attrs) => {
        let lang = "";
        const langMatch = attrs.match(/class="hljs language-(\w+)"/);
        if (langMatch) {
            lang = langMatch[1];
        }
        const header = `<div class="code-header"><span>${lang || "code"}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>`;
        return `<pre>${header}<code${attrs}>`;
    });

    return html;
}

function addCopyButtons(el) {
    el.querySelectorAll("pre code").forEach((block) => {
        block.parentElement.addEventListener("dblclick", () => {
            const text = block.textContent;
            navigator.clipboard.writeText(text);
        });
    });
}

window.copyCode = function (btn) {
    const pre = btn.closest("pre");
    const code = pre.querySelector("code");
    navigator.clipboard.writeText(code.textContent);
    btn.textContent = "Copied!";
    setTimeout(() => {
        btn.textContent = "Copy";
    }, 2000);
};

function scrollToBottom() {
    requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    });
}

function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + "px";
}

async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || isProcessing) return;

    isProcessing = true;
    sendBtn.disabled = true;
    inputEl.value = "";
    autoResize();

    addMessage("user", text);

    const assistantContent = addTypingIndicator();

    // Build the expanded payload
    const payload = {
        message: text,
        model: currentModel,
        thinking_level: currentThinkingLevel,
        temperature: parseFloat(tempSlider.value),
        enable_google_search: useSearch,
        enable_code_execution: useCode,
    };

    const sysPrompt = systemPromptInput.value.trim();
    if (sysPrompt) {
        payload.system_instruction = sysPrompt;
    }

    if (attachedImageBase64 && attachedImageMimeType) {
        payload.image_base64 = attachedImageBase64;
        payload.image_mime_type = attachedImageMimeType;

        // Clear attachment upon send
        attachedImageBase64 = null;
        attachedImageMimeType = null;
        imagePreview.classList.add("hidden");
        previewImg.src = "";
        imageUpload.value = "";
    }

    try {
        const res = await fetch(`${API_BASE}/chat/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errText = await res.text();
            removeTypingIndicator();
            addMessage("assistant", `Error: ${errText}`);
            isProcessing = false;
            sendBtn.disabled = false;
            return;
        }

        const data = await res.json();
        const chatId = data.chat_id;

        const evtSource = new EventSource(`${API_BASE}/chat/events/${chatId}`);

        let toolCalls = {};
        let finalText = "";

        let switchedToThinking = false;

        evtSource.addEventListener("tool_call", (e) => {
            if (!switchedToThinking) {
                switchToThinkingPhase();
                switchedToThinking = true;
            }
            const payload = JSON.parse(e.data);
            const refs = addToolCall(
                assistantContent,
                payload.name,
                payload.args,
                "running..."
            );
            toolCalls[payload.name + "_" + (payload.call_index || 0)] = refs;
        });

        evtSource.addEventListener("tool_result", (e) => {
            const payload = JSON.parse(e.data);
            const key = payload.name + "_" + (payload.call_index || 0);
            const refs = toolCalls[key];
            if (refs) {
                refs.statusEl.textContent = "completed";
                refs.bodyEl.textContent += "\n\n--- Result ---\n" + payload.result;
            }
        });

        evtSource.addEventListener("thinking", (e) => {
            if (!switchedToThinking) {
                switchToThinkingPhase();
                switchedToThinking = true;
            }
            const payload = JSON.parse(e.data);
            addThinkingSection(assistantContent, payload.content);
        });

        evtSource.addEventListener("text", (e) => {
            if (!switchedToThinking) {
                switchToThinkingPhase();
                switchedToThinking = true;
            }
            const payload = JSON.parse(e.data);
            finalText += payload.content;
        });

        evtSource.addEventListener("done", () => {
            evtSource.close();

            // Extract thought chain before removing tracking indicator
            const typingMsg = document.getElementById("typing-message");
            const extraNodes = [];
            if (typingMsg) {
                const thoughtChain = typingMsg.querySelector('.thought-chain');
                if (thoughtChain) {
                    extraNodes.push(thoughtChain);
                }
            }

            removeTypingIndicator();

            if (finalText) {
                addMessage("assistant", finalText, extraNodes);
            }

            isProcessing = false;
            sendBtn.disabled = false;
            inputEl.focus();
        });

        evtSource.addEventListener("error_msg", (e) => {
            evtSource.close();
            removeTypingIndicator();
            const payload = JSON.parse(e.data);
            addMessage("assistant", `Error: ${payload.error}`);
            isProcessing = false;
            sendBtn.disabled = false;
        });

        evtSource.onerror = () => {
            evtSource.close();
            removeTypingIndicator();
            if (!finalText) {
                addMessage("assistant", "Connection lost. Please try again.");
            }
            isProcessing = false;
            sendBtn.disabled = false;
        };
    } catch (err) {
        removeTypingIndicator();
        addMessage("assistant", `Connection error: ${err.message}`);
        isProcessing = false;
        sendBtn.disabled = false;
    }
}

modelBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    // Check if we should open Up or Down based on screen space
    const rect = modelBtn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const popoverHeight = 350; // Estimated max height based on clamp

    if (spaceBelow < popoverHeight && !document.getElementById("chat-container").classList.contains("chat-empty")) {
        modelPopover.classList.add("open-up");
    } else {
        modelPopover.classList.remove("open-up");
    }

    modelPopover.classList.toggle("hidden");
});

// Handle Model Selection
document.querySelectorAll(".model-option").forEach(opt => {
    opt.addEventListener("click", () => {
        document.querySelectorAll(".model-option").forEach(o => o.classList.remove("active"));
        opt.classList.add("active");
        currentModel = opt.getAttribute("data-model");
        const textLabel = opt.querySelector(".model-name").textContent.trim();
        modelBtn.innerHTML = `${textLabel} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><path d="m6 9 6 6 6-6"/></svg>`;
        modelPopover.classList.add("hidden");
    });
});

// Handle Thinking Level Options
const thinkingToggle = document.getElementById("thinking-toggle");
const thinkingLevelsContainer = document.getElementById("thinking-levels-container");

thinkingToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
        thinkingLevelsContainer.classList.remove("hidden");
        // Ensure there's a valid default selection
        if (currentThinkingLevel === "none") {
            const activeBtn = thinkingLevelsContainer.querySelector(".think-btn.active") || thinkingLevelsContainer.querySelector(".think-btn");
            activeBtn.classList.add("active");
            currentThinkingLevel = activeBtn.getAttribute("data-level");
        }
    } else {
        thinkingLevelsContainer.classList.add("hidden");
        currentThinkingLevel = "none";
    }
});

document.querySelectorAll(".think-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation(); // Keep popover open
        document.querySelectorAll(".think-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        if (thinkingToggle.checked) {
            currentThinkingLevel = btn.getAttribute("data-level");
        }
    });
});

document.addEventListener("click", (e) => {
    if (!modelPopover.contains(e.target) && e.target !== modelBtn) {
        modelPopover.classList.add("hidden");
        // Also collapse More models when closing popover
        const moreModelsSection = document.getElementById("more-models-section");
        const moreModelsBtn = document.getElementById("more-models-btn");
        if (moreModelsSection && moreModelsBtn) {
            moreModelsSection.classList.remove("visible");
            moreModelsSection.classList.add("hidden");
            moreModelsBtn.classList.remove("expanded");
        }
    }
});

// Handle More Models Toggle
document.getElementById("more-models-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    const section = document.getElementById("more-models-section");
    const btn = document.getElementById("more-models-btn");
    const isVisible = section.classList.contains("visible");

    if (isVisible) {
        section.classList.remove("visible");
        section.classList.add("hidden");
        btn.classList.remove("expanded");
    } else {
        section.classList.remove("hidden");
        section.classList.add("visible");
        btn.classList.add("expanded");
    }
});

const promptsData = {
    write: [
        "Blog yazım için yaratıcı başlık fikirleri ver",
        "Kısa bir motivasyon konuşması yaz",
        "Bu sabah yaşadığım komik bir olayı hikayeleştir",
        "Resmi bir toplantı daveti e-postası tasarla",
        "Bir bilim kurgu romanı için karakter betimlemesi yap",
        "Müşteriye gönderilecek nazik bir ret e-postası yaz",
        "İlgi çekici bir LinkedIn gönderisi taslağı oluştur",
        "Yeni başlayanlar için yoga hakkında bilgilendirici bir metin yaz",
        "İstanbul'un tarihi mekanlarını anlatan turistik bir broşür metni hazırla",
        "Zaman yolculuğu temalı bir mini öykü yaz",
        "Bir teknoloji ürününün lansmanı için heyecan verici bir basın bülteni oluştur",
        "Kahve kültürü üzerine düşündürücü bir deneme kaleme al",
        "Freelance çalışanlar için verimlilik üzerine bir manifesto yaz",
        "Sosyal medya için 5 farklı 'Tarihte Bugün' formatlı bilgi metni hazırla",
        "Zorlu bir hafta geçiren bir arkadaşıma moral veren bir şiir yaz"
    ],
    learn: [
        "Kuantum fiziğini 5 yaşındaki birine anlatır gibi açıkla",
        "Rönesans döneminin sanata etkilerini özetle",
        "Yapay zeka modelleri ağırlıklarını nasıl günceller?",
        "Fransız devriminin ana nedenleri nelerdi?",
        "Uzay-zaman eğriliği ne anlama geliyor?",
        "Blockchain teknolojisinin çalışma mantığını basitçe açıkla",
        "Genetik mühendisliğinde CRISPR yönteminin önemi nedir?",
        "Roma İmparatorluğu'nun çöküş sürecini adım adım anlat",
        "Kara deliklerin etrafındaki 'Olay Ufku' kavramını detaylandır",
        "Dinozorların yok oluş teorilerini karşılaştırmalı olarak açıkla",
        "Psikolojide 'Bilişsel Çelişki' nedir ve günlük hayattaki örnekleri nelerdir?",
        "Modern mimarinin doğuşu ve temel prensipleri hakkında bilgi ver",
        "Güneş sistemindeki gezegenlerin isimleri nereden gelmektedir?",
        "Küresel ısınmanın okyanus akıntılarına etkisini anlat",
        "İnsan beynindeki nöroplastisite kavramı ne demektir?"
    ],
    code: [
        "React ile basit bir sayaç componenti yaz",
        "Python'da list comprehension nasıl kullanılır?",
        "REST API ile GraphQL arasındaki temel farklar nelerdir?",
        "Rust dilinde 'Borrow Checking' konseptini açıkla",
        "JavaScript'te async/await yapısını örnekle",
        "Docker ve Kubernetes arasındaki temel farklar nelerdir?",
        "SQL'de JOIN türlerini (INNER, LEFT, RIGHT, FULL) örneklerle açıkla",
        "Bir web projesinde CI/CD pipeline nasıl kurulur?",
        "TypeScript kullanmanın JavaScript'e göre avantajları nelerdir?",
        "Git'te 'rebase' ve 'merge' farkı nedir? Hangisi ne zaman kullanılmalı?",
        "C++ dilinde pointer'ların çalışma mantığı ve bellek yönetimi",
        "Vue.js ile React'in lifecycle metotlarını karşılaştır",
        "Microservices mimarisinin avantajları ve dezavantajları nelerdir?",
        "Hata ayıklama (debugging) sürecimi hızlandıracak 5 ipucu ver",
        "Güvenli bir şifreleme algoritması tasarlarken nelere dikkat edilmeli?"
    ],
    life: [
        "Daha verimli ders çalışmak için taktikler ver",
        "Günlük stresle başa çıkmak için 5 basit yöntem söyle",
        "Sağlıklı bir uyku düzeni nasıl oluşturabilirim?",
        "Zaman yönetimimi geliştirmek için ne yapmalıyım?",
        "Kitap okuma alışkanlığı kazanmak için öneriler ver",
        "Güne enerjik başlamak için bir sabah rutini oluştur",
        "Sağlıklı beslenme alışkanlığı edinmek için küçük adımlar öner",
        "Etkili iletişim becerilerimi nasıl geliştirebilirim?",
        "Evde kolayca yapılabilecek 15 dakikalık bir egzersiz programı hazırla",
        "Meditasyon yapmaya yeni başlayan biri için temel adımlar nelerdir?",
        "Ekran süresini azaltmak için dijital detoks tavsiyeleri ver",
        "Yeni bir dil öğrenirken kullanılabilecek uygulamalı stratejiler",
        "Kişisel bütçe ve harcama takibi için pratik yöntemler paylaş",
        "Özgüven geliştirmek için yapılabilecek zihinsel egzersizler",
        "Yaratıcılığı tetikleyen hobiler nelerdir?"
    ],
    claude: [
        "Bana daha önce hiç duymadığım ilginç bir felsefi paradoks anlat",
        "Mars'ta kurulacak ilk koloninin bir gününü hayal et",
        "Eğer hayvanlar konuşabilseydi dünya nasıl bir yer olurdu?",
        "Bana ilham verecek, çok bilinmeyen tarihi bir anekdot paylaş",
        "Gelecekteki ulaşım teknolojileri hakkında tahminlerde bulun",
        "İnsan zihninin sınırlarını zorlayan bir bilim kurgu teorisi üret",
        "Doğada bulunan matematiğin (Altın Oran, Fibonacci) gizemi",
        "Eğer zaman yolculuğu icat edilseydi yazılacak ilk ahlak kuralları",
        "Rüyaların bilimsel açıklaması ve lucid rüya (bilinçli rüya) deneyimleri",
        "Tarihin akışını değiştiren tesadüfi 5 büyük icat",
        "Evrendeki olası farklı yaşam formlarının kimyasal yapısı",
        "Müzik ve insan psikolojisi arasındaki derin bağlantıyı açıkla",
        "Kendi kendine öğrenen evrimsel algoritmaların yaratacağı senaryolar",
        "Sanal gerçeklik dünyasında geçen bir detektiflik hikayesi başlat",
        "Bilmediğimiz bir mitolojiden esinlenerek yeni bir tanrı/tanrıça yarat"
    ]
};

const suggestedMenuPane = document.getElementById("suggested-menu-pane");
const suggestedMenuList = document.getElementById("suggested-menu-list");
const suggestedMenuTitleText = document.getElementById("suggested-menu-title-text");
const btnCloseSuggestedMenu = document.getElementById("btn-close-suggested-menu");
const suggestedActionsContainer = document.querySelector(".suggested-actions");

// Helper: Shuffle array and pull N items
function getRandomPrompts(array, n) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

// Helper: Word-by-word soft fade-in animation
function softTextEntrance(element, finalString, itemIndex) {
    const words = finalString.split(' ');
    const baseDelay = itemIndex * 0.12; // stagger between menu items
    element.innerHTML = '';
    words.forEach((word, i) => {
        const span = document.createElement('span');
        span.className = 'word-fade';
        span.textContent = word + ' ';
        span.style.animationDelay = `${baseDelay + i * 0.04}s`;
        element.appendChild(span);
    });
}

// Handle Suggested Actions Menu Toggle
document.querySelectorAll(".suggest-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const preset = btn.getAttribute("data-preset");
        const title = btn.textContent.trim();
        const basePrompts = promptsData[preset] || [];
        const randomPrompts = getRandomPrompts(basePrompts, 5);

        // SVG Transfer
        const svgIcon = btn.querySelector("svg");
        const headerIconContainer = document.querySelector(".suggested-menu-title svg");
        if (svgIcon && headerIconContainer) {
            headerIconContainer.outerHTML = svgIcon.outerHTML; // Replace completely
            document.querySelector(".suggested-menu-title svg").classList.add("suggested-menu-icon"); // Re-add class
        }

        // Set title
        suggestedMenuTitleText.textContent = title;

        // Populate list
        suggestedMenuList.innerHTML = "";
        randomPrompts.forEach((promptText, index) => {
            const item = document.createElement("div");
            item.className = "suggested-menu-item";
            item.addEventListener("click", () => {
                inputEl.value = promptText;
                inputEl.focus();
                autoResize();
                sendBtn.classList.add("active");
                closeSuggestedMenu();
            });
            suggestedMenuList.appendChild(item);

            // Soft staggered fade-in
            softTextEntrance(item, promptText, index);
        });

        // Toggle visibility with CSS transition trigger
        suggestedActionsContainer.classList.remove("anim-in");
        suggestedActionsContainer.classList.add("anim-out");

        setTimeout(() => {
            const updateUI = () => {
                suggestedActionsContainer.style.display = "none";
                suggestedMenuPane.classList.remove("hidden");
                suggestedMenuPane.classList.remove("anim-out");
                suggestedMenuPane.classList.add("anim-in");
            };

            if (document.startViewTransition) {
                document.startViewTransition(updateUI);
            } else {
                updateUI();
            }
        }, 250);
    });
});

function closeSuggestedMenu() {
    suggestedMenuPane.classList.remove("anim-in");
    suggestedMenuPane.classList.add("anim-out");

    setTimeout(() => {
        const updateUI = () => {
            suggestedMenuPane.classList.add("hidden");
            suggestedActionsContainer.style.display = "flex";
            suggestedActionsContainer.classList.remove("anim-out");
            suggestedActionsContainer.classList.add("anim-in");
        };

        if (document.startViewTransition) {
            document.startViewTransition(updateUI);
        } else {
            updateUI();
        }
    }, 250);
}

btnCloseSuggestedMenu.addEventListener("click", closeSuggestedMenu);

themeBtn.addEventListener("click", toggleTheme);

settingsBtn.addEventListener("click", showModal);

ghostBtn.addEventListener("click", () => {
    // Placeholder for future functionality
    console.log("Ghost button clicked - coming soon!");
});

sendBtn.addEventListener("click", sendMessage);

inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

inputEl.addEventListener("input", () => {
    autoResize();
    if (inputEl.value.trim() && !isProcessing) {
        sendBtn.classList.add("active");
    } else {
        sendBtn.classList.remove("active");
    }
});

saveKeyBtn.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
        hideModal(); // Allow closing without key to change other settings
        return;
    }

    saveKeyBtn.disabled = true;
    saveKeyBtn.textContent = "Kaydediliyor...";

    const existing = document.querySelector("#modal-body .error-text");
    if (existing) existing.remove();

    try {
        const success = await setApiKey(key);
        if (success) {
            hideModal();
            await checkStatus();
            inputEl.focus();
        } else {
            const err = document.createElement("p");
            err.className = "error-text";
            err.textContent = "API Key reddedildi.";
            document.getElementById("modal-body").appendChild(err);
        }
    } catch {
        const err = document.createElement("p");
        err.className = "error-text";
        err.textContent = "Sunucuya bağlanılamıyor.";
        document.getElementById("modal-body").appendChild(err);
    }

    saveKeyBtn.disabled = false;
    saveKeyBtn.textContent = "Kaydet & Kapat";
});

toggleKeyBtn.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
        apiKeyInput.type = "text";
    } else {
        apiKeyInput.type = "password";
    }
});

apiKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        saveKeyBtn.click();
    }
});

getKeyLink.addEventListener("click", (e) => {
    e.preventDefault();
    shell.openExternal("https://aistudio.google.com/apikey");
});

// --- New Feature Sub-Toggles ---

tempSlider.addEventListener("input", () => {
    tempVal.textContent = tempSlider.value;
});

btnAttach.addEventListener("click", () => {
    imageUpload.click();
});

imageUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        const fullDataUrl = ev.target.result;
        // e.g. "data:image/png;base64,iVBORw0KGgo..."
        const parts = fullDataUrl.split(",");
        const mimeLine = parts[0];
        attachedImageMimeType = mimeLine.match(/:(.*?);/)[1];
        attachedImageBase64 = parts[1];

        previewImg.src = fullDataUrl;
        imagePreview.classList.remove("hidden");
        btnAttach.classList.add("active");
    };
    reader.readAsDataURL(file);
});

btnRemoveImg.addEventListener("click", () => {
    attachedImageBase64 = null;
    attachedImageMimeType = null;
    imagePreview.classList.add("hidden");
    previewImg.src = "";
    imageUpload.value = "";
    btnAttach.classList.remove("active");
});

btnSearch.addEventListener("click", () => {
    useSearch = !useSearch;
    if (useSearch) {
        btnSearch.classList.add("active");
    } else {
        btnSearch.classList.remove("active");
    }
});

btnCode.addEventListener("click", () => {
    useCode = !useCode;
    if (useCode) {
        btnCode.classList.add("active");
    } else {
        btnCode.classList.remove("active");
    }
});

async function init() {
    initTheme();
    const hasKey = await checkStatus();
    if (!hasKey) {
        showModal();
    } else {
        inputEl.focus();
    }

    setInterval(checkStatus, 30000);
}

init();
