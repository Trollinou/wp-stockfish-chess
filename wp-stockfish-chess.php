<?php
/**
 * Plugin Name:       WP Stockfish Chess
 * Description:       Joue aux échecs contre Stockfish (niveau débutant) via un shortcode [stockfish].
 * Version:           0.0.2
 * Author:            Etienne Gagnon
 */

if (!defined('ABSPATH')) {
    exit; // Accès direct interdit
}

function wps_stockfish_chess_shortcode() {
    // Le contenu HTML. Notez la classe 'blue' pour le thème de l'échiquier.
    $content = '
        <div id="wps-chess-container">
            <div id="board-container" class="blue">
                <div id="chess-board"></div>
            </div>
            <div id="game-info">
                <div class="game-options">
                    <div id="player-color-choice">
                        <strong>Votre couleur :</strong>
                        <label><input type="radio" name="playerColor" value="white" checked> Blancs</label>
                        <label><input type="radio" name="playerColor" value="black"> Noirs</label>
                    </div>
                    <div id="elo-choice">
                        <label for="elo-slider">Force de l\'IA (ELO) : <strong id="elo-value">1320</strong></label>
                        <input type="range" id="elo-slider" name="elo" min="1320" max="3190" value="1320" style="width: 100%;">
                    </div>
                </div>
                <p>Statut : <span id="status">En attente de votre coup...</span></p>
                <button id="new-game-button">Nouvelle partie</button>
            </div>
            <div id="game-data">
                <div class="game-data-item">
                    <strong>FEN:</strong>
                    <pre id="fen-display"></pre>
                </div>
                <div class="game-data-item">
                    <strong>PGN:</strong>
                    <textarea id="pgn-display" readonly rows="5" style="width: 100%;"></textarea>
                </div>
            </div>
        </div>
    ';
    return $content;
}
add_shortcode('stockfish', 'wps_stockfish_chess_shortcode');

function wps_enqueue_chess_assets() {
    if (is_a($GLOBALS['post'], 'WP_Post') && has_shortcode($GLOBALS['post']->post_content, 'stockfish')) {
        
        $plugin_url = plugin_dir_url(__FILE__);
		
		// --- NOUVEAUX SCRIPTS ET STYLES POUR CHESSGROUND ---
        wp_enqueue_script('chess-js', $plugin_url . 'js/chess.js', array(), '1.4.0', true);
        wp_enqueue_script('chessground-js', $plugin_url . 'js/chessground.js', array(), '9.7.2', true);
        
        // Notre script de jeu (il dépend maintenant de chessground-js)
        wp_enqueue_script('wps-stockfish-game', plugin_dir_url(__FILE__) . 'js/game.js', array('chess-js', 'chessground-js'), '2.0', true);

        // On passe l'URL du plugin à notre script
        $data_to_pass = array('plugin_url' => plugin_dir_url(__FILE__));
        wp_localize_script('wps-stockfish-game', 'wpsStockfishData', $data_to_pass);

        // --- NOUVEAUX STYLES CSS POUR CHESSGROUND ---
        wp_enqueue_style('chessground-base-css', $plugin_url . 'css/chessground.base.css');
        wp_enqueue_style('chessground-theme-css', $plugin_url . 'css/chessground.brown.css'); // Thème "brown"
        wp_enqueue_style('chessground-pieces-css', $plugin_url . 'css/chessground.cburnett.css'); // Thème des pièces
        wp_enqueue_style('wps-stockfish-style', $plugin_url . 'css/style.css');
    }
}

add_action('wp_enqueue_scripts', 'wps_enqueue_chess_assets');
