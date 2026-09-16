exports.config = { timeout: 26 };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,x-api-key,anthropic-version,anthropic-beta,x-goog-api-key',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

const TEXT_MODEL = 'gemini-2.5-flash-lite';
const VISION_MODEL = 'gemini-2.5-flash';
const IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-2.0-flash-preview-image-generation'];

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify(body),
  };
}

function geminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
}

function hasImageParts(messages) {
  return (messages || []).some((m) => {
    if (!Array.isArray(m && m.content)) return false;
    return m.content.some((p) => p && (p.type === 'image' || p.source || p.inlineData));
  });
}

function toGeminiParts(content) {
  if (typeof content === 'string') return content ? [{ text: content }] : [];
  if (!Array.isArray(content)) return [{ text: String(content || '') }];
  const parts = [];
  content.forEach((p) => {
    if (!p) return;
    if (typeof p === 'string') {
      if (p) parts.push({ text: p });
      return;
    }
    if (p.type === 'text' && p.text) parts.push({ text: p.text });
    else if (p.type === 'image' && p.source && p.source.data) {
      parts.push({
        inlineData: {
          mimeType: p.source.media_type || p.source.mime_type || 'image/jpeg',
          data: p.source.data,
        },
      });
    } else if (p.inlineData && p.inlineData.data) {
      parts.push({ inlineData: p.inlineData });
    } else if (p.text) parts.push({ text: p.text });
  });
  return parts.length ? parts : [{ text: '' }];
}

function toGeminiContents(messages) {
  const contents = [];
  (messages || []).forEach((m) => {
    const role = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
    const parts = toGeminiParts(m.content);
    if (!parts.length) return;
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts = last.parts.concat(parts);
    else contents.push({ role, parts });
  });
  if (contents.length && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: '開始' }] });
  }
  return contents;
}

function usageFromGemini(data) {
  const u = (data && data.usageMetadata) || {};
  return {
    input_tokens: u.promptTokenCount || 0,
    output_tokens: u.candidatesTokenCount || 0,
  };
}

function geminiError(data, status) {
  const msg = (data && data.error && (data.error.message || data.error.status)) || '';
  return json(status || 500, {
    error: { message: msg || 'Gemini 連線失敗', type: (data && data.error && data.error.status) || 'api_error' },
  });
}

async function generateContent(model, payload, key) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  return { resp, data };
}

async function generateImage(prompt, aspectRatio, key) {
  const payloads = [
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio: aspectRatio || '1:1' },
      },
    },
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    },
  ];
  let last = { resp: { status: 500 }, data: { error: { message: '生圖失敗' } } };
  for (const model of IMAGE_MODELS) {
    for (const payload of payloads) {
      last = await generateContent(model, payload, key);
      if (last.resp.ok && extractImage(last.data)) return last;
    }
  }
  return last;
}

function extractImage(data) {
  const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  const img = parts.find((p) => p && p.inlineData && p.inlineData.data);
  if (!img) return null;
  return {
    mime: img.inlineData.mimeType || 'image/png',
    data: img.inlineData.data,
  };
}

function extractText(data) {
  const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  return parts.map((p) => p.text || '').join('').trim();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }
  const key = geminiKey();
  if (!key) {
    return json(500, { error: { message: '尚未設定 GEMINI_API_KEY，請到 Netlify 環境變數貼上 Google AI Studio 的金鑰' } });
  }
  try {
    const body = JSON.parse(event.body || '{}');

    if (body.task === 'image') {
      const prompt = (body.prompt || '').trim();
      if (!prompt) return json(400, { error: { message: '缺少生圖描述' } });
      const { resp, data } = await generateImage(prompt, body.aspectRatio, key);
      if (!resp.ok) return geminiError(data, resp.status);
      const image = extractImage(data);
      if (!image) {
        return json(502, { error: { message: extractText(data) || '這次沒有產出圖片，請再試一次' } });
      }
      return json(200, {
        content: [{ type: 'image', mime: image.mime, data: image.data }],
        image,
        usage: usageFromGemini(data),
      });
    }

    const messages = body.messages || [];
    const contents = toGeminiContents(messages);
    if (!contents.length) return json(400, { error: { message: '沒有訊息內容' } });
    const payload = {
      contents,
      generationConfig: { maxOutputTokens: body.max_tokens || 2048 },
    };
    if (body.system) payload.systemInstruction = { parts: [{ text: body.system }] };
    const model = body.model && String(body.model).startsWith('gemini-')
      ? body.model
      : (hasImageParts(messages) ? VISION_MODEL : TEXT_MODEL);
    const { resp, data } = await generateContent(model, payload, key);
    if (!resp.ok) return geminiError(data, resp.status);
    const text = extractText(data);
    return json(200, {
      content: [{ type: 'text', text }],
      usage: usageFromGemini(data),
    });
  } catch (e) {
    return json(500, { error: { message: e.message || 'proxy error' } });
  }
};
