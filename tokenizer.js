// Realistic BPE / WordPiece-style tokenizer with human-friendly live step explanations

const KNOWN_VOCAB = new Map([
  ['the', 279], [' the', 279], ['The', 791], ['and', 290], [' and', 323],
  ['a', 64], [' a', 264], ['an', 276], [' an', 459], ['in', 258], [' in', 304],
  ['into', 1139], [' into', 1139], ['on', 263], [' on', 389], ['of', 315], [' of', 315],
  ['to', 311], [' to', 311], ['for', 369], [' for', 369], ['with', 449], [' with', 449],
  ['from', 505], [' from', 505], ['while', 1418], [' while', 1418], ['is', 374], [' is', 374],
  ['are', 527], [' are', 527], ['was', 574], [' was', 574],
  ['king', 10796], [' king', 10796], ['queen', 21671], [' queen', 21671],
  ['royal', 16483], [' royal', 16483], ['palace', 24011], [' palace', 24011],
  ['prince', 19402], [' prince', 19402], ['walked', 11859], [' walked', 11859],
  ['artificial', 16895], [' artificial', 21075], ['Artificial', 9470],
  ['intelligence', 11478], [' intelligence', 11478],
  ['models', 4211], [' models', 4211], ['model', 1646], [' model', 1646],
  ['learn', 4048], [' learn', 4048], ['language', 4221], [' language', 4221],
  ['massive', 11184], [' massive', 11184], ['code', 2080], [' code', 2080],
  ['apple', 19196], [' apple', 19196], ['Apple', 16779], ['Fresh', 23892],
  ['pie', 4913], [' pie', 4913], ['tastes', 29811], [' tastes', 29811],
  ['delicious', 18405], [' delicious', 18405], ['cold', 4660], [' cold', 4660],
  ['winter', 12770], [' winter', 12770], ['morning', 6693], [' morning', 6693],
  ['token', 4037], [' token', 4037], ['tokens', 11460], [' tokens', 11460],
  ['embed', 8620], [' embed', 8620], ['embeddings', 39723], [' embeddings', 39723],
  ['words', 4339], [' words', 4339], ['word', 2299], [' word', 2299],
  ['def', 755], ['return', 471], [' return', 471], ['hello', 15339], ['Hello', 9906],
  ['world', 1917], [' world', 1917], ['python', 13630], ['Python', 31380],
  ['.', 13], [',', 11], ['!', 0], ['?', 30], [':', 25], ['(', 7], [')', 8],
  ['=', 28], ["'", 6], ['"', 1], ['-', 12], ['_', 62]
]);

const COMMON_PREFIXES = ['un', 're', 'pre', 'dis', 'mis', 'over', 'sub', 'super', 'inter', 'anti', 'auto'];
const COMMON_SUFFIXES = ['ization', 'isation', 'ing', 'ed', 'tion', 'sion', 'able', 'ible', 'ment', 'ness', 'ity', 'ly', 'er', 'est', 's', 'es'];

const TOKEN_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.22)', border: 'rgba(59, 130, 246, 0.55)', hex: '#3b82f6' },
  { bg: 'rgba(168, 85, 247, 0.22)', border: 'rgba(168, 85, 247, 0.55)', hex: '#a855f7' },
  { bg: 'rgba(16, 185, 129, 0.22)', border: 'rgba(16, 185, 129, 0.55)', hex: '#10b981' },
  { bg: 'rgba(245, 158, 11, 0.22)', border: 'rgba(245, 158, 11, 0.55)', hex: '#f59e0b' },
  { bg: 'rgba(34, 211, 238, 0.22)', border: 'rgba(34, 211, 238, 0.55)', hex: '#22d3ee' },
  { bg: 'rgba(244, 63, 94, 0.22)', border: 'rgba(244, 63, 94, 0.55)', hex: '#f43f5e' }
];

function hashTokenId(str, model) {
  let h = model === 'llama3' ? 2166136261 : model === 'wordpiece' ? 1315423911 : 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  const base = Math.abs(h) % 92000;
  return base + 1200;
}

function getTokenId(text, model) {
  if (KNOWN_VOCAB.has(text)) {
    const offset = model === 'llama3' ? 17 : model === 'wordpiece' ? 2000 : 0;
    return KNOWN_VOCAB.get(text) + offset;
  }
  return hashTokenId(text, model);
}

function toUtf8Bytes(str) {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(str)).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0'));
}

function splitSubwords(word, leadingSpace, model) {
  const fullWithSpace = (leadingSpace ? ' ' : '') + word;
  // Check if whole word is in known vocab
  if (KNOWN_VOCAB.has(fullWithSpace) || KNOWN_VOCAB.has(word)) {
    if (model === 'wordpiece' && leadingSpace) {
      return [{ text: word, isContinuation: false, reason: 'whole-word' }];
    }
    return [{ text: fullWithSpace, isContinuation: false, reason: 'whole-word' }];
  }

  // Short words (<= 4 chars) usually stay whole in BPE
  if (word.length <= 4) {
    const text = model === 'wordpiece' ? word : fullWithSpace;
    return [{ text, isContinuation: false, reason: 'short-whole' }];
  }

  // Try realistic prefix + root + suffix splitting
  const lower = word.toLowerCase();
  const pieces = [];
  let remaining = word;
  let foundPrefix = null;
  let foundSuffix = null;

  for (const pre of COMMON_PREFIXES) {
    if (lower.startsWith(pre) && remaining.length - pre.length >= 3) {
      foundPrefix = remaining.slice(0, pre.length);
      remaining = remaining.slice(pre.length);
      break;
    }
  }

  for (const suf of COMMON_SUFFIXES) {
    if (remaining.toLowerCase().endsWith(suf) && remaining.length - suf.length >= 3) {
      foundSuffix = remaining.slice(remaining.length - suf.length);
      remaining = remaining.slice(0, remaining.length - suf.length);
      break;
    }
  }

  if (foundPrefix) {
    pieces.push({ part: foundPrefix, role: 'prefix' });
  }

  // If remaining root is still very long (> 6 chars), split into 3-4 char BPE chunks
  if (remaining.length > 6) {
    for (let i = 0; i < remaining.length; i += 4) {
      pieces.push({ part: remaining.slice(i, i + 4), role: i === 0 && !foundPrefix ? 'root' : 'chunk' });
    }
  } else if (remaining.length > 0) {
    pieces.push({ part: remaining, role: 'root' });
  }

  if (foundSuffix) {
    pieces.push({ part: foundSuffix, role: 'suffix' });
  }

  return pieces.map((p, idx) => {
    const isFirst = idx === 0;
    let text = p.part;
    if (isFirst && leadingSpace && model !== 'wordpiece') {
      text = ' ' + p.part;
    } else if (!isFirst && model === 'wordpiece') {
      text = '##' + p.part;
    }
    return {
      text,
      isContinuation: !isFirst,
      reason: pieces.length > 1 ? `subword-${p.role}` : 'whole-word'
    };
  });
}

function buildHumanExplanation(tokenText, reason, originalChunk, model) {
  const cleanDisplay = tokenText.replace(/^ /, '␣');
  if (reason === 'punctuation') {
    return `Punctuation (${cleanDisplay}) gets its own token so the model knows where clauses, quotes, or sentences begin and end.`;
  }
  if (reason === 'number') {
    return `Digits (${cleanDisplay}) are tokenized as compact numeric chunks so the model can process numbers consistently.`;
  }
  if (reason === 'whitespace') {
    return `Extra whitespace/newline (${cleanDisplay}) is preserved as a token so formatting and indentation (especially in code) aren't lost.`;
  }
  if (reason === 'whole-word') {
    const spaceNote = tokenText.startsWith(' ')
      ? `Notice the leading space (␣)? Modern BPE glues the space onto the front of common words to save tokens. `
      : '';
    return `${spaceNote}"${cleanDisplay}" is a very common word in training data, so BPE merged all its letters into a single token!`;
  }
  if (reason === 'short-whole') {
    return `"${cleanDisplay}" is short enough to be stored as one compact chunk in the ${model.toUpperCase()} vocabulary.`;
  }
  if (reason.startsWith('subword-')) {
    const role = reason.replace('subword-', '');
    return `"${originalChunk}" isn't a single memorized word, so the tokenizer splits it into familiar building blocks — this piece is the ${role} ("${cleanDisplay}"), just like how humans recognize prefixes, roots, and endings!`;
  }
  return `Converted "${cleanDisplay}" into a vocabulary chunk.`;
}

export function tokenizeText(input, model = 'cl100k') {
  if (!input || !input.trim()) {
    return { tokens: [], steps: [] };
  }

  // Pre-tokenize into words (with optional single leading space), numbers, punctuation, or extra whitespace
  const rawMatches = input.match(/ ?[A-Za-z]+| ?[0-9]+|\n+|\s+|[^\sA-Za-z0-9]/g) || [];
  const tokens = [];
  const steps = [];

  steps.push({
    phase: 'STEP 1 · PRE-TOKENIZATION',
    visibleCount: 0,
    highlightIndex: -1,
    explanation: `First, the computer scans your ${input.length}-character sentence and groups letters, spaces, numbers, and punctuation into ${rawMatches.length} rough chunks before merging them.`
  });

  let colorCursor = 0;

  for (const chunk of rawMatches) {
    const hasLeadingSpace = chunk.startsWith(' ') && chunk.length > 1;
    const bare = hasLeadingSpace ? chunk.slice(1) : chunk;

    if (/^\s+$/.test(chunk)) {
      const id = getTokenId(chunk, model);
      const tokenObj = createTokenObj(chunk, id, 'whitespace', chunk, colorCursor++, model);
      tokens.push(tokenObj);
      steps.push({
        phase: 'WHITESPACE TOKEN',
        visibleCount: tokens.length,
        highlightIndex: tokens.length - 1,
        explanation: buildHumanExplanation(chunk, 'whitespace', chunk, model)
      });
    } else if (/^[0-9]+$/.test(bare)) {
      // Split long numbers into 1-3 digit chunks like cl100k
      for (let i = 0; i < bare.length; i += 3) {
        const part = (i === 0 && hasLeadingSpace && model !== 'wordpiece' ? ' ' : '') + bare.slice(i, i + 3);
        const id = getTokenId(part, model);
        const tokenObj = createTokenObj(part, id, 'number', bare, colorCursor++, model);
        tokens.push(tokenObj);
        steps.push({
          phase: 'NUMBER CHUNKING',
          visibleCount: tokens.length,
          highlightIndex: tokens.length - 1,
          explanation: buildHumanExplanation(part, 'number', bare, model)
        });
      }
    } else if (/^[A-Za-z]+$/.test(bare)) {
      const subwords = splitSubwords(bare, hasLeadingSpace, model);
      subwords.forEach((sw) => {
        const id = getTokenId(sw.text, model);
        const tokenObj = createTokenObj(sw.text, id, sw.reason, bare, colorCursor++, model);
        tokens.push(tokenObj);
        steps.push({
          phase: subwords.length > 1 ? 'SUBWORD SPLITTING (BPE)' : 'COMMON WORD MERGE',
          visibleCount: tokens.length,
          highlightIndex: tokens.length - 1,
          explanation: buildHumanExplanation(sw.text, sw.reason, bare, model)
        });
      });
    } else {
      const id = getTokenId(chunk, model);
      const tokenObj = createTokenObj(chunk, id, 'punctuation', chunk, colorCursor++, model);
      tokens.push(tokenObj);
      steps.push({
        phase: 'PUNCTUATION / SYMBOL',
        visibleCount: tokens.length,
        highlightIndex: tokens.length - 1,
        explanation: buildHumanExplanation(chunk, 'punctuation', chunk, model)
      });
    }
  }

  steps.push({
    phase: 'COMPLETE · READY FOR EMBEDDINGS',
    visibleCount: tokens.length,
    highlightIndex: -1,
    explanation: `Done! Your text became ${tokens.length} numeric Token IDs. Now the LLM looks up each Token ID in its embedding table to place it in 3D meaning space below.`
  });

  return { tokens, steps };
}

function createTokenObj(text, id, reason, originalWord, index, model) {
  const palette = TOKEN_COLORS[index % TOKEN_COLORS.length];
  return {
    index,
    text,
    cleanWord: text.replace(/^ /, '').replace(/^##/, '').toLowerCase(),
    id,
    reason,
    originalWord,
    bytes: toUtf8Bytes(text),
    color: palette,
    explanation: buildHumanExplanation(text, reason, originalWord, model)
  };
}

export function explainTokenId(idNum, currentTokens = [], model = 'cl100k') {
  const num = Number(idNum);
  if (!Number.isFinite(num) || num < 0) {
    return {
      found: false,
      title: 'Invalid Token ID',
      tier: 'N/A',
      detail: 'Please enter a non-negative integer Token ID (for example, click one of the blue ID numbers above).'
    };
  }

  const matched = currentTokens.find(t => t.id === num);
  const modelName = model === 'llama3' ? 'LLaMA-3' : model === 'wordpiece' ? 'BERT WordPiece' : 'GPT-4 (cl100k_base)';

  let tier = '';
  let tierReason = '';
  if (num < 256) {
    tier = 'Base Byte / Punctuation Tier (ID < 256)';
    tierReason = `IDs under 256 sit at the very top of the ${modelName} dictionary — they represent single raw bytes, ASCII characters, and basic punctuation.`;
  } else if (num < 2500) {
    tier = 'Ultra-Common Chunk Tier (Early BPE Merge)';
    tierReason = `Low IDs like ${num} belong to words or chunks that appeared millions of times in training data. Because BPE merges the most frequent letter pairs first, common tokens earn low row numbers!`;
  } else if (num < 25000) {
    tier = 'Standard Vocabulary Tier';
    tierReason = `Mid-range IDs like ${num} belong to recognizable everyday words. They were merged after the most common glue words, placing them in the middle of the ~100k-row dictionary.`;
  } else {
    tier = 'Rare Word / Subword Merge Tier (Late BPE Merge)';
    tierReason = `Higher IDs like ${num} are assigned later during vocabulary training to less frequent words or specific subword endings/chunks.`;
  }

  if (matched) {
    const display = matched.text.replace(/^ /, '␣');
    const spaceHint = matched.text.startsWith(' ')
      ? `Notice the leading space (␣): "${display}" has a different ID than "${matched.text.trim()}" because the dictionary stores exact character sequences.`
      : `Capitalization and exact spelling matter: changing even one letter or adding a space points to a completely different row ID.`;

    return {
      found: true,
      token: matched,
      title: `Token ID ${num} → "${display}"`,
      tier,
      detail: `Think of ${num} as a row number in ${modelName}'s dictionary: vocab[${num}] = "${display}". ${tierReason} ${spaceHint}`
    };
  }

  return {
    found: false,
    title: `Token ID ${num} (not in your current sentence)`,
    tier,
    detail: `In ${modelName}, ${num} is simply a row index in the model's vocabulary table. ${tierReason} Try clicking any ID in the array above to see the exact token chunk it maps to!`
  };
}

export function evaluateTokenizationDoubt(rawInput, currentTokens = [], model = 'cl100k', selectedToken = null) {
  const q = (rawInput || '').trim().toLowerCase();
  if (!q) {
    return {
      verdict: 'info',
      badge: '💡 ENTER A DOUBT OR LOGIC',
      headline: 'Type what you are thinking or ask a "Why?" question',
      explanation: 'For example: "I think every word becomes 1 token" or "Why is there a space in front of king?"'
    };
  }

  const splitExample = currentTokens.find(t => t.reason.startsWith('subword-'));
  const spaceExample = currentTokens.find(t => t.text.startsWith(' ') && t.text.length > 1);
  const punctExample = currentTokens.find(t => t.reason === 'punctuation');
  const modelName = model === 'llama3' ? 'LLaMA-3' : model === 'wordpiece' ? 'BERT WordPiece' : 'GPT-4 (cl100k_base)';

  // 1. Misconception: 1 word = 1 token
  if (/(every|each|one|1)\s*word.*(one|1|single)\s*token|word count.*token count|words?\s*=\s*tokens?/.test(q)) {
    const exampleNote = splitExample
      ? ` Look at your current text: "${splitExample.originalWord}" was split into multiple tokens (including "${splitExample.text.replace(/^ /, '␣')}").`
      : '';
    return {
      verdict: 'wrong',
      badge: '❌ NOT QUITE RIGHT',
      headline: 'Words do NOT always equal 1 token.',
      explanation: `What's wrong: LLMs don't split strictly by words. Common short words become 1 token, while rare/long words split into subwords, and punctuation gets its own token.${exampleNote} Usually 1 token is roughly ¾ of an English word.`
    };
  }

  // 2. Misconception: Token ID encodes meaning / similarity
  if (/(token\s*id|id|number).*(mean|meaning|semantic|similar|close|related)/.test(q) || /(similar|related)\s*words?.*(close|similar|near)\s*id/.test(q)) {
    return {
      verdict: 'wrong',
      badge: '❌ COMMON MISCONCEPTION',
      headline: 'Token IDs do NOT represent meaning!',
      explanation: `What's wrong: A Token ID is just an arbitrary row number in the dictionary based on how often that chunk appeared in training data. Two words with totally opposite meanings can have adjacent IDs (e.g. 500 and 501). Actual meaning is only added in Section 2 (3D Embeddings)!`
    };
  }

  // 3. Misconception: Bigger/higher ID = longer word or bigger value
  if (/(bigger|higher|larger|smaller|lower)\s*(token\s*)?id.*(longer|shorter|bigger|more|length|size)/.test(q) || /(length|longer).*higher\s*id/.test(q)) {
    return {
      verdict: 'wrong',
      badge: '❌ NOT QUITE RIGHT',
      headline: 'Higher Token IDs do NOT mean longer words.',
      explanation: `What's wrong: Token IDs are ordered by training frequency (how early BPE merged them), NOT word length. A common 12-letter word can have a low ID, while a rare 3-letter chunk or typo can have a very high ID.`
    };
  }

  // 4. Space handling logic
  if (/space|whitespace|␣|leading/.test(q)) {
    const thinksIgnored = /(ignor|remov|delet|drop|strip|separate)/.test(q);
    if (thinksIgnored && model !== 'wordpiece') {
      return {
        verdict: 'wrong',
        badge: '❌ WRONG FOR BPE MODELS',
        headline: `${modelName} does NOT delete spaces — it glues them onto words!`,
        explanation: `What's wrong: In ${modelName}, a single space before a word is attached to the front of that token (shown as ␣).${spaceExample ? ` For example, "${spaceExample.text.replace(/^ /, '␣')}" (ID ${spaceExample.id}) includes the leading space.` : ''} This saves tokens so spaces don't waste extra slots.`
      };
    }
    if (model === 'wordpiece') {
      return {
        verdict: 'correct',
        badge: '✅ CORRECT FOR WORDPIECE',
        headline: 'BERT WordPiece splits on spaces and drops them.',
        explanation: `Unlike GPT-4/LLaMA-3, WordPiece removes spaces between words and marks continuation pieces with "##" instead.`
      };
    }
    return {
      verdict: 'correct',
      badge: '✅ GOOD OBSERVATION',
      headline: 'Leading spaces are glued onto tokens (␣) to save space.',
      explanation: `In ${modelName}, "king" at the start of a sentence and " king" after a space are two different tokens. Attaching the space to the word avoids needing a separate token for every single space.`
    };
  }

  // 5. Case sensitivity / same word same ID
  if (/capital|uppercase|lowercase|case|same id/.test(q)) {
    const thinksSame = /(same|doesn'?t matter|ignore case|identical)/.test(q);
    if (thinksSame) {
      return {
        verdict: 'wrong',
        badge: '❌ NOT QUITE RIGHT',
        headline: 'Capitalization changes the Token ID!',
        explanation: `What's wrong: Most modern tokenizers (like ${modelName}) are case-sensitive. "The" and "the" are stored at completely different dictionary rows so the model can tell proper nouns and sentence starts apart.`
      };
    }
    return {
      verdict: 'correct',
      badge: '✅ CORRECT LOGIC',
      headline: 'Yes — exact casing and spacing change the Token ID.',
      explanation: `Because BPE matches exact UTF-8 byte sequences, "The", "the", and " the" each have their own separate Token ID.`
    };
  }

  // 6. Subword splitting / BPE logic (correct understanding)
  if (/subword|split|bpe|merge|prefix|suffix|rare|uncommon|chunk/.test(q)) {
    const exampleNote = splitExample
      ? ` You can see this live in your text: "${splitExample.originalWord}" split into "${splitExample.text.replace(/^ /, '␣')}" (ID ${splitExample.id}).`
      : '';
    return {
      verdict: 'correct',
      badge: '✅ YOUR LOGIC IS CORRECT',
      headline: 'Yes! Rare or long words are broken into familiar subword pieces.',
      explanation: `During training, BPE repeatedly merges the most frequent character pairs. Common words become 1 whole token, while less common words fall back to known prefixes, roots, and endings.${exampleNote}`
    };
  }

  // 7. Punctuation / numbers
  if (/punct|dot|comma|period|symbol|number|digit/.test(q)) {
    return {
      verdict: 'info',
      badge: '💡 HOW PUNCTUATION & NUMBERS WORK',
      headline: 'Punctuation and digits are separated so words stay reusable.',
      explanation: `If "palace." were one token, the model would need separate tokens for "palace!", "palace?", and "palace,". Keeping punctuation separate${punctExample ? ` (like "${punctExample.text}" → ID ${punctExample.id})` : ''} keeps the vocabulary compact.`
    };
  }

  // 8. Model differences
  if (/model|gpt|llama|bert|wordpiece|cl100k|different/.test(q)) {
    return {
      verdict: 'info',
      badge: '💡 WHY MODELS DIFFER',
      headline: `Each model family trains its own vocabulary dictionary.`,
      explanation: `You currently have ${modelName} selected. Different models use different training corpora and merge rules (e.g., BPE with leading spaces vs. WordPiece with ##), so the exact same text produces different Token IDs.`
    };
  }

  // Fallback for general custom doubts
  const selNote = selectedToken
    ? ` For your currently selected token "${selectedToken.text.replace(/^ /, '␣')}" (ID ${selectedToken.id}): ${selectedToken.explanation}`
    : '';
  return {
    verdict: 'partial',
    badge: '🤔 LET’S CHECK THIS',
    headline: 'Here is how tokenization handles that:',
    explanation: `In ${modelName}, text is first split into rough chunks (spaces+words, numbers, punctuation), then matched against the trained subword dictionary to produce numeric row IDs.${selNote} Try asking about "every word is 1 token", "token ID means meaning", "spaces", or "subword splitting" to test specific logic!`
  };
}
