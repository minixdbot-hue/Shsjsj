import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import { downloadContentFromMessage, jidNormalizedUser } from "@whiskeysockets/baileys";
import { getTheme } from "../Themes/themes.js";

const theme = getTheme();

// ─── helpers ────────────────────────────────────────────────────────────────

function contextInfo() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363403408693274@newsletter",
      newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
      serverMessageId: 6,
    },
  };
}

function getBotNumber(conn) {
  return (conn?.user?.id && String(conn.user.id).split(":")[0]) || "bot";
}

function getKey(groupJid) {
  return `antivv:${groupJid}`;
}

async function isEnabled(groupJid, botNumber) {
  const val = await db.getAsync(botNumber, getKey(groupJid), false);
  return val === true || val === "true" || val === 1;
}

// ─── COMMAND: .antivv on/off ─────────────────────────────────────────────────

Module({
  command: "antivv",
  package: "group",
  description: "Auto-detect and forward view once messages in a group",
  usage: ".antivv on | off",
})(async (message, match) => {
  try {
    if (!message.isfromMe && !message.isAdmin) {
      return message.send("⛔ Only group admins can use this command.");
    }

    if (!message.isGroup) {
      return message.send("❌ This command can only be used inside a group.");
    }

    const groupJid = message.from;
    const botNumber = getBotNumber(message.conn);
    const raw = (match || "").trim().toLowerCase();

    // Status check (no arg)
    if (!raw) {
      const enabled = await isEnabled(groupJid, botNumber);
      return message.send(
        `👁️ *AntiVV Status*\n> Status: ${enabled ? "✅ ON" : "❌ OFF"}\n\nUse:\n• .antivv on\n• .antivv off`
      );
    }

    if (raw !== "on" && raw !== "off") {
      return message.send("❌ Invalid option.\nUsage: .antivv on | off");
    }

    const newValue = raw === "on";
    await db.set(botNumber, getKey(groupJid), newValue);
    await message.react("✅");
    await message.send(
      newValue
        ? "✅ *AntiVV is now ON*\nView once messages will be automatically captured and forwarded privately."
        : "❌ *AntiVV is now OFF*\nView once messages will no longer be intercepted."
    );
  } catch (err) {
    console.error("[antivv] command error:", err?.message || err);
    await message.react("❌");
    await message.send("❌ Failed to update AntiVV setting.");
  }
});

// ─── AUTO DETECTION: on every incoming message ───────────────────────────────

Module({ on: "text" })(async (message) => {
  try {
    // Only in groups
    if (!message.isGroup) return;
    // Ignore bot's own messages
    if (message.isfromMe) return;

    const groupJid = message.from;
    const botNumber = getBotNumber(message.conn);

    // Check if antivv is enabled for this group
    const enabled = await isEnabled(groupJid, botNumber);
    if (!enabled) return;

    // ── Detect view once in the raw message ──────────────────────────────────
    const rawMsg = message.raw?.message;
    if (!rawMsg) return;

    let content = null;
    let mediaType = null;

    // Direct view once on the message itself
    const msgKeys = Object.keys(rawMsg);
    for (const key of msgKeys) {
      if (rawMsg[key]?.viewOnce === true) {
        content = rawMsg[key];
        mediaType = key;
        break;
      }
    }

    // Wrapped view once (viewOnceMessageV2 / viewOnceMessage)
    if (!content) {
      const wrapper = rawMsg.viewOnceMessageV2 || rawMsg.viewOnceMessage;
      if (wrapper?.message) {
        const innerKey = Object.keys(wrapper.message)[0];
        if (innerKey) {
          content = wrapper.message[innerKey];
          mediaType = innerKey;
        }
      }
    }

    if (!content || !mediaType) return;

    // ── Download the media ────────────────────────────────────────────────────
    const mediaCategory = mediaType.replace("Message", "");
    let buffer;
    try {
      const stream = await downloadContentFromMessage(content, mediaCategory);
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      buffer = Buffer.concat(chunks);
    } catch (dlErr) {
      console.error("[antivv] download error:", dlErr?.message || dlErr);
      return;
    }

    // ── Send to bot's own DM (the owner/bot number) ───────────────────────────
    const senderJid = jidNormalizedUser(message.sender || "");
    const senderTag = senderJid ? `@${senderJid.split("@")[0]}` : "Someone";
    let groupName = groupJid;
    try {
      const meta = await message.conn.groupMetadata(groupJid);
      groupName = meta?.subject || groupJid;
    } catch (_) {}

    const caption =
      `👁️ *AntiVV — View Once Captured*\n` +
      `> Group: ${groupName}\n` +
      `> Sender: ${senderTag}`;

    const ctx = contextInfo();

    try {
      if (mediaType === "imageMessage") {
        await message.conn.sendMessage(
          message.conn.user.id,
          { image: buffer, caption, contextInfo: ctx },
        );
      } else if (mediaType === "videoMessage") {
        await message.conn.sendMessage(
          message.conn.user.id,
          { video: buffer, caption, mimetype: content.mimetype || "video/mp4", contextInfo: ctx },
        );
      } else if (mediaType === "audioMessage") {
        await message.conn.sendMessage(
          message.conn.user.id,
          { audio: buffer, mimetype: content.mimetype || "audio/mpeg", ptt: content.ptt || false, contextInfo: ctx },
        );
      }
    } catch (sendErr) {
      console.error("[antivv] send error:", sendErr?.message || sendErr);
    }

  } catch (err) {
    // Silent — don't crash the message handler
    console.error("[antivv] listener error:", err?.message || err);
  }
});
