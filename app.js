import { tokenizeText, explainTokenId, evaluateTokenizationDoubt } from './tokenizer.js';
import { buildEmbeddingData, cosineSimilarity } from './embeddings.js';
import { EmbeddingScene3D } from './scene3d.js';

const state = {
  text: '',
  model: 'cl100k',
  tokens: [],
  steps: [],
  currentStepIndex: -1, // -1 means show all
  isPlaying: false,
  playTimer: null,
  selectedTokenIndex: null,
  showIds: true,
  showSpaces: true,
  embeddingData: { tokenNodes: [], anchorNodes: [] },
  selectedNode: null
};

// DOM Elements
const promptInput = document.getElementById('prompt-input');
const modelSelect = document.getElementById('model-select');
const statChars = document.getElementById('stat-chars');
const statTokens = document.getElementById('stat-tokens');
const statRatio = document.getElementById('stat-ratio');

const btnPlayTok = document.getElementById('btn-play-tok');
const btnStepBack = document.getElementById('btn-step-back');
const btnStepFwd = document.getElementById('btn-step-fwd');
const btnResetTok = document.getElementById('btn-reset-tok');
const toggleIds = document.getElementById('toggle-ids');
const toggleSpaces = document.getElementById('toggle-spaces');
const tokSpeed = document.getElementById('tok-speed');

const narratorPhase = document.getElementById('narrator-phase');
const narratorText = document.getElementById('narrator-text');
const progressFill = document.getElementById('tok-progress-fill');
const progressLabel = document.getElementById('tok-progress-label');

const tokenStream = document.getElementById('token-stream');
const tokenIdArray = document.getElementById('token-id-array');
const whyIdInput = document.getElementById('why-id-input');
const btnWhyId = document.getElementById('btn-why-id');
const whyIdAnswer = document.getElementById('why-id-answer');
const doubtInput = document.getElementById('doubt-input');
const btnCheckDoubt = document.getElementById('btn-check-doubt');
const doubtAnswer = document.getElementById('doubt-answer');
const inspectorContent = document.getElementById('inspector-content');

// Section 2 DOM
const toggleVectors = document.getElementById('toggle-vectors');
const toggleTrajectory = document.getElementById('toggle-trajectory');
const toggleAnchors = document.getElementById('toggle-anchors');
const toggleLabels = document.getElementById('toggle-labels');
const btnResetCamera = document.getElementById('btn-reset-camera');
const embedDimBadge = document.getElementById('embed-dim-badge');
const embedSelectedInfo = document.getElementById('embed-selected-info');
const neighborsList = document.getElementById('neighbors-list');
const compareA = document.getElementById('compare-a');
const compareB = document.getElementById('compare-b');
const compareResult = document.getElementById('compare-result');

// Initialize 3D Scene
const scene3D = new EmbeddingScene3D(
  document.getElementById('three-container'),
  document.getElementById('labels-overlay'),
  (node) => handleSelect3DNode(node)
);

function stopPlayback() {
  state.isPlaying = false;
  if (state.playTimer) {
    clearInterval(state.playTimer);
    state.playTimer = null;
  }
  btnPlayTok.textContent = '▶ Play Live Tokenization';
}

function runPipeline() {
  stopPlayback();
  state.text = promptInput.value;
  state.model = modelSelect.value;

  const { tokens, steps } = tokenizeText(state.text, state.model);
  state.tokens = tokens;
  state.steps = steps;
  state.currentStepIndex = steps.length > 0 ? steps.length - 1 : -1;
  state.selectedTokenIndex = tokens.length > 0 ? 0 : null;

  // Update stats
  statChars.textContent = state.text.length;
  statTokens.textContent = tokens.length;
  statRatio.textContent = tokens.length > 0 ? (state.text.length / tokens.length).toFixed(2) : '0.0';

  // Update embedding dimension badge
  embedDimBadge.textContent = state.model === 'wordpiece' ? '768-D → 3D' : '1536-D → 3D';

  // Build 3D embeddings
  state.embeddingData = buildEmbeddingData(tokens, state.model);
  scene3D.setData(state.embeddingData.tokenNodes, state.embeddingData.anchorNodes);

  renderTokenizationView();
  if (state.selectedTokenIndex !== null) {
    renderTokenInspector(tokens[state.selectedTokenIndex]);
  } else {
    inspectorContent.innerHTML = '<div class="inspector-empty"><p>Type some text above to inspect tokens.</p></div>';
  }

  populateCompareDropdowns();
  if (state.embeddingData.tokenNodes.length > 0) {
    handleSelect3DNode(state.embeddingData.tokenNodes[0]);
  } else {
    embedSelectedInfo.innerHTML = '<p class="muted">No tokens to display.</p>';
    neighborsList.innerHTML = '';
  }
}

function renderTokenizationView() {
  const { tokens, steps, currentStepIndex } = state;

  let visibleCount = tokens.length;
  let highlightIndex = -1;

  if (steps.length > 0 && currentStepIndex >= 0 && currentStepIndex < steps.length) {
    const step = steps[currentStepIndex];
    visibleCount = step.visibleCount;
    highlightIndex = step.highlightIndex;

    narratorPhase.textContent = step.phase;
    narratorText.textContent = step.explanation;
    const pct = Math.round(((currentStepIndex + 1) / steps.length) * 100);
    progressFill.style.width = `${pct}%`;
    progressLabel.textContent = `Step ${currentStepIndex + 1} / ${steps.length}`;
  } else {
    narratorPhase.textContent = 'LIVE EXPLANATION';
    narratorText.textContent = 'Type text above and press Play Live Tokenization to watch how your text is split and converted into numbers.';
    progressFill.style.width = '0%';
    progressLabel.textContent = 'Ready';
  }

  tokenStream.innerHTML = '';
  const visibleTokens = tokens.slice(0, visibleCount);

  visibleTokens.forEach((tok) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'token-pill';
    if (tok.index === state.selectedTokenIndex) pill.classList.add('selected');
    if (tok.index === highlightIndex) pill.classList.add('active-step');

    pill.style.background = tok.color.bg;
    pill.style.borderColor = tok.color.border;
    pill.style.color = '#f8fafc';

    const labelSpan = document.createElement('span');
    if (state.showSpaces) {
      labelSpan.innerHTML = escapeHtml(tok.text).replace(/^ /, '<span class="space-glyph">␣</span>');
    } else {
      labelSpan.textContent = tok.text;
    }
    pill.appendChild(labelSpan);

    if (state.showIds) {
      const idSpan = document.createElement('span');
      idSpan.className = 'token-id-tag';
      idSpan.textContent = tok.id;
      pill.appendChild(idSpan);
    }

    pill.addEventListener('click', () => {
      state.selectedTokenIndex = tok.index;
      renderTokenizationView();
      renderTokenInspector(tok);
      const matchingNode = state.embeddingData.tokenNodes.find(n => n.index === tok.index);
      if (matchingNode) handleSelect3DNode(matchingNode);
    });

    tokenStream.appendChild(pill);
  });

  tokenIdArray.innerHTML = '';
  if (visibleTokens.length === 0) {
    tokenIdArray.textContent = '[ ]';
  } else {
    tokenIdArray.appendChild(document.createTextNode('['));
    visibleTokens.forEach((tok, idx) => {
      const idBtn = document.createElement('button');
      idBtn.type = 'button';
      idBtn.className = 'raw-id-chip' + (tok.index === state.selectedTokenIndex ? ' active' : '');
      idBtn.textContent = tok.id;
      idBtn.title = `Click to ask why "${tok.text.replace(/^ /, '␣')}" has ID ${tok.id}`;
      idBtn.addEventListener('click', () => {
        state.selectedTokenIndex = tok.index;
        whyIdInput.value = tok.id;
        renderTokenizationView();
        renderTokenInspector(tok);
        showWhyIdExplanation(tok.id);
        const matchingNode = state.embeddingData.tokenNodes.find(n => n.index === tok.index);
        if (matchingNode) handleSelect3DNode(matchingNode);
      });
      tokenIdArray.appendChild(idBtn);
      if (idx < visibleTokens.length - 1) {
        tokenIdArray.appendChild(document.createTextNode(','));
      }
    });
    tokenIdArray.appendChild(document.createTextNode(']'));
  }
}

function showWhyIdExplanation(idVal) {
  const info = explainTokenId(idVal, state.tokens, state.model);
  whyIdAnswer.classList.remove('hidden');
  whyIdAnswer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:4px;">
      <strong>${escapeHtml(info.title)}</strong>
      <span class="dim-badge" style="background:rgba(34,211,238,0.14); color:#67e8f9;">${escapeHtml(info.tier)}</span>
    </div>
    <p>${escapeHtml(info.detail)}</p>
  `;
}

function renderTokenInspector(tok) {
  if (!tok) return;
  const display = tok.text.replace(/^ /, '␣');
  inspectorContent.innerHTML = `
    <div class="inspector-card">
      <div class="inspector-token-hero">
        <span class="hero-text">"${escapeHtml(display)}"</span>
        <span class="hero-id">ID: ${tok.id}</span>
      </div>

      <div class="inspector-explain">
        <strong>Why it looks like this:</strong><br/>
        ${escapeHtml(tok.explanation)}
      </div>

      <div>
        <div class="panel-subheader" style="margin-bottom:6px;">
          <span>UTF-8 Bytes</span>
          <span class="hint-text">${tok.bytes.length} byte(s)</span>
        </div>
        <div class="byte-chips">
          ${tok.bytes.map(b => `<span class="byte-chip">${b}</span>`).join('')}
        </div>
      </div>

      <button type="button" class="btn btn-secondary btn-sm" id="btn-jump-3d">
        Locate "${escapeHtml(display)}" in 3D Embedding Space ↓
      </button>
    </div>
  `;

  document.getElementById('btn-jump-3d').addEventListener('click', () => {
    const matchingNode = state.embeddingData.tokenNodes.find(n => n.index === tok.index);
    if (matchingNode) handleSelect3DNode(matchingNode);
    document.getElementById('section-embedding').scrollIntoView({ behavior: 'smooth' });
  });
}

function handleSelect3DNode(node) {
  state.selectedNode = node;

  // Compute nearest neighbors across all nodes (tokens + anchors) excluding itself
  const allNodes = [...state.embeddingData.tokenNodes, ...state.embeddingData.anchorNodes];
  const scored = allNodes
    .filter(n => !(n.kind === node.kind && n.index === node.index && n.rawText === node.rawText))
    .map(n => ({
      node: n,
      similarity: cosineSimilarity(node.vec, n.vec)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 4);

  scene3D.selectNode(node, scored);

  // Update sidebar info
  embedSelectedInfo.innerHTML = `
    <div class="inspector-token-hero" style="margin-bottom:8px;">
      <span class="hero-text">"${escapeHtml(node.label)}"</span>
      <span class="hero-id">${node.kind === 'token' ? `Token ID: ${node.id}` : 'Reference Concept'}</span>
    </div>
    <div class="coords-grid">
      <div class="coord-box"><span style="color:#f43f5e">X</span> ${node.pos.x}</div>
      <div class="coord-box"><span style="color:#10b981">Y</span> ${node.pos.y}</div>
      <div class="coord-box"><span style="color:#3b82f6">Z</span> ${node.pos.z}</div>
    </div>
    <div class="panel-subheader" style="margin-top:8px; margin-bottom:4px;">
      <span>Embedding Vector Preview</span>
    </div>
    <div class="vector-preview">[${node.preview.join(', ')}, ...]</div>
  `;

  neighborsList.innerHTML = scored.map(item => `
    <div class="neighbor-row">
      <div>
        <span class="neighbor-word">${escapeHtml(item.node.label)}</span>
        <span class="neighbor-type">${item.node.kind === 'anchor' ? 'reference' : 'input token'}</span>
      </div>
      <span class="sim-score">${(item.similarity * 100).toFixed(1)}%</span>
    </div>
  `).join('');

  if (node.kind === 'token') {
    state.selectedTokenIndex = node.index;
    renderTokenizationView();
    const tok = state.tokens[node.index];
    if (tok) renderTokenInspector(tok);
  }
}

function populateCompareDropdowns() {
  const allNodes = [...state.embeddingData.tokenNodes, ...state.embeddingData.anchorNodes];
  const optionsHtml = allNodes.map((n, idx) =>
    `<option value="${idx}">${escapeHtml(n.label)} ${n.kind === 'anchor' ? '(ref)' : ''}</option>`
  ).join('');

  compareA.innerHTML = optionsHtml;
  compareB.innerHTML = optionsHtml;

  if (allNodes.length > 1) {
    compareA.selectedIndex = 0;
    compareB.selectedIndex = 1;
  }
  updateCompareResult();
}

function updateCompareResult() {
  const allNodes = [...state.embeddingData.tokenNodes, ...state.embeddingData.anchorNodes];
  const nodeA = allNodes[Number(compareA.value)];
  const nodeB = allNodes[Number(compareB.value)];
  if (!nodeA || !nodeB) {
    compareResult.textContent = 'Select two tokens to compare.';
    return;
  }
  const sim = cosineSimilarity(nodeA.vec, nodeB.vec);
  const pct = Math.max(0, Math.min(100, Math.round(((sim + 1) / 2) * 100)));
  let interpretation = 'Unrelated or distant concepts.';
  if (sim > 0.78) interpretation = 'Very close in meaning! They live in the same 3D neighborhood.';
  else if (sim > 0.45) interpretation = 'Moderately related — they share some semantic context.';
  else if (sim < -0.2) interpretation = 'Opposite or contrasting semantic regions.';

  compareResult.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span>Cosine Similarity:</span>
      <strong style="font-family:var(--font-mono); color:var(--cyan);">${sim.toFixed(3)}</strong>
    </div>
    <div class="sim-bar-track">
      <div class="sim-bar-fill" style="width:${pct}%"></div>
    </div>
    <p class="muted" style="margin-top:6px;">${interpretation}</p>
  `;
}

// Playback controls
btnPlayTok.addEventListener('click', () => {
  if (state.steps.length === 0) return;
  if (state.isPlaying) {
    stopPlayback();
    return;
  }

  // If at the end, restart from step 0
  if (state.currentStepIndex >= state.steps.length - 1) {
    state.currentStepIndex = 0;
    renderTokenizationView();
  }

  state.isPlaying = true;
  btnPlayTok.textContent = '⏸ Pause';

  const delay = Number(tokSpeed.value) || 450;
  state.playTimer = setInterval(() => {
    if (state.currentStepIndex < state.steps.length - 1) {
      state.currentStepIndex++;
      renderTokenizationView();
    } else {
      stopPlayback();
    }
  }, delay);
});

btnStepFwd.addEventListener('click', () => {
  stopPlayback();
  if (state.currentStepIndex < state.steps.length - 1) {
    state.currentStepIndex++;
    renderTokenizationView();
  }
});

btnStepBack.addEventListener('click', () => {
  stopPlayback();
  if (state.currentStepIndex > 0) {
    state.currentStepIndex--;
    renderTokenizationView();
  }
});

btnResetTok.addEventListener('click', () => {
  stopPlayback();
  if (state.steps.length > 0) {
    state.currentStepIndex = state.steps.length - 1;
    renderTokenizationView();
  }
});

toggleIds.addEventListener('change', () => {
  state.showIds = toggleIds.checked;
  renderTokenizationView();
});

toggleSpaces.addEventListener('change', () => {
  state.showSpaces = toggleSpaces.checked;
  renderTokenizationView();
});

btnWhyId.addEventListener('click', () => {
  showWhyIdExplanation(whyIdInput.value);
});

whyIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    showWhyIdExplanation(whyIdInput.value);
  }
});

function handleCheckDoubt(queryText) {
  const selectedTok = state.selectedTokenIndex !== null ? state.tokens[state.selectedTokenIndex] : null;
  const res = evaluateTokenizationDoubt(queryText, state.tokens, state.model, selectedTok);
  doubtAnswer.className = `doubt-answer verdict-${res.verdict}`;
  doubtAnswer.innerHTML = `
    <span class="doubt-verdict-badge">${escapeHtml(res.badge)}</span>
    <div style="font-weight:600; margin-bottom:4px;">${escapeHtml(res.headline)}</div>
    <p>${escapeHtml(res.explanation)}</p>
  `;
}

btnCheckDoubt.addEventListener('click', () => {
  handleCheckDoubt(doubtInput.value);
});

doubtInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleCheckDoubt(doubtInput.value);
  }
});

document.querySelectorAll('.doubt-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    doubtInput.value = chip.dataset.q;
    handleCheckDoubt(chip.dataset.q);
  });
});

// 3D toggles
toggleVectors.addEventListener('change', () => scene3D.setOptions({ showVectors: toggleVectors.checked }));
toggleTrajectory.addEventListener('change', () => scene3D.setOptions({ showTrajectory: toggleTrajectory.checked }));
toggleAnchors.addEventListener('change', () => scene3D.setOptions({ showAnchors: toggleAnchors.checked }));
toggleLabels.addEventListener('change', () => scene3D.setOptions({ showLabels: toggleLabels.checked }));
btnResetCamera.addEventListener('click', () => scene3D.resetCamera());

compareA.addEventListener('change', updateCompareResult);
compareB.addEventListener('change', updateCompareResult);

// Input & Presets
let debounceTimer = null;
promptInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runPipeline, 180);
});

modelSelect.addEventListener('change', runPipeline);

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    promptInput.value = btn.dataset.text;
    runPipeline();
  });
});

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Initial Run
runPipeline();
