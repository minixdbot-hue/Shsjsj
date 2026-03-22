import { Module } from '../lib/plugins.js';
import { manager } from '../lib/client.js';

// ─── Helper: wait for socket to be open ─────────────────────────────────────
function waitForOpen(sock, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    if (sock.user) return resolve();
    const timeout = setTimeout(() => {
      sock.ev.off('connection.update', handler);
      reject(new Error('Timed out waiting for connection'));
    }, timeoutMs);
    const handler = ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        clearTimeout(timeout);
        sock.ev.off('connection.update', handler);
        resolve();
      } else if (connection === 'close') {
        clearTimeout(timeout);
        sock.ev.off('connection.update', handler);
        reject(lastDisconnect?.error || new Error('Connection closed'));
      }
    };
    sock.ev.on('connection.update', handler);
  });
}

const CTX = {
  forwardingScore: 999,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: '120363403408693274@newsletter',
    newsletterName: '𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳',
    serverMessageId: 6,
  },
};

// ─── PAIR ───────────────────────────────────────────────────────────────────

Module({
  command: 'pair',
  package: 'general',
  description: 'Generate a WhatsApp pairing code directly from the bot',
})(async (message, match) => {
  try {
    const phoneNumber = (match || '').trim().replace(/[^0-9]/g, '');

    if (!phoneNumber || phoneNumber.length < 6) {
      return message.conn.sendMessage(message.from, {
        text: `Usage: .pair <number>\nExample: .pair 5511999999999`,
        contextInfo: CTX,
      });
    }

    if (!/^[0-9]{6,15}$/.test(phoneNumber)) {
      return message.conn.sendMessage(message.from, {
        text: `❌ Invalid number. Use digits only.`,
        contextInfo: CTX,
      });
    }

    await message.conn.sendMessage(message.from, {
      text: `⏳ Generating pairing code for ${phoneNumber}...`,
      contextInfo: CTX,
    });

    // Resolve socket: current conn first, then manager sessions
    let sock = message.conn;

    if (!sock?.requestPairingCode && message.sessionId) {
      const entry = manager.sessions.get(message.sessionId);
      if (entry?.sock?.requestPairingCode) sock = entry.sock;
    }

    if (!sock?.requestPairingCode) {
      for (const [, entry] of manager.sessions) {
        if (entry?.sock?.requestPairingCode) { sock = entry.sock; break; }
      }
    }

    if (!sock?.requestPairingCode) {
      throw new Error(
        'requestPairingCode not available. Make sure the bot was started in pairing code mode (not QR).'
      );
    }

    try { await waitForOpen(sock, 12000); } catch (e) {
      console.warn('[pair] waitForOpen:', e.message);
    }

    const code = await sock.requestPairingCode(phoneNumber);
    if (!code) throw new Error('WhatsApp returned an empty pairing code.');

    const formatted = code.length === 8
      ? `${code.slice(0, 4)}-${code.slice(4)}`
      : code;

    return message.conn.sendMessage(message.from, {
      text: `*Pairing code:* \`${formatted}\`\nValid for 2 minutes.`,
      contextInfo: CTX,
    });

  } catch (err) {
    console.error('[pair] Error:', err);

    let errMsg = `❌ Failed to generate pairing code.\n`;
    if (err.message?.includes('requestPairingCode')) {
      errMsg += `Bot not started in pairing code mode.`;
    } else if (err.message?.includes('Timed out')) {
      errMsg += `Connection timed out. Try again.`;
    } else {
      errMsg += err.message || String(err);
    }

    return message.conn.sendMessage(message.from, {
      text: errMsg,
      contextInfo: CTX,
    });
  }
});
