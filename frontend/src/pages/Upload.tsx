import { useState, useRef, DragEvent, ChangeEvent } from "react";

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
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
    setStatus("Uploading...");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/upload", {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setStatus("Upload successful");
    } catch (err: any) {
      setStatus(`Upload failed: ${err.message ?? err}`);
    }
  };

  return (
    <div className="upload-page">
      <header className="upload-header">
        <h1>Upload File</h1>
      </header>

      <main className="upload-content">
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          style={{
            border: "2px dashed #ccc",
            borderRadius: 8,
            padding: 24,
            textAlign: "center",
            cursor: "pointer",
          }}
          onClick={() => inputRef.current?.click()}
        >
          <p>
            {file ? file.name : "Drag & drop a file here, or click to select"}
          </p>
          <input
            ref={inputRef}
            type="file"
            style={{ display: "none" }}
            onChange={onFileChange}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={upload} disabled={!file}>
            Upload
          </button>
          <button
            style={{ marginLeft: 8 }}
            onClick={() => {
              setFile(null);
              setStatus(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Clear
          </button>
        </div>

        {status && (
          <div style={{ marginTop: 12 }}>
            <small>{status}</small>
          </div>
        )}
      </main>

      <footer className="upload-footer">
        <small>&copy; 2026 My App</small>
      </footer>
    </div>
  );
}
