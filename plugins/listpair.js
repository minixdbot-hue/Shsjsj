import { Module } from "../lib/plugins.js";
import { manager } from "../lib/client.js";
import config from "../config.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

// ─── CTX ──────────────────────────────────────────────────────────────────────
const CTX = {
  forwardingScore: 999,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: "120363403408693274@newsletter",
    newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
    serverMessageId: 6,
  },
};

// ─── Owner check ──────────────────────────────────────────────────────────────
function isOwner(message) {
  try {
    const ownerRaw = (config.owner || "").replace(/[^0-9]/g, "");
    const sudoRaw  = (config.sudo  || "").replace(/[^0-9]/g, "");
    const sender   = (message.sender || message.from || "")
      .split("@")[0]
      .replace(/[^0-9]/g, "");
    return (
      (ownerRaw && sender === ownerRaw) ||
      (sudoRaw  && sender === sudoRaw)  ||
      message.isFromMe
    );
  } catch {
    return message.isFromMe;
  }
}

// ─── .lispair ─────────────────────────────────────────────────────────────────
Module({
  command: "active",
  package: "owner",
  description: "List all active bot sessions (owner only).",
})(async (message) => {
  try {
    // ── Owner guard ──────────────────────────────────────────────────────────
    if (!isOwner(message)) {
      return message.conn.sendMessage(
        message.from,
        {
          text:
            "🚫 *Access Denied*\n\n" +
            "This command is reserved for the bot owner.",
          contextInfo: CTX,
        },
        { quoted: message.raw }
      );
    }

    // ── Collect session data ─────────────────────────────────────────────────
    const sessions = [];

    // Method 1 — getAllConnections() if SessionManager exposes it
    if (typeof manager.getAllConnections === "function") {
      for (const { file_path, connection, healthy } of manager.getAllConnections()) {
        const user = connection?.user || null;
        sessions.push({
          id:        file_path,
          name:      user?.name || user?.verifiedName || "Unknown",
          number:    user?.id ? jidNormalizedUser(user.id).split("@")[0] : "—",
          connected: Boolean(healthy),
        });
      }
    }

    // Method 2 — iterate manager.sessions Map directly (universal fallback)
    if (sessions.length === 0 && manager.sessions?.size > 0) {
      for (const [sid, entry] of manager.sessions) {
        const user = entry?.sock?.user || entry?.connection?.user || null;
        const connected = Boolean(
          entry?.sock?.user || entry?.healthy || entry?.connected
        );
        sessions.push({
          id:        sid,
          name:      user?.name || user?.verifiedName || "Unknown",
          number:    user?.id ? jidNormalizedUser(user.id).split("@")[0] : "—",
          connected,
        });
      }
    }

    // ── Empty state ──────────────────────────────────────────────────────────
    if (sessions.length === 0) {
      return message.conn.sendMessage(
        message.from,
        {
          text:
            "🌙 *No Active Sessions Found*\n\n" +
            "No bots are currently registered or connected.",
          contextInfo: CTX,
        },
        { quoted: message.raw }
      );
    }

    // ── Build report ─────────────────────────────────────────────────────────
    const totalConnected    = sessions.filter((s) => s.connected).length;
    const totalDisconnected = sessions.length - totalConnected;

    let text =
      `🧩 *Active Sessions — Overview*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *Total sessions  :* ${sessions.length}\n` +
      `🟢 *Connected       :* ${totalConnected}\n` +
      `🔴 *Disconnected    :* ${totalDisconnected}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    sessions.forEach((s, i) => {
      const icon   = s.connected ? "🟢" : "🔴";
      const status = s.connected ? "Connected" : "Disconnected";
      text +=
        `*[${i + 1}] ${icon} ${s.name}*\n` +
        `📱 Number  : \`${s.number}\`\n` +
        `🆔 Session : \`${s.id}\`\n` +
        `💬 Status  : ${status}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    });

    text += `\n_🕐 ${new Date().toUTCString()}_`;

    return message.conn.sendMessage(
      message.from,
      { text, contextInfo: CTX },
      { quoted: message.raw }
    );
  } catch (err) {
    console.error("[lispair]", err);
    return message.conn.sendMessage(
      message.from,
      {
        text: `❌ Failed to retrieve sessions:\n${err?.message || err}`,
        contextInfo: CTX,
      },
      { quoted: message.raw }
    );
  }
});
