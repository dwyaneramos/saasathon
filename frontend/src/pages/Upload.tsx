import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f) setFile(f);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const upload = async () => {
    if (!file) return setStatus("Select a file first");
    setStatus("Uploading and generating summary...");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/upload", {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      const payload = await res.json().catch(() => null);
      setSummary(
        typeof payload?.summary === "string"
          ? payload.summary
          : "Summary will appear here once the backend returns it.",
      );

      setStatus("Upload successful");
    } catch (err: any) {
      setStatus(`Upload failed: ${err.message ?? err}`);
    }
  };

  return (
    <div className="upload-page max-w-3xl mx-auto p-6">
      <header className="upload-header mb-6">
        <h1 className="text-2xl font-semibold">Upload and generate summary</h1>
      </header>

      <main className="upload-content">
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="border-2 border-dashed border-gray-300 rounded-2xl min-h-65 p-10 text-center cursor-pointer flex flex-col justify-center items-center gap-3"
          onClick={() => inputRef.current?.click()}
        >
          <div className="w-20 h-20 rounded-full bg-gray-100 grid place-items-center text-3xl">↑</div>
          <p className="text-base mt-2">
            {file ? file.name : "Drag and drop a file here, or click to browse"}
          </p>
          <small className="text-sm text-gray-500 mt-1">
            We will upload the file and generate a summary in one step.
          </small>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        <div className="mt-6">
          <button
            onClick={upload}
            disabled={!file}
            className="min-w-60 px-5 py-3 bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Upload and generate summary
          </button>
        </div>

        {status && (
          <div className="mt-3">
            <small className="text-sm text-gray-600">{status}</small>
          </div>
        )}

        {summary && (
          <section className="mt-6">
            <label htmlFor="summary" className="block mb-2 font-medium">
              Summary
            </label>
            <textarea
              id="summary"
              value={summary}
              readOnly
              rows={8}
              className="w-full rounded-lg border border-gray-200 p-3 resize-y bg-gray-50"
            />
          </section>
        )}
      </main>

      <footer className="upload-footer">
        <small>&copy; 2026 My App</small>
      </footer>
    </div>
  );
}
