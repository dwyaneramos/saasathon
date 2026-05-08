export interface UploadedFile {
  originalName: string;
  mimeType: string;
  size: number;
}

export interface MultipleUploadResponse {
  message: string;
  files: UploadedFile[];
  totalSize: number;
}
