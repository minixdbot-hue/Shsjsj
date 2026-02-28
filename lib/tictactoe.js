// plugins/tictactoe.js
import { Module } from "../lib/plugins.js";

// ─────────────────────────────────────────────
//  🎮 TICTACTOE ENGINE
// ─────────────────────────────────────────────
class TicTacToe {
  constructor(p1, p2 = "⭕") {
    this.p1 = p1;
    this.p2 = p2;
    this._playerTurn = false;
    this._p1Board = 0;
    this._p2Board = 0;
    this.totalMoves = 0;
  }

  get activePlayer() {
    return this._playerTurn ? this.p2 : this.p1;
  }

  get victor() {
    const wins = [
      0b111000000, 0b000111000, 0b000000111,
      0b100100100, 0b010010010, 0b001001001,
      0b100010001, 0b001010100,
    ];
    for (let w of wins) {
      if ((this._p1Board & w) === w) return this.p1;
      if ((this._p2Board & w) === w) return this.p2;
    }
    return null;
  }

  get isDraw() {
    return this.totalMoves === 9 && !this.victor;
  }

  play(position) {
    if (this.victor || position < 0 || position > 8) return -1;
    if ((this._p1Board | this._p2Board) & (1 << position)) return 0;
    if (this._playerTurn) this._p2Board |= 1 << position;
    else this._p1Board |= 1 << position;
    this._playerTurn = !this._playerTurn;
    this.totalMoves++;
    return 1;
  }

  displayBoard() {
    const board = [...Array(9)].map((_, i) => {
      const bit = 1 << i;
      return this._p1Board & bit ? "❌" : this._p2Board & bit ? "⭕" : i + 1;
    });
    return (
      `${board[0]} │ ${board[1]} │ ${board[2]}\n` +
      `──┼───┼──\n` +
      `${board[3]} │ ${board[4]} │ ${board[5]}\n` +
      `──┼───┼──\n` +
      `${board[6]} │ ${board[7]} │ ${board[8]}`
    );
  }
}

// ─────────────────────────────────────────────
//  🗂️ ACTIVE GAMES STORE
//  Key: groupJid  →  Value: game object
// ─────────────────────────────────────────────
const games = new Map();

function buildGameMsg(game) {
  return (
    `🎮 *TIC TAC TOE*\n\n` +
    `❌ *Player 1:* ${game.p1Name}\n` +
    `⭕ *Player 2:* ${game.p2Name}\n\n` +
    `${game.board.displayBoard()}\n\n` +
    `🔄 *Turn:* ${game.board.activePlayer === game.board.p1 ? `❌ ${game.p1Name}` : `⭕ ${game.p2Name}`}\n` +
    `📲 Reply with a number *1-9* to play\n\n` +
    `> © Mᴀᴅᴇ ʙʏ Iɴᴄᴏɴɴᴜ Bᴏʏ`
  );
}

// ─────────────────────────────────────────────
//  🎮 .ttt — Start a game
// ─────────────────────────────────────────────
Module({
  command: ["ttt", "tictactoe"],
  package: "fun",
  description: "Start a Tic Tac Toe game. Mention a player to challenge them!\nExample: .ttt @player",
})(async (message, match) => {
  const groupJid = message.from || message.chat;

  if (!groupJid?.includes("@g.us")) {
    return await message.send("❌ This command can only be used in groups!");
  }

  // Check if game already running
  if (games.has(groupJid)) {
    return await message.send(
      `⚠️ A game is already running!\nUse *.tttend* to cancel it first.`
    );
  }

  // Get player 1 (sender)
  const p1Jid = message.sender;
  const p1Name = message.pushName || p1Jid.split("@")[0];

  // Get player 2 (mentioned or bot)
  let p2Jid = null;
  let p2Name = "Bot 🤖";
  let vsBot = true;

  const mentioned = message.mentionedJid?.[0] || message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

  if (mentioned && mentioned !== p1Jid) {
    p2Jid = mentioned;
    p2Name = `@${mentioned.split("@")[0]}`;
    vsBot = false;
  }

  // Create game
  const board = new TicTacToe("❌", "⭕");
  const game = {
    board,
    p1Jid,
    p1Name,
    p2Jid,
    p2Name,
    vsBot,
    groupJid,
  };

  games.set(groupJid, game);

  // Auto-delete game after 5 minutes of inactivity
  game.timeout = setTimeout(() => {
    if (games.has(groupJid)) {
      games.delete(groupJid);
      message.send(`⏰ *TIC TAC TOE*\n\nGame expired due to inactivity!`).catch(() => {});
    }
  }, 5 * 60 * 1000);

  await message.react("🎮");
  await message.send(
    `🎮 *TIC TAC TOE STARTED!*\n\n` +
    `❌ *Player 1:* ${p1Name}\n` +
    `⭕ *Player 2:* ${p2Name}\n\n` +
    `${board.displayBoard()}\n\n` +
    `🔄 *${p1Name}* goes first!\n` +
    `📲 Reply with a number *1-9* to play\n\n` +
    `> © Mᴀᴅᴇ ʙʏ Iɴᴄᴏɴɴᴜ Bᴏʏ`
  );
});

// ─────────────────────────────────────────────
//  🔢 .tttplay — Make a move
// ─────────────────────────────────────────────
Module({
  command: ["tttplay", "tplay"],
  package: "fun",
  description: "Play a move in Tic Tac Toe\nExample: .tttplay 5",
})(async (message, match) => {
  const groupJid = message.from || message.chat;

  if (!groupJid?.includes("@g.us")) {
    return await message.send("❌ This command can only be used in groups!");
  }

  const game = games.get(groupJid);
  if (!game) {
    return await message.send(
      `❌ No active game!\nStart one with *.ttt* or *.ttt @player*`
    );
  }

  const senderJid = message.sender;

  // Check if it's this player's turn
  const isP1Turn = !game.board._playerTurn;
  const isP2Turn = game.board._playerTurn;

  if (!game.vsBot) {
    if (isP1Turn && senderJid !== game.p1Jid) {
      return await message.send(`⏳ It's *${game.p1Name}*'s turn (❌)!`);
    }
    if (isP2Turn && senderJid !== game.p2Jid) {
      return await message.send(`⏳ It's *${game.p2Name}*'s turn (⭕)!`);
    }
  } else {
    // vs bot: only p1 can play
    if (senderJid !== game.p1Jid) {
      return await message.send(`⏳ Only *${game.p1Name}* can play in this game!`);
    }
  }

  const pos = parseInt(match?.trim()) - 1;

  if (isNaN(pos) || pos < 0 || pos > 8) {
    return await message.send("❌ Invalid move! Enter a number between *1 and 9*.");
  }

  const result = game.board.play(pos);

  if (result === 0) {
    return await message.send("❌ That cell is already taken! Choose another one.");
  }
  if (result === -1) {
    return await message.send("❌ Invalid move!");
  }

  // Reset inactivity timeout
  clearTimeout(game.timeout);
  game.timeout = setTimeout(() => {
    if (games.has(groupJid)) {
      games.delete(groupJid);
      message.send(`⏰ *TIC TAC TOE*\n\nGame expired due to inactivity!`).catch(() => {});
    }
  }, 5 * 60 * 1000);

  // Check win or draw after player move
  if (game.board.victor || game.board.isDraw) {
    clearTimeout(game.timeout);
    games.delete(groupJid);

    if (game.board.isDraw) {
      return await message.send(
        `🎮 *TIC TAC TOE*\n\n` +
        `${game.board.displayBoard()}\n\n` +
        `🤝 *It's a DRAW!* Well played both!\n\n` +
        `> © Mᴀᴅᴇ ʙʏ Iɴᴄᴏɴɴᴜ Bᴏʏ`
      );
    }

    const winnerName = game.board.victor === game.board.p1 ? game.p1Name : game.p2Name;
    return await message.send(
      `🎮 *TIC TAC TOE*\n\n` +
      `${game.board.displayBoard()}\n\n` +
      `🏆 *${winnerName} WINS!* Congratulations! 🎉\n\n` +
      `> © Mᴀᴅᴇ ʙʏ Iɴᴄᴏɴɴᴜ Bᴏʏ`
    );
  }

  // If vs bot, bot plays automatically
  if (game.vsBot) {
    const botMove = getBotMove(game.board);
    game.board.play(botMove);

    if (game.board.victor || game.board.isDraw) {
      clearTimeout(game.timeout);
      games.delete(groupJid);

      if (game.board.isDraw) {
        return await message.send(
          `🎮 *TIC TAC TOE*\n\n` +
          `${game.board.displayBoard()}\n\n` +
          `🤝 *It's a DRAW!* Nice try!\n\n` +
          `> © Mᴀᴅᴇ ʙʏ Iɴᴄᴏɴɴᴜ Bᴏʏ`
        );
      }

      return await message.send(
        `🎮 *TIC TAC TOE*\n\n` +
        `${game.board.displayBoard()}\n\n` +
        `🤖 *Bot WINS!* Better luck next time!\n\n` +
        `> © Mᴀᴅᴇ ʙʏ Iɴᴄᴏɴɴᴜ Bᴏʏ`
      );
    }
  }

  await message.send(buildGameMsg(game));
});

// ─────────────────────────────────────────────
//  🛑 .tttend — End the game
// ─────────────────────────────────────────────
Module({
  command: ["tttend", "tttcancel", "ttstop"],
  package: "fun",
  description: "Cancel the current Tic Tac Toe game",
})(async (message) => {
  const groupJid = message.from || message.chat;

  if (!groupJid?.includes("@g.us")) {
    return await message.send("❌ This command can only be used in groups!");
  }

  const game = games.get(groupJid);
  if (!game) {
    return await message.send("❌ No active game to cancel!");
  }

  clearTimeout(game.timeout);
  games.delete(groupJid);

  await message.react("🛑");
  await message.send(
    `🛑 *TIC TAC TOE CANCELLED!*\n\n` +
    `Game between *${game.p1Name}* and *${game.p2Name}* was ended.\n\n` +
    `> © Mᴀᴅᴇ ʙʏ Iɴᴄᴏɴɴᴜ Bᴏʏ`
  );
});

// ─────────────────────────────────────────────
//  🤖 BOT AI — Simple minimax bot
// ─────────────────────────────────────────────
function getBotMove(board) {
  // Try to win
  for (let i = 0; i < 9; i++) {
    const clone = cloneBoard(board);
    if (clone.play(i) === 1 && clone.victor === clone.p2) return i;
  }
  // Block player win
  for (let i = 0; i < 9; i++) {
    const clone = cloneBoard(board);
    // Simulate player move
    const saved = clone._playerTurn;
    clone._playerTurn = false;
    if (clone.play(i) === 1 && clone.victor === clone.p1) return i;
    clone._playerTurn = saved;
  }
  // Take center
  if (!((board._p1Board | board._p2Board) & (1 << 4))) return 4;
  // Take corners
  for (let i of [0, 2, 6, 8]) {
    if (!((board._p1Board | board._p2Board) & (1 << i))) return i;
  }
  // Take any free cell
  for (let i = 0; i < 9; i++) {
    if (!((board._p1Board | board._p2Board) & (1 << i))) return i;
  }
  return 0;
}

function cloneBoard(board) {
  const clone = new TicTacToe(board.p1, board.p2);
  clone._playerTurn = board._playerTurn;
  clone._p1Board = board._p1Board;
  clone._p2Board = board._p2Board;
  clone.totalMoves = board.totalMoves;
  return clone;
}
