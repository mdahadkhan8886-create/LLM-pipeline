// Realistic Semantic Feature Embedding Engine + 3D Projection + Cosine Similarity

// 12 Semantic Dimensions:
// 0: Royalty/Status, 1: Human/Living, 2: Tech/AI, 3: Code/Syntax,
// 4: Food/Sensory, 5: Nature/Time, 6: Action/Verb, 7: Positive/Quality,
// 8: Grammar/Function, 9: Abstract/Concept, 10: Number/Quantity, 11: Punctuation/Struct

const SEMANTIC_LEXICON = {
  // Royalty & People
  king:         [0.95, 0.80, -0.10, -0.20, 0.00, 0.05, 0.10, 0.25, -0.30, 0.20, 0.00, -0.20],
  queen:        [0.95, 0.82, -0.10, -0.20, 0.02, 0.05, 0.10, 0.30, -0.30, 0.20, 0.00, -0.20],
  royal:        [0.90, 0.35, -0.10, -0.20, 0.05, 0.05, 0.00, 0.35, -0.20, 0.35, 0.00, -0.15],
  palace:       [0.82, 0.20, -0.15, -0.20, 0.05, 0.25, -0.10, 0.25, -0.20, 0.15, 0.00, -0.15],
  prince:       [0.88, 0.80, -0.10, -0.20, 0.00, 0.05, 0.12, 0.28, -0.30, 0.18, 0.00, -0.20],
  man:          [0.15, 0.92, 0.00, -0.10, 0.00, 0.05, 0.15, 0.10, -0.20, 0.10, 0.00, -0.20],
  woman:        [0.15, 0.94, 0.00, -0.10, 0.00, 0.05, 0.15, 0.15, -0.20, 0.10, 0.00, -0.20],

  // AI, Language & Tech
  artificial:   [-0.10, -0.20, 0.92, 0.35, -0.20, -0.20, 0.05, 0.15, -0.15, 0.65, 0.10, -0.10],
  intelligence: [-0.05, 0.25, 0.90, 0.25, -0.20, -0.10, 0.10, 0.35, -0.20, 0.80, 0.05, -0.10],
  model:        [-0.10, -0.10, 0.85, 0.45, -0.20, -0.15, 0.05, 0.10, -0.10, 0.60, 0.15, -0.05],
  models:       [-0.10, -0.10, 0.86, 0.45, -0.20, -0.15, 0.05, 0.10, -0.10, 0.60, 0.25, -0.05],
  token:        [-0.15, -0.20, 0.88, 0.55, -0.20, -0.20, 0.00, 0.05, 0.05, 0.65, 0.20, 0.10],
  tokens:       [-0.15, -0.20, 0.88, 0.55, -0.20, -0.20, 0.00, 0.05, 0.05, 0.65, 0.30, 0.10],
  ization:      [-0.10, -0.20, 0.45, 0.20, -0.15, -0.15, 0.15, 0.00, 0.30, 0.60, 0.00, 0.10],
  embed:        [-0.15, -0.20, 0.85, 0.50, -0.20, -0.20, 0.25, 0.05, -0.10, 0.70, 0.10, 0.00],
  embeddings:   [-0.15, -0.20, 0.90, 0.50, -0.20, -0.20, 0.15, 0.10, -0.10, 0.75, 0.20, 0.00],
  language:     [0.05, 0.35, 0.72, 0.25, -0.10, -0.10, 0.10, 0.20, 0.15, 0.78, 0.00, 0.05],
  computer:     [-0.15, -0.20, 0.94, 0.65, -0.20, -0.20, 0.00, 0.10, -0.15, 0.45, 0.15, 0.00],
  learn:        [0.00, 0.40, 0.68, 0.20, -0.10, 0.00, 0.72, 0.35, -0.10, 0.55, 0.00, -0.10],
  analyze:      [-0.05, 0.20, 0.75, 0.35, -0.15, -0.10, 0.70, 0.15, -0.10, 0.60, 0.10, -0.05],
  analyzed:     [-0.05, 0.20, 0.75, 0.35, -0.15, -0.10, 0.72, 0.15, -0.10, 0.58, 0.10, -0.05],

  // Code & Syntax
  code:         [-0.15, -0.20, 0.78, 0.92, -0.20, -0.20, 0.10, 0.10, -0.05, 0.45, 0.10, 0.20],
  python:       [-0.15, -0.15, 0.76, 0.94, -0.20, 0.05, 0.05, 0.15, -0.10, 0.35, 0.05, 0.15],
  def:          [-0.20, -0.25, 0.55, 0.96, -0.20, -0.20, 0.10, 0.00, 0.25, 0.20, 0.00, 0.40],
  return:       [-0.15, -0.20, 0.50, 0.92, -0.20, -0.20, 0.35, 0.00, 0.30, 0.20, 0.00, 0.35],
  hello:        [0.00, 0.65, 0.20, 0.45, 0.05, 0.05, 0.25, 0.55, 0.10, 0.10, 0.00, 0.00],
  world:        [0.10, 0.40, 0.25, 0.40, 0.05, 0.65, 0.05, 0.30, -0.10, 0.45, 0.05, -0.05],

  // Food & Sensory
  apple:        [-0.10, 0.15, 0.10, -0.15, 0.92, 0.45, -0.10, 0.40, -0.25, -0.10, 0.00, -0.20],
  pie:          [-0.05, 0.00, -0.15, -0.20, 0.96, 0.10, -0.10, 0.50, -0.25, -0.15, 0.05, -0.20],
  fresh:        [-0.05, 0.10, -0.10, -0.20, 0.78, 0.62, 0.05, 0.65, -0.15, 0.05, 0.00, -0.15],
  tastes:       [-0.05, 0.25, -0.15, -0.20, 0.90, 0.10, 0.45, 0.45, -0.15, 0.05, 0.00, -0.15],
  delicious:    [0.05, 0.15, -0.15, -0.20, 0.92, 0.10, 0.00, 0.85, -0.20, 0.10, 0.00, -0.15],

  // Nature & Time
  cold:         [-0.05, 0.00, -0.10, -0.15, 0.25, 0.85, -0.10, -0.15, -0.15, 0.10, 0.00, -0.10],
  winter:       [0.00, 0.00, -0.15, -0.20, 0.15, 0.95, -0.10, 0.10, -0.20, 0.15, 0.05, -0.15],
  morning:      [0.00, 0.15, -0.10, -0.20, 0.20, 0.88, 0.10, 0.40, -0.15, 0.15, 0.05, -0.15],

  // Actions
  walked:       [0.05, 0.55, -0.10, -0.15, -0.05, 0.20, 0.92, 0.10, -0.10, 0.00, 0.00, -0.15],
  run:          [0.00, 0.50, 0.05, 0.15, -0.05, 0.20, 0.95, 0.15, -0.10, 0.00, 0.00, -0.15],
  splits:       [-0.10, -0.10, 0.45, 0.35, 0.05, -0.05, 0.82, 0.00, 0.05, 0.25, 0.10, 0.05],

  // Grammar / Function Words
  the:          [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.96, 0.10, 0.00, 0.20],
  and:          [0.00, 0.00, 0.00, 0.05, 0.00, 0.00, 0.00, 0.05, 0.95, 0.10, 0.05, 0.22],
  a:            [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.94, 0.08, 0.10, 0.18],
  in:           [0.00, 0.00, 0.00, 0.05, 0.00, 0.10, 0.05, 0.00, 0.92, 0.12, 0.00, 0.15],
  into:         [0.00, 0.00, 0.00, 0.05, 0.00, 0.08, 0.25, 0.00, 0.90, 0.15, 0.00, 0.15],
  on:           [0.00, 0.00, 0.00, 0.05, 0.00, 0.08, 0.05, 0.00, 0.92, 0.10, 0.00, 0.15],
  from:         [0.00, 0.00, 0.00, 0.10, 0.00, 0.05, 0.15, 0.00, 0.91, 0.15, 0.00, 0.15],
  while:        [0.00, 0.00, 0.05, 0.25, 0.00, 0.15, 0.10, 0.00, 0.88, 0.20, 0.00, 0.20],
  massive:      [0.10, 0.00, 0.15, 0.00, 0.05, 0.15, 0.00, 0.20, -0.10, 0.35, 0.75, -0.10]
};

// Fixed 12x3 projection matrix (mimics PCA / UMAP projection into 3D space)
const PROJECTION_MATRIX = [
  [ 2.6,  2.2, -0.8], // 0: Royalty
  [ 1.8,  1.6,  1.2], // 1: Human
  [-2.7,  1.9, -1.3], // 2: Tech/AI
  [-2.5, -0.9, -2.1], // 3: Code
  [ 1.4, -2.4,  2.2], // 4: Food
  [ 0.9, -2.1, -2.2], // 5: Nature
  [ 0.3,  0.8,  2.7], // 6: Action
  [ 1.1,  0.4,  1.6], // 7: Positive
  [-0.2, -0.3,  0.2], // 8: Grammar (near center)
  [-1.3,  1.8,  0.8], // 9: Abstract
  [-1.1, -1.6,  1.5], // 10: Number
  [-1.6, -2.2, -1.4]  // 11: Punctuation
];

function deterministicNoise(str, dimIndex, model) {
  let h = model === 'llama3' ? 911382323 : model === 'wordpiece' ? 3735928559 : 16777619;
  const seed = `${str}:${dimIndex}`;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
  }
  return ((h >>> 0) % 1000) / 1000 * 2 - 1; // [-1, 1]
}

function normalizeVector(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

export function computeFeatureVector(cleanWord, reason, model = 'cl100k') {
  if (SEMANTIC_LEXICON[cleanWord]) {
    // Add tiny model-specific nuance so switching models subtly shifts positions
    const base = SEMANTIC_LEXICON[cleanWord].map((v, i) => v + deterministicNoise(cleanWord, i, model) * 0.04);
    return normalizeVector(base);
  }

  // Fallback based on token reason + deterministic character signature
  const vec = new Array(12).fill(0);
  if (reason === 'punctuation' || reason === 'whitespace') {
    vec[11] = 0.92;
    vec[8] = 0.45;
  } else if (reason === 'number') {
    vec[10] = 0.95;
    vec[3] = 0.25;
  } else if (reason.startsWith('subword-')) {
    vec[9] = 0.55;
    vec[8] = 0.35;
    vec[2] = 0.30;
  }

  for (let i = 0; i < 12; i++) {
    vec[i] += deterministicNoise(cleanWord || reason, i, model) * 0.42;
  }
  return normalizeVector(vec);
}

export function projectTo3D(vec12, index = 0) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < 12; i++) {
    x += vec12[i] * PROJECTION_MATRIX[i][0];
    y += vec12[i] * PROJECTION_MATRIX[i][1];
    z += vec12[i] * PROJECTION_MATRIX[i][2];
  }
  // Tiny positional offset so identical tokens don't overlap 100% on the exact same pixel
  const jitter = (index % 7 - 3) * 0.08;
  return {
    x: Number((x * 1.45 + jitter).toFixed(3)),
    y: Number((y * 1.45 - jitter * 0.5).toFixed(3)),
    z: Number((z * 1.45 + jitter * 0.7).toFixed(3))
  };
}

export function cosineSimilarity(vecA, vecB) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function generateHighDimPreview(vec12, seedStr) {
  const preview = [];
  for (let i = 0; i < 10; i++) {
    const val = (vec12[i % 12] * 0.45 + deterministicNoise(seedStr, i + 50, 'hd') * 0.12);
    preview.push(Number(val.toFixed(4)));
  }
  return preview;
}

export const REFERENCE_CONCEPTS = [
  'king', 'queen', 'man', 'woman', 'palace',
  'computer', 'artificial', 'intelligence', 'code', 'python',
  'apple', 'delicious', 'winter', 'walked', 'the'
];

export function buildEmbeddingData(tokens, model = 'cl100k') {
  const tokenNodes = tokens.map((tok) => {
    const vec = computeFeatureVector(tok.cleanWord, tok.reason, model);
    const pos = projectTo3D(vec, tok.index);
    const preview = generateHighDimPreview(vec, tok.text);
    return {
      kind: 'token',
      index: tok.index,
      label: tok.text.replace(/^ /, '␣'),
      rawText: tok.text,
      id: tok.id,
      color: tok.color.hex,
      vec,
      pos,
      preview
    };
  });

  const anchorNodes = REFERENCE_CONCEPTS.map((word, idx) => {
    const vec = computeFeatureVector(word, 'whole-word', model);
    const pos = projectTo3D(vec, idx + 100);
    return {
      kind: 'anchor',
      index: -1 - idx,
      label: word,
      rawText: word,
      id: null,
      color: '#94a3b8',
      vec,
      pos,
      preview: generateHighDimPreview(vec, word)
    };
  });

  return { tokenNodes, anchorNodes };
}
