---
title: Messaging & Chat UI
impact: MEDIUM
impactDescription: creates realistic chat interface animations
tags: messaging, chat, whatsapp, bubbles, conversations
---

## Chat Bubble Stagger

Animate chat bubbles appearing sequentially.

```tsx
const MESSAGES = [
  { text: "Hey!", side: "left", delay: 0 },
  { text: "What's up?", side: "left", delay: 30 },
  { text: "Not much!", side: "right", delay: 60 },
];

MESSAGES.map((msg, i) => {
  const progress = spring({
    frame: frame - msg.delay,
    fps,
    config: { damping: 15 },
  });

  return (
    <div style={{
      opacity: progress,
      transform: `translateY(${(1 - progress) * 20}px)`,
      alignSelf: msg.side === "right" ? "flex-end" : "flex-start",
      backgroundColor: msg.side === "right" ? "#dcf8c6" : "#fff",
      padding: "12px 16px",
      borderRadius: msg.side === "right" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
    }}>
      {msg.text}
    </div>
  );
});
```

## Typing Indicator

Show animated typing dots.

```tsx
const TypingIndicator = () => {
  return (
    <div style={{ display: "flex", gap: 4, padding: "12px 16px" }}>
      {[0, 1, 2].map((i) => {
        const y = Math.sin((frame + i * 10) * 0.2) * 3;
        return (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: "#999",
              transform: `translateY(${y}px)`,
            }}
          />
        );
      })}
    </div>
  );
};
```

## WhatsApp-style Colors

Use familiar messaging app colors.

```tsx
const CHAT_COLORS = {
  sent: "#dcf8c6",      // WhatsApp green
  received: "#ffffff",   // White
  background: "#e5ddd5", // Beige chat background
};
```
