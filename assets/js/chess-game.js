(() => {
  const BOARD_SIZE = 8;
  const WHITE = 'w';
  const BLACK = 'b';
  const FILES = 'abcdefgh';

  const elements = {
    board: document.querySelector('#board'),
    status: document.querySelector('#status'),
    gameInfo: document.querySelector('#gameInfo'),
    moves: document.querySelector('#moves'),
    start: document.querySelector('#start'),
    back: document.querySelector('#back'),
    forward: document.querySelector('#forward'),
    end: document.querySelector('#end'),
    playReplay: document.querySelector('#playReplay'),
    newGame: document.querySelector('#newGame'),
    flip: document.querySelector('#flip'),
    loadReplay: document.querySelector('#loadReplay'),
  };

  let state = createInitialState();
  let selectedSquare = null;
  let flipped = false;
  let pastPositions = [];
  let futurePositions = [];
  let replayTimeline = [];
  let replayIndex = 0;
  let replayTimer = null;

  function createInitialState() {
    return {
      board: [
        'br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br',
        ...Array(8).fill('bp'),
        ...Array(32).fill(null),
        ...Array(8).fill('wp'),
        'wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr',
      ],
      turn: WHITE,
      castle: { wk: true, wq: true, bk: true, bq: true },
      enPassantSquare: null,
      moves: [],
      lastMove: null,
      isOver: false,
    };
  }

  function cloneState(source) {
    return {
      ...source,
      board: [...source.board],
      castle: { ...source.castle },
      moves: [...source.moves],
      lastMove: source.lastMove ? { ...source.lastMove } : null,
    };
  }

  function getRow(square) { return Math.floor(square / BOARD_SIZE); }
  function getColumn(square) { return square % BOARD_SIZE; }
  function getSquare(row, column) { return row * BOARD_SIZE + column; }
  function isOnBoard(row, column) { return row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE; }
  function opponent(color) { return color === WHITE ? BLACK : WHITE; }
  function algebraicName(square) { return `${FILES[getColumn(square)]}${BOARD_SIZE - getRow(square)}`; }

  function pieceImageUrl(piece) {
    const color = piece[0] === WHITE ? 'l' : 'd';
    return `https://commons.wikimedia.org/wiki/Special:FilePath/Chess_${piece[1]}${color}t45.svg`;
  }

  function getAttackedSquares(game, from) {
    const piece = game.board[from];
    if (!piece) return [];

    const [color, type] = piece;
    const row = getRow(from);
    const column = getColumn(from);
    const attacked = [];
    const addIfValid = (targetRow, targetColumn) => {
      if (isOnBoard(targetRow, targetColumn)) attacked.push(getSquare(targetRow, targetColumn));
    };

    if (type === 'p') {
      const direction = color === WHITE ? -1 : 1;
      addIfValid(row + direction, column - 1);
      addIfValid(row + direction, column + 1);
      return attacked;
    }

    if (type === 'n') {
      for (const [rowOffset, columnOffset] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        addIfValid(row + rowOffset, column + columnOffset);
      }
      return attacked;
    }

    if (type === 'k') {
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          if (rowOffset || columnOffset) addIfValid(row + rowOffset, column + columnOffset);
        }
      }
      return attacked;
    }

    const directions = type === 'b'
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : type === 'r'
        ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
        : [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [rowOffset, columnOffset] of directions) {
      let targetRow = row + rowOffset;
      let targetColumn = column + columnOffset;

      while (isOnBoard(targetRow, targetColumn)) {
        const target = getSquare(targetRow, targetColumn);
        attacked.push(target);
        if (game.board[target]) break;
        targetRow += rowOffset;
        targetColumn += columnOffset;
      }
    }

    return attacked;
  }

  function isSquareAttacked(game, square, byColor) {
    return game.board.some((piece, from) => (
      piece?.[0] === byColor && getAttackedSquares(game, from).includes(square)
    ));
  }

  function isInCheck(game, color) {
    const king = game.board.indexOf(`${color}k`);
    return king < 0 || isSquareAttacked(game, king, opponent(color));
  }

  function addMove(game, moves, from, to, details = {}) {
    const target = game.board[to];
    if (!target || target[0] !== game.board[from][0]) moves.push({ from, to, ...details });
  }

  function getPseudoLegalMoves(game, from) {
    const piece = game.board[from];
    if (!piece) return [];

    const [color, type] = piece;
    const row = getRow(from);
    const column = getColumn(from);
    const moves = [];

    if (type === 'p') {
      const direction = color === WHITE ? -1 : 1;
      const startRow = color === WHITE ? 6 : 1;
      const oneForward = getSquare(row + direction, column);

      if (isOnBoard(row + direction, column) && !game.board[oneForward]) {
        addMove(game, moves, from, oneForward);
        const twoForward = getSquare(row + 2 * direction, column);
        if (row === startRow && !game.board[twoForward]) addMove(game, moves, from, twoForward, { doublePawnMove: true });
      }

      for (const columnOffset of [-1, 1]) {
        if (!isOnBoard(row + direction, column + columnOffset)) continue;
        const target = getSquare(row + direction, column + columnOffset);
        if (game.board[target]?.[0] === opponent(color)) addMove(game, moves, from, target);
        if (game.enPassantSquare === target) addMove(game, moves, from, target, { enPassant: true });
      }
      return moves;
    }

    if (type === 'k') {
      getAttackedSquares(game, from).forEach((to) => addMove(game, moves, from, to));
      addCastlingMoves(game, moves, from, color);
      return moves;
    }

    getAttackedSquares(game, from).forEach((to) => addMove(game, moves, from, to));
    return moves;
  }

  function addCastlingMoves(game, moves, from, color) {
    const homeRow = color === WHITE ? 7 : 0;
    const enemy = opponent(color);
    if (from !== getSquare(homeRow, 4) || isInCheck(game, color)) return;

    const kingside = game.castle[`${color}k`]
      && !game.board[getSquare(homeRow, 5)]
      && !game.board[getSquare(homeRow, 6)]
      && game.board[getSquare(homeRow, 7)] === `${color}r`
      && !isSquareAttacked(game, getSquare(homeRow, 5), enemy)
      && !isSquareAttacked(game, getSquare(homeRow, 6), enemy);

    const queenside = game.castle[`${color}q`]
      && !game.board[getSquare(homeRow, 1)]
      && !game.board[getSquare(homeRow, 2)]
      && !game.board[getSquare(homeRow, 3)]
      && game.board[getSquare(homeRow, 0)] === `${color}r`
      && !isSquareAttacked(game, getSquare(homeRow, 3), enemy)
      && !isSquareAttacked(game, getSquare(homeRow, 2), enemy);

    if (kingside) moves.push({ from, to: getSquare(homeRow, 6), castle: 'kingside' });
    if (queenside) moves.push({ from, to: getSquare(homeRow, 2), castle: 'queenside' });
  }

  function getLegalMoves(game, from) {
    const piece = game.board[from];
    if (!piece || piece[0] !== game.turn) return [];
    return getPseudoLegalMoves(game, from).filter((move) => !isInCheck(applyMove(game, move), game.turn));
  }

  function getAllLegalMoves(game) {
    return game.board.flatMap((piece, from) => piece?.[0] === game.turn ? getLegalMoves(game, from) : []);
  }

  function applyMove(game, move, promotion = 'q') {
    const next = cloneState(game);
    const piece = next.board[move.from];
    const [color, type] = piece;
    const captured = next.board[move.to];

    next.board[move.to] = piece;
    next.board[move.from] = null;
    if (move.enPassant) next.board[getSquare(getRow(move.from), getColumn(move.to))] = null;
    if (move.castle === 'kingside') { next.board[move.to - 1] = next.board[move.to + 1]; next.board[move.to + 1] = null; }
    if (move.castle === 'queenside') { next.board[move.to + 1] = next.board[move.to - 2]; next.board[move.to - 2] = null; }
    if (type === 'p' && (getRow(move.to) === 0 || getRow(move.to) === 7)) next.board[move.to] = `${color}${promotion}`;

    updateCastlingRights(next, move, piece, captured);
    next.enPassantSquare = move.doublePawnMove ? getSquare((getRow(move.from) + getRow(move.to)) / 2, getColumn(move.from)) : null;
    next.turn = opponent(color);
    next.lastMove = { from: move.from, to: move.to };
    next.moves.push(formatMove(game, move, promotion));
    return next;
  }

  function updateCastlingRights(game, move, piece, captured) {
    if (piece[1] === 'k') { game.castle[`${piece[0]}k`] = false; game.castle[`${piece[0]}q`] = false; }
    if (piece[1] === 'r') {
      if (move.from === 56) game.castle.wq = false;
      if (move.from === 63) game.castle.wk = false;
      if (move.from === 0) game.castle.bq = false;
      if (move.from === 7) game.castle.bk = false;
    }
    if (captured === 'wr') { if (move.to === 56) game.castle.wq = false; if (move.to === 63) game.castle.wk = false; }
    if (captured === 'br') { if (move.to === 0) game.castle.bq = false; if (move.to === 7) game.castle.bk = false; }
  }

  function formatMove(game, move, promotion) {
    const prefix = game.turn === WHITE ? `${Math.ceil((game.moves.length + 1) / 2)}. ` : '';
    const suffix = game.board[move.from][1] === 'p' && (getRow(move.to) === 0 || getRow(move.to) === 7) ? `=${promotion.toUpperCase()}` : '';
    return `${prefix}${algebraicName(move.from)}-${algebraicName(move.to)}${suffix}`;
  }

  function render() {
    renderBoard();
    renderStatus();
    elements.moves.textContent = state.moves.join('  ');
    elements.moves.scrollTop = elements.moves.scrollHeight;
  }

  function renderBoard() {
    elements.board.innerHTML = '';
    const legalMoves = selectedSquare === null ? [] : getLegalMoves(state, selectedSquare);
    const squares = [...Array(64).keys()];
    if (flipped) squares.reverse();

    squares.forEach((square, displayIndex) => {
      const button = document.createElement('button');
      const piece = state.board[square];
      const move = legalMoves.find((candidate) => candidate.to === square);
      const classes = [
        'square',
        (getRow(square) + getColumn(square)) % 2 ? 'square--dark' : 'square--light',
        selectedSquare === square ? 'square--selected' : '',
        state.lastMove && (state.lastMove.from === square || state.lastMove.to === square) ? 'square--last-move' : '',
        move ? (piece ? 'square--capture' : 'square--move') : '',
      ].filter(Boolean);

      button.className = classes.join(' ');
      button.setAttribute('aria-label', `${algebraicName(square)} ${piece ?? 'empty'}`);
      button.addEventListener('click', () => selectSquare(square));

      if (piece) button.appendChild(createPieceImage(piece));
      addCoordinates(button, square, displayIndex);
      elements.board.appendChild(button);
    });
  }

  function createPieceImage(piece) {
    const image = document.createElement('img');
    image.className = 'piece';
    image.src = pieceImageUrl(piece);
    image.alt = `${piece[0] === WHITE ? 'White' : 'Black'} ${piece[1]}`;
    image.draggable = false;
    return image;
  }

  function addCoordinates(squareElement, square, displayIndex) {
    const visualRow = Math.floor(displayIndex / BOARD_SIZE);
    const visualColumn = displayIndex % BOARD_SIZE;
    if (visualColumn === 0) squareElement.insertAdjacentHTML('beforeend', `<span class="rank">${algebraicName(square)[1]}</span>`);
    if (visualRow === BOARD_SIZE - 1) squareElement.insertAdjacentHTML('beforeend', `<span class="file">${algebraicName(square)[0]}</span>`);
  }

  function renderStatus() {
    const check = isInCheck(state, state.turn);
    const legalMoves = getAllLegalMoves(state);
    if (!legalMoves.length) {
      state.isOver = true;
      elements.status.textContent = check ? `Checkmate — ${state.turn === WHITE ? 'Black' : 'White'} wins!` : 'Stalemate — draw.';
      updateReplayInfo();
      return;
    }
    state.isOver = false;
    elements.status.textContent = `${state.turn === WHITE ? 'White' : 'Black'} to move${check ? ' — CHECK!' : ''}`;
    updateReplayInfo();
  }

  function selectSquare(square) {
    if (state.isOver || replayTimeline.length) return;
    const piece = state.board[square];
    if (selectedSquare === null) {
      if (piece?.[0] === state.turn) selectedSquare = square;
      render();
      return;
    }

    const move = getLegalMoves(state, selectedSquare).find((candidate) => candidate.to === square);
    if (move) {
      const promotion = getPromotionChoice(move);
      pastPositions.push(cloneState(state));
      state = applyMove(state, move, promotion);
      futurePositions = [];
      selectedSquare = null;
      render();
      return;
    }

    selectedSquare = piece?.[0] === state.turn ? square : null;
    render();
  }

  function getPromotionChoice(move) {
    const isPromotion = state.board[move.from][1] === 'p' && (getRow(move.to) === 0 || getRow(move.to) === 7);
    if (!isPromotion) return 'q';
    const answer = prompt('Promote to: queen, rook, bishop, or knight', 'queen')?.trim().toLowerCase();
    return { queen: 'q', rook: 'r', bishop: 'b', knight: 'n' }[answer] ?? 'q';
  }

  function undo() {
    if (replayTimeline.length) {
      if (replayIndex === 0) return;
      replayIndex -= 1;
      state = cloneState(replayTimeline[replayIndex]);
      selectedSquare = null;
      render();
      return;
    }
    if (!pastPositions.length) return;
    futurePositions.push(cloneState(state));
    state = pastPositions.pop();
    selectedSquare = null;
    render();
  }

  function redo() {
    if (replayTimeline.length) {
      if (replayIndex === replayTimeline.length - 1) return;
      replayIndex += 1;
      state = cloneState(replayTimeline[replayIndex]);
      selectedSquare = null;
      render();
      return;
    }
    if (!futurePositions.length) return;
    pastPositions.push(cloneState(state));
    state = futurePositions.pop();
    selectedSquare = null;
    render();
  }

  function goToStart() {
    if (replayTimeline.length) {
      replayIndex = 0;
      state = cloneState(replayTimeline[replayIndex]);
      selectedSquare = null;
      render();
      return;
    }
    while (pastPositions.length) undo();
  }

  function goToEnd() {
    if (replayTimeline.length) {
      replayIndex = replayTimeline.length - 1;
      state = cloneState(replayTimeline[replayIndex]);
      selectedSquare = null;
      render();
      return;
    }
    while (futurePositions.length) redo();
  }

  function startNewGame() {
    stopReplay();
    state = createInitialState();
    selectedSquare = null;
    pastPositions = [];
    futurePositions = [];
    replayTimeline = [];
    replayIndex = 0;
    render();
  }

  function updateReplayInfo() {
    if (!replayTimeline.length) {
      elements.gameInfo.textContent = 'Local two-player game';
      return;
    }
    const replay = window.CAPABLANCA_REPLAY;
    elements.gameInfo.textContent = `${replay.title} · Move ${replayIndex}/${replayTimeline.length - 1} · Result: ${replay.result}`;
  }

  function loadCapablancaReplay() {
    stopReplay();

    try {
      const replay = window.CAPABLANCA_REPLAY;
      if (!replay?.moves) throw new Error('Replay data was not loaded.');

      const sanMoves = tokenizePgn(replay.moves);
      let position = createInitialState();
      const timeline = [cloneState(position)];

      for (const san of sanMoves) {
        const move = findMoveFromSan(position, san);
        if (!move) throw new Error(`Could not interpret PGN move: ${san}`);
        const promotion = getPromotionFromSan(san);
        position = applyMove(position, move, promotion);
        position.moves = [...timeline[timeline.length - 1].moves, san];
        timeline.push(cloneState(position));
      }

      replayTimeline = timeline;
      replayIndex = 0;
      pastPositions = [];
      futurePositions = [];
      state = cloneState(replayTimeline[0]);
      selectedSquare = null;
      render();
    } catch (error) {
      console.error(error);
      elements.gameInfo.textContent = `Replay load failed: ${error.message}`;
    }
  }

  function toggleReplayPlayback() {
    if (!replayTimeline.length) loadCapablancaReplay();
    if (!replayTimeline.length) return;

    if (replayTimer) {
      stopReplay();
      return;
    }

    elements.playReplay.textContent = 'Pause replay';
    replayTimer = setInterval(() => {
      if (replayIndex >= replayTimeline.length - 1) {
        stopReplay();
        return;
      }
      redo();
    }, 650);
  }

  function stopReplay() {
    if (!replayTimer) return;
    clearInterval(replayTimer);
    replayTimer = null;
    elements.playReplay.textContent = 'Play replay';
  }

  function tokenizePgn(pgn) {
    return pgn
      .replace(/\{[^}]*\}/g, '')
      .replace(/\d+\.\.\.|\d+\./g, '')
      .trim()
      .split(/\s+/)
      .filter((token) => !['1-0', '0-1', '1/2-1/2', '*'].includes(token));
  }

  function findMoveFromSan(game, san) {
    const normalized = san.replace(/[+#?!]+$/g, '');
    const candidates = getAllLegalMoves(game);
    if (normalized === 'O-O') return candidates.find((move) => move.castle === 'kingside');
    if (normalized === 'O-O-O') return candidates.find((move) => move.castle === 'queenside');

    const match = normalized.match(/^([KQRBN])?([a-h]?)([1-8]?)(x?)([a-h][1-8])(?:=([QRBN]))?$/);
    if (!match) return null;
    const [, pieceLetter, fromFile, fromRank, capture, destination] = match;
    const type = { K: 'k', Q: 'q', R: 'r', B: 'b', N: 'n' }[pieceLetter] ?? 'p';

    return candidates.find((move) => {
      const piece = game.board[move.from];
      const isCapture = Boolean(game.board[move.to]) || move.enPassant;
      return piece[1] === type
        && algebraicName(move.to) === destination
        && (!fromFile || algebraicName(move.from)[0] === fromFile)
        && (!fromRank || algebraicName(move.from)[1] === fromRank)
        && Boolean(capture) === isCapture;
    });
  }

  function getPromotionFromSan(san) {
    const promotion = san.match(/=([QRBN])/);
    return { Q: 'q', R: 'r', B: 'b', N: 'n' }[promotion?.[1]] ?? 'q';
  }

  function bindControls() {
    elements.newGame.addEventListener('click', startNewGame);
    elements.start.addEventListener('click', goToStart);
    elements.back.addEventListener('click', undo);
    elements.forward.addEventListener('click', redo);
    elements.end.addEventListener('click', goToEnd);
    elements.playReplay.addEventListener('click', toggleReplayPlayback);
    elements.flip.addEventListener('click', () => { flipped = !flipped; render(); });
    elements.loadReplay.addEventListener('click', loadCapablancaReplay);
  }

  bindControls();
  render();
})();
