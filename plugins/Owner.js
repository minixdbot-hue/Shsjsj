import { Module } from '../lib/plugins.js';
import { db } from '../lib/client.js';
import config from '../config.js';
import { jidNormalizedUser } from '@whiskeysockets/baileys';

// ─── Helpers ────────────────────────────────────────────────────────────────

const GLOBAL_SESSION = '__global__';

function normalizeJid(input = '') {
  const clean = input.replace(/[^0-9]/g, '');
  if (!clean) return null;
  return jidNormalizedUser(`${clean}@s.whatsapp.net`);
}

function extractNumber(match, quoted) {
  // from mention/reply
  if (quoted?.sender) return jidNormalizedUser(quoted.sender);
  // from text arg
  const clean = (match || '').replace(/[^0-9]/g, '');
  if (clean.length >= 6) return jidNormalizedUser(`${clean}@s.whatsapp.net`);
  return null;
}

function isOwner(senderJid) {
  const ownerRaw = (config.owner || '').replace(/[^0-9]/g, '');
  if (!ownerRaw) return false;
  // compare numéros bruts pour éviter les problèmes multi-device
  const senderNum = (senderJid || '').split('@')[0].replace(/[^0-9]/g, '');
  return senderNum === ownerRaw;
}

function isSudo(senderJid) {
  const senderNum = (senderJid || '').split('@')[0].replace(/[^0-9]/g, '');
  // vérifier config.sudo
  const sudoRaw = (config.sudo || '').replace(/[^0-9]/g, '');
  if (sudoRaw && senderNum === sudoRaw) return true;
  // vérifier la liste sudo en DB
  const list = db.get(GLOBAL_SESSION, 'sudo_list', []);
  return Array.isArray(list) && list.some(j => (j || '').split('@')[0].replace(/[^0-9]/g, '') === senderNum);
}

function isOwnerOrSudo(senderJid) {
  return isOwner(senderJid) || isSudo(senderJid);
}

function getSudoList() {
  return db.get(GLOBAL_SESSION, 'sudo_list', []);
}

function getBanList() {
  return db.get(GLOBAL_SESSION, 'ban_list', []);
}

function contextInfo() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: '120363403408693274@newsletter',
      newsletterName: '𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳',
      serverMessageId: 6,
    },
  };
}

async function reply(message, text) {
  return message.conn.sendMessage(message.from, {
    text,
    contextInfo: contextInfo(),
  }, { quoted: message.raw });
}

// ─── SUDOADD ────────────────────────────────────────────────────────────────

Module({
  command: 'sudoadd',
  package: 'owner',
  description: 'Add a user as sudo (owner-only)',
})(async (message, match) => {
  const sender = message.sender || message.from || "";

  if (!isOwner(sender)) {
    return reply(message, `⛔ Access denied. Only the bot owner can use this command.`);
  }

  const target = extractNumber(match, message.quoted);
  if (!target) {
    return reply(message, `❌ Usage: .sudoadd <number>\nExample: .sudoadd 5511999999999\nOr reply to a message with .sudoadd`);
  }

  if (isOwner(target)) {
    return reply(message, `⚠️ That number is already the bot owner.`);
  }

  const list = getSudoList();
  if (list.includes(target)) {
    return reply(message, `⚠️ ${target.split('@')[0]} is already in the sudo list.`);
  }

  list.push(target);
  db.setHot(GLOBAL_SESSION, 'sudo_list', list);

  return reply(message, `✅ Sudo added.\n👤 User: ${target.split('@')[0]}\n🔑 Level: Sudo (Full Access)\nThis user now has access to all bot commands.`);
});

// ─── DELSUDO ────────────────────────────────────────────────────────────────

Module({
  command: 'delsudo',
  package: 'owner',
  description: 'Remove a user from sudo list (owner-only)',
})(async (message, match) => {
  const sender = message.sender || message.from || "";

  if (!isOwner(sender)) {
    return reply(message, `⛔ Access denied. Only the bot owner can use this command.`);
  }

  const target = extractNumber(match, message.quoted);
  if (!target) {
    return reply(message, `❌ Usage: .delsudo <number>\nExample: .delsudo 5511999999999\nOr reply to a message with .delsudo`);
  }

  const list = getSudoList();
  const idx = list.indexOf(target);
  if (idx === -1) {
    return reply(message, `⚠️ ${target.split('@')[0]} is not in the sudo list.`);
  }

  list.splice(idx, 1);
  db.setHot(GLOBAL_SESSION, 'sudo_list', list);

  return reply(message, `🗑️ Sudo removed.\n👤 User: ${target.split('@')[0]}\n❌ Sudo access has been revoked.`);
});

// ─── LISTSUDO ───────────────────────────────────────────────────────────────

Module({
  command: 'listsudo',
  package: 'owner',
  description: 'List all sudo users',
})(async (message, match) => {
  const sender = message.sender || message.from || "";

  if (!isOwnerOrSudo(sender)) {
    return reply(message, `⛔ Access denied. Only the owner or sudo users can use this command.`);
  }

  const list = getSudoList();

  if (!list.length) {
    return reply(message, `📋 Sudo list:\nNo sudo users found.`);
  }

  const entries = list.map((jid, i) => `${i + 1}. @${jid.split('@')[0]}`).join('\n');

  return reply(message, `📋 Sudo list:\nTotal Sudo Users: ${list.length}\n\n${entries}`);
});

// ─── BAN ────────────────────────────────────────────────────────────────────

Module({
  command: 'ban',
  package: 'owner',
  description: 'Ban a user from using the bot (owner/sudo only)',
})(async (message, match) => {
  const sender = message.sender || message.from || "";

  if (!isOwnerOrSudo(sender)) {
    return reply(message, `⛔ Access denied. Only the owner or sudo users can ban users.`);
  }

  const target = extractNumber(match, message.quoted);
  if (!target) {
    return reply(message, `❌ Usage: .ban <number>\nExample: .ban 5511999999999\nOr reply to a message with .ban`);
  }

  if (isOwner(target)) {
    return reply(message, `⚠️ You cannot ban the bot owner.`);
  }

  if (isSudo(target) && !isOwner(sender)) {
    return reply(message, `⚠️ Only the bot owner can ban a sudo user.`);
  }

  const list = getBanList();
  if (list.includes(target)) {
    return reply(message, `⚠️ ${target.split('@')[0]} is already banned.`);
  }

  list.push(target);
  db.setHot(GLOBAL_SESSION, 'ban_list', list);

  return reply(message, `🔨 User banned.\n👤 User: ${target.split('@')[0]}\n🚫 Status: Banned\nThis user can no longer use the bot.`);
});

// ─── UNBAN ──────────────────────────────────────────────────────────────────

Module({
  command: 'unban',
  package: 'owner',
  description: 'Unban a user (owner/sudo only)',
})(async (message, match) => {
  const sender = message.sender || message.from || "";

  if (!isOwnerOrSudo(sender)) {
    return reply(message, `⛔ Access denied. Only the owner or sudo users can unban users.`);
  }

  const target = extractNumber(match, message.quoted);
  if (!target) {
    return reply(message, `❌ Usage: .unban <number>\nExample: .unban 5511999999999\nOr reply to a message with .unban`);
  }

  const list = getBanList();
  const idx = list.indexOf(target);
  if (idx === -1) {
    return reply(message, `⚠️ ${target.split('@')[0]} is not banned.`);
  }

  list.splice(idx, 1);
  db.setHot(GLOBAL_SESSION, 'ban_list', list);

  return reply(message, `✅ User unbanned.\n👤 User: ${target.split('@')[0]}\n✅ Status: Unbanned\nThis user can now use the bot again.`);
});

// ─── LISTBAN ────────────────────────────────────────────────────────────────

Module({
  command: 'listban',
  package: 'owner',
  description: 'List all banned users (owner/sudo only)',
})(async (message, match) => {
  const sender = message.sender || message.from || "";

  if (!isOwnerOrSudo(sender)) {
    return reply(message, `⛔ Access denied. Only the owner or sudo users can view the ban list.`);
  }

  const list = getBanList();

  if (!list.length) {
    return reply(message, `🚫 Ban list:\nNo banned users found.`);
  }

  const entries = list.map((jid, i) => `${i + 1}. @${jid.split('@')[0]}`).join('\n');

  return reply(message, `🚫 Ban list:\nTotal Banned Users: ${list.length}\n\n${entries}`);
});
