"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function Importer({ kind, accept }: { kind: string; accept: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    const res = await fetch("/api/import", { method: "POST", body: fd });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) setMsg(j.error);
    else setMsg(`Imported ${j.report?.accepted ?? 0} of ${j.report?.rows ?? 0} rows.`);
    router.refresh();
  }

  return (
    <label className="btn sm" style={{ position: "relative" }}>
      {busy ? "Importing…" : "Replace file"}
      <input
        type="file"
        accept={accept}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {msg ? <span className="muted small" style={{ position: "absolute", top: 34, right: 0, whiteSpace: "nowrap" }}>{msg}</span> : null}
    </label>
  );
}

export function ResetDemo() {
  const router = useRouter();
  return (
    <button
      className="btn sm"
      onClick={async () => {
        if (!confirm("Replace all imported files with the synthetic demo data?")) return;
        await fetch("/api/reset", { method: "POST" });
        router.refresh();
      }}
    >
      Load demo data
    </button>
  );
}
