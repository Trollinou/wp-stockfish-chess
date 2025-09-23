(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Chessground = {}));
})(this, (function (exports) { 'use strict';

    const colors = ['white', 'black'];
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

    const invRanks = [...ranks].reverse();
    const allKeys = files.flatMap(f => ranks.map(r => (f + r)));
    const pos2key = (pos) => allKeys[8 * pos[0] + pos[1]];
    const key2pos = (k) => [k.charCodeAt(0) - 97, k.charCodeAt(1) - 49];
    const allPos = allKeys.map(key2pos);
    function memo(f) {
        let v;
        const ret = () => {
            if (v === undefined)
                v = f();
            return v;
        };
        ret.clear = () => {
            v = undefined;
        };
        return ret;
    }
    const timer = () => {
        let startAt;
        return {
            start() {
                startAt = performance.now();
            },
            cancel() {
                startAt = undefined;
            },
            stop() {
                if (!startAt)
                    return 0;
                const time = performance.now() - startAt;
                startAt = undefined;
                return time;
            },
        };
    };
    const opposite = (c) => (c === 'white' ? 'black' : 'white');
    const distanceSq = (pos1, pos2) => (pos1[0] - pos2[0]) ** 2 + (pos1[1] - pos2[1]) ** 2;
    const samePiece = (p1, p2) => p1.role === p2.role && p1.color === p2.color;
    const samePos = (p1, p2) => p1[0] === p2[0] && p1[1] === p2[1];
    const posToTranslate = (bounds) => (pos, asWhite) => [
        ((asWhite ? pos[0] : 7 - pos[0]) * bounds.width) / 8,
        ((asWhite ? 7 - pos[1] : pos[1]) * bounds.height) / 8,
    ];
    const translate = (el, pos) => {
        el.style.transform = `translate(${pos[0]}px,${pos[1]}px)`;
    };
    const translateAndScale = (el, pos, scale = 1) => {
        el.style.transform = `translate(${pos[0]}px,${pos[1]}px) scale(${scale})`;
    };
    const setVisible = (el, v) => {
        el.style.visibility = v ? 'visible' : 'hidden';
    };
    const eventPosition = (e) => {
        if (e.clientX || e.clientX === 0)
            return [e.clientX, e.clientY];
        if (e.targetTouches?.[0])
            return [e.targetTouches[0].clientX, e.targetTouches[0].clientY];
        return; // touchend has no position!
    };
    const isRightButton = (e) => e.button === 2;
    const createEl = (tagName, className) => {
        const el = document.createElement(tagName);
        if (className)
            el.className = className;
        return el;
    };
    function computeSquareCenter(key, asWhite, bounds) {
        const pos = key2pos(key);
        if (!asWhite) {
            pos[0] = 7 - pos[0];
            pos[1] = 7 - pos[1];
        }
        return [
            bounds.left + (bounds.width * pos[0]) / 8 + bounds.width / 16,
            bounds.top + (bounds.height * (7 - pos[1])) / 8 + bounds.height / 16,
        ];
    }
    const diff = (a, b) => Math.abs(a - b);
    const knightDir = (x1, y1, x2, y2) => diff(x1, x2) * diff(y1, y2) === 2;
    const rookDir = (x1, y1, x2, y2) => (x1 === x2) !== (y1 === y2);
    const bishopDir = (x1, y1, x2, y2) => diff(x1, x2) === diff(y1, y2) && x1 !== x2;
    const queenDir = (x1, y1, x2, y2) => rookDir(x1, y1, x2, y2) || bishopDir(x1, y1, x2, y2);
    const kingDirNonCastling = (x1, y1, x2, y2) => Math.max(diff(x1, x2), diff(y1, y2)) === 1;
    const pawnDirCapture = (x1, y1, x2, y2, isDirectionUp) => diff(x1, x2) === 1 && y2 === y1 + (isDirectionUp ? 1 : -1);
    const pawnDirAdvance = (x1, y1, x2, y2, isDirectionUp) => {
        const step = isDirectionUp ? 1 : -1;
        return (x1 === x2 &&
            (y2 === y1 + step ||
                // allow 2 squares from first two ranks, for horde
                (y2 === y1 + 2 * step && (isDirectionUp ? y1 <= 1 : y1 >= 6))));
    };
    /** Returns all board squares between (x1, y1) and (x2, y2) exclusive,
     *  along a straight line (rook or bishop path). Returns [] if not aligned, or none between.
     */
    const squaresBetween = (x1, y1, x2, y2) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        // Must be a straight or diagonal line
        if (dx && dy && Math.abs(dx) !== Math.abs(dy))
            return [];
        const stepX = Math.sign(dx), stepY = Math.sign(dy);
        const squares = [];
        let x = x1 + stepX, y = y1 + stepY;
        while (x !== x2 || y !== y2) {
            squares.push([x, y]);
            x += stepX;
            y += stepY;
        }
        return squares.map(sq => pos2key(sq));
    };
    const adjacentSquares = (square) => {
        const pos = key2pos(square);
        const adjacentSquares = [];
        if (pos[0] > 0)
            adjacentSquares.push([pos[0] - 1, pos[1]]);
        if (pos[0] < 7)
            adjacentSquares.push([pos[0] + 1, pos[1]]);
        return adjacentSquares.map(pos2key);
    };
    const squareShiftedVertically = (square, delta) => {
        const pos = key2pos(square);
        pos[1] += delta;
        return pos2key(pos);
    };

    const isDestOccupiedByFriendly = (ctx) => ctx.friendlies.has(pos2key(ctx.pos2));
    const isDestOccupiedByEnemy = (ctx) => ctx.enemies.has(pos2key(ctx.pos2));
    const anyPieceBetween = (pos1, pos2, pieces) => squaresBetween(...pos1, ...pos2).some(s => pieces.has(s));
    const canEnemyPawnAdvanceToSquare = (pawnStart, dest, ctx) => {
        const piece = ctx.enemies.get(pawnStart);
        if (piece?.role !== 'pawn')
            return false;
        const step = piece.color === 'white' ? 1 : -1;
        const startPos = key2pos(pawnStart);
        const destPos = key2pos(dest);
        return (pawnDirAdvance(...startPos, ...destPos, piece.color === 'white') &&
            !anyPieceBetween(startPos, [destPos[0], destPos[1] + step], ctx.allPieces));
    };
    const canEnemyPawnCaptureOnSquare = (pawnStart, dest, ctx) => {
        const enemyPawn = ctx.enemies.get(pawnStart);
        return (enemyPawn?.role === 'pawn' &&
            pawnDirCapture(...key2pos(pawnStart), ...key2pos(dest), enemyPawn.color === 'white') &&
            (ctx.friendlies.has(dest) ||
                canBeCapturedBySomeEnemyEnPassant(squareShiftedVertically(dest, enemyPawn.color === 'white' ? -1 : 1), ctx.friendlies, ctx.enemies, ctx.lastMove)));
    };
    const canSomeEnemyPawnAdvanceToDest = (ctx) => [...ctx.enemies.keys()].some(key => canEnemyPawnAdvanceToSquare(key, pos2key(ctx.pos2), ctx));
    const isDestControlledByEnemy = (ctx, pieceRolesExclude) => {
        const square = ctx.pos2;
        return [...ctx.enemies].some(([key, piece]) => {
            const piecePos = key2pos(key);
            return (!pieceRolesExclude?.includes(piece.role) &&
                ((piece.role === 'pawn' && pawnDirCapture(...piecePos, ...square, piece.color === 'white')) ||
                    (piece.role === 'knight' && knightDir(...piecePos, ...square)) ||
                    (piece.role === 'bishop' && bishopDir(...piecePos, ...square)) ||
                    (piece.role === 'rook' && rookDir(...piecePos, ...square)) ||
                    (piece.role === 'queen' && queenDir(...piecePos, ...square)) ||
                    (piece.role === 'king' && kingDirNonCastling(...piecePos, ...square))) &&
                (!['bishop', 'rook', 'queen'].includes(piece.role) || !anyPieceBetween(piecePos, square, ctx.allPieces)));
        });
    };
    const isFriendlyOnDestAndAttacked = (ctx) => isDestOccupiedByFriendly(ctx) &&
        (canBeCapturedBySomeEnemyEnPassant(pos2key(ctx.pos2), ctx.friendlies, ctx.enemies, ctx.lastMove) ||
            isDestControlledByEnemy(ctx));
    const canBeCapturedBySomeEnemyEnPassant = (potentialSquareOfFriendlyPawn, friendlies, enemies, lastMove) => {
        if (lastMove && potentialSquareOfFriendlyPawn !== lastMove[1])
            return false;
        const pos = key2pos(potentialSquareOfFriendlyPawn);
        const friendly = friendlies.get(potentialSquareOfFriendlyPawn);
        return (friendly?.role === 'pawn' &&
            pos[1] === (friendly.color === 'white' ? 3 : 4) &&
            (!lastMove || diff(key2pos(lastMove[0])[1], pos[1]) === 2) &&
            [1, -1].some(delta => enemies.get(pos2key([pos[0] + delta, pos[1]]))?.role === 'pawn'));
    };
    const isPathClearEnoughOfFriendliesForPremove = (ctx) => {
        if (ctx.unrestrictedPremoves)
            return true;
        const squaresBetween$1 = squaresBetween(...ctx.pos1, ...ctx.pos2);
        const squaresOfFriendliesBetween = squaresBetween$1.filter(s => ctx.friendlies.has(s));
        return (!squaresOfFriendliesBetween.length ||
            (squaresOfFriendliesBetween.length === 1 &&
                canBeCapturedBySomeEnemyEnPassant(squaresOfFriendliesBetween[0], ctx.friendlies, ctx.enemies, ctx.lastMove) &&
                !squaresBetween$1.includes(squareShiftedVertically(squaresOfFriendliesBetween[0], ctx.color === 'white' ? -1 : 1))));
    };
    const isPathClearEnoughOfEnemiesForPremove = (ctx) => {
        if (ctx.unrestrictedPremoves)
            return true;
        const squaresBetween$1 = squaresBetween(...ctx.pos1, ...ctx.pos2);
        const squaresOfEnemiesBetween = squaresBetween$1.filter(s => ctx.enemies.has(s));
        if (squaresOfEnemiesBetween.length > 1)
            return false;
        if (!squaresOfEnemiesBetween.length)
            return true;
        const enemySquare = squaresOfEnemiesBetween[0];
        const enemy = ctx.enemies.get(enemySquare);
        if (!enemy || enemy.role !== 'pawn')
            return true;
        const enemyStep = enemy.color === 'white' ? 1 : -1;
        const squareAbove = squareShiftedVertically(enemySquare, enemyStep);
        const enemyPawnDests = [
            ...adjacentSquares(squareAbove).filter(s => canEnemyPawnCaptureOnSquare(enemySquare, s, ctx)),
            ...[squareAbove, squareShiftedVertically(squareAbove, enemyStep)].filter(s => s && canEnemyPawnAdvanceToSquare(enemySquare, s, ctx)),
        ];
        const badSquares = [...squaresBetween$1, pos2key(ctx.pos1)];
        return enemyPawnDests.some(square => !badSquares.includes(square));
    };
    const isPathClearEnoughForPremove = (ctx) => isPathClearEnoughOfFriendliesForPremove(ctx) && isPathClearEnoughOfEnemiesForPremove(ctx);
    const pawn = (ctx) => {
        const step = ctx.color === 'white' ? 1 : -1;
        if (diff(ctx.pos1[0], ctx.pos2[0]) > 1)
            return false;
        if (!diff(ctx.pos1[0], ctx.pos2[0])) {
            return (pawnDirAdvance(...ctx.pos1, ...ctx.pos2, ctx.color === 'white') &&
                isPathClearEnoughForPremove({ ...ctx, pos2: [ctx.pos2[0], ctx.pos2[1] + step] }));
        }
        if (ctx.pos2[1] !== ctx.pos1[1] + step)
            return false;
        if (ctx.unrestrictedPremoves || isDestOccupiedByEnemy(ctx))
            return true;
        if (isDestOccupiedByFriendly(ctx))
            return isDestControlledByEnemy(ctx);
        else
            return (canSomeEnemyPawnAdvanceToDest(ctx) ||
                canBeCapturedBySomeEnemyEnPassant(pos2key([ctx.pos2[0], ctx.pos2[1] + step]), ctx.friendlies, ctx.enemies, ctx.lastMove) ||
                isDestControlledByEnemy(ctx, ['pawn']));
    };
    const knight = (ctx) => knightDir(...ctx.pos1, ...ctx.pos2) &&
        (ctx.unrestrictedPremoves || !isDestOccupiedByFriendly(ctx) || isFriendlyOnDestAndAttacked(ctx));
    const bishop = (ctx) => bishopDir(...ctx.pos1, ...ctx.pos2) &&
        isPathClearEnoughForPremove(ctx) &&
        (ctx.unrestrictedPremoves || !isDestOccupiedByFriendly(ctx) || isFriendlyOnDestAndAttacked(ctx));
    const rook = (ctx) => rookDir(...ctx.pos1, ...ctx.pos2) &&
        isPathClearEnoughForPremove(ctx) &&
        (ctx.unrestrictedPremoves || !isDestOccupiedByFriendly(ctx) || isFriendlyOnDestAndAttacked(ctx));
    const queen = (ctx) => bishop(ctx) || rook(ctx);
    const king = (ctx) => (kingDirNonCastling(...ctx.pos1, ...ctx.pos2) &&
        (ctx.unrestrictedPremoves || !isDestOccupiedByFriendly(ctx) || isFriendlyOnDestAndAttacked(ctx))) ||
        (ctx.canCastle &&
            ctx.pos1[1] === ctx.pos2[1] &&
            ctx.pos1[1] === (ctx.color === 'white' ? 0 : 7) &&
            ((ctx.pos1[0] === 4 &&
                ((ctx.pos2[0] === 2 && ctx.rookFilesFriendlies.includes(0)) ||
                    (ctx.pos2[0] === 6 && ctx.rookFilesFriendlies.includes(7)))) ||
                ctx.rookFilesFriendlies.includes(ctx.pos2[0])) &&
            (ctx.unrestrictedPremoves ||
                /* The following checks if no non-rook friendly piece is in the way between the king and its castling destination.
                   Note that for the Chess960 edge case of Kb1 "long castling", the check passes even if there is a piece in the way
                   on c1. But this is fine, since premoving from b1 to a1 as a normal move would have already returned true. */
                squaresBetween(...ctx.pos1, ctx.pos2[0] > ctx.pos1[0] ? 7 : 1, ctx.pos2[1])
                    .map(s => ctx.allPieces.get(s))
                    .every(p => !p || samePiece(p, { role: 'rook', color: ctx.color }))));
    const mobilityByRole = { pawn, knight, bishop, rook, queen, king };
    function premove(state, key) {
        const pieces = state.pieces, canCastle = state.premovable.castle, unrestrictedPremoves = !!state.premovable.unrestrictedPremoves;
        const piece = pieces.get(key);
        if (!piece || piece.color === state.turnColor)
            return [];
        const color = piece.color, friendlies = new Map([...pieces].filter(([_, p]) => p.color === color)), enemies = new Map([...pieces].filter(([_, p]) => p.color === opposite(color))), pos = key2pos(key), mobility = mobilityByRole[piece.role], ctx = {
            pos1: pos,
            allPieces: pieces,
            friendlies: friendlies,
            enemies: enemies,
            unrestrictedPremoves: unrestrictedPremoves,
            color: color,
            canCastle: canCastle,
            rookFilesFriendlies: Array.from(pieces)
                .filter(([k, p]) => k[1] === (color === 'white' ? '1' : '8') && p.color === color && p.role === 'rook')
                .map(([k]) => key2pos(k)[0]),
            lastMove: state.lastMove,
        };
        return allPos.filter(pos2 => mobility({ ...ctx, pos2 })).map(pos2key);
    }

    function callUserFunction(f, ...args) {
        if (f)
            setTimeout(() => f(...args), 1);
    }
    function toggleOrientation(state) {
        state.orientation = opposite(state.orientation);
        state.animation.current = state.draggable.current = state.selected = undefined;
    }
    function setPieces(state, pieces) {
        for (const [key, piece] of pieces) {
            if (piece)
                state.pieces.set(key, piece);
            else
                state.pieces.delete(key);
        }
    }
    function setCheck(state, color) {
        state.check = undefined;
        if (color === true)
            color = state.turnColor;
        if (color)
            for (const [k, p] of state.pieces) {
                if (p.role === 'king' && p.color === color) {
                    state.check = k;
                }
            }
    }
    function setPremove(state, orig, dest, meta) {
        unsetPredrop(state);
        state.premovable.current = [orig, dest];
        callUserFunction(state.premovable.events.set, orig, dest, meta);
    }
    function unsetPremove(state) {
        if (state.premovable.current) {
            state.premovable.current = undefined;
            callUserFunction(state.premovable.events.unset);
        }
    }
    function setPredrop(state, role, key) {
        unsetPremove(state);
        state.predroppable.current = { role, key };
        callUserFunction(state.predroppable.events.set, role, key);
    }
    function unsetPredrop(state) {
        const pd = state.predroppable;
        if (pd.current) {
            pd.current = undefined;
            callUserFunction(pd.events.unset);
        }
    }
    function tryAutoCastle(state, orig, dest) {
        if (!state.autoCastle)
            return false;
        const king = state.pieces.get(orig);
        if (!king || king.role !== 'king')
            return false;
        const origPos = key2pos(orig);
        const destPos = key2pos(dest);
        if ((origPos[1] !== 0 && origPos[1] !== 7) || origPos[1] !== destPos[1])
            return false;
        if (origPos[0] === 4 && !state.pieces.has(dest)) {
            if (destPos[0] === 6)
                dest = pos2key([7, destPos[1]]);
            else if (destPos[0] === 2)
                dest = pos2key([0, destPos[1]]);
        }
        const rook = state.pieces.get(dest);
        if (!rook || rook.color !== king.color || rook.role !== 'rook')
            return false;
        state.pieces.delete(orig);
        state.pieces.delete(dest);
        if (origPos[0] < destPos[0]) {
            state.pieces.set(pos2key([6, destPos[1]]), king);
            state.pieces.set(pos2key([5, destPos[1]]), rook);
        }
        else {
            state.pieces.set(pos2key([2, destPos[1]]), king);
            state.pieces.set(pos2key([3, destPos[1]]), rook);
        }
        return true;
    }
    function baseMove(state, orig, dest) {
        const origPiece = state.pieces.get(orig), destPiece = state.pieces.get(dest);
        if (orig === dest || !origPiece)
            return false;
        const captured = destPiece && destPiece.color !== origPiece.color ? destPiece : undefined;
        if (dest === state.selected)
            unselect(state);
        callUserFunction(state.events.move, orig, dest, captured);
        if (!tryAutoCastle(state, orig, dest)) {
            state.pieces.set(dest, origPiece);
            state.pieces.delete(orig);
        }
        state.lastMove = [orig, dest];
        state.check = undefined;
        callUserFunction(state.events.change);
        return captured || true;
    }
    function baseNewPiece(state, piece, key, force) {
        if (state.pieces.has(key)) {
            if (force)
                state.pieces.delete(key);
            else
                return false;
        }
        callUserFunction(state.events.dropNewPiece, piece, key);
        state.pieces.set(key, piece);
        state.lastMove = [key];
        state.check = undefined;
        callUserFunction(state.events.change);
        state.movable.dests = undefined;
        state.turnColor = opposite(state.turnColor);
        return true;
    }
    function baseUserMove(state, orig, dest) {
        const result = baseMove(state, orig, dest);
        if (result) {
            state.movable.dests = undefined;
            state.turnColor = opposite(state.turnColor);
            state.animation.current = undefined;
        }
        return result;
    }
    function userMove(state, orig, dest) {
        if (canMove(state, orig, dest)) {
            const result = baseUserMove(state, orig, dest);
            if (result) {
                const holdTime = state.hold.stop();
                unselect(state);
                const metadata = {
                    premove: false,
                    ctrlKey: state.stats.ctrlKey,
                    holdTime,
                };
                if (result !== true)
                    metadata.captured = result;
                callUserFunction(state.movable.events.after, orig, dest, metadata);
                return true;
            }
        }
        else if (canPremove(state, orig, dest)) {
            setPremove(state, orig, dest, {
                ctrlKey: state.stats.ctrlKey,
            });
            unselect(state);
            return true;
        }
        unselect(state);
        return false;
    }
    function dropNewPiece(state, orig, dest, force) {
        const piece = state.pieces.get(orig);
        if (piece && (canDrop(state, orig, dest) || force)) {
            state.pieces.delete(orig);
            baseNewPiece(state, piece, dest, force);
            callUserFunction(state.movable.events.afterNewPiece, piece.role, dest, {
                premove: false,
                predrop: false,
            });
        }
        else if (piece && canPredrop(state, orig, dest)) {
            setPredrop(state, piece.role, dest);
        }
        else {
            unsetPremove(state);
            unsetPredrop(state);
        }
        state.pieces.delete(orig);
        unselect(state);
    }
    function selectSquare(state, key, force) {
        callUserFunction(state.events.select, key);
        if (state.selected) {
            if (state.selected === key && !state.draggable.enabled) {
                unselect(state);
                state.hold.cancel();
                return;
            }
            else if ((state.selectable.enabled || force) && state.selected !== key) {
                if (userMove(state, state.selected, key)) {
                    state.stats.dragged = false;
                    return;
                }
            }
        }
        if ((state.selectable.enabled || state.draggable.enabled) &&
            (isMovable(state, key) || isPremovable(state, key))) {
            setSelected(state, key);
            state.hold.start();
        }
    }
    function setSelected(state, key) {
        state.selected = key;
        if (!isPremovable(state, key))
            state.premovable.dests = undefined;
        else if (!state.premovable.customDests)
            state.premovable.dests = premove(state, key);
        // calculate chess premoves if custom premoves are not passed
    }
    function unselect(state) {
        state.selected = undefined;
        state.premovable.dests = undefined;
        state.hold.cancel();
    }
    function isMovable(state, orig) {
        const piece = state.pieces.get(orig);
        return (!!piece &&
            (state.movable.color === 'both' ||
                (state.movable.color === piece.color && state.turnColor === piece.color)));
    }
    const canMove = (state, orig, dest) => orig !== dest &&
        isMovable(state, orig) &&
        (state.movable.free || !!state.movable.dests?.get(orig)?.includes(dest));
    function canDrop(state, orig, dest) {
        const piece = state.pieces.get(orig);
        return (!!piece &&
            (orig === dest || !state.pieces.has(dest)) &&
            (state.movable.color === 'both' ||
                (state.movable.color === piece.color && state.turnColor === piece.color)));
    }
    function isPremovable(state, orig) {
        const piece = state.pieces.get(orig);
        return (!!piece &&
            state.premovable.enabled &&
            state.movable.color === piece.color &&
            state.turnColor !== piece.color);
    }
    const canPremove = (state, orig, dest) => orig !== dest &&
        isPremovable(state, orig) &&
        (state.premovable.customDests?.get(orig) ?? premove(state, orig)).includes(dest);
    function canPredrop(state, orig, dest) {
        const piece = state.pieces.get(orig);
        const destPiece = state.pieces.get(dest);
        return (!!piece &&
            (!destPiece || destPiece.color !== state.movable.color) &&
            state.predroppable.enabled &&
            (piece.role !== 'pawn' || (dest[1] !== '1' && dest[1] !== '8')) &&
            state.movable.color === piece.color &&
            state.turnColor !== piece.color);
    }
    function isDraggable(state, orig) {
        const piece = state.pieces.get(orig);
        return (!!piece &&
            state.draggable.enabled &&
            (state.movable.color === 'both' ||
                (state.movable.color === piece.color && (state.turnColor === piece.color || state.premovable.enabled))));
    }
    function playPremove(state) {
        const move = state.premovable.current;
        if (!move)
            return false;
        const orig = move[0], dest = move[1];
        let success = false;
        if (canMove(state, orig, dest)) {
            const result = baseUserMove(state, orig, dest);
            if (result) {
                const metadata = { premove: true };
                if (result !== true)
                    metadata.captured = result;
                callUserFunction(state.movable.events.after, orig, dest, metadata);
                success = true;
            }
        }
        unsetPremove(state);
        return success;
    }
    function playPredrop(state, validate) {
        const drop = state.predroppable.current;
        let success = false;
        if (!drop)
            return false;
        if (validate(drop)) {
            const piece = {
                role: drop.role,
                color: state.movable.color,
            };
            if (baseNewPiece(state, piece, drop.key)) {
                callUserFunction(state.movable.events.afterNewPiece, drop.role, drop.key, {
                    premove: false,
                    predrop: true,
                });
                success = true;
            }
        }
        unsetPredrop(state);
        return success;
    }
    function cancelMove(state) {
        unsetPremove(state);
        unsetPredrop(state);
        unselect(state);
    }
    function stop(state) {
        state.movable.color = state.movable.dests = state.animation.current = undefined;
        cancelMove(state);
    }
    function getKeyAtDomPos(pos, asWhite, bounds) {
        let file = Math.floor((8 * (pos[0] - bounds.left)) / bounds.width);
        if (!asWhite)
            file = 7 - file;
        let rank = 7 - Math.floor((8 * (pos[1] - bounds.top)) / bounds.height);
        if (!asWhite)
            rank = 7 - rank;
        return file >= 0 && file < 8 && rank >= 0 && rank < 8 ? pos2key([file, rank]) : undefined;
    }
    function getSnappedKeyAtDomPos(orig, pos, asWhite, bounds) {
        const origPos = key2pos(orig);
        const validSnapPos = allPos.filter(pos2 => samePos(origPos, pos2) ||
            queenDir(origPos[0], origPos[1], pos2[0], pos2[1]) ||
            knightDir(origPos[0], origPos[1], pos2[0], pos2[1]));
        const validSnapCenters = validSnapPos.map(pos2 => computeSquareCenter(pos2key(pos2), asWhite, bounds));
        const validSnapDistances = validSnapCenters.map(pos2 => distanceSq(pos, pos2));
        const [, closestSnapIndex] = validSnapDistances.reduce((a, b, index) => (a[0] < b ? a : [b, index]), [validSnapDistances[0], 0]);
        return pos2key(validSnapPos[closestSnapIndex]);
    }
    const whitePov = (s) => s.orientation === 'white';

    const initial = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
    const roles = {
        p: 'pawn',
        r: 'rook',
        n: 'knight',
        b: 'bishop',
        q: 'queen',
        k: 'king',
    };
    const letters = {
        pawn: 'p',
        rook: 'r',
        knight: 'n',
        bishop: 'b',
        queen: 'q',
        king: 'k',
    };
    function read(fen) {
        if (fen === 'start')
            fen = initial;
        const pieces = new Map();
        let row = 7, col = 0;
        for (const c of fen) {
            switch (c) {
                case ' ':
                case '[':
                    return pieces;
                case '/':
                    --row;
                    if (row < 0)
                        return pieces;
                    col = 0;
                    break;
                case '~': {
                    const piece = pieces.get(pos2key([col - 1, row]));
                    if (piece)
                        piece.promoted = true;
                    break;
                }
                default: {
                    const nb = c.charCodeAt(0);
                    if (nb < 57)
                        col += nb - 48;
                    else {
                        const role = c.toLowerCase();
                        const key = pos2key([col, row]);
                        if (key)
                            pieces.set(key, {
                                role: roles[role],
                                color: c === role ? 'black' : 'white',
                            });
                        ++col;
                    }
                }
            }
        }
        return pieces;
    }
    function write(pieces) {
        return invRanks
            .map(y => files
            .map(x => {
            const piece = pieces.get((x + y));
            if (piece) {
                let p = letters[piece.role];
                if (piece.color === 'white')
                    p = p.toUpperCase();
                if (piece.promoted)
                    p += '~';
                return p;
            }
            else
                return '1';
        })
            .join(''))
            .join('/')
            .replace(/1{2,}/g, s => s.length.toString());
    }

    function applyAnimation(state, config) {
        if (config.animation) {
            deepMerge(state.animation, config.animation);
            // no need for such short animations
            if ((state.animation.duration || 0) < 70)
                state.animation.enabled = false;
        }
    }
    function configure(state, config) {
        // don't merge destinations and autoShapes. Just override.
        if (config.movable?.dests)
            state.movable.dests = undefined;
        if (config.drawable?.autoShapes)
            state.drawable.autoShapes = [];
        deepMerge(state, config);
        // if a fen was provided, replace the pieces
        if (config.fen) {
            state.pieces = read(config.fen);
            state.drawable.shapes = config.drawable?.shapes || [];
        }
        // apply config values that could be undefined yet meaningful
        if ('check' in config)
            setCheck(state, config.check || false);
        if ('lastMove' in config && !config.lastMove)
            state.lastMove = undefined;
        // in case of ZH drop last move, there's a single square.
        // if the previous last move had two squares,
        // the merge algorithm will incorrectly keep the second square.
        else if (config.lastMove)
            state.lastMove = config.lastMove;
        // fix move/premove dests
        if (state.selected)
            setSelected(state, state.selected);
        applyAnimation(state, config);
        if (!state.movable.rookCastle && state.movable.dests) {
            const rank = state.movable.color === 'white' ? '1' : '8', kingStartPos = ('e' + rank), dests = state.movable.dests.get(kingStartPos), king = state.pieces.get(kingStartPos);
            if (!dests || !king || king.role !== 'king')
                return;
            state.movable.dests.set(kingStartPos, dests.filter(d => !(d === 'a' + rank && dests.includes(('c' + rank))) &&
                !(d === 'h' + rank && dests.includes(('g' + rank)))));
        }
    }
    function deepMerge(base, extend) {
        for (const key in extend) {
            if (key === '__proto__' || key === 'constructor' || !Object.prototype.hasOwnProperty.call(extend, key))
                continue;
            if (Object.prototype.hasOwnProperty.call(base, key) &&
                isPlainObject(base[key]) &&
                isPlainObject(extend[key]))
                deepMerge(base[key], extend[key]);
            else
                base[key] = extend[key];
        }
    }
    function isPlainObject(o) {
        if (typeof o !== 'object' || o === null)
            return false;
        const proto = Object.getPrototypeOf(o);
        return proto === Object.prototype || proto === null;
    }

    const anim = (mutation, state) => state.animation.enabled ? animate(mutation, state) : render$2(mutation, state);
    function render$2(mutation, state) {
        const result = mutation(state);
        state.dom.redraw();
        return result;
    }
    const makePiece = (key, piece) => ({
        key: key,
        pos: key2pos(key),
        piece: piece,
    });
    const closer = (piece, pieces) => pieces.sort((p1, p2) => distanceSq(piece.pos, p1.pos) - distanceSq(piece.pos, p2.pos))[0];
    function computePlan(prevPieces, current) {
        const anims = new Map(), animedOrigs = [], fadings = new Map(), missings = [], news = [], prePieces = new Map();
        let curP, preP, vector;
        for (const [k, p] of prevPieces) {
            prePieces.set(k, makePiece(k, p));
        }
        for (const key of allKeys) {
            curP = current.pieces.get(key);
            preP = prePieces.get(key);
            if (curP) {
                if (preP) {
                    if (!samePiece(curP, preP.piece)) {
                        missings.push(preP);
                        news.push(makePiece(key, curP));
                    }
                }
                else
                    news.push(makePiece(key, curP));
            }
            else if (preP)
                missings.push(preP);
        }
        for (const newP of news) {
            preP = closer(newP, missings.filter(p => samePiece(newP.piece, p.piece)));
            if (preP) {
                vector = [preP.pos[0] - newP.pos[0], preP.pos[1] - newP.pos[1]];
                anims.set(newP.key, vector.concat(vector));
                animedOrigs.push(preP.key);
            }
        }
        for (const p of missings) {
            if (!animedOrigs.includes(p.key))
                fadings.set(p.key, p.piece);
        }
        return {
            anims: anims,
            fadings: fadings,
        };
    }
    function step(state, now) {
        const cur = state.animation.current;
        if (cur === undefined) {
            // animation was canceled :(
            if (!state.dom.destroyed)
                state.dom.redrawNow();
            return;
        }
        const rest = 1 - (now - cur.start) * cur.frequency;
        if (rest <= 0) {
            state.animation.current = undefined;
            state.dom.redrawNow();
        }
        else {
            const ease = easing(rest);
            for (const cfg of cur.plan.anims.values()) {
                cfg[2] = cfg[0] * ease;
                cfg[3] = cfg[1] * ease;
            }
            state.dom.redrawNow(true); // optimisation: don't render SVG changes during animations
            requestAnimationFrame((now = performance.now()) => step(state, now));
        }
    }
    function animate(mutation, state) {
        // clone state before mutating it
        const prevPieces = new Map(state.pieces);
        const result = mutation(state);
        const plan = computePlan(prevPieces, state);
        if (plan.anims.size || plan.fadings.size) {
            const alreadyRunning = state.animation.current && state.animation.current.start;
            state.animation.current = {
                start: performance.now(),
                frequency: 1 / state.animation.duration,
                plan: plan,
            };
            if (!alreadyRunning)
                step(state, performance.now());
        }
        else {
            // don't animate, just render right away
            state.dom.redraw();
        }
        return result;
    }
    // https://gist.github.com/gre/1650294
    const easing = (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1);

    const brushes = ['green', 'red', 'blue', 'yellow'];
    function start$2(state, e) {
        // support one finger touch only
        if (e.touches && e.touches.length > 1)
            return;
        e.stopPropagation();
        e.preventDefault();
        e.ctrlKey ? unselect(state) : cancelMove(state);
        const pos = eventPosition(e), orig = getKeyAtDomPos(pos, whitePov(state), state.dom.bounds());
        if (!orig)
            return;
        state.drawable.current = {
            orig,
            pos,
            brush: eventBrush(e),
            snapToValidMove: state.drawable.defaultSnapToValidMove,
        };
        processDraw(state);
    }
    function processDraw(state) {
        requestAnimationFrame(() => {
            const cur = state.drawable.current;
            if (cur) {
                const keyAtDomPos = getKeyAtDomPos(cur.pos, whitePov(state), state.dom.bounds());
                if (!keyAtDomPos) {
                    cur.snapToValidMove = false;
                }
                const mouseSq = cur.snapToValidMove
                    ? getSnappedKeyAtDomPos(cur.orig, cur.pos, whitePov(state), state.dom.bounds())
                    : keyAtDomPos;
                if (mouseSq !== cur.mouseSq) {
                    cur.mouseSq = mouseSq;
                    cur.dest = mouseSq !== cur.orig ? mouseSq : undefined;
                    state.dom.redrawNow();
                }
                processDraw(state);
            }
        });
    }
    function move$1(state, e) {
        if (state.drawable.current)
            state.drawable.current.pos = eventPosition(e);
    }
    function end$1(state) {
        const cur = state.drawable.current;
        if (cur) {
            if (cur.mouseSq)
                addShape(state.drawable, cur);
            cancel$1(state);
        }
    }
    function cancel$1(state) {
        if (state.drawable.current) {
            state.drawable.current = undefined;
            state.dom.redraw();
        }
    }
    function clear(state) {
        if (state.drawable.shapes.length) {
            state.drawable.shapes = [];
            state.dom.redraw();
            onChange(state.drawable);
        }
    }
    function eventBrush(e) {
        const modA = (e.shiftKey || e.ctrlKey) && isRightButton(e);
        const modB = e.altKey || e.metaKey || e.getModifierState?.('AltGraph');
        return brushes[(modA ? 1 : 0) + (modB ? 2 : 0)];
    }
    function addShape(drawable, cur) {
        const sameShape = (s) => s.orig === cur.orig && s.dest === cur.dest;
        const similar = drawable.shapes.find(sameShape);
        if (similar)
            drawable.shapes = drawable.shapes.filter(s => !sameShape(s));
        if (!similar || similar.brush !== cur.brush)
            drawable.shapes.push({
                orig: cur.orig,
                dest: cur.dest,
                brush: cur.brush,
            });
        onChange(drawable);
    }
    function onChange(drawable) {
        if (drawable.onChange)
            drawable.onChange(drawable.shapes);
    }

    function start$1(s, e) {
        if (!(s.trustAllEvents || e.isTrusted))
            return; // only trust when trustAllEvents is enabled
        if (e.buttons !== undefined && e.buttons > 1)
            return; // only touch or left click
        if (e.touches && e.touches.length > 1)
            return; // support one finger touch only
        const bounds = s.dom.bounds(), position = eventPosition(e), orig = getKeyAtDomPos(position, whitePov(s), bounds);
        if (!orig)
            return;
        const piece = s.pieces.get(orig);
        const previouslySelected = s.selected;
        if (!previouslySelected &&
            s.drawable.enabled &&
            (s.drawable.eraseOnClick || !piece || piece.color !== s.turnColor))
            clear(s);
        // Prevent touch scroll and create no corresponding mouse event, if there
        // is an intent to interact with the board.
        if (e.cancelable !== false &&
            (!e.touches || s.blockTouchScroll || piece || previouslySelected || pieceCloseTo(s, position)))
            e.preventDefault();
        else if (e.touches)
            return; // Handle only corresponding mouse event https://github.com/lichess-org/chessground/pull/268
        const hadPremove = !!s.premovable.current;
        const hadPredrop = !!s.predroppable.current;
        s.stats.ctrlKey = e.ctrlKey;
        if (s.selected && canMove(s, s.selected, orig)) {
            anim(state => selectSquare(state, orig), s);
        }
        else {
            selectSquare(s, orig);
        }
        const stillSelected = s.selected === orig;
        const element = pieceElementByKey(s, orig);
        if (piece && element && stillSelected && isDraggable(s, orig)) {
            s.draggable.current = {
                orig,
                piece,
                origPos: position,
                pos: position,
                started: s.draggable.autoDistance && s.stats.dragged,
                element,
                previouslySelected,
                originTarget: e.target,
                keyHasChanged: false,
            };
            element.cgDragging = true;
            element.classList.add('dragging');
            // place ghost
            const ghost = s.dom.elements.ghost;
            if (ghost) {
                ghost.className = `ghost ${piece.color} ${piece.role}`;
                translate(ghost, posToTranslate(bounds)(key2pos(orig), whitePov(s)));
                setVisible(ghost, true);
            }
            processDrag(s);
        }
        else {
            if (hadPremove)
                unsetPremove(s);
            if (hadPredrop)
                unsetPredrop(s);
        }
        s.dom.redraw();
    }
    function pieceCloseTo(s, pos) {
        const asWhite = whitePov(s), bounds = s.dom.bounds(), radiusSq = Math.pow((s.touchIgnoreRadius * bounds.width) / 16, 2) * 2;
        for (const key of s.pieces.keys()) {
            const center = computeSquareCenter(key, asWhite, bounds);
            if (distanceSq(center, pos) <= radiusSq)
                return true;
        }
        return false;
    }
    function dragNewPiece(s, piece, e, force) {
        const key = 'a0';
        s.pieces.set(key, piece);
        s.dom.redraw();
        const position = eventPosition(e);
        s.draggable.current = {
            orig: key,
            piece,
            origPos: position,
            pos: position,
            started: true,
            element: () => pieceElementByKey(s, key),
            originTarget: e.target,
            newPiece: true,
            force: !!force,
            keyHasChanged: false,
        };
        processDrag(s);
    }
    function processDrag(s) {
        requestAnimationFrame(() => {
            const cur = s.draggable.current;
            if (!cur)
                return;
            // cancel animations while dragging
            if (s.animation.current?.plan.anims.has(cur.orig))
                s.animation.current = undefined;
            // if moving piece is gone, cancel
            const origPiece = s.pieces.get(cur.orig);
            if (!origPiece || !samePiece(origPiece, cur.piece))
                cancel(s);
            else {
                if (!cur.started && distanceSq(cur.pos, cur.origPos) >= Math.pow(s.draggable.distance, 2))
                    cur.started = true;
                if (cur.started) {
                    // support lazy elements
                    if (typeof cur.element === 'function') {
                        const found = cur.element();
                        if (!found)
                            return;
                        found.cgDragging = true;
                        found.classList.add('dragging');
                        cur.element = found;
                    }
                    const bounds = s.dom.bounds();
                    translate(cur.element, [
                        cur.pos[0] - bounds.left - bounds.width / 16,
                        cur.pos[1] - bounds.top - bounds.height / 16,
                    ]);
                    cur.keyHasChanged || (cur.keyHasChanged = cur.orig !== getKeyAtDomPos(cur.pos, whitePov(s), bounds));
                }
            }
            processDrag(s);
        });
    }
    function move(s, e) {
        // support one finger touch only
        if (s.draggable.current && (!e.touches || e.touches.length < 2)) {
            s.draggable.current.pos = eventPosition(e);
        }
    }
    function end(s, e) {
        const cur = s.draggable.current;
        if (!cur)
            return;
        // create no corresponding mouse event
        if (e.type === 'touchend' && e.cancelable !== false)
            e.preventDefault();
        // comparing with the origin target is an easy way to test that the end event
        // has the same touch origin
        if (e.type === 'touchend' && cur.originTarget !== e.target && !cur.newPiece) {
            s.draggable.current = undefined;
            return;
        }
        unsetPremove(s);
        unsetPredrop(s);
        // touchend has no position; so use the last touchmove position instead
        const eventPos = eventPosition(e) || cur.pos;
        const dest = getKeyAtDomPos(eventPos, whitePov(s), s.dom.bounds());
        if (dest && cur.started && cur.orig !== dest) {
            if (cur.newPiece)
                dropNewPiece(s, cur.orig, dest, cur.force);
            else {
                s.stats.ctrlKey = e.ctrlKey;
                if (userMove(s, cur.orig, dest))
                    s.stats.dragged = true;
            }
        }
        else if (cur.newPiece) {
            s.pieces.delete(cur.orig);
        }
        else if (s.draggable.deleteOnDropOff && !dest) {
            s.pieces.delete(cur.orig);
            callUserFunction(s.events.change);
        }
        if ((cur.orig === cur.previouslySelected || cur.keyHasChanged) && (cur.orig === dest || !dest))
            unselect(s);
        else if (!s.selectable.enabled)
            unselect(s);
        removeDragElements(s);
        s.draggable.current = undefined;
        s.dom.redraw();
    }
    function cancel(s) {
        const cur = s.draggable.current;
        if (cur) {
            if (cur.newPiece)
                s.pieces.delete(cur.orig);
            s.draggable.current = undefined;
            unselect(s);
            removeDragElements(s);
            s.dom.redraw();
        }
    }
    function removeDragElements(s) {
        const e = s.dom.elements;
        if (e.ghost)
            setVisible(e.ghost, false);
    }
    function pieceElementByKey(s, key) {
        let el = s.dom.elements.board.firstChild;
        while (el) {
            if (el.cgKey === key && el.tagName === 'PIECE')
                return el;
            el = el.nextSibling;
        }
        return;
    }

    function explosion(state, keys) {
        state.exploding = { stage: 1, keys };
        state.dom.redraw();
        setTimeout(() => {
            setStage(state, 2);
            setTimeout(() => setStage(state, undefined), 120);
        }, 120);
    }
    function setStage(state, stage) {
        if (state.exploding) {
            if (stage)
                state.exploding.stage = stage;
            else
                state.exploding = undefined;
            state.dom.redraw();
        }
    }

    // see API types and documentations in dts/api.d.ts
    function start(state, redrawAll) {
        function toggleOrientation$1() {
            toggleOrientation(state);
            redrawAll();
        }
        return {
            set(config) {
                if (config.orientation && config.orientation !== state.orientation)
                    toggleOrientation$1();
                applyAnimation(state, config);
                (config.fen ? anim : render$2)(state => configure(state, config), state);
            },
            state,
            getFen: () => write(state.pieces),
            toggleOrientation: toggleOrientation$1,
            setPieces(pieces) {
                anim(state => setPieces(state, pieces), state);
            },
            selectSquare(key, force) {
                if (key)
                    anim(state => selectSquare(state, key, force), state);
                else if (state.selected) {
                    unselect(state);
                    state.dom.redraw();
                }
            },
            move(orig, dest) {
                anim(state => baseMove(state, orig, dest), state);
            },
            newPiece(piece, key) {
                anim(state => baseNewPiece(state, piece, key), state);
            },
            playPremove() {
                if (state.premovable.current) {
                    if (anim(playPremove, state))
                        return true;
                    // if the premove couldn't be played, redraw to clear it up
                    state.dom.redraw();
                }
                return false;
            },
            playPredrop(validate) {
                if (state.predroppable.current) {
                    const result = playPredrop(state, validate);
                    state.dom.redraw();
                    return result;
                }
                return false;
            },
            cancelPremove() {
                render$2(unsetPremove, state);
            },
            cancelPredrop() {
                render$2(unsetPredrop, state);
            },
            cancelMove() {
                render$2(state => {
                    cancelMove(state);
                    cancel(state);
                }, state);
            },
            stop() {
                render$2(state => {
                    stop(state);
                    cancel(state);
                }, state);
            },
            explode(keys) {
                explosion(state, keys);
            },
            setAutoShapes(shapes) {
                render$2(state => (state.drawable.autoShapes = shapes), state);
            },
            setShapes(shapes) {
                render$2(state => (state.drawable.shapes = shapes.slice()), state);
            },
            getKeyAtDomPos(pos) {
                return getKeyAtDomPos(pos, whitePov(state), state.dom.bounds());
            },
            redrawAll,
            dragNewPiece(piece, event, force) {
                dragNewPiece(state, piece, event, force);
            },
            destroy() {
                stop(state);
                state.dom.unbind && state.dom.unbind();
                state.dom.destroyed = true;
            },
        };
    }

    function defaults() {
        return {
            pieces: read(initial),
            orientation: 'white',
            turnColor: 'white',
            coordinates: true,
            coordinatesOnSquares: false,
            ranksPosition: 'right',
            autoCastle: true,
            viewOnly: false,
            disableContextMenu: false,
            addPieceZIndex: false,
            blockTouchScroll: false,
            touchIgnoreRadius: 1,
            pieceKey: false,
            trustAllEvents: false,
            highlight: {
                lastMove: true,
                check: true,
            },
            animation: {
                enabled: true,
                duration: 200,
            },
            movable: {
                free: true,
                color: 'both',
                showDests: true,
                events: {},
                rookCastle: true,
            },
            premovable: {
                enabled: true,
                showDests: true,
                castle: true,
                events: {},
            },
            predroppable: {
                enabled: false,
                events: {},
            },
            draggable: {
                enabled: true,
                distance: 3,
                autoDistance: true,
                showGhost: true,
                deleteOnDropOff: false,
            },
            dropmode: {
                active: false,
            },
            selectable: {
                enabled: true,
            },
            stats: {
                // on touchscreen, default to "tap-tap" moves
                // instead of drag
                dragged: !('ontouchstart' in window),
            },
            events: {},
            drawable: {
                enabled: true, // can draw
                visible: true, // can view
                defaultSnapToValidMove: true,
                eraseOnClick: true,
                shapes: [],
                autoShapes: [],
                brushes: {
                    green: { key: 'g', color: '#15781B', opacity: 1, lineWidth: 10 },
                    red: { key: 'r', color: '#882020', opacity: 1, lineWidth: 10 },
                    blue: { key: 'b', color: '#003088', opacity: 1, lineWidth: 10 },
                    yellow: { key: 'y', color: '#e68f00', opacity: 1, lineWidth: 10 },
                    paleBlue: { key: 'pb', color: '#003088', opacity: 0.4, lineWidth: 15 },
                    paleGreen: { key: 'pg', color: '#15781B', opacity: 0.4, lineWidth: 15 },
                    paleRed: { key: 'pr', color: '#882020', opacity: 0.4, lineWidth: 15 },
                    paleGrey: {
                        key: 'pgr',
                        color: '#4a4a4a',
                        opacity: 0.35,
                        lineWidth: 15,
                    },
                    purple: { key: 'purple', color: '#68217a', opacity: 0.65, lineWidth: 10 },
                    pink: { key: 'pink', color: '#ee2080', opacity: 0.5, lineWidth: 10 },
                    white: { key: 'white', color: 'white', opacity: 1, lineWidth: 10 },
                    paleWhite: { key: 'pwhite', color: 'white', opacity: 0.6, lineWidth: 10 },
                },
                prevSvgHash: '',
            },
            hold: timer(),
        };
    }

    function createDefs() {
        const defs = createElement('defs');
        const filter = setAttributes(createElement('filter'), { id: 'cg-filter-blur' });
        filter.appendChild(setAttributes(createElement('feGaussianBlur'), { stdDeviation: '0.013' }));
        defs.appendChild(filter);
        return defs;
    }
    function renderSvg(state, els) {
        const d = state.drawable, curD = d.current, cur = curD && curD.mouseSq ? curD : undefined, dests = new Map(), bounds = state.dom.bounds(), nonPieceAutoShapes = d.autoShapes.filter(autoShape => !autoShape.piece);
        for (const s of d.shapes.concat(nonPieceAutoShapes).concat(cur ? [cur] : [])) {
            if (!s.dest)
                continue;
            const sources = dests.get(s.dest) ?? new Set(), from = pos2user(orient(key2pos(s.orig), state.orientation), bounds), to = pos2user(orient(key2pos(s.dest), state.orientation), bounds);
            sources.add(moveAngle(from, to));
            dests.set(s.dest, sources);
        }
        const shapes = [];
        for (const s of d.shapes.concat(nonPieceAutoShapes)) {
            shapes.push({
                shape: s,
                current: false,
                hash: shapeHash(s, isShort(s.dest, dests), false, bounds),
            });
        }
        if (cur)
            shapes.push({
                shape: cur,
                current: true,
                hash: shapeHash(cur, isShort(cur.dest, dests), true, bounds),
            });
        const fullHash = shapes.map(sc => sc.hash).join(';');
        if (fullHash === state.drawable.prevSvgHash)
            return;
        state.drawable.prevSvgHash = fullHash;
        syncDefs(d, shapes, els);
        syncShapes$1(shapes, els, s => renderShape$1(state, s, d.brushes, dests, bounds));
    }
    // append only. Don't try to update/remove.
    function syncDefs(d, shapes, els) {
        for (const shapesEl of [els.shapes, els.shapesBelow]) {
            const defsEl = shapesEl.querySelector('defs');
            const thisPlane = shapes.filter(s => (shapesEl === els.shapesBelow) === !!s.shape.below);
            const brushes = new Map();
            for (const s of thisPlane.filter(s => s.shape.dest && s.shape.brush)) {
                const brush = makeCustomBrush(d.brushes[s.shape.brush], s.shape.modifiers);
                const { key, color } = hiliteOf(s.shape);
                if (key && color)
                    brushes.set(key, { key, color, opacity: 1, lineWidth: 1 });
                brushes.set(brush.key, brush);
            }
            const keysInDom = new Set();
            let el = defsEl.firstElementChild;
            while (el) {
                keysInDom.add(el.getAttribute('cgKey'));
                el = el.nextElementSibling;
            }
            for (const [key, brush] of brushes.entries()) {
                if (!keysInDom.has(key))
                    defsEl.appendChild(renderMarker(brush));
            }
        }
    }
    function syncShapes$1(shapes, els, renderShape) {
        for (const [shapesEl, customEl] of [
            [els.shapes, els.custom],
            [els.shapesBelow, els.customBelow],
        ]) {
            const [shapesG, customG] = [shapesEl, customEl].map(el => el.querySelector('g'));
            const thisPlane = shapes.filter(s => (shapesEl === els.shapesBelow) === !!s.shape.below);
            const hashesInDom = new Map();
            for (const sc of thisPlane)
                hashesInDom.set(sc.hash, false);
            for (const root of [shapesG, customG]) {
                const toRemove = [];
                let el = root.firstElementChild, elHash;
                while (el) {
                    elHash = el.getAttribute('cgHash');
                    if (hashesInDom.has(elHash))
                        hashesInDom.set(elHash, true);
                    else
                        toRemove.push(el);
                    el = el.nextElementSibling;
                }
                for (const el of toRemove)
                    root.removeChild(el);
            }
            // insert shapes that are not yet in dom
            for (const sc of thisPlane.filter(s => !hashesInDom.get(s.hash))) {
                for (const svg of renderShape(sc)) {
                    if (svg.isCustom)
                        customG.appendChild(svg.el);
                    else
                        shapesG.appendChild(svg.el);
                }
            }
        }
    }
    function shapeHash({ orig, dest, brush, piece, modifiers, customSvg, label, below }, shorten, current, bounds) {
        // a shape and an overlay svg share a lifetime and have the same cgHash attribute
        return [
            bounds.width,
            bounds.height,
            current,
            orig,
            dest,
            brush,
            shorten && '-',
            piece && pieceHash(piece),
            modifiers && modifiersHash(modifiers),
            customSvg && `custom-${textHash(customSvg.html)},${customSvg.center?.[0] ?? 'o'}`,
            label && `label-${textHash(label.text)}`,
            below && 'below',
        ]
            .filter(x => x)
            .join(',');
    }
    function pieceHash(piece) {
        return [piece.color, piece.role, piece.scale].filter(x => x).join(',');
    }
    function modifiersHash(m) {
        return [m.lineWidth, m.hilite].filter(x => x).join(',');
    }
    function textHash(s) {
        // Rolling hash with base 31 (cf. https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript)
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = ((h << 5) - h + s.charCodeAt(i)) >>> 0;
        }
        return h.toString();
    }
    function renderShape$1(state, { shape, current, hash }, brushes, dests, bounds) {
        const from = pos2user(orient(key2pos(shape.orig), state.orientation), bounds), to = shape.dest ? pos2user(orient(key2pos(shape.dest), state.orientation), bounds) : from, brush = shape.brush && makeCustomBrush(brushes[shape.brush], shape.modifiers), slots = dests.get(shape.dest), svgs = [];
        if (brush) {
            const el = setAttributes(createElement('g'), { cgHash: hash });
            svgs.push({ el });
            if (from[0] !== to[0] || from[1] !== to[1])
                el.appendChild(renderArrow(shape, brush, from, to, current, isShort(shape.dest, dests)));
            else
                el.appendChild(renderCircle(brushes[shape.brush], from, current, bounds));
        }
        if (shape.label) {
            const label = shape.label;
            label.fill ?? (label.fill = shape.brush && brushes[shape.brush].color);
            const corner = shape.brush ? undefined : 'tr';
            svgs.push({ el: renderLabel(label, hash, from, to, slots, corner), isCustom: true });
        }
        if (shape.customSvg) {
            const on = shape.customSvg.center ?? 'orig';
            const [x, y] = on === 'label' ? labelCoords(from, to, slots).map(c => c - 0.5) : on === 'dest' ? to : from;
            const el = setAttributes(createElement('g'), { transform: `translate(${x},${y})`, cgHash: hash });
            el.innerHTML = `<svg width="1" height="1" viewBox="0 0 100 100">${shape.customSvg.html}</svg>`;
            svgs.push({ el, isCustom: true });
        }
        return svgs;
    }
    function renderCircle(brush, at, current, bounds) {
        const widths = circleWidth(), radius = (bounds.width + bounds.height) / (4 * Math.max(bounds.width, bounds.height));
        return setAttributes(createElement('circle'), {
            stroke: brush.color,
            'stroke-width': widths[current ? 0 : 1],
            fill: 'none',
            opacity: opacity(brush, current),
            cx: at[0],
            cy: at[1],
            r: radius - widths[1] / 2,
        });
    }
    function renderArrow(s, brush, from, to, current, shorten) {
        function renderLine(isHilite) {
            const m = arrowMargin(shorten && !current), dx = to[0] - from[0], dy = to[1] - from[1], angle = Math.atan2(dy, dx), xo = Math.cos(angle) * m, yo = Math.sin(angle) * m;
            const hilite = hiliteOf(s);
            return setAttributes(createElement('line'), {
                stroke: isHilite ? hilite.color : brush.color,
                'stroke-width': lineWidth(brush, current) * (isHilite ? 1.14 : 1),
                'stroke-linecap': 'round',
                'marker-end': `url(#arrowhead-${isHilite ? hilite.key : brush.key})`,
                opacity: s.modifiers?.hilite ? 1 : opacity(brush, current),
                x1: from[0],
                y1: from[1],
                x2: to[0] - xo,
                y2: to[1] - yo,
            });
        }
        if (!s.modifiers?.hilite)
            return renderLine(false);
        const g = setAttributes(createElement('g'), { opacity: brush.opacity });
        const blurred = setAttributes(createElement('g'), { filter: 'url(#cg-filter-blur)' });
        blurred.appendChild(filterBox(from, to));
        blurred.appendChild(renderLine(true));
        g.appendChild(blurred);
        g.appendChild(renderLine(false));
        return g;
    }
    function renderMarker(brush) {
        const marker = setAttributes(createElement('marker'), {
            id: 'arrowhead-' + brush.key,
            orient: 'auto',
            overflow: 'visible',
            markerWidth: 4,
            markerHeight: 4,
            refX: brush.key.startsWith('hilite') ? 1.86 : 2.05,
            refY: 2,
        });
        marker.appendChild(setAttributes(createElement('path'), {
            d: 'M0,0 V4 L3,2 Z',
            fill: brush.color,
        }));
        marker.setAttribute('cgKey', brush.key);
        return marker;
    }
    function renderLabel(label, hash, from, to, slots, corner) {
        const labelSize = 0.4, fontSize = labelSize * 0.75 ** label.text.length, at = labelCoords(from, to, slots), cornerOff = corner === 'tr' ? 0.4 : 0, g = setAttributes(createElement('g'), {
            transform: `translate(${at[0] + cornerOff},${at[1] - cornerOff})`,
            cgHash: hash,
        });
        g.appendChild(setAttributes(createElement('circle'), {
            r: labelSize / 2,
            'fill-opacity': corner ? 1.0 : 0.8,
            'stroke-opacity': corner ? 1.0 : 0.7,
            'stroke-width': 0.03,
            fill: label.fill ?? '#666',
            stroke: 'white',
        }));
        const labelEl = setAttributes(createElement('text'), {
            'font-size': fontSize,
            'font-family': 'Noto Sans',
            'text-anchor': 'middle',
            fill: 'white',
            y: 0.13 * 0.75 ** label.text.length,
        });
        labelEl.innerHTML = label.text;
        g.appendChild(labelEl);
        return g;
    }
    function orient(pos, color) {
        return color === 'white' ? pos : [7 - pos[0], 7 - pos[1]];
    }
    function isShort(dest, dests) {
        return true === (dest && dests.has(dest) && dests.get(dest).size > 1);
    }
    function createElement(tagName) {
        return document.createElementNS('http://www.w3.org/2000/svg', tagName);
    }
    function setAttributes(el, attrs) {
        for (const key in attrs) {
            if (Object.prototype.hasOwnProperty.call(attrs, key))
                el.setAttribute(key, attrs[key]);
        }
        return el;
    }
    function makeCustomBrush(base, modifiers) {
        return !modifiers
            ? base
            : {
                color: base.color,
                opacity: Math.round(base.opacity * 10) / 10,
                lineWidth: Math.round(modifiers.lineWidth || base.lineWidth),
                key: [base.key, modifiers.lineWidth].filter(x => x).join(''),
            };
    }
    function circleWidth() {
        return [3 / 64, 4 / 64];
    }
    function lineWidth(brush, current) {
        return ((brush.lineWidth || 10) * (current ? 0.85 : 1)) / 64;
    }
    function hiliteOf(shape) {
        const hilite = shape.modifiers?.hilite;
        return { key: hilite && `hilite-${hilite.replace('#', '')}`, color: hilite };
    }
    function opacity(brush, current) {
        return (brush.opacity || 1) * (current ? 0.9 : 1);
    }
    function arrowMargin(shorten) {
        return (shorten ? 20 : 10) / 64;
    }
    function pos2user(pos, bounds) {
        const xScale = Math.min(1, bounds.width / bounds.height);
        const yScale = Math.min(1, bounds.height / bounds.width);
        return [(pos[0] - 3.5) * xScale, (3.5 - pos[1]) * yScale];
    }
    function filterBox(from, to) {
        // lines/arrows are considered to be one dimensional for the purposes of SVG filters,
        // so we add a transparent bounding box to ensure they apply to the 2nd dimension
        const box = {
            from: [Math.floor(Math.min(from[0], to[0])), Math.floor(Math.min(from[1], to[1]))],
            to: [Math.ceil(Math.max(from[0], to[0])), Math.ceil(Math.max(from[1], to[1]))],
        };
        return setAttributes(createElement('rect'), {
            x: box.from[0],
            y: box.from[1],
            width: box.to[0] - box.from[0],
            height: box.to[1] - box.from[1],
            fill: 'none',
            stroke: 'none',
        });
    }
    function moveAngle(from, to, asSlot = true) {
        const angle = Math.atan2(to[1] - from[1], to[0] - from[0]) + Math.PI;
        return asSlot ? (Math.round((angle * 8) / Math.PI) + 16) % 16 : angle;
    }
    function dist(from, to) {
        return Math.sqrt([from[0] - to[0], from[1] - to[1]].reduce((acc, x) => acc + x * x, 0));
    }
    /*
     try to place label at the junction of the destination shaft and arrowhead. if there's more than
     1 arrow pointing to a square, the arrow shortens by 10 / 64 units so the label must move as well.
     
     if the angle between two incoming arrows is pi / 8, such as when an adjacent knight and bishop
     attack the same square, the knight's label is slid further down the shaft by an amount equal to
     our label size to avoid collision
    */
    function labelCoords(from, to, slots) {
        let mag = dist(from, to);
        //if (mag === 0) return [from[0], from[1]];
        const angle = moveAngle(from, to, false);
        if (slots) {
            mag -= 33 / 64; // reduce by arrowhead length
            if (slots.size > 1) {
                mag -= 10 / 64; // reduce by shortening factor
                const slot = moveAngle(from, to);
                if (slots.has((slot + 1) % 16) || slots.has((slot + 15) % 16)) {
                    if (slot & 1)
                        mag -= 0.4;
                    // and by label size for the knight if another arrow is within pi / 8.
                }
            }
        }
        return [from[0] - Math.cos(angle) * mag, from[1] - Math.sin(angle) * mag].map(c => c + 0.5);
    }

    function renderWrap(element, s) {
        // .cg-wrap (element passed to Chessground)
        //   cg-container
        //     cg-board
        //     svg.cg-shapes
        //       defs
        //       g
        //     svg.cg-custom-svgs
        //       g
        //     cg-auto-pieces
        //     coords.ranks
        //     coords.files
        //     piece.ghost
        element.innerHTML = '';
        // ensure the cg-wrap class is set
        // so bounds calculation can use the CSS width/height values
        // add that class yourself to the element before calling chessground
        // for a slight performance improvement! (avoids recomputing style)
        element.classList.add('cg-wrap');
        for (const c of colors)
            element.classList.toggle('orientation-' + c, s.orientation === c);
        element.classList.toggle('manipulable', !s.viewOnly);
        const container = createEl('cg-container');
        element.appendChild(container);
        const board = createEl('cg-board');
        container.appendChild(board);
        let shapesBelow;
        let shapes;
        let customBelow;
        let custom;
        let autoPieces;
        if (s.drawable.visible) {
            [shapesBelow, shapes] = ['cg-shapes-below', 'cg-shapes'].map(cls => svgContainer(cls, true));
            [customBelow, custom] = ['cg-custom-below', 'cg-custom-svgs'].map(cls => svgContainer(cls, false));
            autoPieces = createEl('cg-auto-pieces');
            container.appendChild(shapesBelow);
            container.appendChild(customBelow);
            container.appendChild(shapes);
            container.appendChild(custom);
            container.appendChild(autoPieces);
        }
        if (s.coordinates) {
            const orientClass = s.orientation === 'black' ? ' black' : '';
            const ranksPositionClass = s.ranksPosition === 'left' ? ' left' : '';
            if (s.coordinatesOnSquares) {
                const rankN = s.orientation === 'white' ? i => i + 1 : i => 8 - i;
                files.forEach((f, i) => container.appendChild(renderCoords(ranks.map(r => f + r), 'squares rank' + rankN(i) + orientClass + ranksPositionClass)));
            }
            else {
                container.appendChild(renderCoords(ranks, 'ranks' + orientClass + ranksPositionClass));
                container.appendChild(renderCoords(files, 'files' + orientClass));
            }
        }
        let ghost;
        if (s.draggable.enabled && s.draggable.showGhost) {
            ghost = createEl('piece', 'ghost');
            setVisible(ghost, false);
            container.appendChild(ghost);
        }
        return { board, container, wrap: element, ghost, shapes, shapesBelow, custom, customBelow, autoPieces };
    }
    function svgContainer(cls, isShapes) {
        const svg = setAttributes(createElement('svg'), {
            class: cls,
            viewBox: isShapes ? '-4 -4 8 8' : '-3.5 -3.5 8 8',
            preserveAspectRatio: 'xMidYMid slice',
        });
        if (isShapes)
            svg.appendChild(createDefs());
        svg.appendChild(createElement('g'));
        return svg;
    }
    function renderCoords(elems, className) {
        const el = createEl('coords', className);
        let f;
        for (const elem of elems) {
            f = createEl('coord');
            f.textContent = elem;
            el.appendChild(f);
        }
        return el;
    }

    function drop(s, e) {
        if (!s.dropmode.active)
            return;
        unsetPremove(s);
        unsetPredrop(s);
        const piece = s.dropmode.piece;
        if (piece) {
            s.pieces.set('a0', piece);
            const position = eventPosition(e);
            const dest = position && getKeyAtDomPos(position, whitePov(s), s.dom.bounds());
            if (dest)
                dropNewPiece(s, 'a0', dest);
        }
        s.dom.redraw();
    }

    function bindBoard(s, onResize) {
        const boardEl = s.dom.elements.board;
        if ('ResizeObserver' in window)
            new ResizeObserver(onResize).observe(s.dom.elements.wrap);
        if (s.disableContextMenu || s.drawable.enabled) {
            boardEl.addEventListener('contextmenu', e => e.preventDefault());
        }
        if (s.viewOnly)
            return;
        // Cannot be passive, because we prevent touch scrolling and dragging of
        // selected elements.
        const onStart = startDragOrDraw(s);
        boardEl.addEventListener('touchstart', onStart, {
            passive: false,
        });
        boardEl.addEventListener('mousedown', onStart, {
            passive: false,
        });
    }
    // returns the unbind function
    function bindDocument(s, onResize) {
        const unbinds = [];
        // Old versions of Edge and Safari do not support ResizeObserver. Send
        // chessground.resize if a user action has changed the bounds of the board.
        if (!('ResizeObserver' in window))
            unbinds.push(unbindable(document.body, 'chessground.resize', onResize));
        if (!s.viewOnly) {
            const onmove = dragOrDraw(s, move, move$1);
            const onend = dragOrDraw(s, end, end$1);
            for (const ev of ['touchmove', 'mousemove'])
                unbinds.push(unbindable(document, ev, onmove));
            for (const ev of ['touchend', 'mouseup'])
                unbinds.push(unbindable(document, ev, onend));
            const onScroll = () => s.dom.bounds.clear();
            unbinds.push(unbindable(document, 'scroll', onScroll, { capture: true, passive: true }));
            unbinds.push(unbindable(window, 'resize', onScroll, { passive: true }));
        }
        return () => unbinds.forEach(f => f());
    }
    function unbindable(el, eventName, callback, options) {
        el.addEventListener(eventName, callback, options);
        return () => el.removeEventListener(eventName, callback, options);
    }
    const startDragOrDraw = (s) => e => {
        if (s.draggable.current)
            cancel(s);
        else if (s.drawable.current)
            cancel$1(s);
        else if (e.shiftKey || isRightButton(e)) {
            if (s.drawable.enabled)
                start$2(s, e);
        }
        else if (!s.viewOnly) {
            if (s.dropmode.active)
                drop(s, e);
            else
                start$1(s, e);
        }
    };
    const dragOrDraw = (s, withDrag, withDraw) => e => {
        if (s.drawable.current) {
            if (s.drawable.enabled)
                withDraw(s, e);
        }
        else if (!s.viewOnly)
            withDrag(s, e);
    };

    // ported from https://github.com/lichess-org/lichobile/blob/master/src/chessground/render.ts
    // in case of bugs, blame @veloce
    function render$1(s) {
        const asWhite = whitePov(s), posToTranslate$1 = posToTranslate(s.dom.bounds()), boardEl = s.dom.elements.board, pieces = s.pieces, curAnim = s.animation.current, anims = curAnim ? curAnim.plan.anims : new Map(), fadings = curAnim ? curAnim.plan.fadings : new Map(), curDrag = s.draggable.current, squares = computeSquareClasses(s), samePieces = new Set(), sameSquares = new Set(), movedPieces = new Map(), movedSquares = new Map(); // by class name
        let k, el, pieceAtKey, elPieceName, anim, fading, pMvdset, pMvd, sMvdset, sMvd;
        // walk over all board dom elements, apply animations and flag moved pieces
        el = boardEl.firstChild;
        while (el) {
            k = el.cgKey;
            if (isPieceNode(el)) {
                pieceAtKey = pieces.get(k);
                anim = anims.get(k);
                fading = fadings.get(k);
                elPieceName = el.cgPiece;
                // if piece not being dragged anymore, remove dragging style
                if (el.cgDragging && (!curDrag || curDrag.orig !== k)) {
                    el.classList.remove('dragging');
                    translate(el, posToTranslate$1(key2pos(k), asWhite));
                    el.cgDragging = false;
                }
                // remove fading class if it still remains
                if (!fading && el.cgFading) {
                    el.cgFading = false;
                    el.classList.remove('fading');
                }
                // there is now a piece at this dom key
                if (pieceAtKey) {
                    // continue animation if already animating and same piece
                    // (otherwise it could animate a captured piece)
                    if (anim && el.cgAnimating && elPieceName === pieceNameOf(pieceAtKey)) {
                        const pos = key2pos(k);
                        pos[0] += anim[2];
                        pos[1] += anim[3];
                        el.classList.add('anim');
                        translate(el, posToTranslate$1(pos, asWhite));
                    }
                    else if (el.cgAnimating) {
                        el.cgAnimating = false;
                        el.classList.remove('anim');
                        translate(el, posToTranslate$1(key2pos(k), asWhite));
                        if (s.addPieceZIndex)
                            el.style.zIndex = posZIndex(key2pos(k), asWhite);
                    }
                    // same piece: flag as same
                    if (elPieceName === pieceNameOf(pieceAtKey) && (!fading || !el.cgFading)) {
                        samePieces.add(k);
                    }
                    // different piece: flag as moved unless it is a fading piece
                    else {
                        if (fading && elPieceName === pieceNameOf(fading)) {
                            el.classList.add('fading');
                            el.cgFading = true;
                        }
                        else {
                            appendValue(movedPieces, elPieceName, el);
                        }
                    }
                }
                // no piece: flag as moved
                else {
                    appendValue(movedPieces, elPieceName, el);
                }
            }
            else if (isSquareNode(el)) {
                const cn = el.className;
                if (squares.get(k) === cn)
                    sameSquares.add(k);
                else
                    appendValue(movedSquares, cn, el);
            }
            el = el.nextSibling;
        }
        // walk over all squares in current set, apply dom changes to moved squares
        // or append new squares
        for (const [sk, className] of squares) {
            if (!sameSquares.has(sk)) {
                sMvdset = movedSquares.get(className);
                sMvd = sMvdset && sMvdset.pop();
                const translation = posToTranslate$1(key2pos(sk), asWhite);
                if (sMvd) {
                    sMvd.cgKey = sk;
                    translate(sMvd, translation);
                }
                else {
                    const squareNode = createEl('square', className);
                    squareNode.cgKey = sk;
                    translate(squareNode, translation);
                    boardEl.insertBefore(squareNode, boardEl.firstChild);
                }
            }
        }
        // walk over all pieces in current set, apply dom changes to moved pieces
        // or append new pieces
        for (const [k, p] of pieces) {
            anim = anims.get(k);
            if (!samePieces.has(k)) {
                pMvdset = movedPieces.get(pieceNameOf(p));
                pMvd = pMvdset && pMvdset.pop();
                // a same piece was moved
                if (pMvd) {
                    // apply dom changes
                    pMvd.cgKey = k;
                    if (pMvd.cgFading) {
                        pMvd.classList.remove('fading');
                        pMvd.cgFading = false;
                    }
                    const pos = key2pos(k);
                    if (s.addPieceZIndex)
                        pMvd.style.zIndex = posZIndex(pos, asWhite);
                    if (anim) {
                        pMvd.cgAnimating = true;
                        pMvd.classList.add('anim');
                        pos[0] += anim[2];
                        pos[1] += anim[3];
                    }
                    translate(pMvd, posToTranslate$1(pos, asWhite));
                }
                // no piece in moved obj: insert the new piece
                // assumes the new piece is not being dragged
                else {
                    const pieceName = pieceNameOf(p), pieceNode = createEl('piece', pieceName), pos = key2pos(k);
                    pieceNode.cgPiece = pieceName;
                    pieceNode.cgKey = k;
                    if (anim) {
                        pieceNode.cgAnimating = true;
                        pos[0] += anim[2];
                        pos[1] += anim[3];
                    }
                    translate(pieceNode, posToTranslate$1(pos, asWhite));
                    if (s.addPieceZIndex)
                        pieceNode.style.zIndex = posZIndex(pos, asWhite);
                    boardEl.appendChild(pieceNode);
                }
            }
        }
        // remove any element that remains in the moved sets
        for (const nodes of movedPieces.values())
            removeNodes(s, nodes);
        for (const nodes of movedSquares.values())
            removeNodes(s, nodes);
    }
    function renderResized$1(s) {
        const asWhite = whitePov(s), posToTranslate$1 = posToTranslate(s.dom.bounds());
        let el = s.dom.elements.board.firstChild;
        while (el) {
            if ((isPieceNode(el) && !el.cgAnimating) || isSquareNode(el)) {
                translate(el, posToTranslate$1(key2pos(el.cgKey), asWhite));
            }
            el = el.nextSibling;
        }
    }
    function updateBounds(s) {
        const bounds = s.dom.elements.wrap.getBoundingClientRect();
        const container = s.dom.elements.container;
        const ratio = bounds.height / bounds.width;
        const width = (Math.floor((bounds.width * window.devicePixelRatio) / 8) * 8) / window.devicePixelRatio;
        const height = width * ratio;
        container.style.width = width + 'px';
        container.style.height = height + 'px';
        s.dom.bounds.clear();
        s.addDimensionsCssVarsTo?.style.setProperty('---cg-width', width + 'px');
        s.addDimensionsCssVarsTo?.style.setProperty('---cg-height', height + 'px');
    }
    const isPieceNode = (el) => el.tagName === 'PIECE';
    const isSquareNode = (el) => el.tagName === 'SQUARE';
    function removeNodes(s, nodes) {
        for (const node of nodes)
            s.dom.elements.board.removeChild(node);
    }
    function posZIndex(pos, asWhite) {
        const minZ = 3;
        const rank = pos[1];
        const z = asWhite ? minZ + 7 - rank : minZ + rank;
        return `${z}`;
    }
    const pieceNameOf = (piece) => `${piece.color} ${piece.role}`;
    function computeSquareClasses(s) {
        const squares = new Map();
        if (s.lastMove && s.highlight.lastMove)
            for (const k of s.lastMove) {
                addSquare(squares, k, 'last-move');
            }
        if (s.check && s.highlight.check)
            addSquare(squares, s.check, 'check');
        if (s.selected) {
            addSquare(squares, s.selected, 'selected');
            if (s.movable.showDests) {
                const dests = s.movable.dests?.get(s.selected);
                if (dests)
                    for (const k of dests) {
                        addSquare(squares, k, 'move-dest' + (s.pieces.has(k) ? ' oc' : ''));
                    }
                const pDests = s.premovable.customDests?.get(s.selected) ?? s.premovable.dests;
                if (pDests)
                    for (const k of pDests) {
                        addSquare(squares, k, 'premove-dest' + (s.pieces.has(k) ? ' oc' : ''));
                    }
            }
        }
        const premove = s.premovable.current;
        if (premove)
            for (const k of premove)
                addSquare(squares, k, 'current-premove');
        else if (s.predroppable.current)
            addSquare(squares, s.predroppable.current.key, 'current-premove');
        const o = s.exploding;
        if (o)
            for (const k of o.keys)
                addSquare(squares, k, 'exploding' + o.stage);
        if (s.highlight.custom) {
            s.highlight.custom.forEach((v, k) => {
                addSquare(squares, k, v);
            });
        }
        return squares;
    }
    function addSquare(squares, key, klass) {
        const classes = squares.get(key);
        if (classes)
            squares.set(key, `${classes} ${klass}`);
        else
            squares.set(key, klass);
    }
    function appendValue(map, key, value) {
        const arr = map.get(key);
        if (arr)
            arr.push(value);
        else
            map.set(key, [value]);
    }

    // append and remove only. No updates.
    function syncShapes(shapes, root, renderShape) {
        const hashesInDom = new Map(), // by hash
        toRemove = [];
        for (const sc of shapes)
            hashesInDom.set(sc.hash, false);
        let el = root.firstElementChild, elHash;
        while (el) {
            elHash = el.getAttribute('cgHash');
            // found a shape element that's here to stay
            if (hashesInDom.has(elHash))
                hashesInDom.set(elHash, true);
            // or remove it
            else
                toRemove.push(el);
            el = el.nextElementSibling;
        }
        // remove old shapes
        for (const el of toRemove)
            root.removeChild(el);
        // insert shapes that are not yet in dom
        for (const sc of shapes) {
            if (!hashesInDom.get(sc.hash))
                root.appendChild(renderShape(sc));
        }
    }

    function render(state, autoPieceEl) {
        const autoPieces = state.drawable.autoShapes.filter(autoShape => autoShape.piece);
        const autoPieceShapes = autoPieces.map((s) => {
            return {
                shape: s,
                hash: hash(s),
                current: false,
            };
        });
        syncShapes(autoPieceShapes, autoPieceEl, shape => renderShape(state, shape, state.dom.bounds()));
    }
    function renderResized(state) {
        const asWhite = whitePov(state), posToTranslate$1 = posToTranslate(state.dom.bounds());
        let el = state.dom.elements.autoPieces?.firstChild;
        while (el) {
            translateAndScale(el, posToTranslate$1(key2pos(el.cgKey), asWhite), el.cgScale);
            el = el.nextSibling;
        }
    }
    function renderShape(state, { shape, hash }, bounds) {
        const orig = shape.orig;
        const role = shape.piece?.role;
        const color = shape.piece?.color;
        const scale = shape.piece?.scale;
        const pieceEl = createEl('piece', `${role} ${color}`);
        pieceEl.setAttribute('cgHash', hash);
        pieceEl.cgKey = orig;
        pieceEl.cgScale = scale;
        translateAndScale(pieceEl, posToTranslate(bounds)(key2pos(orig), whitePov(state)), scale);
        return pieceEl;
    }
    const hash = (autoPiece) => [autoPiece.orig, autoPiece.piece?.role, autoPiece.piece?.color, autoPiece.piece?.scale].join(',');

    function initModule({ el, config }) {
        return Chessground(el, config);
    }
    function Chessground(element, config) {
        const maybeState = defaults();
        configure(maybeState, config || {});
        function redrawAll() {
            const prevUnbind = 'dom' in maybeState ? maybeState.dom.unbind : undefined;
            // compute bounds from existing board element if possible
            // this allows non-square boards from CSS to be handled (for 3D)
            const elements = renderWrap(element, maybeState), bounds = memo(() => elements.board.getBoundingClientRect()), redrawNow = (skipSvg) => {
                render$1(state);
                if (elements.autoPieces)
                    render(state, elements.autoPieces);
                if (!skipSvg && elements.shapes)
                    renderSvg(state, elements);
            }, onResize = () => {
                updateBounds(state);
                renderResized$1(state);
                if (elements.autoPieces)
                    renderResized(state);
            };
            const state = maybeState;
            state.dom = {
                elements,
                bounds,
                redraw: debounceRedraw(redrawNow),
                redrawNow,
                unbind: prevUnbind,
            };
            state.drawable.prevSvgHash = '';
            updateBounds(state);
            redrawNow(false);
            bindBoard(state, onResize);
            if (!prevUnbind)
                state.dom.unbind = bindDocument(state, onResize);
            state.events.insert && state.events.insert(elements);
            return state;
        }
        return start(redrawAll(), redrawAll);
    }
    function debounceRedraw(redrawNow) {
        let redrawing = false;
        return () => {
            if (redrawing)
                return;
            redrawing = true;
            requestAnimationFrame(() => {
                redrawNow();
                redrawing = false;
            });
        };
    }

    exports.Chessground = Chessground;
    exports.initModule = initModule;

}));
//# sourceMappingURL=chessground.js.map
