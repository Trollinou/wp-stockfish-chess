# WP Stockfish Chess

Un plugin WordPress simple pour jouer aux échecs contre l'intelligence artificielle Stockfish directement dans vos articles ou pages via un shortcode.

## Description

Ce plugin intègre la bibliothèque d'échecs `chess.js`, l'interface utilisateur `chessground`, et le moteur d'échecs `stockfish.js` pour créer une expérience de jeu interactive.

Utilisez le shortcode `[stockfish]` pour insérer l'échiquier.

## Fonctionnalités

- **Jeu contre Stockfish** : Affrontez une version de Stockfish directement dans votre navigateur.
- **Choix de la couleur** : Avant de commencer une nouvelle partie, vous pouvez choisir de jouer les Blancs ou les Noirs.
- **Réglage de la force de l'IA** : Un curseur vous permet de régler la force de Stockfish sur une échelle ELO de 1320 à 3190.
- **Affichage des informations de partie** : La position FEN actuelle et l'historique PGN de la partie sont affichés sous l'échiquier et mis à jour en temps réel.
- **Interface responsive** : L'échiquier s'adapte à la taille de l'écran.

## Utilisation

1.  Installez et activez le plugin.
2.  Modifiez une page ou un article.
3.  Insérez le shortcode `[stockfish]` là où vous souhaitez que l'échiquier apparaisse.
4.  Configurez les options de partie (votre couleur, la force de l'IA) directement dans l'interface.
5.  Cliquez sur "Nouvelle partie" pour commencer.
