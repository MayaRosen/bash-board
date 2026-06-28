# Chess Systems: PGN Replay and Browser Engine

This repository explores chess through two complementary implementations:

- A Unix/Linux command-line pipeline that transforms tournament PGN data into an interactive replay.
- A graphical chess game that runs directly in a web browser, with no build step or JavaScript packages.

Together, they demonstrate two very different ways to model the same domain: text-processing and scripting on one side, client-side state management and rules validation on the other.

## Project structure

```text
.
├── chess_sim.sh              # Unix terminal PGN replay
├── parse-moves.py            # SAN-to-UCI conversion with python-chess
├── pgn_split.sh              # Tournament PGN splitter
├── chess_game.html           # Browser game entry point
├── assets/
│   ├── css/chess-game.css    # Responsive graphical interface
│   └── js/chess-game.js      # Chess rules engine and UI state
├── splited/                  # Individual tournament games
└── capmemel24.pgn            # Tournament PGN source data
```

## 1. Unix / Linux PGN replay

The original implementation is a Bash-driven replay tool for games from the 2024 Capablanca Memorial tournament. It reads Portable Game Notation (PGN), converts human-readable algebraic notation into machine-friendly UCI moves, then renders each position in a terminal board.

### Architecture

```text
capmemel24.pgn
      |
      |  pgn_split.sh
      v
individual PGN games in splited/
      |
      |  chess_sim.sh + parse-moves.py
      v
SAN notation -> UCI square-to-square moves -> interactive terminal replay
```

| File | Responsibility |
| --- | --- |
| `pgn_split.sh` | Splits a tournament PGN collection into one file per game using Unix text utilities. |
| `parse-moves.py` | Uses `python-chess` to parse SAN notation such as `Nf3` and emit UCI moves such as `g1f3`. |
| `chess_sim.sh` | Manages an ASCII board, position history, forward/backward navigation, and game metadata display. |
| `capmemel24.pgn` | Source tournament collection. |

### Run the terminal version

Use Git Bash, WSL, or another Linux/Unix-compatible shell. The scripts must use Unix (`LF`) line endings.

```bash
cd "/mnt/c/school/Organize git/EX1_MAARACHOT"
python3 -m pip install --user python-chess
sed -i 's/\r$//' chess_sim.sh pgn_split.sh
bash chess_sim.sh
```

Terminal controls:

| Key | Action |
| --- | --- |
| `d` | Advance one move |
| `a` | Return one move |
| `w` | Reset to the starting position |
| `s` | Jump to the final position |
| `q` | Exit |

To regenerate the individual PGN game files:

```bash
bash pgn_split.sh . splited
```

## 2. Graphical browser chess game

[`chess_game.html`](chess_game.html) is a local browser game implemented directly in vanilla HTML, CSS, and JavaScript—no server, package manager, or framework is required. It uses professional SVG chess assets from Wikimedia Commons, so an internet connection is needed for the piece artwork to load.

### Engine capabilities

- Local two-player gameplay with click-to-move interaction
- Legal-move generation for every piece
- Check detection and filtering of moves that leave the king in check
- Checkmate and stalemate detection
- Castling, including attacked-square and path validation
- En passant capture
- Pawn promotion to queen, rook, bishop, or knight
- Capture handling and castling-right tracking
- Move history, board flipping, and instant game reset
- Start/back/forward/end navigation through the current game's position history
- SVG piece artwork, last-move highlighting, legal-move markers, and board coordinates
- Built-in Capablanca Memorial replay mode: the browser interprets the included PGN's SAN moves with the same local rules engine used for gameplay
- Responsive board layout for desktop and smaller screens

### Technical design

The browser version uses a compact in-memory game state:

```text
board[64] + side to move + castling rights + en-passant target + move log
```

For each selected piece, the engine generates pseudo-legal moves, simulates each resulting position, and retains only moves that do not expose that side's king. This keeps rule enforcement close to the data model and avoids reliance on a third-party chess engine.

### Run the graphical version

Open `chess_game.html` in any modern browser.

From WSL:

```bash
explorer.exe chess_game.html
```

From PowerShell:

```powershell
start chess_game.html
```

## Why two versions?

The command-line version is a data-oriented Unix workflow: it showcases shell scripting, PGN processing, Python integration, and stateful terminal interaction. The graphical version is an interactive rules engine: it showcases event-driven UI programming, responsive rendering, and chess legality validation in the browser.

They share a common chess focus but make different technical strengths visible—one traces historical games from structured data; the other lets players create their own.
