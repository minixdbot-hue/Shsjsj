// plugins/tictactoe.js
import { Module } from "../lib/plugins.js";
import TicTacToe from "../lib/tictactoe-d.js";

// ─────────────────────────────────────────────
//  🗂️  ACTIVE GAMES STORE  (groupJid → game)
// ─────────────────────────────────────────────
const games = new Map();

// ─────────────────────────────────────────────
//  🎨  BOARD RENDERER  (box-drawing version)
// ─────────────────────────────────────────────
function renderBoard(board) {
  const cells = [...Array(9)].map((_, i) => {
    const bit = 1 << i;
    if (board._p1Board & bit) return "❌";
    if (board._p2Board & bit) return "⭕";
    return String(i + 1);
  });
  return (
    `  ${cells[0]} │ ${cells[1]} │ ${cells[2]}\n` +
    `  ──┼───┼──\n` +
    `  ${cells[3]} │ ${cells[4]} │ ${cells[5]}\n` +
    `  ──┼───┼──\n` +
    `  ${cells[6]} │ ${cells[7]} │ ${cells[8]}`
  );
}

// ─────────────────────────────────────────────
//  📄  MESSAGE BUILDER
// ─────────────────────────────────────────────
function buildGameMsg(game) {
  const isP1Turn = !game.board._playerTurn;
  const turnName = isP1Turn ? game.p1Name : game.p2Name;
  const turnSymbol = isP1Turn ? "❌" : "⭕";
  return (
    `🎮 *TIC TAC TOE*\n\n` +
    `❌ *Player 1 :* ${game.p1Name}\n` +
    `⭕ *Player 2 :* ${game.p2Name}\n\n` +
    `${renderBoard(game.board)}\n\n` +
    `🔄 *Turn :* ${turnSymbol} ${turnName}\n` +
    `📲 Reply with a number *1‑9* to play\n\n` +
    `> © Made by Incognu Boy`
  );
}

// ─────────────────────────────────────────────
//  🤖  MINIMAX BOT AI
// ─────────────────────────────────────────────
function cloneBoard(b) {
  const c = new TicTacToe(b.p1, b.p2);
  c._playerTurn = b._playerTurn;
  c._p1Board    = b._p1Board;
  c._p2Board    = b._p2Board;
  c.totalMoves  = b.totalMoves;
  return c;
}

function getBotMove(board) {
  // 1 – Win if possible
  for (let i = 0; i < 9; i++) {
    const c = cloneBoard(board);
    if (c.play(i) === 1 && c.victor === c.p2) return i;
  }
  // 2 – Block player win
  for (let i = 0; i < 9; i++) {
    const c = cloneBoard(board);
    c._playerTurn = false;
    if (c.play(i) === 1 && c.victor === c.p1) return i;
  }
  // 3 – Centre
  if (!((board._p1Board | board._p2Board) & (1 << 4))) return 4;
  // 4 – Corners
  for (const i of [0, 2, 6, 8]) {
    if (!((board._p1Board | board._p2Board) & (1 << i))) return i;
  }
  // 5 – Any free cell
  for (let i = 0; i < 9; i++) {
    if (!((board._p1Board | board._p2Board) & (1 << i))) return i;
  }
  return 0;
}

// ─────────────────────────────────────────────
//  ⏱️  INACTIVITY TIMER (5 min)
// ─────────────────────────────────────────────
function startTimer(groupJid, sendFn) {
  return setTimeout(() => {
    if (games.has(groupJid)) {
      games.delete(groupJid);
      sendFn(`⏰ *TIC TAC TOE*\n\nGame expired due to inactivity.`).catch(() => {});
    }
  }, 5 * 60 * 1000);
}

// ─────────────────────────────────────────────
//  🎮  .ttt — Start a game
// ─────────────────────────────────────────────
Module({
  command: ["ttt", "tictactoe"],
  package: "fun",
  description: "Start a Tic Tac Toe game.\nEx: .ttt @player  |  .ttt (vs Bot)",
})(async (message, match) => {
  const groupJid = message.from || message.chat;
  if (!groupJid?.includes("@g.us"))
    return message.send("❌ This command only works in groups!");

  if (games.has(groupJid))
    return message.send(
      `⚠️ A game is already in progress!\nUse *.tttend* to cancel it first.`
    );

  const p1Jid  = message.sender;
  const p1Name = message.pushName || p1Jid.split("@")[0];

  const mentioned =
    message.mentionedJid?.[0] ||
    message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  let p2Jid  = null;
  let p2Name = "🤖 Bot";
  let vsBot  = true;

  if (mentioned && mentioned !== p1Jid) {
    p2Jid  = mentioned;
    p2Name = `@${mentioned.split("@")[0]}`;
    vsBot  = false;
  }

  const board = new TicTacToe("❌", "⭕");
  const game  = { board, p1Jid, p1Name, p2Jid, p2Name, vsBot, groupJid };
  game.timeout = startTimer(groupJid, (t) => message.send(t));
  games.set(groupJid, game);

  await message.react("🎮");
  await message.send(
    `🎮 *TIC TAC TOE — NEW GAME!*\n\n` +
    `❌ *Player 1 :* ${p1Name}\n` +
    `⭕ *Player 2 :* ${p2Name}\n\n` +
    `${renderBoard(board)}\n\n` +
    `🔄 *${p1Name}* starts (❌)!\n` +
    `📲 Reply with a number *1‑9* to play\n\n` +
    `> © Made by Incognu Boy`
  );
});

// ─────────────────────────────────────────────
//  🔢  .tttplay — Play a move
// ─────────────────────────────────────────────
Module({
  command: ["tttplay", "tplay", "tp"],
  package: "fun",
  description: "Play a move in the current game.\nEx: .tttplay 5",
})(async (message, match) => {
  const groupJid = message.from || message.chat;
  if (!groupJid?.includes("@g.us"))
    return message.send("❌ This command only works in groups!");

  const game = games.get(groupJid);
  if (!game)
    return message.send(
      `❌ No game in progress!\nStart one with *.ttt* or *.ttt @player*`
    );

  const senderJid = message.sender;
  const isP1Turn  = !game.board._playerTurn;
  const isP2Turn  = game.board._playerTurn;

  if (!game.vsBot) {
    if (isP1Turn && senderJid !== game.p1Jid)
      return message.send(`⏳ It's *${game.p1Name}*'s turn (❌)!`);
    if (isP2Turn && senderJid !== game.p2Jid)
      return message.send(`⏳ It's *${game.p2Name}*'s turn (⭕)!`);
  } else {
    if (senderJid !== game.p1Jid)
      return message.send(`⏳ Only *${game.p1Name}* can play in this game!`);
  }

  const pos = parseInt(match?.trim()) - 1;
  if (isNaN(pos) || pos < 0 || pos > 8)
    return message.send("❌ Invalid move! Enter a number between *1 and 9*.");

  const result = game.board.play(pos);
  if (result === 0) return message.send("❌ That cell is already taken!");
  if (result === -1) return message.send("❌ Invalid move!");

  // Reset timer
  clearTimeout(game.timeout);
  game.timeout = startTimer(groupJid, (t) => message.send(t));

  // ── Check result after player move ──
  const endGame = async (isDraw, winnerName) => {
    clearTimeout(game.timeout);
    games.delete(groupJid);
    if (isDraw) {
      return message.send(
        `🎮 *TIC TAC TOE*\n\n${renderBoard(game.board)}\n\n` +
        `🤝 *It's a draw!* Well played everyone!\n\n> © Made by Incognu Boy`
      );
    }
    return message.send(
      `🎮 *TIC TAC TOE*\n\n${renderBoard(game.board)}\n\n` +
      `🏆 *${winnerName} WINS!* Congratulations 🎉\n\n> © Made by Incognu Boy`
    );
  };

  if (game.board.victor || game.board.isDraw) {
    const winnerName = game.board.victor === game.board.p1 ? game.p1Name : game.p2Name;
    return endGame(game.board.isDraw, winnerName);
  }

  // ── Bot turn ──
  if (game.vsBot) {
    const botPos = getBotMove(game.board);
    game.board.play(botPos);

    if (game.board.victor || game.board.isDraw) {
      const winnerName = game.board.victor === game.board.p2 ? "🤖 Bot" : game.p1Name;
      return endGame(game.board.isDraw, winnerName);
    }
  }

  await message.send(buildGameMsg(game));
});

// ─────────────────────────────────────────────
//  🛑  .tttend — End the game
// ─────────────────────────────────────────────
Module({
  command: ["tttend", "tttcancel", "ttstop"],
  package: "fun",
  description: "Cancel the current Tic Tac Toe game.",
})(async (message) => {
  const groupJid = message.from || message.chat;
  if (!groupJid?.includes("@g.us"))
    return message.send("❌ This command only works in groups!");

  const game = games.get(groupJid);
  if (!game) return message.send("❌ No game in progress!");

  clearTimeout(game.timeout);
  games.delete(groupJid);

  await message.react("🛑");
  await message.send(
    `🛑 *TIC TAC TOE CANCELLED!*\n\n` +
    `Game between *${game.p1Name}* and *${game.p2Name}* ended.\n\n` +
    `> © Made by Incognu Boy`
  );
});
