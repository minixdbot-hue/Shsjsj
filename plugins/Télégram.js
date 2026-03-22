// plugins/telegram.js
import { Module } from "../lib/plugins.js";
import axios from "axios";

// ─────────────────────────────────────────────
//  CONFIG — replace with your Telegram Bot token
// ─────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8628995376:AAEfaPuN7cWZPXZh3jDfNgpLgS3R6t1lbCc";
const TG_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const TG_FILE = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}`;

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

/**
 * Get information about a Telegram sticker pack.
 * @param {string} packName  e.g. "Animals" or link https://t.me/addstickers/Animals
 */
async function getStickerSet(packName) {
  const name = packName
    .replace(/https?:\/\/t\.me\/addstickers\//i, "")
    .trim();

  const res = await axios.get(`${TG_API}/getStickerSet`, {
    params: { name },
    timeout: 15000,
  });

  if (!res.data.ok) {
    throw new Error(res.data.description || "Pack not found");
  }
  return res.data.result;
}

/**
 * Download a Telegram file using its file_id.
 * @returns {Buffer}
 */
async function downloadTgFile(fileId) {
  // 1 – get file path
  const pathRes = await axios.get(`${TG_API}/getFile`, {
    params: { file_id: fileId },
    timeout: 10000,
  });
  if (!pathRes.data.ok) throw new Error("Unable to retrieve file");

  const filePath = pathRes.data.result.file_path;

  // 2 – download content
  const fileRes = await axios.get(`${TG_FILE}/${filePath}`, {
    responseType: "arraybuffer",
    timeout: 30000,
  });
  return Buffer.from(fileRes.data);
}

// ─────────────────────────────────────────────
//  CMD : .tgsticker <packName> [index]
//  Downloads ONE sticker from the pack (first by default,
//  or the one indicated by 1‑based index).
// ─────────────────────────────────────────────
Module({
  command: ["tgsticker", "tgstick", "telegram"],
  package: "tools",
  description:
    "Download a Telegram sticker.\n" +
    "Ex: .tgsticker Animals\n" +
    "    .tgsticker Animals 3\n" +
    "    .tgsticker https://t.me/addstickers/Animals",
})(async (message, match) => {
  const raw = (match || "").trim();
  if (!raw) {
    return message.send(
      `❌ Provide a pack name!\n\n` +
      `*Usage:*\n` +
      `• .tgsticker Animals\n` +
      `• .tgsticker Animals 3\n` +
      `• .tgsticker https://t.me/addstickers/Animals\n\n` +
      `> © Made by Incognu Boy`
    );
  }

  // Split "packName [index]"
  const parts    = raw.split(/\s+/);
  const packArg  = parts[0];
  const indexArg = parseInt(parts[1]) || 1;

  await message.react("⏳");

  let stickerSet;
  try {
    stickerSet = await getStickerSet(packArg);
  } catch (e) {
    await message.react("❌");
    return message.send(
      `❌ Telegram pack not found: *${packArg}*\n` +
      `Check the pack name (e.g. .tgsticker Animals)`
    );
  }

  const stickers = stickerSet.stickers;
  const total    = stickers.length;
  const idx      = Math.min(Math.max(indexArg, 1), total) - 1;
  const sticker  = stickers[idx];

  // Info
  const packTitle  = stickerSet.title;
  const packName   = stickerSet.name;
  const isAnimated = stickerSet.is_animated;
  const isVideo    = stickerSet.is_video;
  const emoji      = sticker.emoji || "🎭";

  let buffer;
  try {
    buffer = await downloadTgFile(sticker.file_id);
  } catch (e) {
    await message.react("❌");
    return message.send(`❌ Download error: ${e.message}`);
  }

  await message.react("✅");

  // Send sticker as document (webp or tgs)
  const ext = isAnimated ? "tgs" : isVideo ? "webm" : "webp";
  const fileName = `${packName}_${idx + 1}.${ext}`;

  await message.send(
    `📦 *Pack:* ${packTitle}\n` +
    `🔢 *Sticker:* ${idx + 1} / ${total}\n` +
    `${emoji} *Emoji:* ${emoji}\n` +
    `🎞️ *Type:* ${isVideo ? "Video" : isAnimated ? "Animated" : "Static"}\n\n` +
    `> © Made by Incognu Boy`
  );

  // Send raw sticker file
  await message.send({ document: buffer, mimetype: "image/webp", fileName });
});

// ─────────────────────────────────────────────
//  CMD : .tgpack <packName>
//  Downloads ALL stickers from the pack (max 30)
// ─────────────────────────────────────────────
Module({
  command: ["tgpack", "tgspack"],
  package: "tools",
  description:
    "Download all stickers from a Telegram pack (max 30).\n" +
    "Ex: .tgpack Animals",
})(async (message, match) => {
  const packArg = (match || "").trim();
  if (!packArg) {
    return message.send(
      `❌ Provide a pack name!\nEx: .tgpack Animals\n\n` +
      `> © Made by Incognu Boy`
    );
  }

  await message.react("⏳");

  let stickerSet;
  try {
    stickerSet = await getStickerSet(packArg);
  } catch (e) {
    await message.react("❌");
    return message.send(`❌ Pack not found: *${packArg}*`);
  }

  const stickers   = stickerSet.stickers.slice(0, 30);
  const total      = stickerSet.stickers.length;
  const packTitle  = stickerSet.title;
  const packName   = stickerSet.name;
  const isAnimated = stickerSet.is_animated;
  const isVideo    = stickerSet.is_video;
  const ext        = isVideo ? "webm" : isAnimated ? "tgs" : "webp";

  await message.send(
    `📦 *Pack:* ${packTitle}\n` +
    `🔢 *Total:* ${total} stickers${total > 30 ? " (max 30 sent)" : ""}\n` +
    `🎞️ *Type:* ${isVideo ? "Video" : isAnimated ? "Animated" : "Static"}\n\n` +
    `⬇️ Downloading…\n\n` +
    `> © Made by Incognu Boy`
  );

  let sent = 0;
  for (const [i, sticker] of stickers.entries()) {
    try {
      const buffer = await downloadTgFile(sticker.file_id);
      await message.send({
        document: buffer,
        mimetype: "image/webp",
        fileName: `${packName}_${i + 1}.${ext}`,
      });
      sent++;
      // Small delay to avoid flood
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      console.error(`[telegram] sticker ${i + 1} error:`, e?.message);
    }
  }

  await message.react("✅");
  await message.send(
    `✅ *${sent}/${stickers.length} stickers sent* from pack *${packTitle}*\n\n` +
    `> © Made by Incognu Boy`
  );
});
