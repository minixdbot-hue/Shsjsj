import { Module } from "../lib/plugins.js";
import { db, manager } from "../lib/client.js";
import { getTheme } from "../Themes/themes.js";

const theme = getTheme();

// ─── DB namespace ─────────────────────────────────────────────────────────────
// All group schedules live under the "__schedules__" session namespace.
// Keys: "open:<groupJid>"  and  "close:<groupJid>"
// Values: { time: "HH:MM", sessionId: "..." }
const DB_SID = "__schedules__";

// ─── CTX (newsletter forward style) ──────────────────────────────────────────
const CTX = {
  forwardingScore: 999,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: "120363403408693274@newsletter",
    newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
    serverMessageId: 6,
  },
};

// ─── DB helpers ───────────────────────────────────────────────────────────────
function saveSchedule(type, jid, time, sessionId) {
  db.setHot(DB_SID, `${type}:${jid}`, { time, sessionId, jid, type });
}

function deleteSchedule(type, jid) {
  db.delHot(DB_SID, `${type}:${jid}`);
}

function getSchedule(type, jid) {
  return db.get(DB_SID, `${type}:${jid}`) || null;
}

// Iterate all schedule entries of a given type from DB cache + hotIndex
function getAllSchedules(type) {
  const results = [];
  const seen = new Set();

  // Primary: main cache
  try {
    const sessionMap = db.cache.get(DB_SID);
    if (sessionMap) {
      for (const [key, value] of sessionMap.entries()) {
        if (key.startsWith(`${type}:`) && value) {
          seen.add(key);
          results.push(value);
        }
      }
    }
  } catch {}

  // Fallback: hotIndex (in case cache not yet hydrated)
  try {
    const hot = db.hotIndex.get(DB_SID);
    if (hot) {
      for (const [key, value] of Object.entries(hot)) {
        if (key.startsWith(`${type}:`) && value && !seen.has(key)) {
          results.push(value);
        }
      }
    }
  } catch {}

  return results;
}

// ─── Helper: parse "HH:MM" ────────────────────────────────────────────────────
function parseTime(str) {
  if (!str) return null;
  const match = str.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

// ─── Scheduler (runs once globally, checks every 60s) ────────────────────────
let schedulerStarted = false;

function startGroupScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  setInterval(async () => {
    try {
      const now = new Date();
      const currentTime =
        now.getUTCHours().toString().padStart(2, "0") +
        ":" +
        now.getUTCMinutes().toString().padStart(2, "0");

      for (const type of ["open", "close"]) {
        const entries = getAllSchedules(type);
        for (const entry of entries) {
          if (!entry || entry.time !== currentTime) continue;

          const { jid, sessionId } = entry;
          try {
            const sessionEntry = manager.sessions.get(sessionId);
            if (!sessionEntry?.sock) {
              console.warn(`[groupschedule] No socket for session: ${sessionId}`);
              continue;
            }
            const s = sessionEntry.sock;

            if (type === "open") {
              await s.groupSettingUpdate(jid, "not_announcement");
              await s.sendMessage(jid, {
                text:
                  "🟢 *Group is now OPEN*\n\n" +
                  "✅ All members can send messages.\n" +
                  "⏰ Scheduled auto-open triggered.",
              });
              console.log(`[groupschedule] ✅ Auto-opened ${jid}`);
            } else {
              await s.groupSettingUpdate(jid, "announcement");
              await s.sendMessage(jid, {
                text:
                  "🔴 *Group is now CLOSED*\n\n" +
                  "🔒 Only admins can send messages.\n" +
                  "⏰ Scheduled auto-close triggered.",
              });
              console.log(`[groupschedule] ✅ Auto-closed ${jid}`);
            }
          } catch (err) {
            console.error(`[groupschedule] Error on ${type} for ${jid}:`, err?.message || err);
          }
        }
      }
    } catch (err) {
      console.error("[groupschedule] Scheduler tick error:", err?.message || err);
    }
  }, 60 * 1000);

  console.log("⏰ [groupschedule] Scheduler started — checking every 60s (UTC).");
}

startGroupScheduler();

// ─── .opentime ────────────────────────────────────────────────────────────────
Module({
  command: "opentime",
  package: "group",
  description: "Schedule daily auto-open for this group (UTC). Usage: .opentime HH:MM",
})(async (message, match) => {
  try {
    if (!message.isGroup) {
      return message.conn.sendMessage(
        message.from,
        { text: "❌ This command can only be used inside a group.", contextInfo: CTX },
        { quoted: message.raw }
      );
    }

    if (!message.isAdmin && !message.isFromMe) {
      return message.conn.sendMessage(
        message.from,
        { text: theme.isAdmin || "❌ Only group admins can set the open schedule.", contextInfo: CTX },
        { quoted: message.raw }
      );
    }

    const time = parseTime((match || "").trim());
    if (!time) {
      return message.conn.sendMessage(
        message.from,
        {
          text:
            "⚠️ *Invalid time format.*\n\n" +
            "Usage: *.opentime HH:MM* (24h, UTC)\n\n" +
            "Example: `.opentime 08:00`\n" +
            "→ Group opens every day at 08:00 UTC.",
          contextInfo: CTX,
        },
        { quoted: message.raw }
      );
    }

    const sessionId =
      message.sessionId ||
      message.conn?.sessionId ||
      [...manager.sessions.keys()][0];

    saveSchedule("open", message.from, time, sessionId);

    return message.conn.sendMessage(
      message.from,
      {
        text:
          `✅ *Open schedule saved!*\n\n` +
          `📅 This group will be *automatically opened* every day at *${time} UTC*.\n\n` +
          `📌 Works even when you're offline.\n` +
          `💡 Use *.schedulestatus* to view · *.cancelschedule open* to remove.`,
        contextInfo: CTX,
      },
      { quoted: message.raw }
    );
  } catch (err) {
    console.error("[opentime]", err);
    return message.conn.sendMessage(
      message.from,
      { text: `❌ Failed to set open schedule:\n${err?.message || err}`, contextInfo: CTX },
      { quoted: message.raw }
    );
  }
});

// ─── .closetime ───────────────────────────────────────────────────────────────
Module({
  command: "closetime",
  package: "group",
  description: "Schedule daily auto-close for this group (UTC). Usage: .closetime HH:MM",
})(async (message, match) => {
  try {
    if (!message.isGroup) {
      return message.conn.sendMessage(
        message.from,
        { text: "❌ This command can only be used inside a group.", contextInfo: CTX },
        { quoted: message.raw }
      );
    }

    if (!message.isAdmin && !message.isFromMe) {
      return message.conn.sendMessage(
        message.from,
        { text: theme.isAdmin || "❌ Only group admins can set the close schedule.", contextInfo: CTX },
        { quoted: message.raw }
      );
    }

    const time = parseTime((match || "").trim());
    if (!time) {
      return message.conn.sendMessage(
        message.from,
        {
          text:
            "⚠️ *Invalid time format.*\n\n" +
            "Usage: *.closetime HH:MM* (24h, UTC)\n\n" +
            "Example: `.closetime 22:00`\n" +
            "→ Group closes every day at 22:00 UTC.",
          contextInfo: CTX,
        },
        { quoted: message.raw }
      );
    }

    const sessionId =
      message.sessionId ||
      message.conn?.sessionId ||
      [...manager.sessions.keys()][0];

    saveSchedule("close", message.from, time, sessionId);

    return message.conn.sendMessage(
      message.from,
      {
        text:
          `✅ *Close schedule saved!*\n\n` +
          `📅 This group will be *automatically closed* every day at *${time} UTC*.\n\n` +
          `📌 Works even when you're offline.\n` +
          `💡 Use *.schedulestatus* to view · *.cancelschedule close* to remove.`,
        contextInfo: CTX,
      },
      { quoted: message.raw }
    );
  } catch (err) {
    console.error("[closetime]", err);
    return message.conn.sendMessage(
      message.from,
      { text: `❌ Failed to set close schedule:\n${err?.message || err}`, contextInfo: CTX },
      { quoted: message.raw }
    );
  }
});

// ─── .schedulestatus ──────────────────────────────────────────────────────────
Module({
  command: "schedulestatus",
  package: "group",
  description: "View current open/close schedule for this group.",
})(async (message) => {
  try {
    if (!message.isGroup) {
      return message.conn.sendMessage(
        message.from,
        { text: "❌ This command can only be used inside a group.", contextInfo: CTX },
        { quoted: message.raw }
      );
    }

    const openEntry  = getSchedule("open",  message.from);
    const closeEntry = getSchedule("close", message.from);

    const openLine  = openEntry?.time  ? `🟢 *Open time :* ${openEntry.time} UTC (daily)`  : "🟢 *Open time :* ─ not set";
    const closeLine = closeEntry?.time ? `🔴 *Close time:* ${closeEntry.time} UTC (daily)` : "🔴 *Close time:* ─ not set";

    return message.conn.sendMessage(
      message.from,
      {
        text:
          `⏰ *Group Schedule Status*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `${openLine}\n` +
          `${closeLine}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📌 All times are *UTC* (24h format).\n` +
          `💡 *.opentime HH:MM* / *.closetime HH:MM* to change.\n` +
          `💡 *.cancelschedule open|close|all* to remove.`,
        contextInfo: CTX,
      },
      { quoted: message.raw }
    );
  } catch (err) {
    console.error("[schedulestatus]", err);
  }
});

// ─── .cancelschedule ──────────────────────────────────────────────────────────
Module({
  command: "cancelschedule",
  package: "group",
  description: "Cancel open or close schedule. Usage: .cancelschedule open|close|all",
})(async (message, match) => {
  try {
    if (!message.isGroup) {
      return message.conn.sendMessage(
        message.from,
        { text: "❌ This command can only be used inside a group.", contextInfo: CTX },
        { quoted: message.raw }
      );
    }

    if (!message.isAdmin && !message.isFromMe) {
      return message.conn.sendMessage(
        message.from,
        { text: theme.isAdmin || "❌ Only group admins can cancel schedules.", contextInfo: CTX },
        { quoted: message.raw }
      );
    }

    const arg = (match || "").trim().toLowerCase();

    if (!["open", "close", "all"].includes(arg)) {
      return message.conn.sendMessage(
        message.from,
        {
          text:
            "⚠️ Usage: *.cancelschedule open|close|all*\n\n" +
            "`.cancelschedule open`  — remove open schedule\n" +
            "`.cancelschedule close` — remove close schedule\n" +
            "`.cancelschedule all`   — remove both",
          contextInfo: CTX,
        },
        { quoted: message.raw }
      );
    }

    if (arg === "open"  || arg === "all") deleteSchedule("open",  message.from);
    if (arg === "close" || arg === "all") deleteSchedule("close", message.from);

    return message.conn.sendMessage(
      message.from,
      {
        text: `✅ *Schedule cancelled.*\n\nRemoved *${arg}* schedule for this group.`,
        contextInfo: CTX,
      },
      { quoted: message.raw }
    );
  } catch (err) {
    console.error("[cancelschedule]", err);
    return message.conn.sendMessage(
      message.from,
      { text: `❌ Error: ${err?.message || err}`, contextInfo: CTX },
      { quoted: message.raw }
    );
  }
});
