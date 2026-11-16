"use client";

import { useRef, useState } from "react";

/** Photo picker that shrinks phone photos (often 5+ MB) to a ~1600px JPEG before upload. */
export default function PhotoInput({ id, current }: { id: string; current?: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.85));
      const small = new File([blob], "photo.jpg", { type: "image/jpeg" });
      const dt = new DataTransfer();
      dt.items.add(small);
      input.current!.files = dt.files;
      setPreview(URL.createObjectURL(small));
    } catch {
      // If the browser can't shrink it, the original file is sent as-is.
      setPreview(URL.createObjectURL(file));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor={id}>Photo</label>
      {preview && <img src={preview} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 14 }} />}
      <input ref={input} id={id} name="photo" type="file" accept="image/*" onChange={onChange} className="file" />
      {busy && <span className="allergens">Getting the photo ready…</span>}
    </div>
  );
}
