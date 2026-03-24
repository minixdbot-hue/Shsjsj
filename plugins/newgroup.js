import { Module } from "../lib/plugins.js";
import config from "../config.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function isOwner(senderJid) {
  const ownerRaw = (config.owner || "").replace(/[^0-9]/g, "");
  const sudoRaw  = (config.sudo  || "").replace(/[^0-9]/g, "");
  if (!ownerRaw && !sudoRaw) return false;
  // strip device suffix :XX before comparing
  const senderNum = (senderJid || "").split(":")[0].split("@")[0].replace(/[^0-9]/g, "");
  return (ownerRaw && senderNum === ownerRaw) || (sudoRaw && senderNum === sudoRaw);
}

// ─── COMMAND ─────────────────────────────────────────────────────────────────

Module({
  command: "newgroup",
  package: "owner",
  description: "Create a new WhatsApp group (owner only)",
  usage: ".newgroup <group name>",
})(async (message, match) => {
  try {
    const senderJid = jidNormalizedUser(message.sender || message.from || "");

    // Owner-only
    if (!isOwner(senderJid) && !message.isFromMe) {
      return message.conn.sendMessage(
        message.from,
        {
          text: "⛔ Only the bot owner can create groups.",
          contextInfo: contextInfo(),
        },
        { quoted: message.raw }
      );
    }

    const groupName = (match || "").trim();
    if (!groupName) {
      return message.conn.sendMessage(
        message.from,
        {
          text: "❌ Please provide a group name.\n\nUsage: .newgroup <name>\nExample: .newgroup My Awesome Group",
          contextInfo: contextInfo(),
        },
        { quoted: message.raw }
      );
    }

    await message.react("⏳");

    // Build participants list: bot itself + owner
    const botJid = jidNormalizedUser(message.conn.user.id);
    const ownerRaw = (config.owner || "").replace(/[^0-9]/g, "");
    const participants = [];
    if (ownerRaw) {
      const ownerJid = jidNormalizedUser(`${ownerRaw}@s.whatsapp.net`);
      if (ownerJid !== botJid) participants.push(ownerJid);
    }

    // groupCreate(subject, participants)
    const result = await message.conn.groupCreate(groupName, participants);

    const newGroupJid = result?.id || result?.gid || null;

    await message.react("✅");

    let successText =
      `✅ *Group Created Successfully!*\n\n` +
      `📛 Name: *${groupName}*`;

    if (newGroupJid) {
      try {
        // Try to get invite link
        const inviteCode = await message.conn.groupInviteCode(newGroupJid);
        if (inviteCode) {
          successText += `\n🔗 Invite: https://chat.whatsapp.com/${inviteCode}`;
        }
      } catch (_) {
        // Invite link optional — don't fail if not available
      }
      successText += `\n🆔 JID: ${newGroupJid}`;
    }

    await message.conn.sendMessage(
      message.from,
      { text: successText, contextInfo: contextInfo() },
      { quoted: message.raw }
    );

  } catch (err) {
    console.error("[newgroup] error:", err?.message || err);
    await message.react("❌");
    await message.conn.sendMessage(
      message.from,
      {
        text: `❌ Failed to create group.\n\nError: ${err?.message || "Unknown error"}`,
        contextInfo: contextInfo(),
      },
      { quoted: message.raw }
    );
  }
});
