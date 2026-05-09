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
  keywords: string[];
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
  keywords: string[];
  createdAt: Date;
};

type DocumentSearchRow = DocumentRow & {
  extracted_text: string;
  category_name: string | null;
  score: number;
};

export type PublicDocumentSearchResult = PublicDocument & {
  categoryName: string | null;
  score: number;
  snippet: string | null;
};

export type DashboardAssistantSuggestion = {
  label: string;
  sub: string;
  prompt: string;
};

export type DashboardAssistantResponse = {
  message: string;
  navigateTo: string | null;
  suggestedActions: DashboardAssistantSuggestion[];
  searchResults: PublicDocumentSearchResult[];
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
        keywords,
        created_at
     FROM documents
     WHERE $1::integer IS NULL OR space_id = $1
     ORDER BY created_at DESC`,
    [spaceId ?? null],
  );
  return rows;
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
        keywords,
        created_at
     FROM documents
     WHERE id = $1
     LIMIT 1`,
    [documentId],
  );
  return rows[0] ?? null;
}

export async function searchDocuments(input: {
  query: string;
  spaceId?: number | null;
  limit?: number;
}) {
  await ensureDocumentSchema();

  const trimmedQuery = input.query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const normalizedQuery = trimmedQuery.toLowerCase();
  const tokens = normalizeSearchTokens(trimmedQuery);
  const safeLimit = Math.min(Math.max(input.limit ?? 8, 1), 20);

  const { rows } = await getDb().query<DocumentSearchRow>(
    `SELECT
        d.id,
        d.space_id,
        d.filename,
        d.filepath,
        d.file_name,
        d.original_file_name,
        d.stored_file_name,
        d.mime_type,
        d.file_size,
        d.category_id,
        d.summary,
        d.keywords,
        d.extracted_text,
        d.created_at,
        c.name AS category_name,
        (
          CASE
            WHEN lower(COALESCE(d.original_file_name, d.file_name, d.filename, '')) = $2 THEN 140
            ELSE 0
          END +
          CASE
            WHEN lower(COALESCE(d.original_file_name, d.file_name, d.filename, '')) LIKE '%' || $2 || '%' THEN 80
            ELSE 0
          END +
          CASE
            WHEN lower(COALESCE(c.name, '')) LIKE '%' || $2 || '%' THEN 45
            ELSE 0
          END +
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM unnest(COALESCE(c.keywords, '{}'::text[])) AS category_keyword
              WHERE lower(category_keyword) LIKE '%' || $2 || '%'
            ) THEN 24
            ELSE 0
          END +
          CASE
            WHEN lower(COALESCE(d.summary, '')) LIKE '%' || $2 || '%' THEN 35
            ELSE 0
          END +
          CASE
            WHEN lower(COALESCE(d.extracted_text, '')) LIKE '%' || $2 || '%' THEN 18
            ELSE 0
          END +
          COALESCE((
            SELECT SUM(
              CASE
                WHEN token = '' THEN 0
                WHEN lower(COALESCE(d.original_file_name, d.file_name, d.filename, '')) LIKE '%' || token || '%' THEN 16
                WHEN lower(COALESCE(c.name, '')) LIKE '%' || token || '%' THEN 10
                WHEN EXISTS (
                  SELECT 1
                  FROM unnest(COALESCE(c.keywords, '{}'::text[])) AS category_keyword
                  WHERE lower(category_keyword) = token
                ) THEN 10
                WHEN lower(COALESCE(d.summary, '')) LIKE '%' || token || '%' THEN 8
                WHEN lower(COALESCE(d.extracted_text, '')) LIKE '%' || token || '%' THEN 4
                WHEN EXISTS (
                  SELECT 1
                  FROM unnest(COALESCE(d.keywords, '{}'::text[])) AS document_keyword
                  WHERE lower(document_keyword) = token
                ) THEN 12
                ELSE 0
              END
            )
            FROM unnest($3::text[]) AS token
          ), 0)
        )::float8 AS score
     FROM documents d
     LEFT JOIN document_categories c ON c.id = d.category_id
     WHERE ($1::integer IS NULL OR d.space_id = $1)
     ORDER BY score DESC, d.created_at DESC
     LIMIT $4`,
    [input.spaceId ?? null, normalizedQuery, tokens, safeLimit],
  );

  return rows.filter((row) => row.score > 0);
}

export async function askDashboardAssistant({
  prompt,
  spaceId,
  pathname,
}: {
  prompt?: string;
  spaceId?: number | null;
  pathname?: string;
}): Promise<DashboardAssistantResponse> {
  await ensureDocumentSchema();

  const trimmedPrompt = prompt?.trim() ?? "";
  const categories = await listCategories(spaceId ?? null);
  const documents = await listDocuments(spaceId ?? null);
  const searchRows = trimmedPrompt
    ? await searchDocuments({
        query: trimmedPrompt,
        spaceId: spaceId ?? null,
        limit: 6,
      })
    : [];
  const publicSearchResults = searchRows.map(toPublicDocumentSearchResult);
  const suggestionsSeed = buildSuggestedActions({
    pathname: pathname ?? "/dashboard",
    categories,
    documents,
    searchResults: searchRows,
  });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      message: buildFallbackAssistantMessage({
        prompt: trimmedPrompt,
        categories,
        documents,
        searchResults: searchRows,
      }),
      navigateTo: resolveSuggestedNavigation({
        prompt: trimmedPrompt,
        pathname: pathname ?? "/dashboard",
        searchResults: searchRows,
      }),
      suggestedActions: suggestionsSeed,
      searchResults: publicSearchResults,
    };
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are Kibi's dashboard assistant. Stay grounded in the provided workspace context and search results. Return only valid JSON and never invent files, categories, or capabilities.",
      },
      {
        role: "user",
        content: buildDashboardAssistantPrompt({
          prompt: trimmedPrompt,
          pathname: pathname ?? "/dashboard",
          categories,
          documents,
          searchResults: publicSearchResults,
          suggestions: suggestionsSeed,
        }),
      },
    ],
    temperature: 0.2,
    max_tokens: 1200,
  };

  const { payload } = await sendOpenRouterRequest(body, apiKey);
  const rawContent = payload?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new HttpError(502, "OpenRouter returned an empty response");
  }

  const parsed = parseDashboardAssistantJson(rawContent);
  return {
    message:
      cleanString(parsed.message) ||
      buildFallbackAssistantMessage({
        prompt: trimmedPrompt,
        categories,
        documents,
        searchResults: searchRows,
      }),
    navigateTo: sanitizeDashboardNavigateTo(
      cleanString(parsed.navigateTo),
      searchRows,
      pathname ?? "/dashboard",
      trimmedPrompt,
    ),
    suggestedActions: (() => {
      const normalizedSuggestions = normalizeDashboardSuggestions(
        parsed.suggestedActions,
      ).slice(0, 4);
      return normalizedSuggestions.length > 0
        ? normalizedSuggestions
        : suggestionsSeed;
    })(),
    searchResults: publicSearchResults,
  };
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
      keywords,
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
      keywords,
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
    keywords: document.keywords,
    createdAt: document.created_at,
  };
}

export function toPublicDocumentSearchResult(
  document: DocumentSearchRow,
): PublicDocumentSearchResult {
  return {
    ...toPublicDocument(document),
    categoryName: document.category_name,
    score: document.score,
    snippet: buildSearchSnippet(document),
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
  const keywords = buildDocumentKeywords(file, modelAnalysis, match);

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
        needs_new_category = $9,
        keywords = $11
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
        keywords,
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
				keywords,
				category_id,
				confidence,
				needs_new_category
			)
			VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      keywords,
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
    keywords: buildDocumentKeywords(file, modelAnalysis, match),
    categoryId: match.category?.id ?? null,
    needsNewCategory: match.needsNewCategory,
    suggestedCategoryName: match.suggestedCategoryName,
    suggestedCategoryDescription: match.suggestedCategoryDescription,
  };
}

function normalizeKeywords(keywords: string[]) {
  return [...new Set(
    keywords
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean),
  )];
}

function normalizeSearchTokens(query: string) {
  return [...new Set(
    query
      .toLowerCase()
      .replace(/[^\w\s.-]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  )];
}

type DashboardAssistantJson = {
  message?: unknown;
  navigateTo?: unknown;
  suggestedActions?: unknown;
};

function parseDashboardAssistantJson(content: unknown): DashboardAssistantJson {
  return parseJsonObject(content) as DashboardAssistantJson;
}

function normalizeDashboardSuggestions(
  value: unknown,
): DashboardAssistantSuggestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const suggestion = item as Record<string, unknown>;
      const label = cleanString(suggestion.label);
      const sub = cleanString(suggestion.sub);
      const prompt = cleanString(suggestion.prompt);

      if (!label || !sub || !prompt) {
        return null;
      }

      return { label, sub, prompt };
    })
    .filter((suggestion): suggestion is DashboardAssistantSuggestion => Boolean(suggestion));
}

function buildDashboardAssistantPrompt({
  prompt,
  pathname,
  categories,
  documents,
  searchResults,
  suggestions,
}: {
  prompt: string;
  pathname: string;
  categories: CategoryRow[];
  documents: DocumentRow[];
  searchResults: PublicDocumentSearchResult[];
  suggestions: DashboardAssistantSuggestion[];
}) {
  const context = {
    pathname,
    categoryCount: categories.length,
    documentCount: documents.length,
    categories: categories.slice(0, 12).map((category) => ({
      id: category.id,
      name: category.name,
      description: getCategoryDescription(category),
      keywords: getCategoryKeywords(category),
      fileCount: documents.filter((document) => document.category_id === category.id).length,
    })),
    recentDocuments: documents.slice(0, 8).map((document) => ({
      id: document.id,
      name:
        document.original_file_name ||
        document.file_name ||
        document.filename,
      categoryId: document.category_id,
      summary: document.summary,
      keywords: document.keywords,
    })),
    searchResults,
    defaultSuggestedActions: suggestions,
  };

  return `
Answer the user's dashboard request using only this workspace context.

Current route: ${pathname}
User prompt: ${prompt || "(no prompt, generate helpful suggested actions only)"}

Workspace context:
${JSON.stringify(context)}

Return exactly this JSON:
{
  "message": "natural language response grounded in the context",
  "navigateTo": "/upload" | "/graph" | "/dashboard" | "/file/123" | null,
  "suggestedActions": [
    {
      "label": "short button label",
      "sub": "brief supporting text",
      "prompt": "the exact prompt this action should send"
    }
  ]
}

Rules:
- Use the prompt and search results first, not canned wording.
- If the user asks to open/view/read a specific file and the best search result is a strong match, set navigateTo to /file/<id>.
- If the user asks about categories or collections, navigateTo can be /graph.
- If the user asks to add or import files, navigateTo can be /upload.
- Never claim direct file editing exists.
- Suggested actions must fit the actual workspace state and should do what they say.
- Do not invent files, categories, keywords, or routes.
`;
}

function buildSuggestedActions({
  pathname,
  categories,
  documents,
  searchResults,
}: {
  pathname: string;
  categories: CategoryRow[];
  documents: DocumentRow[];
  searchResults: DocumentSearchRow[];
}) {
  const actions: DashboardAssistantSuggestion[] = [];
  const topSearchResult = searchResults[0];

  if (topSearchResult) {
    actions.push({
      label: "Open match",
      sub: displayDocumentName(topSearchResult),
      prompt: `Open ${displayDocumentName(topSearchResult)}`,
    });
  }

  if (documents[0]) {
    actions.push({
      label: "Open recent file",
      sub: displayDocumentName(documents[0]),
      prompt: `Open ${displayDocumentName(documents[0])}`,
    });
  }

  if (categories[0]) {
    const busiestCategory = [...categories]
      .map((category) => ({
        category,
        fileCount: documents.filter((document) => document.category_id === category.id).length,
      }))
      .sort((left, right) => right.fileCount - left.fileCount)[0];

    if (busiestCategory && busiestCategory.fileCount > 0) {
      actions.push({
        label: `Open ${busiestCategory.category.name}`,
        sub: `${busiestCategory.fileCount} files`,
        prompt: `Show me files in ${busiestCategory.category.name}`,
      });
    } else {
      actions.push({
        label: "View categories",
        sub: `${categories.length} available`,
        prompt: "Show me the categories in this space",
      });
    }
  }

  actions.push({
    label: "Open uploads",
    sub: documents.length === 0 ? "Add your first file" : "Add more files",
    prompt: "Take me to the upload page",
  });

  if (pathname !== "/dashboard") {
    actions.push({
      label: "Back to dashboard",
      sub: "Return to assistant home",
      prompt: "Take me back to the dashboard",
    });
  }

  return dedupeSuggestions(actions).slice(0, 4);
}

function dedupeSuggestions(suggestions: DashboardAssistantSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = `${suggestion.label}::${suggestion.prompt}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildFallbackAssistantMessage({
  prompt,
  categories,
  documents,
  searchResults,
}: {
  prompt: string;
  categories: CategoryRow[];
  documents: DocumentRow[];
  searchResults: DocumentSearchRow[];
}) {
  if (!prompt) {
    return documents.length === 0
      ? "This space is ready for its first upload. I can help you open uploads, browse categories, or find files once they are here."
      : `This space has ${documents.length} files across ${categories.length} categories. Ask me for a file, an image, or a category and I will search the workspace context first.`;
  }

  if (searchResults[0]) {
    const bestMatch = searchResults[0];
    return `I searched this space for "${prompt}" and the closest match is ${displayDocumentName(bestMatch)}${bestMatch.category_name ? ` in ${bestMatch.category_name}` : ""}.`;
  }

  return `I searched this workspace for "${prompt}" but did not find a strong file match. Try a filename, category name, or a phrase that should appear in the document.`;
}

function resolveSuggestedNavigation({
  prompt,
  pathname,
  searchResults,
}: {
  prompt: string;
  pathname: string;
  searchResults: DocumentSearchRow[];
}) {
  const normalizedPrompt = prompt.toLowerCase();
  const topSearchResult = searchResults[0];

  if (containsSearchPhrase(normalizedPrompt, ["upload", "import", "add file"])) {
    return "/upload";
  }

  if (containsSearchPhrase(normalizedPrompt, ["dashboard", "home"])) {
    return pathname === "/dashboard" ? null : "/dashboard";
  }

  if (containsSearchPhrase(normalizedPrompt, ["category", "categories", "graph", "folder"])) {
    return "/graph";
  }

  if (
    topSearchResult &&
    containsSearchPhrase(normalizedPrompt, ["open", "view", "read", "show", "edit"])
  ) {
    return `/file/${topSearchResult.id}`;
  }

  return null;
}

function sanitizeDashboardNavigateTo(
  value: string,
  searchResults: DocumentSearchRow[],
  pathname: string,
  prompt: string,
) {
  if (value === "/upload" || value === "/graph") {
    return value;
  }

  if (value === "/dashboard") {
    return pathname === "/dashboard" ? null : value;
  }

  if (/^\/file\/\d+$/.test(value)) {
    const documentId = Number(value.split("/").pop());
    return searchResults.some((result) => result.id === documentId)
      ? value
      : null;
  }

  return resolveSuggestedNavigation({
    prompt,
    pathname,
    searchResults,
  });
}

function buildDocumentKeywords(
  file: Express.Multer.File,
  modelAnalysis: ClaudeAnalysis,
  match: CategoryMatch,
) {
  return normalizeKeywords([
    ...normalizeSearchTokens(file.originalname.replace(/\.[^.]+$/, "")),
    ...normalizeSearchTokens(modelAnalysis.summary),
    ...normalizeSearchTokens(modelAnalysis.extractedText),
    ...normalizeSearchTokens(match.suggestedCategoryName),
    ...modelAnalysis.matchedKeywords,
  ]).slice(0, 40);
}

function displayDocumentName(document: Pick<DocumentRow, "original_file_name" | "file_name" | "filename">) {
  return document.original_file_name || document.file_name || document.filename;
}

function containsSearchPhrase(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

function buildSearchSnippet(row: DocumentSearchRow) {
  return row.summary ? normalizeWhitespace(row.summary).slice(0, 140) : null;
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}
