document.addEventListener('DOMContentLoaded', function () {
    if (typeof Chess === 'undefined' || typeof Chessground === 'undefined') {
        console.error("Les bibliothèques Chess.js ou Chessground.js ne sont pas chargées.");
        return;
    }

    // --- DOM Elements ---
    const boardEl = document.getElementById('chess-board');
    const statusEl = document.getElementById('status');
    const eloSlider = document.getElementById('elo-slider');
    const eloValueSpan = document.getElementById('elo-value');
    const newGameButton = document.getElementById('new-game-button');
    const fenDisplay = document.getElementById('fen-display');
    const pgnDisplay = document.getElementById('pgn-display');

    // --- Chess & Stockfish Instances ---
    const game = new Chess.Chess();
    const stockfish = new Worker(wpsStockfishData.plugin_url + 'engine/stockfish.js');
    let ground; // Will be initialized in startNewGame

    // --- ELO Slider Handler ---
    eloSlider.addEventListener('input', () => {
        eloValueSpan.textContent = eloSlider.value;
    });

    // --- Core Functions ---

    // Sets Stockfish strength
    function setStockfishStrength(elo) {
        stockfish.postMessage('uci');
        stockfish.postMessage('isready');
        stockfish.postMessage('setoption name UCI_LimitStrength value true');
        stockfish.postMessage('setoption name UCI_Elo value ' + elo);
    }

    // Utility to get legal moves for Chessground
    function toDests(chess) {
        const dests = new Map();
        Chess.SQUARES.forEach(s => {
            const ms = chess.moves({ square: s, verbose: true });
            if (ms.length) dests.set(s, ms.map(m => m.to));
        });
        return dests;
    }

    // Update FEN and PGN displays
    function updateFenPgnDisplay() {
        fenDisplay.textContent = game.fen();
        pgnDisplay.value = game.pgn();
    }

    // Update game status text
    function updateStatus() {
        let status = '';
        const moveColor = game.turn() === 'w' ? 'Blancs' : 'Noirs';

        if (game.isCheckmate()) {
            status = 'Échec et mat !';
        } else if (game.isDraw()) {
            status = 'Partie nulle.';
        } else {
            status = 'Au tour des ' + moveColor;
            if (game.isCheck()) {
                status += ' (en échec)';
            }
        }
        statusEl.innerHTML = status;
        updateFenPgnDisplay(); // Update FEN/PGN along with status
    }

    // Ask Stockfish for its best move
    function getBestMove() {
        if (!game.isGameOver()) {
            stockfish.postMessage('position fen ' + game.fen());
            stockfish.postMessage('go depth 2'); // A low depth for quick response
        }
    }

    // Handle move from the player
    function onUserMove(orig, dest) {
        const playerColor = ground.state.orientation;
        if (game.turn() !== playerColor[0]) return; // Not player's turn

        const move = game.move({ from: orig, to: dest, promotion: 'q' });
        if (move === null) return;

        ground.set({
            fen: game.fen(),
            turnColor: game.turn() === 'w' ? 'white' : 'black',
            movable: {
                color: game.turn() === 'w' ? 'white' : 'black',
                dests: toDests(game)
            }
        });
        updateStatus();

        // If game is not over, ask stockfish to play
        if (!game.isGameOver()) {
            setTimeout(getBestMove, 500);
        }
    }

    // Handle message from Stockfish worker
    stockfish.onmessage = function (event) {
        const message = event.data;
        if (message && message.includes('bestmove')) {
            const bestMove = message.split(' ')[1];
            game.move({ from: bestMove.substring(0, 2), to: bestMove.substring(2, 4), promotion: 'q' });

            ground.move(bestMove.substring(0, 2), bestMove.substring(2, 4));
            ground.set({
                fen: game.fen(),
                turnColor: game.turn() === 'w' ? 'white' : 'black',
                movable: {
                    color: ground.state.orientation,
                    dests: toDests(game)
                }
            });
            updateStatus();
        }
    };

    // --- New Game Setup ---
    function startNewGame() {
        const playerColor = document.querySelector('input[name="playerColor"]:checked').value;
        const elo = eloSlider.value;

        // 1. Configure Stockfish
        setStockfishStrength(elo);
        stockfish.postMessage('ucinewgame');

        // 2. Reset internal game state
        game.reset();

        // 3. Configure Chessground
        const config = {
            orientation: playerColor,
            turnColor: 'white', // Chess always starts with white to move
            coordinates: true,
            fen: 'start',
            movable: {
                color: playerColor,
                free: false,
                dests: toDests(game),
            },
            events: {
                move: onUserMove
            },
            lastMove: null,
            check: null
        };

        if (ground) {
            ground.set(config);
        } else {
            ground = Chessground.Chessground(boardEl, config);
        }

        // 4. If player is black, make Stockfish play first
        if (playerColor === 'black') {
            setTimeout(getBestMove, 500);
        }

        updateStatus();
    }

    // --- Event Listeners ---
    newGameButton.addEventListener('click', startNewGame);

    // --- Initial Load ---
    startNewGame(); // Start a game on page load
});
