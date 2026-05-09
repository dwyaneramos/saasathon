import { getDb } from "../db/index.js";
import { HttpError } from "../utils/httpError.js";

const MIN_CONFIDENCE = 0.28;
const TEXT_PREVIEW_LIMIT = 4000;
const DOCUMENT_KEYWORD_LIMIT = 24;
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
  metadata: Record<string, unknown>;
  keywords: string[];
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
  metadata: Record<string, unknown>;
  keywords: string[];
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
  keywords: string[];
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

export async function ensureDocumentSchema() {
  await getDb().query(`
		CREATE TABLE IF NOT EXISTS spaces (
			id SERIAL PRIMARY KEY,
			created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
			name TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS document_categories (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			space_id INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
			metadata JSONB NOT NULL DEFAULT '{}',
			description TEXT,
			keywords TEXT[] NOT NULL DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS documents (
			id SERIAL PRIMARY KEY,
			space_id INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
			filename TEXT NOT NULL,
			filepath TEXT,
			metadata JSONB NOT NULL DEFAULT '{}',
			keywords TEXT[] NOT NULL DEFAULT '{}',
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

		ALTER TABLE document_categories
			DROP CONSTRAINT IF EXISTS document_categories_name_key,
			ADD COLUMN IF NOT EXISTS space_id INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
			ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}',
			ADD COLUMN IF NOT EXISTS description TEXT,
			ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}',
			ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

		ALTER TABLE documents
			ADD COLUMN IF NOT EXISTS space_id INTEGER REFERENCES spaces(id) ON DELETE CASCADE,
			ADD COLUMN IF NOT EXISTS filename TEXT NOT NULL DEFAULT 'unknown',
			ADD COLUMN IF NOT EXISTS filepath TEXT,
			ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}',
			ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}',
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

		UPDATE document_categories
		SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
			'description', description,
			'keywords', keywords
		));

		UPDATE documents
		SET keywords = COALESCE((
			SELECT ARRAY(
				SELECT DISTINCT token
				FROM unnest(
					regexp_split_to_array(
						regexp_replace(lower(COALESCE(original_file_name, file_name, filename, '')), '\.[^.]+$', ''),
						'[^a-z0-9]+'
					)
				) AS token
				WHERE length(token) >= 3
				ORDER BY token
			)
		), '{}'::text[])
		WHERE cardinality(COALESCE(keywords, '{}'::text[])) = 0;

		UPDATE documents
		SET
			filename = COALESCE(NULLIF(filename, ''), stored_file_name, file_name, 'unknown'),
			filepath = COALESCE(filepath, storage_path),
			metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
				'originalName', original_file_name,
				'mimeType', mime_type,
				'size', file_size,
				'spaceId', space_id,
				'keywords', keywords
			));

		CREATE UNIQUE INDEX IF NOT EXISTS document_categories_space_name_unique_idx
			ON document_categories (COALESCE(space_id, 0), lower(name));

		CREATE INDEX IF NOT EXISTS documents_keywords_gin_idx
			ON documents
			USING GIN (keywords);
	`);

  for (const category of DEFAULT_CATEGORIES) {
    await getDb().query(
      `INSERT INTO document_categories (name, space_id, metadata, description, keywords)
			 SELECT $1, NULL, $2, $3, $4
			 WHERE NOT EXISTS (
				SELECT 1 FROM document_categories
				WHERE lower(name) = lower($1) AND space_id IS NULL
			 )`,
      [
        category.name,
        buildCategoryMetadata(category),
        category.description ?? null,
        category.keywords ?? [],
      ],
    );
  }
}

export async function listCategories(spaceId?: number | null) {
  await ensureDocumentSchema();
  const { rows } = await getDb().query<CategoryRow>(
    `SELECT id, name, space_id, metadata, description, keywords, created_at
		 FROM document_categories
		 WHERE $1::integer IS NULL OR space_id IS NULL OR space_id = $1
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
        metadata,
        keywords,
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

export async function getDocument(documentId: number) {
  await ensureDocumentSchema();
  const { rows } = await getDb().query<DocumentRow>(
    `SELECT
        id,
        space_id,
        filename,
        filepath,
        metadata,
        keywords,
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

export async function searchDocuments(input: {
  query: string;
  spaceId?: number | null;
  limit?: number;
}) {
  await ensureDocumentSchema();

  const query = input.query.trim();
  if (!query) {
    return [];
  }

  const limit = clampSearchLimit(input.limit);
  const spaceId = input.spaceId ?? null;

  const tokenPatterns = buildSearchPatterns(query);
  const { rows } = await getDb().query<SearchDocumentRow>(
    `SELECT
        id,
        filename,
        file_name,
        original_file_name,
        mime_type,
        summary,
        extracted_text,
        keywords
     FROM documents
     WHERE ($1::integer IS NULL OR space_id = $1)
       AND (
         COALESCE(original_file_name, file_name, filename) ILIKE $2
         OR filename ILIKE $2
         OR summary ILIKE $2
         OR extracted_text ILIKE $2
         OR EXISTS (
           SELECT 1
           FROM unnest(COALESCE(keywords, '{}'::text[])) AS keyword
           WHERE keyword ILIKE $2
         )
         OR EXISTS (
           SELECT 1
           FROM unnest($3::text[]) AS pattern
           WHERE extracted_text ILIKE pattern
              OR summary ILIKE pattern
              OR COALESCE(original_file_name, file_name, filename) ILIKE pattern
         )
       )
     ORDER BY created_at DESC
     LIMIT $4`,
    [spaceId, `%${escapeLikePattern(query)}%`, tokenPatterns, Math.max(limit * 4, limit)],
  );

  return rows
    .map((row) => ({
      row,
      score: scoreSearchResult(row, query),
      snippet: buildSnippet(row, query),
    }))
    .filter((result) => Number.isFinite(result.score) && result.score > 0)
    .sort((a, b) => b.score - a.score || a.row.filename.localeCompare(b.row.filename))
    .slice(0, limit)
    .map(({ row, snippet }) => toPublicSearchResult(row, snippet));
}

export async function createCategory(input: CategoryInput) {
  await ensureDocumentSchema();
  const keywords = normalizeKeywords(input.keywords?.length ? input.keywords : [input.name]);
  const spaceId = input.spaceId ?? await getDocumentSpaceId(input.documentId);
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
    [input.name.trim(), spaceId ?? null],
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
      spaceId ?? null,
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
    metadata: document.metadata ?? {},
    keywords: normalizeKeywords(document.keywords ?? []),
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
  const category = await getCategoryById(categoryId);
  const mergedKeywords = normalizeKeywords([
    ...getCategoryKeywords(category ?? null),
  ]);
  const { rows } = await getDb().query(
    `UPDATE documents
		 SET
			category_id = $1::integer,
			keywords = CASE
				WHEN cardinality($3::text[]) = 0 THEN keywords
				ELSE (
					SELECT ARRAY(
						SELECT DISTINCT keyword
						FROM unnest(COALESCE(keywords, '{}'::text[]) || $3::text[]) AS keyword
						WHERE keyword <> ''
						ORDER BY keyword
					)
				)
			END,
			needs_new_category = FALSE,
			confidence = 1,
			metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
				'categoryId', $1::integer,
				'keywords', CASE
					WHEN cardinality($3::text[]) = 0 THEN COALESCE(metadata->'keywords', '[]'::jsonb)
					ELSE to_jsonb((
						SELECT ARRAY(
							SELECT DISTINCT keyword
							FROM unnest(COALESCE(keywords, '{}'::text[]) || $3::text[]) AS keyword
							WHERE keyword <> ''
							ORDER BY keyword
						)
					))
				END
			)
		 WHERE id = $2
		 RETURNING id`,
    [categoryId, documentId, mergedKeywords],
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
  const documentKeywords = buildDocumentKeywords({
    file,
    extractedText,
    modelAnalysis,
    match,
  });
  const documentMetadata = buildDocumentMetadata({
    file,
    sourceType,
    modelAnalysis,
    match,
    keywords: documentKeywords,
  });

  if (documentId) {
    const { rows } = await getDb().query<{ id: number }>(
      `UPDATE documents
       SET
        filename = COALESCE(NULLIF(filename, ''), stored_file_name, $2),
        filepath = COALESCE(filepath, storage_path),
        metadata = COALESCE(metadata, '{}'::jsonb) || $10::jsonb,
        keywords = $11,
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
        documentKeywords,
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
				keywords,
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
			VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id`,
    [
      file.originalname,
      documentMetadata,
      documentKeywords,
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

function getCategoryKeywords(category: CategoryRow | null) {
  if (!category) {
    return [];
  }
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
  keywords,
}: {
  file: Express.Multer.File;
  sourceType: "pdf" | "image";
  modelAnalysis: ClaudeAnalysis;
  match: CategoryMatch;
  keywords: string[];
}) {
  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    sourceType,
    pageCount: sourceType === "pdf" ? modelAnalysis.pageCount ?? 0 : 0,
    summary: modelAnalysis.summary,
    categoryId: match.category?.id ?? null,
    keywords,
    needsNewCategory: match.needsNewCategory,
    suggestedCategoryName: match.suggestedCategoryName,
    suggestedCategoryDescription: match.suggestedCategoryDescription,
  };
}

async function getCategoryById(categoryId: number) {
  const { rows } = await getDb().query<CategoryRow>(
    `SELECT id, name, space_id, metadata, description, keywords, created_at
     FROM document_categories
     WHERE id = $1
     LIMIT 1`,
    [categoryId],
  );
  return rows[0] ?? null;
}

function buildDocumentKeywords({
  file,
  extractedText,
  modelAnalysis,
  match,
}: {
  file: Express.Multer.File;
  extractedText: string;
  modelAnalysis: ClaudeAnalysis;
  match: CategoryMatch;
}) {
  return normalizeKeywords([
    ...extractKeywordsFromFilename(file.originalname),
    ...modelAnalysis.matchedKeywords,
    ...getCategoryKeywords(match.category),
    ...tokenizeKeywords(modelAnalysis.summary),
    ...tokenizeKeywords(extractedText),
    ...tokenizeKeywords(match.suggestedCategoryName),
    ...tokenizeKeywords(match.suggestedCategoryDescription),
  ]).slice(0, DOCUMENT_KEYWORD_LIMIT);
}

function extractKeywordsFromFilename(filename: string) {
  const extension = filename.includes(".")
    ? filename.slice(0, filename.lastIndexOf("."))
    : filename;
  return tokenizeKeywords(extension);
}

function tokenizeKeywords(text: string) {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!normalized) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const token of normalized.split(/\s+/)) {
    if (!isSearchableKeyword(token)) {
      continue;
    }
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
    .map(([token]) => token)
    .slice(0, DOCUMENT_KEYWORD_LIMIT);
}

function isSearchableKeyword(token: string) {
  if (token.length < 3 || /^\d+$/.test(token)) {
    return false;
  }

  return !DOCUMENT_KEYWORD_STOPWORDS.has(token);
}

const DOCUMENT_KEYWORD_STOPWORDS = new Set([
  "about",
  "after",
  "also",
  "among",
  "because",
  "before",
  "between",
  "could",
  "document",
  "from",
  "have",
  "into",
  "just",
  "more",
  "much",
  "only",
  "other",
  "over",
  "page",
  "pages",
  "should",
  "some",
  "than",
  "that",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "through",
  "under",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
]);

function normalizeKeywords(keywords: string[]) {
  return [...new Set(keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean))];
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function toPublicSearchResult(
  row: SearchDocumentRow,
  snippet: string | null = null,
): DocumentSearchResult {
  return {
    id: row.id,
    filename: row.filename,
    fileName: row.file_name,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    snippet,
  };
}

function scoreSearchResult(row: SearchDocumentRow, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return 0;
  }

  const title = normalizeWhitespace(
    row.original_file_name || row.file_name || row.filename,
  ).toLowerCase();
  const summary = normalizeWhitespace(row.summary).toLowerCase();
  const normalizedText = normalizeWhitespace(row.extracted_text).toLowerCase();
  let score = 0;
  const titleIndex = title.indexOf(normalizedQuery);
  if (titleIndex >= 0) {
    score += 320 - Math.min(titleIndex, 160);
  }

  const summaryIndex = summary.indexOf(normalizedQuery);
  if (summaryIndex >= 0) {
    score += 220 - Math.min(summaryIndex, 150);
  }

  const directIndex = normalizedText.indexOf(normalizedQuery);
  if (directIndex >= 0) {
    score += 140 - Math.min(directIndex, 120);
  }

  for (const token of tokenizeKeywords(query)) {
    if (title.includes(token)) score += 40;
    if (summary.includes(token)) score += 28;
    if (normalizedText.includes(token)) score += 18;
  }

  for (const keyword of row.keywords ?? []) {
    if (normalizedQuery.includes(keyword) || keyword.includes(normalizedQuery)) {
      score += 18;
    }
  }

  return score;
}

function buildSnippet(row: SearchDocumentRow, query: string) {
  const snippet = buildSnippetFromText(row.summary, query);
  if (snippet) {
    return snippet;
  }

  return buildSnippetFromText(row.extracted_text, query);
}

function buildSnippetFromText(sourceText: string, query: string) {
  const normalizedText = normalizeWhitespace(sourceText);
  if (!normalizedText) {
    return null;
  }

  const lowerText = normalizedText.toLowerCase();
  const searchTerms = [query.trim().toLowerCase(), ...tokenizeKeywords(query)].filter(Boolean);
  const matchIndex = searchTerms
    .map((term) => lowerText.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (matchIndex === undefined) {
    return null;
  }

  const sentenceStart = normalizedText.lastIndexOf(". ", Math.max(matchIndex - 1, 0));
  const sentenceEnd = normalizedText.indexOf(". ", matchIndex);
  const start = Math.max(sentenceStart >= 0 ? sentenceStart + 2 : 0, matchIndex - 70);
  const end = Math.min(
    sentenceEnd >= 0 ? sentenceEnd + 1 : normalizedText.length,
    matchIndex + 130,
  );
  const snippet = normalizedText.slice(start, end).trim();

  if (!snippet) {
    return null;
  }

  return `${start > 0 ? "... " : ""}${snippet}${end < normalizedText.length ? " ..." : ""}`;
}

function clampSearchLimit(limit?: number) {
  if (!limit || !Number.isInteger(limit) || limit < 1) {
    return 20;
  }
  return Math.min(limit, 50);
}

function buildSearchPatterns(query: string) {
  return tokenizeKeywords(query).map((token) => `%${escapeLikePattern(token)}%`);
}

function escapeLikePattern(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}
