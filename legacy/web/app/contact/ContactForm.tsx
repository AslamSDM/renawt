"use client";

import { useState } from "react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
    const href = `mailto:support@remawt.com?subject=${encodeURIComponent(
      subject || "Contact from remawt.com",
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  const field =
    "w-full border border-rule bg-transparent px-4 py-3 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-ink";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mono-tick mb-2 block">
            NAME
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="email" className="mono-tick mb-2 block">
            EMAIL
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={field}
          />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="mono-tick mb-2 block">
          SUBJECT
        </label>
        <input
          id="subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What's this about?"
          className={field}
        />
      </div>

      <div>
        <label htmlFor="message" className="mono-tick mb-2 block">
          MESSAGE
        </label>
        <textarea
          id="message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
          className={`${field} resize-y`}
        />
      </div>

      <button type="submit" className="btn-accent">
        Send message
      </button>
    </form>
  );
}
