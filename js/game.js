document.addEventListener('DOMContentLoaded', function () {
    if (typeof Chess === 'undefined' || typeof Chessground === 'undefined') {
        console.error("Les bibliothèques Chess.js ou Chessground.js ne sont pas chargées.");
        return;
    }

    const game = new Chess();
    const stockfish = new Worker(wpsStockfishData.plugin_url + 'engine/stockfish.js');
    const statusEl = document.getElementById('status');
    const boardEl = document.getElementById('chess-board');

    // Fonction utilitaire pour convertir les coups de chess.js au format de Chessground
    function toDests(chess) {
        const dests = new Map();
        chess.SQUARES.forEach(s => {
            const ms = chess.moves({ square: s, verbose: true });
            if (ms.length) dests.set(s, ms.map(m => m.to));
        });
        return dests;
    }

    // Fonction appelée quand le joueur fait un coup
    function onUserMove(orig, dest) {
        const move = game.move({ from: orig, to: dest, promotion: 'q' });
        
        // Si le coup est illégal, on ne fait rien, Chessground gère
        if (move === null) return;
        
        updateStatus();
        
        // On met à jour l'échiquier pour refléter le coup
        ground.set({
            fen: game.fen(),
            turnColor: 'black', // C'est au tour des noirs
            movable: {
                color: 'black',
                dests: toDests(game)
            }
        });
        
        // On demande à Stockfish de jouer après un court délai
        setTimeout(getBestMove, 500);
    }

    // Fonction pour demander le meilleur coup à Stockfish
    function getBestMove() {
        if (!game.game_over()) {
            stockfish.postMessage('position fen ' + game.fen());
            stockfish.postMessage('go depth 2');
        }
    }

    // Réception du message de Stockfish
    stockfish.onmessage = function (event) {
        const message = event.data;
        if (message && message.includes('bestmove')) {
            const bestMove = message.split(' ')[1];
            const from = bestMove.substring(0, 2);
            const to = bestMove.substring(2, 4);

            game.move({ from, to });
            
            // On met à jour l'échiquier et on joue le coup de l'IA visuellement
            ground.set({
                fen: game.fen(),
                turnColor: 'white', // C'est au tour des blancs
                movable: {
                    color: 'white', // Le joueur peut maintenant jouer
                    dests: toDests(game)
                }
            });
            ground.move(from, to);
            updateStatus();
        }
    };
    
    // Configuration initiale de Chessground
    const config = {
        fen: game.fen(), // Position de départ
        orientation: 'white', // Le joueur joue les blancs
        turnColor: 'white',   // C'est au tour des blancs
        movable: {
            color: 'white', // On peut bouger les pièces blanches
            free: false,    // On ne peut pas bouger les pièces n'importe où
            dests: toDests(game), // On calcule les coups légaux
        },
        events: {
            move: onUserMove // Fonction à appeler après un coup du joueur
        }
    };
    
    const ground = Chessground(boardEl, config);

    // Mise à jour du statut
    function updateStatus() {
        let status = '';
        const moveColor = game.turn() === 'w' ? 'Blancs' : 'Noirs';

        if (game.in_checkmate()) {
            status = 'Échec et mat !';
        } else if (game.in_draw()) {
            status = 'Partie nulle.';
        } else {
            status = 'Au tour des ' + moveColor;
            if (game.in_check()) {
                status += ' (en échec)';
            }
        }
        statusEl.innerHTML = status;
    }

    // Bouton pour une nouvelle partie
    document.getElementById('new-game-button').addEventListener('click', () => {
        game.reset();
        stockfish.postMessage('ucinewgame');
        ground.set({
            fen: game.fen(),
            turnColor: 'white',
            movable: {
                color: 'white',
                dests: toDests(game)
            }
        });
        updateStatus();
    });

    // Initialisation de Stockfish
    function initStockfish() {
        stockfish.postMessage('uci');
        stockfish.postMessage('isready');
        stockfish.postMessage('setoption name Skill Level value 0');
    }
    
    initStockfish();
    updateStatus();
});