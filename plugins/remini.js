// plugins/remini.js
import axios from "axios";
import FormData from "form-data";
import { Module } from "../lib/plugins.js";

Module({
  command: ["remini", "enhance", "hd", "upscale"],
  package: "tools",
  description: "Enhance image quality using AI upscaling",
})(async (message, match) => {
  try {
    // 1️⃣ Vérifier qu'une image est citée
    const quoted = message.quoted || message;
    const mimeType = quoted?.mimetype || quoted?.msg?.mimetype || "";

    if (!mimeType.startsWith("image/")) {
      return await message.send(
        "📸 ᴘʟᴇᴀsᴇ ʀᴇᴘʟʏ ᴛᴏ ᴀɴ *ɪᴍᴀɢᴇ* (ᴊᴘᴇɢ/ᴘɴɢ)."
      );
    }

    // 2️⃣ Vérifier le format
    const extension = mimeType.includes("jpeg")
      ? ".jpg"
      : mimeType.includes("png")
      ? ".png"
      : null;

    if (!extension) {
      return await message.send(
        "❌ ᴜɴsᴜᴘᴘᴏʀᴛᴇᴅ ғᴏʀᴍᴀᴛ. ᴜsᴇ ᴊᴘᴇɢ/ᴘɴɢ ᴏɴʟʏ."
      );
    }

    // 3️⃣ Télécharger l'image
    const mediaBuffer = await quoted.download?.();
    if (!mediaBuffer) {
      return await message.send("❌ Failed to download image.");
    }

    await message.react("⏳");
    await message.send(
      "🔄 ᴇɴʜᴀɴᴄɪɴɢ ɪᴍᴀɢᴇ ǫᴜᴀʟɪᴛʏ... ᴘʟᴇᴀsᴇ ᴡᴀɪᴛ ⏳"
    );

    // 4️⃣ Upload vers Catbox
    const form = new FormData();
    form.append("fileToUpload", mediaBuffer, {
      filename: `image${extension}`,
      contentType: mimeType,
    });
    form.append("reqtype", "fileupload");

    const { data: imageUrl } = await axios.post(
      "https://catbox.moe/user/api.php",
      form,
      {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        timeout: 30000,
      }
    );

    if (!imageUrl || !imageUrl.startsWith("http")) {
      return await message.send("❌ Failed to upload image to server.");
    }

    // 5️⃣ Appel API d'amélioration
    const { data: enhanced } = await axios.get(
      `https://www.veloria.my.id/imagecreator/upscale?url=${encodeURIComponent(imageUrl)}`,
      {
        responseType: "arraybuffer",
        timeout: 60000,
      }
    );

    if (!enhanced || enhanced.length < 200) {
      return await message.send("❌ API returned invalid image data.");
    }

    // 6️⃣ Envoyer l'image améliorée
    const caption = `*✅ ɪᴍᴀɢᴇ ᴇɴʜᴀɴᴄᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ!*\n> © Mᴀᴅᴇ ʙʏ Iɴᴄᴏɴɴᴜ Bᴏʏ`;

    await message.send({
      image: Buffer.from(enhanced),
      caption: caption,
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363403408693274@newsletter",
          newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
          serverMessageId: 6,
        },
      },
    });

    await message.react("✅");

  } catch (error) {
    console.error("[REMINI ERROR]", error);
    await message.react("❌");
    await message.send(
      `❌ Error: ${error.message || "Enhancement failed. Try again later."}`
    );
  }
});
