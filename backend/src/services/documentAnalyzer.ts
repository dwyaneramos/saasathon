import { getDb } from "../db/index.js";
import { HttpError } from "../utils/httpError.js";

const MIN_CONFIDENCE = 0.28;
const TEXT_PREVIEW_LIMIT = 4000;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5";

type CategoryRow = {
  id: number;
  name: string;
  description: string | null;
  keywords: string[];
  created_at: Date;
};

export type CategoryInput = {
  name: string;
  description?: string;
  keywords?: string[];
};

export type CategoryMatch = {
  category: CategoryRow | null;
  confidence: number;
  matchedKeywords: string[];
  needsNewCategory: boolean;
  suggestedCategoryName: string;
  suggestedCategoryDescription: string;
  prompt: string | null;
};

export type DocumentAnalysis = {
  documentId: number;
  fileName: string;
  pageCount: number;
  summary: string;
  textPreview: string;
  match: CategoryMatch;
  sourceType: "pdf" | "image";
  model: string;
};

const DEFAULT_CATEGORIES: CategoryInput[] = [
  {
    name: "Invoices",
    description: "Bills, receipts, and payment requests.",
    keywords: ["invoice", "receipt", "amount due", "subtotal", "tax", "payment"],
  },
  {
    name: "Contracts",
    description: "Agreements, terms, signatures, and legal clauses.",
    keywords: ["agreement", "contract", "party", "terms", "signature", "clause"],
  },
  {
    name: "Bank Statements",
    description: "Banking activity, balances, deposits, and withdrawals.",
    keywords: ["statement", "balance", "deposit", "withdrawal", "transaction", "account"],
  },
  {
    name: "Tax Documents",
    description: "Tax filings, forms, and deductions.",
    keywords: ["tax", "ird", "income", "deduction", "gst", "return"],
  },
  {
    name: "Reports",
    description: "Narrative or analytical reports.",
    keywords: ["report", "summary", "analysis", "findings", "recommendation", "overview"],
  },
];

export async function ensureDocumentSchema() {
  await getDb().query(`
		CREATE TABLE IF NOT EXISTS document_categories (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			description TEXT,
			keywords TEXT[] NOT NULL DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS documents (
			id SERIAL PRIMARY KEY,
			file_name TEXT NOT NULL,
			mime_type TEXT NOT NULL,
			page_count INTEGER NOT NULL DEFAULT 0,
			extracted_text TEXT NOT NULL,
			summary TEXT NOT NULL,
			category_id INTEGER REFERENCES document_categories(id) ON DELETE SET NULL,
			confidence NUMERIC(5, 4) NOT NULL DEFAULT 0,
			needs_new_category BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS spaces (
			id SERIAL PRIMARY KEY,
			created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
			name TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		ALTER TABLE document_categories
			ADD COLUMN IF NOT EXISTS description TEXT,
			ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}',
			ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

		ALTER TABLE documents
			ADD COLUMN IF NOT EXISTS space_id INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
			ADD COLUMN IF NOT EXISTS file_name TEXT NOT NULL DEFAULT 'unknown',
			ADD COLUMN IF NOT EXISTS original_file_name TEXT,
			ADD COLUMN IF NOT EXISTS stored_file_name TEXT,
			ADD COLUMN IF NOT EXISTS storage_path TEXT,
			ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0,
			ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
			ADD COLUMN IF NOT EXISTS page_count INTEGER NOT NULL DEFAULT 0,
			ADD COLUMN IF NOT EXISTS extracted_text TEXT NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES document_categories(id) ON DELETE SET NULL,
			ADD COLUMN IF NOT EXISTS confidence NUMERIC(5, 4) NOT NULL DEFAULT 0,
			ADD COLUMN IF NOT EXISTS needs_new_category BOOLEAN NOT NULL DEFAULT FALSE,
			ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
	`);

  for (const category of DEFAULT_CATEGORIES) {
    await getDb().query(
      `INSERT INTO document_categories (name, description, keywords)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (name) DO NOTHING`,
      [category.name, category.description ?? null, category.keywords ?? []],
    );
  }
}

export async function listCategories() {
  await ensureDocumentSchema();
  const { rows } = await getDb().query<CategoryRow>(
    `SELECT id, name, description, keywords, created_at
		 FROM document_categories
		 ORDER BY name ASC`,
  );
  return rows;
}

export async function createCategory(input: CategoryInput) {
  await ensureDocumentSchema();
  const keywords = normalizeKeywords(input.keywords?.length ? input.keywords : [input.name]);
  const { rows } = await getDb().query<CategoryRow>(
    `INSERT INTO document_categories (name, description, keywords)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (name)
		 DO UPDATE SET
			description = COALESCE(EXCLUDED.description, document_categories.description),
			keywords = EXCLUDED.keywords
		 RETURNING id, name, description, keywords, created_at`,
    [input.name.trim(), input.description?.trim() || null, keywords],
  );
  return rows[0];
}

export async function assignDocumentCategory(
  documentId: number,
  categoryId: number,
) {
  await ensureDocumentSchema();
  const { rows } = await getDb().query(
    `UPDATE documents
		 SET category_id = $1, needs_new_category = FALSE, confidence = 1
		 WHERE id = $2
		 RETURNING id`,
    [categoryId, documentId],
  );
  return rows.length > 0;
}

export async function analyzePdf(
  file: Express.Multer.File,
  minConfidence = MIN_CONFIDENCE,
  documentId?: number,
): Promise<DocumentAnalysis> {
  await ensureDocumentSchema();
  const categories = await listCategories();
  const modelAnalysis = await analyzeWithClaude({
    file,
    sourceType: "pdf",
    categories,
    minConfidence,
  });

  return saveAnalysis(file, "pdf", modelAnalysis, documentId);
}

export async function analyzeImage(
  file: Express.Multer.File,
  minConfidence = MIN_CONFIDENCE,
  documentId?: number,
): Promise<DocumentAnalysis> {
  await ensureDocumentSchema();
  const categories = await listCategories();
  const modelAnalysis = await analyzeWithClaude({
    file,
    sourceType: "image",
    categories,
    minConfidence,
  });

  return saveAnalysis(file, "image", modelAnalysis, documentId);
}

async function saveAnalysis(
  file: Express.Multer.File,
  sourceType: "pdf" | "image",
  modelAnalysis: ClaudeAnalysis,
  documentId?: number,
) {
  const match = toCategoryMatch(modelAnalysis);
  const extractedText = normalizeWhitespace(modelAnalysis.extractedText);

  if (documentId) {
    const { rows } = await getDb().query<{ id: number }>(
      `UPDATE documents
       SET
        file_name = COALESCE(NULLIF(file_name, ''), $2),
        original_file_name = COALESCE(original_file_name, $2),
        mime_type = $3,
        page_count = $4,
        extracted_text = $5,
        summary = $6,
        category_id = $7,
        confidence = $8,
        needs_new_category = $9
       WHERE id = $1
       RETURNING id`,
      [
        documentId,
        file.originalname,
        file.mimetype,
        sourceType === "pdf" ? modelAnalysis.pageCount ?? 0 : 0,
        extractedText,
        modelAnalysis.summary,
        match.category?.id ?? null,
        match.confidence,
        match.needsNewCategory,
      ],
    );

    if (rows[0]) {
      return buildDocumentAnalysis(
        rows[0].id,
        file,
        sourceType,
        modelAnalysis,
        extractedText,
        match,
      );
    }
  }

  const { rows } = await getDb().query<{ id: number }>(
	    `INSERT INTO documents (
				file_name,
				mime_type,
				file_size,
				page_count,
				extracted_text,
				summary,
				category_id,
				confidence,
				needs_new_category
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id`,
    [
      file.originalname,
      file.mimetype,
      file.size,
      sourceType === "pdf" ? modelAnalysis.pageCount ?? 0 : 0,
      extractedText,
      modelAnalysis.summary,
      match.category?.id ?? null,
      match.confidence,
      match.needsNewCategory,
    ],
  );

  return buildDocumentAnalysis(
    rows[0].id,
    file,
    sourceType,
    modelAnalysis,
    extractedText,
    match,
  );
}

function buildDocumentAnalysis(
  documentId: number,
  file: Express.Multer.File,
  sourceType: "pdf" | "image",
  modelAnalysis: ClaudeAnalysis,
  extractedText: string,
  match: CategoryMatch,
) {
  return {
    documentId,
    fileName: file.originalname,
    pageCount: sourceType === "pdf" ? modelAnalysis.pageCount ?? 0 : 0,
    summary: modelAnalysis.summary,
    textPreview: extractedText.slice(0, TEXT_PREVIEW_LIMIT),
    match,
    sourceType,
    model: modelAnalysis.model,
  };
}

type ClaudeAnalysis = {
  model: string;
  extractedText: string;
  pageCount?: number;
  summary: string;
  category: CategoryRow | null;
  confidence: number;
  matchedKeywords: string[];
  needsNewCategory: boolean;
  suggestedCategoryName: string;
  suggestedCategoryDescription: string;
  prompt: string | null;
};

async function analyzeWithClaude({
  file,
  sourceType,
  categories,
  minConfidence,
}: {
  file: Express.Multer.File;
  sourceType: "pdf" | "image";
  categories: CategoryRow[];
  minConfidence: number;
}): Promise<ClaudeAnalysis> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, "OPENROUTER_API_KEY is required");
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  const content =
    sourceType === "pdf"
      ? buildPdfContent(file, categories, minConfidence)
      : buildImageContent(file, categories, minConfidence);

  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You parse uploaded business documents and return only valid JSON. Never wrap JSON in markdown.",
      },
      {
        role: "user",
        content,
      },
    ],
    plugins: sourceType === "pdf" ? buildPdfPlugins() : undefined,
    temperature: 0,
    max_tokens: 1200,
  };

  const { payload } = await sendOpenRouterRequest(body, apiKey);

  const rawContent = payload?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new HttpError(502, "OpenRouter returned an empty response");
  }

  const parsed = parseJsonObject(rawContent);
  const category = findCategory(categories, parsed.categoryId, parsed.categoryName);
  const confidence = clampConfidence(parsed.confidence);
  const needsNewCategory = !category || confidence < minConfidence;
  const suggestedCategoryName =
    cleanString(parsed.suggestedCategoryName) ||
    cleanString(parsed.categoryName) ||
    "Uncategorized Document";
  const suggestedCategoryDescription =
    cleanString(parsed.suggestedCategoryDescription) ||
    `Documents related to ${suggestedCategoryName.toLowerCase()}.`;

  return {
    model: payload?.model || model,
    extractedText: cleanString(parsed.extractedText) || cleanString(parsed.description),
    pageCount: toPositiveInteger(parsed.pageCount),
    summary: cleanString(parsed.summary) || "No summary returned.",
    category: needsNewCategory ? null : category,
    confidence,
    matchedKeywords: toStringArray(parsed.matchedKeywords),
    needsNewCategory,
    suggestedCategoryName,
    suggestedCategoryDescription,
    prompt: needsNewCategory
      ? cleanString(parsed.prompt) ||
      `No existing category matched this ${sourceType} confidently. Create a new category such as "${suggestedCategoryName}" and assign this document to it.`
      : null,
  };
}

type OpenRouterResponse = {
  model?: string;
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: string;
  };
};

async function sendOpenRouterRequest(
  body: Record<string, unknown>,
  apiKey: string,
) {
  const first = await postOpenRouter(body, apiKey);
  if (
    first.response.ok ||
    !body.plugins ||
    !first.payload?.error?.message?.toLowerCase().includes("parse")
  ) {
    assertOpenRouterOk(first.response, first.payload);
    return first;
  }

  const fallbackBody = { ...body };
  delete fallbackBody.plugins;
  const fallback = await postOpenRouter(fallbackBody, apiKey);
  assertOpenRouterOk(fallback.response, fallback.payload);
  return fallback;
}

async function postOpenRouter(body: Record<string, unknown>, apiKey: string) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME || "Kibi",
    },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  return {
    response,
    payload: parseOpenRouterPayload(responseText),
  };
}

function assertOpenRouterOk(
  response: Response,
  payload: OpenRouterResponse | null,
) {
  if (response.ok) {
    return;
  }

  const message = payload?.error?.message || "OpenRouter request failed";
  throw new HttpError(response.status >= 500 ? 502 : response.status, message);
}

function parseOpenRouterPayload(responseText: string): OpenRouterResponse | null {
  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as OpenRouterResponse;
  } catch {
    return {
      error: {
        message: responseText.slice(0, 500),
      },
    };
  }
}

function buildPdfPlugins() {
  const engine = process.env.OPENROUTER_PDF_ENGINE?.trim();
  if (!engine) {
    return undefined;
  }

  return [
    {
      id: "file-parser",
      pdf: { engine },
    },
  ];
}

type ModelJson = {
  extractedText?: unknown;
  description?: unknown;
  pageCount?: unknown;
  summary?: unknown;
  categoryId?: unknown;
  categoryName?: unknown;
  confidence?: unknown;
  matchedKeywords?: unknown;
  needsNewCategory?: unknown;
  suggestedCategoryName?: unknown;
  prompt?: unknown;
  suggestedCategoryDescription?: unknown;
};

function buildPdfContent(
  file: Express.Multer.File,
  categories: CategoryRow[],
  minConfidence: number,
) {
  return [
    {
      type: "text",
      text: buildAnalysisPrompt("pdf", categories, minConfidence),
    },
    {
      type: "file",
      file: {
        filename: file.originalname,
        file_data: `data:application/pdf;base64,${file.buffer.toString("base64")}`,
      },
    },
  ];
}

function buildImageContent(
  file: Express.Multer.File,
  categories: CategoryRow[],
  minConfidence: number,
) {
  return [
    {
      type: "text",
      text: buildAnalysisPrompt("image", categories, minConfidence),
    },
    {
      type: "image_url",
      image_url: {
        url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
      },
    },
  ];
}

function buildAnalysisPrompt(
  sourceType: "pdf" | "image",
  categories: CategoryRow[],
  minConfidence: number,
) {
  const categoryList = categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    keywords: category.keywords,
  }));

  return `
Parse this ${sourceType} and categorize it against the existing categories.

Existing categories:
${JSON.stringify(categoryList)}

Minimum confidence for using an existing category: ${minConfidence}.

Return exactly this JSON shape:
{
  "extractedText": "important OCR text or visual/document description",
  "pageCount": 0,
  "summary": "short useful summary",
  "categoryId": 123,
  "categoryName": "Existing category name or null",
  "confidence": 0.0,
  "matchedKeywords": ["keyword"],
  "needsNewCategory": true,
  "suggestedCategoryName": "New category name if needed",
  "suggestedCategoryDescription": "One sentence describing what belongs in this new category",
  "prompt": "A short prompt asking the user to create the category if needed"
}

Rules:
- Use an existing category only when the document clearly fits it.
- If the best category is below the confidence threshold, set categoryId and categoryName to null.
- For images, include visible text from the image when present, then describe the visual evidence.
- For PDFs, extract the main readable content and page count if available.
`;
}

function toCategoryMatch(modelAnalysis: ClaudeAnalysis): CategoryMatch {
  return {
    category: modelAnalysis.category,
    confidence: modelAnalysis.confidence,
    matchedKeywords: modelAnalysis.matchedKeywords,
    needsNewCategory: modelAnalysis.needsNewCategory,
    suggestedCategoryName: modelAnalysis.suggestedCategoryName,
    suggestedCategoryDescription: modelAnalysis.suggestedCategoryDescription,
    prompt: modelAnalysis.prompt,
  };
}

function findCategory(
  categories: CategoryRow[],
  categoryId: unknown,
  categoryName: unknown,
) {
  const id = toPositiveInteger(categoryId);
  if (id) {
    const category = categories.find((candidate) => candidate.id === id);
    if (category) {
      return category;
    }
  }

  const name = cleanString(categoryName).toLowerCase();
  if (!name || name === "null") {
    return null;
  }

  return (
    categories.find((candidate) => candidate.name.toLowerCase() === name) ?? null
  );
}

function parseJsonObject(content: unknown): ModelJson {
  const text = contentToText(content);
  try {
    return JSON.parse(text) as ModelJson;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new HttpError(502, "OpenRouter response was not valid JSON");
    }
    try {
      return JSON.parse(match[0]) as ModelJson;
    } catch {
      throw new HttpError(502, "OpenRouter response was not valid JSON");
    }
  }
}

function contentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "text" in item) {
          return cleanString((item as { text?: unknown }).text);
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (content && typeof content === "object" && "text" in content) {
    return cleanString((content as { text?: unknown }).text);
  }

  return "";
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => cleanString(item))
    .filter(Boolean);
}

function toPositiveInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }
  return parsed;
}

function clampConfidence(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Number(Math.max(0, Math.min(1, parsed)).toFixed(4));
}

function normalizeKeywords(keywords: string[]) {
  return [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}
