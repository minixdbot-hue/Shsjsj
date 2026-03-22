import { Module } from "../lib/plugins.js";
import config from "../config.js";

Module({
  command: "gstatus",
  aliases: ["groupstatus", "gs"],
  description: "Post group status with text / image / video / audio",
})(async (message, match) => {
  const { client, m, IsGroup, isBotAdmin } = message;

  const formatMsg = (text) =>
    `❥┈┈┈┈┈┈┈┈┈┈➤\n${text}\n❥┈┈┈┈┈┈┈┈┈┈➤`;

  try {
    // 🔹 Load config (CLEAN)
    const botname = config?.botname || "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳";

    // 🔒 Checks
    if (!IsGroup)
      return message.send(formatMsg("This command works only in groups."));

    if (!isBotAdmin)
      return message.send(
        formatMsg("I need *admin* permission to post group status.")
      );

    // 🔹 Quoted / mime
    const quoted = m.quoted ? m.quoted : m;
    const mime = (quoted.msg || quoted).mimetype || "";

    // 🔹 Caption (play command style → match)
    const caption = match?.trim() || "";

    if (!/image|video|audio/.test(mime) && !caption) {
      return message.send(
        formatMsg(
          `Reply to image / video / audio OR send text\n\nExample:\n.gstatus Hello everyone`
        )
      );
    }

    const defaultCaption = `Group status posted by ${botname} ✅`;

    // 🖼 IMAGE
    if (/image/.test(mime)) {
      const buffer = await client.downloadMediaMessage(quoted);
      await client.sendMessage(m.chat, {
        groupStatusMessage: {
          image: buffer,
          caption: caption || defaultCaption,
        },
      });
      return message.send(formatMsg("Image status posted ✅"));
    }

    // 🎥 VIDEO
    if (/video/.test(mime)) {
      const buffer = await client.downloadMediaMessage(quoted);
      await client.sendMessage(m.chat, {
        groupStatusMessage: {
          video: buffer,
          caption: caption || defaultCaption,
        },
      });
      return message.send(formatMsg("Video status posted ✅"));
    }

    // 🎵 AUDIO
    if (/audio/.test(mime)) {
      const buffer = await client.downloadMediaMessage(quoted);
      await client.sendMessage(m.chat, {
        groupStatusMessage: {
          audio: buffer,
          mimetype: "audio/mp4",
        },
      });
      return message.send(formatMsg("Audio status posted ✅"));
    }

    // 📝 TEXT
    if (caption) {
      await client.sendMessage(m.chat, {
        groupStatusMessage: {
          text: caption,
        },
      });
      return message.send(formatMsg("Text status posted ✅"));
    }
  } catch (err) {
    console.error("[GSTATUS ERROR]", err);
    return message.send(
      formatMsg(`Failed to post status:\n${err.message}`)
    );
  }
});
