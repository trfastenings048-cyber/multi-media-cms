"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Toast, { type ToastData } from "@/components/Toast";

type UploadedFile = {
  id: string;
  file: File;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon() {
  return (
    <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export default function FileUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastData["type"]) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next: UploadedFile[] = Array.from(incoming).map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
    }));
    setFiles((prev) => [...prev, ...next]);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  async function handleUpload() {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    setProgress(0);

    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const folder = "rubenius/documents";
      const signRes = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params: { timestamp, folder } })
      });
      
      if (!signRes.ok) throw new Error("Failed to get upload signature");
      const { signature, apiKey, cloudName } = await signRes.json();

      const uploadedFiles: Array<{ name: string; size: number; mimeType: string; url: string; publicId: string }> = [];
      let totalLoaded = 0;
      const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);

      for (let i = 0; i < files.length; i++) {
        const { file } = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", apiKey);
        formData.append("timestamp", timestamp.toString());
        formData.append("signature", signature);
        formData.append("folder", folder);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const currentProgress = Math.round(((totalLoaded + e.loaded) / totalSize) * 100);
              setProgress(currentProgress);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              totalLoaded += file.size;
              const res = JSON.parse(xhr.responseText);
              uploadedFiles.push({
                name: file.name,
                size: file.size,
                mimeType: file.type || "application/octet-stream",
                url: res.secure_url,
                publicId: res.public_id,
              });
              resolve();
            } else {
              reject(new Error("Cloudinary upload failed"));
            }
          };

          xhr.onerror = () => reject(new Error("Network error"));
          xhr.onabort = () => reject(new Error("Upload cancelled"));

          xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`);
          xhr.send(formData);
        });
      }

      const saveRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: uploadedFiles }),
      });

      if (!saveRes.ok) throw new Error("Failed to save documents to database");

      showToast("Files uploaded successfully!", "success");
      setTimeout(() => router.push("/main-screen"), 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      showToast(message, "error");
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <Toast toast={toast} />

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`border-2 border-dashed rounded-xl px-8 py-12 flex flex-col items-center gap-3 cursor-pointer transition-colors select-none
          ${dragOver ? "border-black bg-gray-50" : "border-gray-300 hover:border-gray-500"}`}
      >
        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm font-medium text-gray-700">
          Drag &amp; drop files here, or <span className="underline">browse</span>
        </p>
        <p className="text-xs text-gray-400">PDF, Images (JPG, PNG, GIF…), Videos (MP4, MOV…)</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/*,video/*"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map(({ id, file }) => (
            <li
              key={id}
              className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
            >
              <FileIcon />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
              </div>
              <button
                onClick={() => removeFile(id)}
                disabled={uploading}
                aria-label="Remove file"
                className="shrink-0 p-1 rounded-full text-gray-400 hover:text-black hover:bg-gray-200 transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Progress bar */}
      {uploading && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={files.length === 0 || uploading}
        className="w-full bg-black text-white py-3 rounded-xl text-sm font-semibold tracking-wide hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {uploading ? "Uploading…" : `Upload ${files.length > 0 ? `(${files.length} file${files.length > 1 ? "s" : ""})` : ""}`}
      </button>
    </div>
  );
}
