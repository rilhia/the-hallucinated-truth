// ------------------------------------------------------------
//  GLOBAL STATE
// ------------------------------------------------------------
let gameId = null;
let gameSubject = null;
let lastReplyTime = "";
let typingInterval = null;
let typingElement = null;
let lastSelectedDropdown = null;

const noiseChars = "abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()[]{}<>?+-=_";

const apiHost = window.location.hostname;
const apiPort = "3023";


// ------------------------------------------------------------
//  HELPERS
// ------------------------------------------------------------
function $(id) {
  return document.getElementById(id);
}

function setDisplay(id, visible) {
  $(id).classList.toggle("hidden", !visible);
}

async function postJSON(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => r.json().catch(() => ({})));
}

function safeHTMLText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '<br>');
}

function log(msg) {
  const box = $("log");
  box.innerHTML += `<div class="messageBoxText">${msg}</div>`;
  box.scrollTop = box.scrollHeight;
}

function clearLog() {
  $("log").innerHTML = "";
}

const hiddenPhrase = "the hallucinated truth";
let hiddenIndex = 0;


// ------------------------------------------------------------
//  TYPING EFFECT
// ------------------------------------------------------------
function logTypingStart() {
  const box = $("log");

  typingElement = document.createElement("div");
  typingElement.className = "messageBoxText";
  typingElement.style.opacity = 0.6;

  box.appendChild(typingElement);
  box.scrollTop = box.scrollHeight;

  typingInterval = setInterval(() => {
    let c;

    if (Math.random() < 0.14) {
      c = hiddenPhrase[hiddenIndex];
      hiddenIndex = (hiddenIndex + 1) % hiddenPhrase.length;
    } else {
      c = noiseChars[Math.floor(Math.random() * noiseChars.length)];
    }

    typingElement.innerText += c;

    if (typingElement.innerText.length > 60) {
      typingElement.innerText = typingElement.innerText.slice(5);
    }

    box.scrollTop = box.scrollHeight;
  }, 35);
}

function logTypingStop() {
  clearInterval(typingInterval);
  typingInterval = null;
  if (typingElement) typingElement.innerHTML = "";
}

function logTypingRealMessage(text) {
  if (!typingElement) return;

  const safe = safeHTMLText(text);
  let i = 0;

  (function typeTick() {
    if (i <= safe.length) {
      typingElement.innerHTML = safe.slice(0, i++);
      requestAnimationFrame(typeTick);
    }
  })();
}


// ------------------------------------------------------------
//  SUMMARY BUILDER
// ------------------------------------------------------------
function buildSummary(state) {
  let html = "<br><b>Your Attempts</b><br><br>";

  state.userExplanations.forEach((u, idx) => {
    html += `<b>Guess ${idx + 1}:</b> ${u.userText}<br>`;
    if (u.correct) {
      const fact = state.knownFacts[u.matchedTruthIndex];
      html += `✔ Correct — ${fact.fact}<br>`;
      html += `<i>Source:</i> ${fact.source} — <a href="${fact.url}" target="_blank">${fact.url}</a><br><br>`;
    } else {
      html += `❌ Incorrect<br><br>`;
    }
  });

  const guessed = state.userExplanations
    .filter(u => u.correct)
    .map(u => u.matchedTruthIndex);

  const missed = state.knownFacts
    .map((f, index) => ({ index, ...f }))
    .filter(f => !guessed.includes(f.index));

  if (missed.length > 0) {
    html += "<br><b>Missed Truths</b><br><br>";
    missed.forEach((f) => {
      html += `• ${f.fact}<br>`;
      html += `<i>Source:</i> ${f.source} — <a href="${f.url}" target="_blank">${f.url}</a><br><br>`;
    });
  } else {
    html += "<br><b>You found every truth!</b><br><br>";
  }

  return html;
}


// ------------------------------------------------------------
//  GAME INTERACTIONS
// ------------------------------------------------------------
$("startBtn").onclick = async () => {
  const data = await postJSON(`http://${apiHost}:${apiPort}/api/start`, {});

  gameId = data.gameId;
  clearLog();

  setDisplay("gameLoaderContainer", false);
  $("gameId").textContent = gameId;
  setDisplay("gameArea", true);
  setDisplay("initSection", true);

  log("🟢 Game created. Click 'Generate Story' to begin.");
};

$("initBtn").onclick = async () => {
  if (!gameId) return;

  const promptSubject = $("promptSubject").value.trim();
  $("gameSubject").textContent = promptSubject;

  await postJSON(`http://${apiHost}:${apiPort}/api/init`, { gameId, promptSubject });

  log("📘 Story generation requested… waiting for Ollama.");
  setDisplay("initSection", false);
  logTypingStart();
};

$("explainBtn").onclick = async () => {
  const text = $("truthExplain").value.trim();
  if (!text) return;

  await postJSON(`http://${apiHost}:${apiPort}/api/explainTruth`, {
    gameId,
    explanation: text
  });

  log(`📝 You: ${text}`);
  $("truthExplain").value = "";
};

$("noMoreTruthsBtn").onclick = async () => {
  await postJSON(`http://${apiHost}:${apiPort}/api/end`, { gameId });
};


// ------------------------------------------------------------
//  LOAD GAME
// ------------------------------------------------------------
$("completedDropdown").onchange = () => {
  lastSelectedDropdown = "completedDropdown";
};

$("inProgressDropdown").onchange = () => {
  lastSelectedDropdown = "inProgressDropdown";
};

$("loadGameBtn").onclick = async () => {
  let id = null;

  if (lastSelectedDropdown === "completedDropdown") {
    id = $("completedDropdown").value;
  } else if (lastSelectedDropdown === "inProgressDropdown") {
    id = $("inProgressDropdown").value;
  }

  if (!id) return log("No game selected.");
  loadGame(id);
};

async function loadGame(id) {
  const res = await fetch(`http://${apiHost}:${apiPort}/api/state/${id}`);
  const state = await res.json();

  clearLog();

  gameId = id;
  $("gameId").textContent = id;
  $("gameSubject").textContent = state.subject;

  setDisplay("gameArea", true);

  replayGameFromState(state);
}


// ------------------------------------------------------------
//  REPLAY LOGIC
// ------------------------------------------------------------
function replayGameFromState(state) {
  logTypingStop();
  $("log").innerHTML = "";
  setDisplay("initSection", false);

  log("📂 --- Loaded Saved Game ---");
  log("🟢 Game created. Click 'Generate Story' to begin.");
  log("📘 Story generation requested… waiting for Ollama.");

  if (state.story) {
    typingElement = document.createElement("div");
    typingElement.className = "messageBoxText";
    typingElement.style.opacity = 0.6;

    typingElement.innerHTML = safeHTMLText(
      state.story.map(p => p.paragraph).join("\n\n") + "\n\n"
    );

    $("log").appendChild(typingElement);
    setDisplay("explainSection", true);
  }

  if (state.userExplanations) {
    state.userExplanations.forEach(ex => {
      log("📝 You: " + ex.userText);
      log(
        ex.correct
          ? `✔ You were correct: ${state.knownFacts[ex.matchedTruthIndex].fact}<br><a href="${state.knownFacts[ex.matchedTruthIndex].url}"target="_blank">${state.knownFacts[ex.matchedTruthIndex].url}</a><br><br>`
          : `❌ You were incorrect<br><br>`
      );
    });
  }

  if (state.stage === 3) {
    log(buildSummary(state));
    log(`🎉 Game over — Score: ${state.score}`);

    setDisplay("explainSection", false);
    setDisplay("gameLoaderContainer", true);
    gameId = null;

  } else {
    log("⏳ Game still active — continue guessing.");
    setDisplay("explainSection", true);
  }
}


// ------------------------------------------------------------
//  POPULATE GAME LISTS
// ------------------------------------------------------------
async function refreshDropdowns() {
  const res = await fetch(`http://${apiHost}:${apiPort}/api/games`);
  const { active, completed } = await res.json();

  $("completedDropdown").innerHTML = `<option value="">-- none --</option>`;
  $("inProgressDropdown").innerHTML = `<option value="">-- none --</option>`;

  completed.forEach(id => $("completedDropdown").innerHTML += `<option value="${id}">${id}</option>`);
  active.forEach(id => $("inProgressDropdown").innerHTML += `<option value="${id}">${id}</option>`);
}
refreshDropdowns();


// ------------------------------------------------------------
//  POLLING
// ------------------------------------------------------------
async function pollState() {
  if (!gameId) return;

  try {
    const res = await fetch(`http://${apiHost}:${apiPort}/api/state/${gameId}`);
    const state = await res.json();

    if (state.lastReply && state.lastReplyTime !== lastReplyTime) {
      lastReplyTime = state.lastReplyTime;
      logTypingStop();

      if (state.stage === 1) {
        const text = state.story.map(p => p.paragraph).join("\n\n") + "\n\n";
        logTypingRealMessage(text);
        setDisplay("explainSection", true);
      }

      if (state.stage === 2) {
        const last = state.userExplanations.at(-1);
        log(
          last.correct
            ? `✔ You were correct: ${state.knownFacts[last.matchedTruthIndex].fact}<br><a href="${state.knownFacts[last.matchedTruthIndex].url}"target="_blank">${state.knownFacts[last.matchedTruthIndex].url}</a><br><br>`
            : `❌ You were incorrect<br><br>`
        );
      }

      if (state.stage === 3) {
        log(buildSummary(state));
        log(`🎉 Game over — Score: ${state.score}`);

        setDisplay("gameLoaderContainer", true);
        setDisplay("explainSection", false);
      }

      if (state.stage === -1) {
        log(state.lastReply);
        setDisplay("gameLoaderContainer", true);
        setDisplay("explainSection", false);
      }
    }

  } catch (err) {
    console.error("Polling error:", err);
  }
}

setInterval(pollState, 500);