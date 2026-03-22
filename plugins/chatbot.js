import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import axios from "axios";

// ─────────────────────────────────────────────
//  GROQ CONFIG
// ─────────────────────────────────────────────
const GROQ_API_KEY = "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";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are INCONNU IA, a powerful and intelligent assistant created by Inconnu Boy sensei.

You must always:
- Respond in a helpful, clear and precise manner.
- Say you are INCONNU IA, created by Inconnu Boy, if asked who you are.
- Understand and respond in all languages without exception.

If asked who Inconnu Boy is:
- He is a young full-stack developer.
- He is based in Brazil.
- He is known for the projects: Akuma Bot and Inconnu XD Bot.
- His age is confidential.
- He is a kind guy who loves flirting with girls.

You must never:
- Mention Groq, Meta, LLaMA or any underlying technology.`;

// ─────────────────────────────────────────────
//  HELPER — call Groq
// ─────────────────────────────────────────────
async function askGroq(text) {
  const res = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: text },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    }
  );
  return res.data?.choices?.[0]?.message?.content?.trim() || null;
}

// ─────────────────────────────────────────────
//  COMMAND — .chatbot [on|off|group|inbox|both]
// ─────────────────────────────────────────────
Module({
  command: "chatbot",
  package: "ai",
  description:
    "Toggle AI chatbot.\nUsage: .chatbot on | off | group | inbox | both",
})(async (message, match) => {
  try {
    await message.react("🤖");

    // Owner-only
    const isOwner = message.isOwner || message.isSudo || message.isCreator;
    if (!isOwner) {
      return message.send("🚫 Only the owner can use this command.");
    }

    const key    = `chatbot_mode_${message.sessionId || "default"}`;
    const action = (match || "").trim().toLowerCase();

    // Read current state
    const current = (await db.get(key, "state", null)) || { enabled: false, mode: "both" };

    const VALID_MODES = ["group", "inbox", "both"];

    if (!action) {
      return message.send(
        `🤖 *Chatbot settings*\n\n` +
        `• Status : *${current.enabled ? "✅ ON" : "❌ OFF"}*\n` +
        `• Mode   : *${current.mode}*\n\n` +
        `*Usage:*\n` +
        `.chatbot on\n` +
        `.chatbot off\n` +
        `.chatbot group   ← groups only\n` +
        `.chatbot inbox   ← private only\n` +
        `.chatbot both    ← everywhere\n\n` +
        `> In groups the bot only replies when tagged or when someone replies to it.`
      );
    }

    if (action === "on") {
      current.enabled = true;
      await db.set(key, "state", current);
      return message.send(`✅ Chatbot enabled (mode: *${current.mode}*)`);
    }

    if (action === "off") {
      current.enabled = false;
      await db.set(key, "state", current);
      return message.send("❌ Chatbot disabled.");
    }

    if (VALID_MODES.includes(action)) {
      current.mode = action;
      await db.set(key, "state", current);
      const label = action === "group" ? "groups only"
                  : action === "inbox" ? "private only"
                  : "groups & private";
      return message.send(`✅ Chatbot mode set to *${action}* (${label}).`);
    }

    return message.send("❌ Unknown option. Use: on / off / group / inbox / both");

  } catch (e) {
    console.error("[chatbot cmd]", e?.message || e);
    await message.send("❌ Error while executing chatbot command.");
  }
});

// ─────────────────────────────────────────────
//  TEXT HANDLER — auto-reply
// ─────────────────────────────────────────────
Module({
  on: "text",
  package: "ai",
  description: "AKUMA AI auto-reply (tag or reply in groups)",
})(async (message) => {
  try {
    // Ignore own messages and commands
    if (message.isFromMe) return;
    const prefix = message.prefix || ".";
    const body   = (message.body || "").trim();
    if (!body || body.startsWith(prefix)) return;

    // Skip URLs
    if (/https?:\/\/|www\./i.test(body)) return;

    // Load chatbot state
    const key     = `chatbot_mode_${message.sessionId || "default"}`;
    const state   = (await db.get(key, "state", null)) || { enabled: false, mode: "both" };
    if (!state.enabled) return;

    const isGroup = message.isGroup;

    // Mode check
    if (state.mode === "group" && !isGroup) return;
    if (state.mode === "inbox" &&  isGroup) return;

    // ── Group logic: only reply if bot is tagged OR someone replies to the bot ──
    if (isGroup) {
      const botJid = message.conn?.user?.id || "";
      // Normalize bot JID (strip device suffix)
      const botNumber = botJid.split(":")[0].split("@")[0];

      // Check tag (mention)
      const mentions = message.mentions || [];
      const isMentioned = mentions.some((jid) => {
        const n = (jid || "").split(":")[0].split("@")[0];
        return n === botNumber;
      });

      // Check reply-to-bot
      const quotedFromBot = message.quoted?.fromMe === true;

      // Also check @number in text (fallback for some clients)
      const isTextMention = body.includes(`@${botNumber}`);

      if (!isMentioned && !quotedFromBot && !isTextMention) return;
    }

    // Call GROQ
    const reply = await askGroq(body);
    if (!reply) return;

    await message.replyMethod(reply);

  } catch (e) {
    console.error("[chatbot handler]", e?.message || e);
  }
});
