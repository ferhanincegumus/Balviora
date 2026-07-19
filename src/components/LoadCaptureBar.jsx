import React, { useRef } from "react";
import { Camera, Upload, X, FileText } from "lucide-react";

// Top-of-form capture buttons for driver (field) mode:
// "Take photo" opens the device camera (BOL / receipt / gate pass),
// "Upload file" picks a PDF or image. Selected files are collected and
// later attached as Evidence to the claim created with the load.
export default function LoadCaptureBar({ files, onAdd, onRemove }) {
  const photoRef = useRef(null);
  const fileRef = useRef(null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => photoRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1 p-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
        >
          <Camera className="w-5 h-5" />
          <span className="text-sm font-medium">Take photo</span>
          <span className="text-xs opacity-80">BOL / receipt / gate pass</span>
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1 p-4 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition"
        >
          <Upload className="w-5 h-5" />
          <span className="text-sm font-medium">Upload file</span>
          <span className="text-xs opacity-70">PDF or image</span>
        </button>
      </div>

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onAdd(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onAdd(Array.from(e.target.files));
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs"
            >
              <FileText className="w-3 h-3 text-muted-foreground" />
              {f.name.length > 22 ? f.name.slice(0, 19) + "…" : f.name}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}