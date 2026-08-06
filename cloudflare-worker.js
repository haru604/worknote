const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
    if (!env.GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY が設定されていません" }, 500, cors);

    try {
      const body = await request.json();
      const action = body?.action;
      const payload = redactSensitive(body?.payload ?? {});
      const model = env.GEMINI_MODEL || DEFAULT_MODEL;

      if (action === "test") {
        const result = await callGemini(env.GEMINI_API_KEY, model, {
          systemInstruction: "WORKNOTEの接続確認です。指定されたJSONだけを返してください。",
          input: "接続確認として status に ok、message に 接続できました を入れてください。",
          schema: testSchema,
        });
        return json({ ...result, model }, 200, cors);
      }

      if (action !== "analyze" && action !== "chat") {
        return json({ error: "Unknown action" }, 400, cors);
      }

      const isChat = action === "chat";
      const result = await callGemini(env.GEMINI_API_KEY, model, {
        systemInstruction: systemInstruction(isChat),
        input: isChat ? buildChatPrompt(payload) : buildAnalysisPrompt(payload),
        schema: isChat ? chatSchema : analysisSchema,
      });

      return json({ ...result, model }, 200, cors);
    } catch (error) {
      return json({ error: error?.message || "予期しないエラーが発生しました" }, 500, cors);
    }
  },
};

async function callGemini(apiKey, model, { systemInstruction, input, schema }) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      system_instruction: systemInstruction,
      input,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema,
      },
      store: false,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || `Gemini API error (${response.status})`;
    throw new Error(message);
  }

  const outputText = extractOutputText(data);
  try {
    return JSON.parse(outputText);
  } catch {
    throw new Error("GeminiのJSON応答を解析できませんでした");
  }
}

function systemInstruction(isChat) {
  return [
    "あなたはWORKNOTE専用のAI副店長補佐です。回答は日本語で簡潔かつ具体的にしてください。",
    "確認できない事実を作らず、記録にない人物・数字・期限を断定しないでください。",
    "顧客の個人情報は出力しないでください。スタッフへの人格評価ではなく、記録された行動と傾向だけを扱ってください。",
    "他スタッフへの指示、店長報告、削除や予定変更は確定せず、必ず候補として提示してください。",
    isChat ? "ユーザーの修正意図を確認し、何を変更したかを短く返してください。" : "優先順位、期限超過、日報改善、MTGの抜け、スタッフ育成、店長報告、週報のうち必要なものだけを返してください。",
  ].join("\n");
}

function buildAnalysisPrompt(payload) {
  return `以下はWORKNOTEのデータです。保存済みルールを最優先し、今日の行動につながる提案を最大8件返してください。重複提案は避けてください。\n${JSON.stringify(payload)}`;
}

function buildChatPrompt(payload) {
  return `ユーザーがAIの認識や提案を修正しています。反映範囲（今回だけ・テーマ・全体）を踏まえ、修正後の認識を短く確認してください。操作は勝手に実行しないでください。\n${JSON.stringify(payload)}`;
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text) return data.output_text;
  for (const output of data?.outputs || []) {
    if (typeof output?.text === "string" && output.text) return output.text;
    for (const part of output?.content || output?.parts || []) {
      if (typeof part?.text === "string" && part.text) return part.text;
    }
  }
  for (const step of data?.steps || []) {
    if (typeof step?.output_text === "string" && step.output_text) return step.output_text;
    for (const output of step?.outputs || []) {
      if (typeof output?.text === "string" && output.text) return output.text;
    }
  }
  throw new Error("Geminiから出力テキストが返りませんでした");
}

function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactSensitive(v)]));
  }
  if (typeof value !== "string") return value;
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[メールアドレス削除]")
    .replace(/(?:\+81[- ]?|0)\d{1,4}[- ]?\d{1,4}[- ]?\d{3,4}/g, "[電話番号削除]")
    .replace(/\b\d{11,16}\b/g, "[識別番号削除]");
}

function corsHeaders(origin, allowedOrigin) {
  const allowed = !allowedOrigin || allowedOrigin === "*" || origin === allowedOrigin;
  return {
    "Access-Control-Allow-Origin": allowed ? (allowedOrigin && allowedOrigin !== "*" ? allowedOrigin : "*") : "null",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin",
  };
}

function json(value, status, cors) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

const actionSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["createTask", "acceptFocus", "viewTasks", "editMeeting", "copy"] },
    title: { type: "string" },
    date: { type: "string" },
    value: { type: "string" },
    id: { type: "string" },
  },
  required: ["type", "title", "date", "value", "id"],
};

const analysisSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["priority", "warning", "draft", "staff", "report", "weekly"] },
          title: { type: "string" },
          body: { type: "string" },
          actions: { type: "array", maxItems: 3, items: actionSchema },
        },
        required: ["kind", "title", "body", "actions"],
      },
    },
  },
  required: ["items"],
};

const chatSchema = {
  type: "object",
  properties: { reply: { type: "string" } },
  required: ["reply"],
};

const testSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["ok"] },
    message: { type: "string" },
  },
  required: ["status", "message"],
};
