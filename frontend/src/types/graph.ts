export interface CategorySummary {
  id: number;
  name: string;
  spaceId: number | null;
  description: string | null;
  keywords: string[];
  metadata: Record<string, unknown>;
}

export interface DocumentSummary {
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
  createdAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  categoryId?: number;
  documentId?: number;
}
