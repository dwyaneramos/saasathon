export interface UploadedFile {
  documentId: number;
  spaceId: number;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
}

export interface MultipleUploadResponse {
  message: string;
  files: UploadedFile[];
  totalSize: number;
}

export interface FileAnalysisResult {
  documentId?: number;
  fileName: string;
  categoryName: string;
  suggestedCategoryName?: string;
  suggestedCategoryDescription?: string;
  categoryDescription: string;
  summary: string;
  prompt: string | null;
  needsNewCategory: boolean;
  categoryInput: string;
  isCreatingCategory: boolean;
  categoryStatus?: string;
  error?: string;
}
