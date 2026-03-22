import { Module } from "../lib/plugins.js";
import TextStyles from "../lib/textfonts.js";

const ts = new TextStyles();

// ─────────────────────────────────────────────
//  STYLE REGISTRY
// ─────────────────────────────────────────────
const STYLES = [
  { id: "1",  name: "𝗕𝗼𝗹𝗱",            emoji: "𝗔",  fn: (t) => ts.toBold(t) },
  { id: "2",  name: "𝘐𝘵𝘢𝘭𝘪𝘤",           emoji: "𝘈",  fn: (t) => ts.toItalic(t) },
  { id: "3",  name: "𝙱𝚘𝚕𝚍 𝙸𝚝𝚊𝚕𝚒𝚌",     emoji: "𝘼",  fn: (t) => ts.toBoldItalic(t) },
  { id: "4",  name: "𝚖𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎",       emoji: "𝙰",  fn: (t) => ts.toMonospace(t) },
  { id: "5",  name: "𝒮𝒸𝓇𝒾𝓅𝓉",          emoji: "𝒜",  fn: (t) => ts.toScript(t) },
  { id: "6",  name: "𝔉𝔯𝔞𝔨𝔱𝔲𝔯",         emoji: "𝔄",  fn: (t) => ts.toFraktur(t) },
  { id: "7",  name: "𝔻𝕠𝕦𝕓𝕝𝕖 𝕊𝕥𝕣𝕦𝕔𝕜", emoji: "𝔸",  fn: (t) => ts.toDoubleStruck(t) },
  { id: "8",  name: "Ⓒⓘⓡⓒⓛⓔⓓ",       emoji: "Ⓐ",  fn: (t) => ts.toCircled(t) },
  { id: "9",  name: "🅂🅀🅄🄰🅁🄴🄳",     emoji: "🄰",  fn: (t) => ts.toSquared(t) },
  { id: "10", name: "🅽🅴🅶 🆂🆀🆄🅰🆁🅴", emoji: "🅰",  fn: (t) => ts.toNegativeSquared(t) },
  { id: "11", name: "ꜱᴍᴀʟʟ ᴄᴀᴘꜱ",       emoji: "ᴀ",  fn: (t) => ts.toSmallCaps(t) },
  { id: "12", name: "Ａｅｓｔｈｅｔｉｃ",    emoji: "Ａ",  fn: (t) => ts.toFullwidth(t) },
  { id: "13", name: "αєѕтнєтιc",          emoji: "α",  fn: (t) => ts.toAesthetic(t) },
  { id: "14", name: "C̲u̲r̲s̲i̲v̲e̲",          emoji: "C̲",  fn: (t) => ts.toCursive(t) },
];

// ─────────────────────────────────────────────
//  HELP MESSAGE (no text given)
// ─────────────────────────────────────────────
function buildHelp(prefix) {
  const lines = STYLES.map(
    (s) => `  *${s.id.padStart(2, " ")}*  ${s.emoji}  ${s.name}`
  ).join("\n");
  return (
    `✨ *FANCY TEXT STYLES*\n\n` +
    `Usage:\n` +
    `• ${prefix}fancy <text>     → all styles\n` +
    `• ${prefix}fancy <id> <text> → specific style\n\n` +
    `*Available styles:*\n${lines}\n\n` +
    `> © Made by Incognu Boy`
  );
}

// ─────────────────────────────────────────────
//  ALL STYLES MESSAGE
// ─────────────────────────────────────────────
function buildAllStyles(text) {
  const results = STYLES.map(
    (s) => `*[${s.id}]* ${s.name}\n${s.fn(text)}`
  ).join("\n\n");
  return (
    `✨ *FANCY TEXT — "${text}"*\n\n` +
    `${results}\n\n` +
    `> © Made by Incognu Boy`
  );
}

// ─────────────────────────────────────────────
//  SINGLE STYLE MESSAGE
// ─────────────────────────────────────────────
function buildSingleStyle(style, text) {
  return (
    `✨ *FANCY TEXT — Style ${style.name}*\n\n` +
    `📝 Original: ${text}\n` +
    `✅ Result: ${style.fn(text)}\n\n` +
    `> © Made by Incognu Boy`
  );
}

// ─────────────────────────────────────────────
//  MODULE
// ─────────────────────────────────────────────
Module({
  command: ["fancy", "font", "style"],
  package: "tools",
  description:
    "Convert text to fancy styles.\nEx: .fancy hello  |  .fancy 5 hello",
})(async (message, match) => {
  const prefix = message.prefix || ".";
  const raw    = (match || "").trim();

  // No argument → help
  if (!raw) {
    await message.react("✨");
    return message.send(buildHelp(prefix));
  }

  // Check if first token is a style ID
  const parts    = raw.split(/\s+/);
  const styleId  = parts[0];
  const styleObj = STYLES.find((s) => s.id === styleId);

  if (styleObj) {
    // .fancy <id> <text>
    const text = parts.slice(1).join(" ").trim();
    if (!text) {
      return message.send(
        `❌ No text provided!\nEx: ${prefix}fancy ${styleId} your text here`
      );
    }
    await message.react("✨");
    return message.send(buildSingleStyle(styleObj, text));
  }

  // .fancy <text> → all styles
  await message.react("✨");
  return message.send(buildAllStyles(raw));
});
