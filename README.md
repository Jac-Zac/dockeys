# DocsKeys

This fork adds a blue block cursor in Normal/Visual modes and keeps Docs' caret in
Insert. The width is approximate with proportional fonts. On macOS, line motions
use Command+Left/Right; `Esc` leaves Insert on the last character when Braille text
is available.

- `>>` / `<<`: indent / unindent. Counts work (`3>>`); Visual mode uses `>` / `<`.
  Indentation applies to paragraphs/list items covered by the selected displayed lines.
- `D` / `C`: delete to line end / delete and enter Insert.
- `dt<char>` / `df<char>`: delete before / through the next character on the line.
- Normal `~`, Visual `U` / `u` / `~`: toggle case, uppercase or lowercase using Docs'
  native commands to preserve formatting. Normal `u` remains Undo.
- `:w`: send Save (Docs still autosaves).
- Select lines with `V`, then `:normal Itext` / `:normal Atext` to prefix / suffix
  each selected paragraph. Only these two `:normal` forms are supported.

Press Enter to run a command or Esc to cancel. Macros and rectangular selection
are not supported.

A browser extension that brings Vim-style keyboard shortcuts to Google Docs, allowing you to edit documents with familiar Vim motions and commands.

While this extension currently implements core Vim functionality including basic motions, text manipulation, and visual selections, there's room for expansion. Contributions are welcome to add more Vim features as per your need.

If you are using DocsKeys with Vimium, disable Vimium on Google Docs.

This project is heavily inspired by and uses much of code from [SheetKeys](https://github.com/philc/sheetkeys)

### Available Motions

#### Basic Movement
- `h` - Move cursor left
- `j` - Move cursor down
- `k` - Move cursor up
- `l` - Move cursor right
- `w` - Move to start of next word
- `b` - Move to start of previous word
- `e` - Move to end of current word

### Numbered Prefixed Motions

- `{n}h` - Move cursor left n times
- `{n}j` - Move cursor down n times
- `{n}k` - Move cursor up n times
- `{n}l` - Move cursor right n times
- `{n}w` - Move to start of n words
- `{n}b` - Move to start of n previous word
- `{n}e` - Move to end of n word

#### Line Navigation
- `0` or `^` or `_` - Go to start of line
- `$` - Go to end of line
- `I` - Go to start of line and enter insert mode
- `A` - Go to end of line and enter insert mode

#### Document Navigation
- `g` - Go to document start
- `G` - Go to document end
- `{` - Go to start of paragraph
- `}` - Go to end of paragraph
- `/` - Opens Find & Replace Dialog

### Editing Commands

#### Mode Switching
- `i` - Enter insert mode
- `a` - Enter insert mode (after cursor)
- `v` - Enter visual mode
- `V` - Enter visual line mode
- `Esc` - Return to normal mode
- `Ctrl` + `o` - Temporary normal mode from insert mode

#### Text Manipulation
- `d` + motion - Delete (supports `dw`, `diw`, `dp`, `dip`, `dd`, `d_`, `d0`, `d$`)
- `c` + motion - Change (supports `cw`, `ciw`, `cp`, `cip`, `cc`, `c^`)
- `y` + motion - Yank/copy (supports `yw`, `yiw`, `yp`, `yip`, `yy`, `y0`)
- `p` - Paste
- `u` - Undo
- `r` - Redo
- `x` - Delete character in front of cursor

#### Line Operations
- `o` - Add new line below and enter insert mode
- `O` - Add new line above and enter insert mode

### Visual Mode Commands
When in visual mode (`v` or `V`):
- All movement keys (`h`, `j`, `k`, `l`, `w`, `b`, etc.) extend the selection
- `d` - Delete selected text
- `c` - Change selected text
- `y` - Yank selected text
- `p` - Paste over selected text

## Installation

[Chrome Web Store](https://chromewebstore.google.com/detail/docskeys/mmmomengbindngnkjblabjebdfmaiccj) |
[Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/docskeys/)

### Install from source

#### Chrome / Helium
- Disable the store version of DocsKeys to avoid running both versions
- Clone or download this repository
- Navigate to `chrome://extensions` in Chrome
- Toggle into Developer Mode
- Click on "Load Unpacked Extension..."
- Select this repository's folder and reload your Google Docs tabs

#### Firefox (upstream branch)
- Clone or download the [firefox branch](https://github.com/tirthd16/dockeys/tree/firefox) of this repository
- Navigate to `about:debugging` in Firefox
- Click on "This Firefox"
- Click on "Load Temporary Add-on..."
- Select the manifest.json file from the docskeys folder

## Usage

1. Open a Google Doc
2. Enable Screen reader support and Braille support in Docs' Accessibility settings
3. Start using Vim commands in normal mode
4. Press `i` or `a` to enter insert mode for regular typing
5. Press `Esc` to return to normal mode

## Known Limitations

- Most advanced Vim features like marks, macros, and registers are not supported
- Custom key mappings are not supported
- PR's are welcome to add these features

## License

See [MIT-LICENSE.txt](MIT-LICENSE.txt) for details.
