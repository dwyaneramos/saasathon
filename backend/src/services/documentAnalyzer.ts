import { getDb } from "../db/index.js";
import { ensureCoreSchema } from "./schemaService.js";
import { HttpError } from "../utils/httpError.js";

const MIN_CONFIDENCE = 0.28;
const TEXT_PREVIEW_LIMIT = 4000;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5";

type CategoryRow = {
  id: number;
  name: string;
  space_id: number | null;
  metadata: CategoryMetadata;
  description: string | null;
  keywords: string[];
  created_at: Date;
};

type CategoryMetadata = {
  description?: string | null;
  keywords?: string[];
  [key: string]: unknown;
};

export type PublicCategory = {
  id: number;
  name: string;
  spaceId: number | null;
  metadata: CategoryMetadata;
  description: string | null;
  keywords: string[];
};

type DocumentRow = {
  id: number;
  space_id: number | null;
  filename: string;
  filepath: string | null;
  file_name: string;
  original_file_name: string | null;
  stored_file_name: string | null;
  mime_type: string;
  file_size: number;
  category_id: number | null;
  summary: string;
  created_at: Date;
};

export type PublicDocument = {
  id: number;
  spaceId: number | null;
  filename: string;
  filepath: string | null;
  fileName: string;
  originalFileName: string | null;
  storedFileName: string | null;
  mimeType: string;
  fileSize: number;
  categoryId: number | null;
  summary: string;
  createdAt: Date;
};

type SearchDocumentRow = {
  id: number;
  filename: string;
  file_name: string;
  original_file_name: string | null;
  mime_type: string;
  summary: string;
  extracted_text: string;
};

export type DocumentSearchResult = {
  id: number;
  filename: string;
  fileName: string;
  originalFileName: string | null;
  mimeType: string;
  snippet: string | null;
};

export type CategoryInput = {
  name: string;
  spaceId?: number | null;
  description?: string;
  keywords?: string[];
  metadata?: CategoryMetadata;
  documentId?: number;
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

const seededDefaultCategorySpaces = new Set<number>();
const defaultCategorySeedPromises = new Map<number, Promise<void>>();

export async function ensureDocumentSchema() {
  await ensureCoreSchema();
}

export async function listCategories(spaceId?: number | null) {
  await ensureDocumentSchema();
  await ensureDefaultCategoriesForSpace(spaceId ?? null);
  const { rows } = await getDb().query<CategoryRow>(
    `SELECT id, name, space_id, metadata, description, keywords, created_at
		 FROM document_categories
		 WHERE space_id = $1
		 ORDER BY name ASC`,
    [spaceId ?? null],
  );
  return rows;
}

export async function listDocuments(spaceId?: number | null) {
  await ensureDocumentSchema();
  const { rows } = await getDb().query<DocumentRow>(
    `SELECT
        id,
        space_id,
        filename,
        filepath,
        file_name,
        original_file_name,
        stored_file_name,
        mime_type,
        file_size,
        category_id,
        summary,
        created_at
     FROM documents
     WHERE $1::integer IS NULL OR space_id = $1
     ORDER BY created_at DESC`,
    [spaceId ?? null],
  );
  return rows;
}

export async function searchDocuments(input: {
  query: string;
  spaceId?: number | null;
  limit?: number;
}) {
  await ensureDocumentSchema();

  const query = input.query.trim();
  if (!query) {
    return [] as DocumentSearchResult[];
  }

  const likeQuery = `%${escapeLikePattern(query)}%`;
  const { rows } = await getDb().query<SearchDocumentRow>(
    `SELECT
        id,
        filename,
        file_name,
        original_file_name,
        mime_type,
        summary,
        extracted_text
     FROM documents
     WHERE ($1::integer IS NULL OR space_id = $1)
       AND (
         COALESCE(original_file_name, file_name, filename) ILIKE $2
         OR summary ILIKE $2
         OR extracted_text ILIKE $2
       )
     ORDER BY created_at DESC
     LIMIT $3`,
    [input.spaceId ?? null, likeQuery, input.limit ?? 20],
  );

  const uniqueResults = new Map<string, DocumentSearchResult>();

  for (const row of rows) {
    const documentKey = String(row.id);

    if (uniqueResults.has(documentKey)) {
      continue;
    }

    uniqueResults.set(documentKey, {
      id: row.id,
      filename: row.filename,
      fileName: row.file_name,
      originalFileName: row.original_file_name,
      mimeType: row.mime_type,
      snippet: buildSearchSnippet(row, query),
    });
  }

  return [...uniqueResults.values()];
}

export async function getDocument(documentId: number) {
  await ensureDocumentSchema();
  const { rows } = await getDb().query<DocumentRow>(
    `SELECT
        id,
        space_id,
        filename,
        filepath,
        file_name,
        original_file_name,
        stored_file_name,
        mime_type,
        file_size,
        category_id,
        summary,
        created_at
     FROM documents
     WHERE id = $1
     LIMIT 1`,
    [documentId],
  );
  return rows[0] ?? null;
}

export async function renameDocument(documentId: number, name: string) {
  await ensureDocumentSchema();
  const trimmedName = name.trim();
  const { rows } = await getDb().query<DocumentRow>(
    `UPDATE documents
     SET
      file_name = $2,
      original_file_name = $2
     WHERE id = $1
     RETURNING
      id,
      space_id,
      filename,
      filepath,
      file_name,
      original_file_name,
      stored_file_name,
      mime_type,
      file_size,
      category_id,
      summary,
      created_at`,
    [documentId, trimmedName],
  );
  return rows[0] ?? null;
}

export async function deleteDocument(documentId: number) {
  await ensureDocumentSchema();
  const { rows } = await getDb().query<DocumentRow>(
    `DELETE FROM documents
     WHERE id = $1
     RETURNING
      id,
      space_id,
      filename,
      filepath,
      file_name,
      original_file_name,
      stored_file_name,
      mime_type,
      file_size,
      category_id,
      summary,
      created_at`,
    [documentId],
  );
  return rows[0] ?? null;
}

export async function createCategory(input: CategoryInput) {
  await ensureDocumentSchema();
  const keywords = normalizeKeywords(input.keywords?.length ? input.keywords : [input.name]);
  const spaceId = input.spaceId ?? await getDocumentSpaceId(input.documentId);
  if (spaceId == null) {
    throw new HttpError(400, "A space is required to create categories.");
  }

  const metadata = buildCategoryMetadata({
    ...input,
    keywords,
  });
  const existing = await getDb().query<CategoryRow>(
    `SELECT id, name, space_id, metadata, description, keywords, created_at
		 FROM document_categories
		 WHERE lower(name) = lower($1)
			AND space_id IS NOT DISTINCT FROM $2
		 LIMIT 1`,
    [input.name.trim(), spaceId],
  );

  if (existing.rows[0]) {
    const { rows } = await getDb().query<CategoryRow>(
      `UPDATE document_categories
			 SET
				metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
				description = COALESCE($3, description),
				keywords = $4
			 WHERE id = $1
			 RETURNING id, name, space_id, metadata, description, keywords, created_at`,
      [
        existing.rows[0].id,
        metadata,
        input.description?.trim() || null,
        keywords,
      ],
    );
    return rows[0];
  }

  const { rows } = await getDb().query<CategoryRow>(
    `INSERT INTO document_categories (name, space_id, metadata, description, keywords)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, name, space_id, metadata, description, keywords, created_at`,
    [
      input.name.trim(),
      spaceId,
      metadata,
      input.description?.trim() || null,
      keywords,
    ],
  );
  return rows[0];
}

export function toPublicCategory(category: CategoryRow): PublicCategory {
  const metadata = normalizeCategoryMetadata(category);
  return {
    id: category.id,
    name: category.name,
    spaceId: category.space_id,
    metadata,
    description: getCategoryDescription(category),
    keywords: getCategoryKeywords(category),
  };
}

export function toPublicDocument(document: DocumentRow): PublicDocument {
  return {
    id: document.id,
    spaceId: document.space_id,
    filename: document.filename,
    filepath: document.filepath,
    fileName: document.file_name,
    originalFileName: document.original_file_name,
    storedFileName: document.stored_file_name,
    mimeType: document.mime_type,
    fileSize: document.file_size,
    categoryId: document.category_id,
    summary: document.summary,
    createdAt: document.created_at,
  };
}

export async function assignDocumentCategory(
  documentId: number,
  categoryId: number,
) {
  await ensureDocumentSchema();
  const { rows } = await getDb().query(
    `UPDATE documents
		 SET
			category_id = $1::integer,
			needs_new_category = FALSE,
			confidence = 1,
			metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('categoryId', $1::integer)
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
  const categories = await listCategories(await getDocumentSpaceId(documentId));
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
  const categories = await listCategories(await getDocumentSpaceId(documentId));
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
  const documentMetadata = buildDocumentMetadata({
    file,
    sourceType,
    modelAnalysis,
    match,
  });

  if (documentId) {
    const { rows } = await getDb().query<{ id: number }>(
      `UPDATE documents
       SET
        filename = COALESCE(NULLIF(filename, ''), stored_file_name, $2),
        filepath = COALESCE(filepath, storage_path),
        metadata = COALESCE(metadata, '{}'::jsonb) || $10::jsonb,
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
        documentMetadata,
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
				filename,
				filepath,
				metadata,
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
			VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id`,
    [
      file.originalname,
      documentMetadata,
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
    spaceId: category.space_id,
    metadata: normalizeCategoryMetadata(category),
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

async function getDocumentSpaceId(documentId?: number) {
  if (!documentId) {
    return null;
  }

  const { rows } = await getDb().query<{ space_id: number | null }>(
    `SELECT space_id FROM documents WHERE id = $1`,
    [documentId],
  );
  return rows[0]?.space_id ?? null;
}

async function ensureDefaultCategoriesForSpace(spaceId: number | null) {
  if (spaceId == null || seededDefaultCategorySpaces.has(spaceId)) {
    return;
  }

  const inFlight = defaultCategorySeedPromises.get(spaceId);
  if (inFlight) {
    await inFlight;
    return;
  }

  const promise = (async () => {
    for (const category of DEFAULT_CATEGORIES) {
      await getDb().query(
        `INSERT INTO document_categories (name, space_id, metadata, description, keywords)
         SELECT $1, $2, $3, $4, $5
         WHERE NOT EXISTS (
           SELECT 1 FROM document_categories
           WHERE lower(name) = lower($1) AND space_id = $2
         )`,
        [
          category.name,
          spaceId,
          buildCategoryMetadata(category),
          category.description ?? null,
          category.keywords ?? [],
        ],
      );
    }

    seededDefaultCategorySpaces.add(spaceId);
  })().finally(() => {
    defaultCategorySeedPromises.delete(spaceId);
  });

  defaultCategorySeedPromises.set(spaceId, promise);
  await promise;
}

function buildCategoryMetadata(input: CategoryInput): CategoryMetadata {
  const metadata =
    input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {};
  const description =
    input.description?.trim() ||
    (typeof metadata.description === "string" ? metadata.description.trim() : null);
  const keywords = normalizeKeywords(
    input.keywords?.length
      ? input.keywords
      : Array.isArray(metadata.keywords)
        ? metadata.keywords
        : [input.name],
  );

  return {
    ...metadata,
    description,
    keywords,
  };
}

function normalizeCategoryMetadata(category: CategoryRow): CategoryMetadata {
  return buildCategoryMetadata({
    name: category.name,
    description:
      typeof category.metadata?.description === "string"
        ? category.metadata.description
        : category.description ?? undefined,
    keywords: getCategoryKeywords(category),
    metadata: category.metadata,
  });
}

function getCategoryDescription(category: CategoryRow) {
  return (
    (typeof category.metadata?.description === "string"
      ? category.metadata.description.trim()
      : "") ||
    category.description ||
    null
  );
}

function getCategoryKeywords(category: CategoryRow) {
  if (Array.isArray(category.metadata?.keywords)) {
    return normalizeKeywords(category.metadata.keywords);
  }
  return normalizeKeywords(category.keywords?.length ? category.keywords : [category.name]);
}

function buildDocumentMetadata({
  file,
  sourceType,
  modelAnalysis,
  match,
}: {
  file: Express.Multer.File;
  sourceType: "pdf" | "image";
  modelAnalysis: ClaudeAnalysis;
  match: CategoryMatch;
}) {
  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    sourceType,
    pageCount: sourceType === "pdf" ? modelAnalysis.pageCount ?? 0 : 0,
    summary: modelAnalysis.summary,
    categoryId: match.category?.id ?? null,
    needsNewCategory: match.needsNewCategory,
    suggestedCategoryName: match.suggestedCategoryName,
    suggestedCategoryDescription: match.suggestedCategoryDescription,
  };
}

function normalizeKeywords(keywords: string[]) {
  return [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
}

function buildSearchSnippet(row: SearchDocumentRow, query: string) {
  const sources = [row.summary, row.extracted_text].filter(Boolean);
  const normalizedQuery = query.trim().toLowerCase();

  for (const source of sources) {
    const text = normalizeWhitespace(source);
    const index = text.toLowerCase().indexOf(normalizedQuery);
    if (index >= 0) {
      const start = Math.max(index - 60, 0);
      const end = Math.min(index + normalizedQuery.length + 90, text.length);
      const prefix = start > 0 ? "..." : "";
      const suffix = end < text.length ? "..." : "";
      return `${prefix}${text.slice(start, end).trim()}${suffix}`;
    }
  }

  return row.summary ? normalizeWhitespace(row.summary).slice(0, 140) : null;
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
