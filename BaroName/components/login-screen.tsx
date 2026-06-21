"use client";

import { FormEvent, useState } from "react";

export function LoginScreen() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    if (response.ok) {
      window.location.reload();
      return;
    }

    const data = (await response.json().catch(() => ({}))) as { message?: string };
    setMessage(data.message || "Could not unlock BaroName.");
    setLoading(false);
  }

  return (
    <main className="lock-screen">
      <section className="lock-card" aria-labelledby="lock-title">
        <div className="brand-mark">B</div>
        <p className="eyebrow">Private naming workspace</p>
        <h1 id="lock-title">BaroName</h1>
        <p className="lock-copy">
          A global-first AI naming studio for your private projects.
        </p>
        <form onSubmit={unlock} className="lock-form">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter workspace password"
            autoFocus
          />
          <button type="submit" disabled={!password || loading}>
            {loading ? "Unlocking..." : "Unlock workspace"}
          </button>
        </form>
        {message ? <p className="error-text">{message}</p> : null}
        <p className="fine-print">
          Your Gemini API key is used only on the server and is never shown in the browser.
        </p>
      </section>
    </main>
  );
}
