import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type {
  FileAnalysisResult,
  MultipleUploadResponse,
  UploadedFile,
} from "../types/upload";

type AnalysisResponse = {
  document?: {
    id?: number;
    summary?: string;
  };
  category?: {
    name?: string;
  } | null;
  needsNewCategory?: boolean;
  suggestedCategoryName?: string;
  suggestedCategoryDescription?: string;
  prompt?: string | null;
  error?: string;
};

type CreatedCategory = {
  name: string;
  description: string;
};

type CategoryListResponse = {
  categories?: Array<{
    name: string;
    description: string | null;
  }>;
};

type CategoryUpsertResponse = {
  category?: {
    name?: string;
    description?: string | null;
  };
  error?: string;
};

export default function Upload() {
  const apiBaseUrl = "http://localhost:3000/api/v1";
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [analysisResults, setAnalysisResults] = useState<FileAnalysisResult[]>(
    [],
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const newFiles = Array.from(e.dataTransfer.files ?? []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const upload = async () => {
    if (files.length === 0) return setStatus("Select at least one file");
    setStatus(`Uploading ${files.length} file(s)...`);
    setAnalysisResults([]);
    try {
      const body = new FormData();
      files.forEach((f) => body.append("files", f));
      const res = await fetch(`${apiBaseUrl}/upload/multiple`, {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const payload = (await res.json()) as MultipleUploadResponse;
      setUploadedFiles(payload.files);
      setSummary(
        `${payload.message} Total size: ${(payload.totalSize / 1024 / 1024).toFixed(2)} MB`,
      );
      setStatus("Upload successful. Analyzing files...");
      const knownCategories = await loadKnownCategories();
      const results: FileAnalysisResult[] = [];
      for (const [index, file] of files.entries()) {
        const result = await analyzeFile(file, knownCategories, payload.files[index]);
        results.push(result);
        setAnalysisResults([...results]);
      }
      setAnalysisResults(results);
      const failedCount = results.filter((result) => result.error).length;
      setStatus(
        failedCount > 0
          ? `Upload complete. Analysis failed for ${failedCount} file(s).`
          : "Upload and analysis complete",
      );
      setFiles([]);
    } catch (err: any) {
      setStatus(`Upload failed: ${err.message ?? err}`);
    }
  };

  const analyzeFile = async (
    file: File,
    knownCategories: Map<string, CreatedCategory>,
    uploadedFile?: UploadedFile,
  ): Promise<FileAnalysisResult> => {
    const endpoint = getAnalysisEndpoint(file);

    if (!endpoint) {
      return {
        fileName: file.name,
        categoryName: "Not analyzed",
        summary: "Analysis is available for PDFs, JPEGs, PNGs, GIFs, and WebP images.",
        prompt: null,
        needsNewCategory: false,
        categoryInput: "",
        categoryDescription: "",
        isCreatingCategory: false,
      };
    }

    try {
      const body = new FormData();
      body.append("file", file);
      if (uploadedFile?.documentId) {
        body.append("documentId", String(uploadedFile.documentId));
      }

      const res = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: "POST",
        body,
      });
      const payload = (await res.json()) as AnalysisResponse;

      if (!res.ok && payload.error) {
        throw new Error(payload.error);
      }

      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }

      const categoryName =
        payload.category?.name ??
        payload.suggestedCategoryName ??
        "Uncategorized";
      const suggestionKey = categoryKey(payload.suggestedCategoryName ?? categoryName);
      const existingCategory = knownCategories.get(suggestionKey);
      const needsNewCategory =
        Boolean(payload.needsNewCategory) && !existingCategory;

      if (payload.needsNewCategory && existingCategory) {
        const assignedCategory = await createOrAssignCategory(
          existingCategory.name,
          existingCategory.description,
          payload.document?.id,
        );
        knownCategories.set(categoryKey(assignedCategory.name), assignedCategory);
      }

      return {
        documentId: payload.document?.id ?? uploadedFile?.documentId,
        fileName: file.name,
        categoryName: existingCategory?.name ?? categoryName,
        suggestedCategoryName: payload.suggestedCategoryName,
        suggestedCategoryDescription: payload.suggestedCategoryDescription,
        summary: payload.document?.summary ?? "No summary returned.",
        prompt: payload.prompt ?? null,
        needsNewCategory,
        categoryInput: payload.suggestedCategoryName ?? categoryName,
        categoryDescription:
          existingCategory?.description ??
          payload.suggestedCategoryDescription ??
          buildFallbackCategoryDescription(categoryName),
        isCreatingCategory: false,
        categoryStatus: existingCategory
          ? `Assigned to ${existingCategory.name}.`
          : undefined,
      };
    } catch (err: any) {
      return {
        fileName: file.name,
        categoryName: "Analysis failed",
        summary: "",
        prompt: null,
        needsNewCategory: false,
        categoryInput: "",
        categoryDescription: "",
        isCreatingCategory: false,
        error: err.message ?? "Analysis failed",
      };
    }
  };

  const categoryKey = (name: string) => name.trim().toLowerCase();

  const buildFallbackCategoryDescription = (name: string) =>
    `Documents related to ${name.toLowerCase()}.`;

  const loadKnownCategories = async () => {
    const res = await fetch(`${apiBaseUrl}/categories`);
    if (!res.ok) return new Map<string, CreatedCategory>();

    const payload = (await res.json().catch(() => null)) as CategoryListResponse | null;
    const categories = payload?.categories ?? [];
    return new Map(
      categories.map((category) => [
        categoryKey(category.name),
        {
          name: category.name,
          description:
            category.description ?? buildFallbackCategoryDescription(category.name),
        },
      ]),
    );
  };

  const createOrAssignCategory = async (
    name: string,
    description: string,
    documentId?: number,
  ) => {
    const res = await fetch(`${apiBaseUrl}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description,
        keywords: [name],
        documentId,
      }),
    });
    const payload = (await res.json().catch(() => null)) as CategoryUpsertResponse | null;

    if (!res.ok) {
      throw new Error(payload?.error ?? `${res.status} ${res.statusText}`);
    }

    return {
      name: payload?.category?.name ?? name,
      description:
        payload?.category?.description ??
        (description || buildFallbackCategoryDescription(name)),
    };
  };

  const updateCategoryInput = (fileName: string, value: string) => {
    setAnalysisResults((prev) =>
      prev.map((result) =>
        result.fileName === fileName
          ? { ...result, categoryInput: value, categoryStatus: undefined }
          : result,
      ),
    );
  };

  const confirmCategory = async (result: FileAnalysisResult) => {
    const name = result.categoryInput.trim();
    if (!name) {
      setAnalysisResults((prev) =>
        prev.map((item) =>
          item.fileName === result.fileName
            ? { ...item, categoryStatus: "Enter a category name." }
            : item,
        ),
      );
      return;
    }

    setAnalysisResults((prev) =>
      prev.map((item) =>
        item.fileName === result.fileName
          ? { ...item, isCreatingCategory: true, categoryStatus: undefined }
          : item,
      ),
    );

    try {
      const category = await createOrAssignCategory(
        name,
        result.categoryDescription?.trim() ||
          buildFallbackCategoryDescription(name),
        result.documentId,
      );

      setAnalysisResults((prev) =>
        prev.map((item) =>
          shouldApplyCreatedCategory(item, result, name)
            ? {
                ...item,
                categoryName: category.name,
                suggestedCategoryName: category.name,
                suggestedCategoryDescription: category.description,
                categoryDescription: category.description,
                needsNewCategory: false,
                prompt: null,
                isCreatingCategory: false,
                categoryStatus:
                  item.fileName === result.fileName
                    ? "Category created and assigned."
                    : `Assigned to ${category.name}.`,
              }
            : item,
        ),
      );
    } catch (err: any) {
      setAnalysisResults((prev) =>
        prev.map((item) =>
          item.fileName === result.fileName
            ? {
                ...item,
                isCreatingCategory: false,
                categoryStatus: err.message ?? "Could not create category.",
              }
            : item,
        ),
      );
    }
  };

  const shouldApplyCreatedCategory = (
    item: FileAnalysisResult,
    source: FileAnalysisResult,
    createdName: string,
  ) => {
    const itemSuggestionKey = categoryKey(item.suggestedCategoryName ?? item.categoryName);
    return (
      itemSuggestionKey === categoryKey(source.suggestedCategoryName ?? source.categoryName) ||
      itemSuggestionKey === categoryKey(createdName) ||
      categoryKey(item.categoryInput) === categoryKey(createdName)
    );
  };

  const getAnalysisEndpoint = (file: File) => {
    if (file.type === "application/pdf") return "/documents/analyze";
    if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      return "/images/analyze";
    }
    return null;
  };

  const activeCategoryPromptIndex = analysisResults.findIndex(
    (result) => result.needsNewCategory && !result.error,
  );

  return (
    <div className="upload-page max-w-3xl mx-auto p-6">
      <header className="upload-header mb-6">
        <h1 className="text-2xl font-semibold">Upload PDFs and Images</h1>
      </header>

      <main className="upload-content">
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="border-2 border-dashed border-gray-300 rounded-2xl min-h-65 p-10 text-center cursor-pointer flex flex-col justify-center items-center gap-3"
          onClick={() => inputRef.current?.click()}
        >
          <div className="w-20 h-20 rounded-full bg-gray-100 grid place-items-center text-3xl">
            ↑
          </div>
          <p className="text-base mt-2">
            {files.length > 0
              ? `${files.length} file(s) selected`
              : "Drag and drop files here, or click to browse"}
          </p>
          <small className="text-sm text-gray-500 mt-1">
            Supported: PDF and image files (JPEG, PNG, GIF, WebP, SVG, BMP,
            TIFF)
          </small>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onFileChange}
            accept=".pdf,image/*"
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2">Selected Files:</h3>
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center text-sm"
                >
                  <span>
                    {f.name} ({(f.size / 1024).toFixed(2)} KB)
                  </span>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={upload}
            disabled={files.length === 0}
            className="min-w-60 px-5 py-3 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {files.length > 0
              ? `Upload ${files.length} File(s)`
              : "Upload Files"}
          </button>
        </div>

        {status && (
          <div className="mt-3">
            <small className="text-sm text-gray-600">{status}</small>
          </div>
        )}

        {(summary || uploadedFiles.length > 0) && (
          <section className="mt-6">
            <label className="block mb-2 font-medium">Upload Details</label>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">{summary}</p>
              {uploadedFiles.length > 0 && (
                <table className="w-full text-sm border border-gray-200 rounded">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2 text-left">Document ID</th>
                      <th className="border p-2 text-left">Filename</th>
                      <th className="border p-2 text-left">Stored As</th>
                      <th className="border p-2 text-left">Type</th>
                      <th className="border p-2 text-right">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedFiles.map((uf, i) => (
                      <tr key={i} className="border-t">
                        <td className="border p-2">{uf.documentId}</td>
                        <td className="border p-2">{uf.originalName}</td>
                        <td className="border p-2">{uf.filename}</td>
                        <td className="border p-2">{uf.mimeType}</td>
                        <td className="border p-2 text-right">
                          {(uf.size / 1024).toFixed(2)} KB
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {analysisResults.length > 0 && (
          <section className="mt-6">
            <label className="block mb-2 font-medium">Analysis</label>
            <div className="space-y-3">
              {analysisResults.map((result, index) => (
                <article
                  key={result.fileName}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-medium">{result.fileName}</h3>
                    <span className="text-sm text-gray-600">
                      {result.categoryName}
                    </span>
                  </div>

                  {result.error ? (
                    <p className="mt-3 text-sm text-red-600">{result.error}</p>
                  ) : (
                    <>
                      {result.needsNewCategory &&
                        result.prompt &&
                        index === activeCategoryPromptIndex && (
                        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                          <p className="text-sm text-amber-800">
                            {result.prompt}
                          </p>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <input
                              value={result.categoryInput}
                              onChange={(e) =>
                                updateCategoryInput(result.fileName, e.target.value)
                              }
                              className="min-w-0 flex-1 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-400"
                            />
                            <button
                              onClick={() => confirmCategory(result)}
                              disabled={
                                result.isCreatingCategory ||
                                !result.categoryInput.trim()
                              }
                              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {result.isCreatingCategory
                                ? "Creating..."
                                : "Confirm"}
                            </button>
                          </div>
                          <textarea
                            value={result.categoryDescription}
                            onChange={(e) =>
                              setAnalysisResults((prev) =>
                                prev.map((item) =>
                                  item.fileName === result.fileName
                                    ? {
                                        ...item,
                                        categoryDescription: e.target.value,
                                        categoryStatus: undefined,
                                      }
                                    : item,
                                ),
                              )
                            }
                            rows={2}
                            className="mt-2 w-full resize-y rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-400"
                          />
                        </div>
                      )}
                      {result.needsNewCategory &&
                        index !== activeCategoryPromptIndex && (
                          <p className="mt-3 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-600">
                            Waiting for the previous category decision.
                          </p>
                        )}
                      {result.categoryStatus && (
                        <p className="mt-3 text-sm text-gray-600">
                          {result.categoryStatus}
                        </p>
                      )}
                      <p className="mt-3 text-sm leading-6 text-gray-700">
                        {result.summary}
                      </p>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="upload-footer">
        <small>&copy; 2026 My App</small>
      </footer>
    </div>
  );
}
