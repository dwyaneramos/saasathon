import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { MultipleUploadResponse, UploadedFile } from "../types/upload";

export default function Upload() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
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
    try {
      const body = new FormData();
      files.forEach((f) => body.append("files", f));
      const res = await fetch("/upload/multiple", {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const payload = (await res.json()) as MultipleUploadResponse;
      setUploadedFiles(payload.files);
      setSummary(
        `${payload.message} Total size: ${(payload.totalSize / 1024 / 1024).toFixed(2)} MB`,
      );
      setStatus("Upload successful");
      setFiles([]);
    } catch (err: any) {
      setStatus(`Upload failed: ${err.message ?? err}`);
    }
  };

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
                      <th className="border p-2 text-left">Filename</th>
                      <th className="border p-2 text-left">Type</th>
                      <th className="border p-2 text-right">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedFiles.map((uf, i) => (
                      <tr key={i} className="border-t">
                        <td className="border p-2">{uf.originalName}</td>
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
      </main>

      <footer className="upload-footer">
        <small>&copy; 2026 My App</small>
      </footer>
    </div>
  );
}
