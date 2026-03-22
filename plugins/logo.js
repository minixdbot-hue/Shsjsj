// plugins/logo.js
import axios from "axios";
import * as cheerio from "cheerio";
import { Module } from "../lib/plugins.js";

// ─────────────────────────────────────────────
//  ephoto360 scraper (replaces mumaker)
// ─────────────────────────────────────────────
async function ephoto(url, text) {
  const { data: html } = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 15000,
  });
  const $ = cheerio.load(html);

  // Find the form and build POST body
  const formData = new URLSearchParams();
  $("form input, form textarea").each((_, el) => {
    const name = $(el).attr("name");
    const val = $(el).attr("value") || "";
    if (!name) return;
    if ($(el).attr("type") === "submit") return;
    // Replace text fields with user input
    if ($(el).attr("type") === "text" || el.tagName === "textarea") {
      formData.append(name, text);
    } else {
      formData.append(name, val);
    }
  });

  const action = $("form").attr("action") || url;
  const { data: result } = await axios.post(action, formData.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
      Referer: url,
    },
    timeout: 30000,
  });

  const $r = cheerio.load(result);
  // Try common selectors for the output image
  const imgSrc =
    $r(".image-result img").attr("src") ||
    $r("#result img").attr("src") ||
    $r("img.output").attr("src") ||
    $r(".result img").attr("src");

  if (!imgSrc) throw new Error("Image not found in ephoto360 response");
  return { image: imgSrc };
}

// ─────────────────────────────────────────────
//  Helper générique pour tous les logos
// ─────────────────────────────────────────────
function createLogoModule({ command, emoji, label, url }) {
  Module({
    command,
    package: "logo",
    description: `Generate ${label} logo using ephoto360`,
  })(async (message, match) => {
    if (!match) {
      return await message.send(
        `*${emoji} ${label.toUpperCase()} LOGO*\n\nPlease provide text\nExample: *.${Array.isArray(command) ? command[0] : command} YourText*`
      );
    }

    try {
      await message.react("⏳");

      const result = await ephoto(url, match.trim());

      await message.send({
        image: { url: result.image },
        caption: `*${emoji} ${label.toUpperCase()} LOGO*\n\n✨ *Text:* ${match.trim()}\n\n> © Mᴀᴅᴇ ʙʏ Iɴᴄᴏɴɴᴜ Bᴏʏ`,
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
      console.error(`[${label.toUpperCase()} LOGO ERROR]`, error);
      await message.react("❌");
      await message.send(`*❌ ERROR*\nFailed to generate ${label} logo`);
    }
  });
}

// ─────────────────────────────────────────────
//  🎮 ANIME & GAME LOGOS
// ─────────────────────────────────────────────
createLogoModule({
  command: "dragonball",
  emoji: "🐉",
  label: "Dragon Ball",
  url: "https://en.ephoto360.com/create-dragon-ball-style-text-effects-online-809.html",
});

createLogoModule({
  command: "naruto",
  emoji: "🌀",
  label: "Naruto",
  url: "https://en.ephoto360.com/naruto-shippuden-logo-style-text-effect-online-808.html",
});

createLogoModule({
  command: "arena",
  emoji: "⚔️",
  label: "Arena",
  url: "https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html",
});

// ─────────────────────────────────────────────
//  💻 MODERN & TECH LOGOS
// ─────────────────────────────────────────────
createLogoModule({
  command: "hacker",
  emoji: "💻",
  label: "Hacker",
  url: "https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html",
});

createLogoModule({
  command: "mechanical",
  emoji: "⚙️",
  label: "Mechanical",
  url: "https://en.ephoto360.com/create-your-name-in-a-mechanical-style-306.html",
});

createLogoModule({
  command: "incandescent",
  emoji: "💡",
  label: "Incandescent",
  url: "https://en.ephoto360.com/text-effects-incandescent-bulbs-219.html",
});

createLogoModule({
  command: "gold",
  emoji: "🏆",
  label: "Gold",
  url: "https://en.ephoto360.com/modern-gold-4-213.html",
});

// ─────────────────────────────────────────────
//  🌈 NATURE & EFFECT LOGOS
// ─────────────────────────────────────────────
createLogoModule({
  command: "sand",
  emoji: "🏖️",
  label: "Sand",
  url: "https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html",
});

createLogoModule({
  command: "sunset",
  emoji: "🌅",
  label: "Sunset",
  url: "https://en.ephoto360.com/create-sunset-light-text-effects-online-807.html",
});

createLogoModule({
  command: "water",
  emoji: "💧",
  label: "Water",
  url: "https://en.ephoto360.com/create-water-effect-text-online-295.html",
});

createLogoModule({
  command: "rain",
  emoji: "🌧️",
  label: "Rain",
  url: "https://en.ephoto360.com/foggy-rainy-text-effect-75.html",
});

// ─────────────────────────────────────────────
//  🎨 ART & CREATIVE LOGOS
// ─────────────────────────────────────────────
createLogoModule({
  command: "chocolate",
  emoji: "🍫",
  label: "Chocolate",
  url: "https://en.ephoto360.com/chocolate-text-effect-353.html",
});

createLogoModule({
  command: "graffiti",
  emoji: "🎨",
  label: "Graffiti",
  url: "https://en.ephoto360.com/create-a-cartoon-style-graffiti-text-effect-online-668.html",
});

createLogoModule({
  command: "boom",
  emoji: "💥",
  label: "Boom",
  url: "https://en.ephoto360.com/boom-text-comic-style-text-effect-675.html",
});

createLogoModule({
  command: "purple",
  emoji: "🟣",
  label: "Purple",
  url: "https://en.ephoto360.com/purple-text-effect-online-100.html",
});

// ─────────────────────────────────────────────
//  📝 TEXT & TYPOGRAPHY LOGOS
// ─────────────────────────────────────────────
createLogoModule({
  command: "cloth",
  emoji: "👕",
  label: "Cloth",
  url: "https://en.ephoto360.com/text-on-cloth-effect-62.html",
});

createLogoModule({
  command: "1917",
  emoji: "🎬",
  label: "1917",
  url: "https://en.ephoto360.com/1917-style-text-effect-523.html",
});

createLogoModule({
  command: "child",
  emoji: "👶",
  label: "Child",
  url: "https://en.ephoto360.com/write-text-on-wet-glass-online-589.html",
});

createLogoModule({
  command: "typo",
  emoji: "📝",
  label: "Typo",
  url: "https://en.ephoto360.com/typography-text-effect-on-pavement-online-774.html",
});
