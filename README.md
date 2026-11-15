# DocsKeys

This local build adds a translucent blue block cursor in Normal and Visual modes,
and restores Google's caret in Insert mode. The block follows the caret and scales
with its height; its width is approximate for proportional fonts.
`Esc` leaves Insert mode on the last character when Braille text is available.
On macOS, line motions (`0`, `$`, `I`, `A`, and selections using them) now use
Command+Left/Right instead of Home/End.

To use it in Chrome or a Chromium browser, disable the store version of DocsKeys,
open your browser's Extensions page, enable Developer mode, choose **Load unpacked**,
and select this folder. Reload your Google Docs tabs. Press `Esc` for the block
cursor and `i` for the thin caret. Disable Vimium on Google Docs if installed.

Indent with `>>`, unindent with `<<`. Counts work: `3>>` selects three displayed
lines and indents their paragraphs. In Visual mode use `>` or `<`; for example,
`Vjj>` indents the paragraphs covered by the selection. Google Docs indentation
applies to whole paragraphs/list items, including their wrapped lines.

Also added: `D` / `C` (delete to line end / delete and insert), `dt<char>` /
`df<char>` (delete before / through the next character), Normal `~`, and Visual
`U` / `u` / `~` for case changes. Normal `u` remains Undo. Case changes use Docs'
native capitalization commands to keep formatting.

Press `:` for `:w` (Docs still autosaves). After selecting lines with `V`, use
`:normal Itext` or `:normal Atext` to insert text at each selected paragraph's
start or end. These are the supported `:normal` forms, not a full Vim parser.
Press Enter to run a command or Esc to cancel. There is no macro recording.

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

#### Chrome
- Clone or download this repository
- Navigate to `chrome://extensions` in Chrome
- Toggle into Developer Mode
- Click on "Load Unpacked Extension..."
- Select the docskeys folder

#### Firefox
- Clone or download the [firefox branch](https://github.com/tirthd16/dockeys/tree/firefox) of this repository
- Navigate to `about:debugging` in Firefox
- Click on "This Firefox"
- Click on "Load Temporary Add-on..."
- Select the manifest.json file from the docskeys folder

## Usage

1. Open a Google Doc
2. Extension will automatically activate
3. Start using Vim commands in normal mode
4. Press `i` or `a` to enter insert mode for regular typing
5. Press `Esc` to return to normal mode

## Known Limitations

- Most advanced Vim features like marks, macros, and registers are not supported
- Custom key mappings are not supported
- PR's are welcome to add these features

## License

See [MIT-LICENSE.txt](MIT-LICENSE.txt) for details.
