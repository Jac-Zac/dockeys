// Google Docs has moved from using editable HTML elements (textbox with contenteditable=true)
// to custom implementation with its own editing surface since 2015. (https://drive.googleblog.com/2010/05/whats-different-about-new-google-docs.html)
// This means that each keystroke is captured and then fed into layout engine which 
// then draws the text, cursor, selection, headings etc on seperate iframe.
// Such implementation deters any extensibility in terms of text manipulation because 
// there is no API to interact with Google Docs layout engine

// Thus only way (in my understanding) to achieve vim motions would be to capture keystrokes
// before sending to layout engine and interpret them into respective vim motion/command.
// Then implement those motions by sending relevant keystrokes. Essentially doing a keystroke to keystroke remapping. 

function initializeDocsKeys() {
const iframe = document.querySelector('.docs-texteventtarget-iframe')
if (!iframe?.contentDocument?.body) {
    setTimeout(initializeDocsKeys, 100)
    return
}
iframe.contentDocument.addEventListener('keydown', eventHandler, true)

let mode = 'normal'
let pendingIndent = null
let pendingFind = null
let operationRunning = false
let editRequestId = 0
const settle = () => new Promise(resolve => setTimeout(resolve, 50))
let cursorRoot = null

function updateCursorAppearance() {
    // Collaborator cursors have a name label; the local cursor's label is empty.
    const nextRoot = Array.from(document.querySelectorAll('.kix-cursor')).find(cursor =>
        cursor.querySelector('.kix-cursor-caret') &&
        !cursor.querySelector('.kix-cursor-name')?.textContent.trim()
    )
    if (cursorRoot !== nextRoot) {
        cursorRoot?.classList.remove('docskeys-block-cursor')
        cursorRoot = nextRoot
    }
    cursorRoot?.classList.toggle('docskeys-block-cursor', mode !== 'insert')
}

// Docs can replace its cursor when switching document tabs or rebuilding a page.
new MutationObserver(() => {
    if (!cursorRoot?.isConnected) updateCursorAppearance()
}).observe(document.body, { childList: true, subtree: true })

let tempnormal = false // State variable for indicating temperory normal mode
let multipleMotion = {
    times:0,
    mode:"normal"
}

// How to simulate a keypress in Chrome: http://stackoverflow.com/a/10520017/46237
// Note that we have to do this keypress simulation in an injected script, because events dispatched
// by content scripts do not preserve overridden properties.
const script = document.createElement("script");
script.src = chrome.runtime.getURL("page_script.js");
document.documentElement.appendChild(script);

const isMac = /Mac/.test(navigator.platform || navigator.userAgent);

const keyCodes = {
    backspace: 8,
    enter: 13,
    esc: 27,
    end: 35,
    home: 36,
    left: 37,
    up: 38,
    right: 39,
    down: 40,
    bracketLeft: 219,
    bracketRight: 221,
    save: 83,
    "delete": 46,
};

const wordModifierKey = isMac ? 'alt' : 'control'
const paragraphModifierKey = isMac ? 'alt' : 'control'

function wordMods(shift = false) {
    return { shift, [wordModifierKey]: true }
}

function paragraphMods(shift = false) {
    return { shift, [paragraphModifierKey]: true }
}

// Send request to injected page script to simulate keypress
// Messages are passed to page script via "doc-keys-simulate-keypress" events, which are dispatched
// on the window object by the content script.
function sendKeyEvent(key, mods = {}) {
    const keyCode = keyCodes[key]
    const defaultMods = { shift: false, control: false, alt: false, meta: false }
    window.dispatchEvent(new CustomEvent("doc-keys-simulate-keypress", { detail: { keyCode, mods: { ...defaultMods, ...mods } } }));
}

//Mode indicator thing (insert, visualline)
const modeIndicator = document.createElement('div')
modeIndicator.style.position = 'fixed'
modeIndicator.style.bottom = '20px'
modeIndicator.style.right = '20px'
modeIndicator.style.padding = '8px 16px'
modeIndicator.style.borderRadius = '4px'
modeIndicator.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
modeIndicator.style.fontSize = '14px'
modeIndicator.style.fontWeight = '500'
modeIndicator.style.zIndex = '9999'
document.body.appendChild(modeIndicator)

function updateModeIndicator(currentMode) {
    updateCursorAppearance()
    modeIndicator.textContent = currentMode.toUpperCase()
    switch(currentMode) {
        case 'normal':
            modeIndicator.style.backgroundColor = '#1a73e8'
            modeIndicator.style.color = 'white'
            break
        case 'insert':
            modeIndicator.style.backgroundColor = '#34a853'
            modeIndicator.style.color = 'white'
            break
        case 'visual':
        case 'visualLine':
            modeIndicator.style.backgroundColor = '#fbbc04'
            modeIndicator.style.color = 'black'
            break
        case 'waitForFirstInput':
        case 'waitForSecondInput':
        case 'waitForVisualInput':
            modeIndicator.style.backgroundColor = '#ea4335'
            modeIndicator.style.color = 'white'
            break
    }
}

function repeatMotion(motion, times, key) {
  for (let i = 0; i < times; i++) {
      motion(key)
  }
}

function switchModeToVisual() {
    mode = 'visual'
    updateModeIndicator(mode)
    sendKeyEvent('right', { shift: true })
}

function switchModeToVisualLine() {
    mode = 'visualLine'
    updateModeIndicator(mode)
    goToStartOfLine()
    sendKeyEvent('down', { shift: true })
}

function switchModeToNormal() {
    pendingIndent = null
    pendingFind = null
    if (mode == "visualLine" || mode == "waitForFirstInput") sendKeyEvent("left")
    mode = 'normal'
    updateModeIndicator(mode)
}

function switchModeToInsert() {
    mode = 'insert'
    updateModeIndicator(mode)
}

function switchModeToWait() {
    mode = "waitForFirstInput"
    updateModeIndicator(mode)
    // define cursor style
}

function switchModeToWait2() {
    mode = "waitForSecondInput"
    updateModeIndicator(mode)
    // define cursor style
}

let longStringOp = ""


function goToStartOfLine(shift = false) {
    sendKeyEvent(isMac ? 'left' : 'home', { shift, meta: isMac })
}

function goToEndOfLine(shift = false) {
    sendKeyEvent(isMac ? 'right' : 'end', { shift, meta: isMac })
}

function selectToStartOfLine() {
    goToStartOfLine(true)
}

function selectToEndOfLine() {
    goToEndOfLine(true)
}

function indentLines(key, count = 1) {
    const selecting = mode === 'visual' || mode === 'visualLine' || count > 1
    if (count > 1) {
        goToStartOfLine()
        for (let i = 1; i < count; i++) sendKeyEvent('down', { shift: true })
        selectToEndOfLine()
    }
    sendKeyEvent(key === '>' ? 'bracketRight' : 'bracketLeft', { [isMac ? 'meta' : 'control']: true })
    if (selecting) sendKeyEvent('left')
    mode = 'normal'
    updateModeIndicator(mode)
}

function focusEditor() {
    iframe.contentWindow.focus()
    const doc = iframe.contentDocument
    ;(doc.querySelector('[contenteditable="true"]') || doc.body).focus()
}

function deleteToEnd(change) {
    selectToEndOfLine()
    if (!iframe.contentWindow.getSelection().isCollapsed) sendKeyEvent('backspace')
    if (change) switchModeToInsert()
    else switchModeToNormal()
}

function findForOperator(character) {
    const find = pendingFind
    pendingFind = null
    selectToEndOfLine()
    const sel = iframe.contentWindow.getSelection()
    const remaining = Array.from(sel.toString())
    if (!sel.isCollapsed) sendKeyEvent('left')
    const index = remaining.indexOf(character, 1)
    if (index < 0) { switchModeToNormal(); return }
    const count = index + (find.motion === 'f' ? 1 : 0)
    for (let i = 0; i < count; i++) sendKeyEvent('right', { shift: true })
    if (find.operator === 'y') runLongStringOp('y')
    else {
        sendKeyEvent('backspace')
        if (find.operator === 'c') switchModeToInsert()
        else switchModeToNormal()
    }
}

async function runOperation(action) {
    if (operationRunning) return
    operationRunning = true
    try { await action() }
    catch (error) { console.warn('DocsKeys:', error) }
    finally { operationRunning = false; switchModeToNormal() }
}

document.addEventListener('keydown', event => {
    if (operationRunning && event.key === 'Escape') operationRunning = false
}, true)

function replaceText(text) {
    return new Promise((resolve, reject) => {
        const id = ++editRequestId
        const finish = event => {
            if (event.detail.id !== id) return
            clearTimeout(timer)
            window.removeEventListener('doc-keys-edit-result', finish)
            if (event.detail.error) reject(new Error(event.detail.error))
            else resolve()
        }
        const timer = setTimeout(() => {
            window.removeEventListener('doc-keys-edit-result', finish)
            reject(new Error('Editor did not confirm the edit'))
        }, 2000)
        window.addEventListener('doc-keys-edit-result', finish)
        window.dispatchEvent(new CustomEvent('doc-keys-edit-text', { detail: { id, text } }))
    })
}

async function capitalizeSelection(label) {
    const format = Array.from(document.querySelectorAll('.menu-button')).find(el => el.textContent.trim() === 'Format')
    if (!format) throw new Error('Format menu unavailable')
    simulateClick(format)
    for (const caption of ['Text', 'Capitalization', label]) {
        let item
        for (let attempt = 0; attempt < 30 && operationRunning; attempt++) {
            item = Array.from(document.querySelectorAll('.goog-menuitem')).find(el =>
                el.getClientRects().length > 0 && el.innerText.trim().toLowerCase().startsWith(caption.toLowerCase()))
            if (item) break
            await settle()
        }
        if (!item) throw new Error('Capitalization menu unavailable')
        simulateClick(item)
    }
    focusEditor()
    await settle()
}

function changeCase(key, count = 1) {
    const visual = mode === 'visual' || mode === 'visualLine'
    const selected = iframe.contentWindow.getSelection().toString()
    void runOperation(async () => {
        if (key === 'U' || key === 'u') {
            if (!selected) return
            await capitalizeSelection(key === 'U' ? 'UPPERCASE' : 'lowercase')
            if (!iframe.contentWindow.getSelection().isCollapsed) sendKeyEvent('left')
            return
        }
        if (visual) {
            count = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(selected)).length
            if (selected) sendKeyEvent('left')
        }
        for (let i = 0; i < count && operationRunning; i++) {
            sendKeyEvent('right', { shift: true })
            await settle()
            const sel = iframe.contentWindow.getSelection()
            const character = sel.toString()
            if (!character || (!visual && /[\r\n]/.test(character))) {
                if (!sel.isCollapsed) sendKeyEvent('left')
                break
            }
            if (character.toLowerCase() !== character.toUpperCase()) {
                await capitalizeSelection(character === character.toLowerCase() ? 'UPPERCASE' : 'lowercase')
            }
            if (!iframe.contentWindow.getSelection().isCollapsed) sendKeyEvent('right')
        }
    })
}

function openCommandLine() {
    const visual = mode === 'visual' || mode === 'visualLine'
    const previousMode = mode
    const selected = visual ? iframe.contentWindow.getSelection().toString() : ''
    const input = document.createElement('input')
    input.setAttribute('aria-label', 'Vim command')
    input.placeholder = ':w | :normal Itext | :normal Atext'
    input.value = visual ? "'<,'>" : ''
    Object.assign(input.style, { position: 'fixed', bottom: '20px', left: '20px',
        width: 'min(600px, 65vw)', padding: '8px', font: '16px monospace', zIndex: '10000' })
    const close = () => { input.remove(); focusEditor(); mode = previousMode }
    input.addEventListener('keydown', event => {
        event.stopPropagation()
        if (event.key === 'Escape') { event.preventDefault(); close(); return }
        if (event.key !== 'Enter') return
        event.preventDefault()
        const command = input.value.replace(/^'<,'>\s*/, '').replace(/^:/, '').trimStart()
        if (/^w\s*$/.test(command)) {
            close()
            sendKeyEvent('save', { [isMac ? 'meta' : 'control']: true })
            switchModeToNormal()
            return
        }
        const match = command.match(/^norm(?:al)?!?\s+([IA])(.*)$/)
        if (!match) { input.style.borderColor = 'red'; return }
        close()
        const rows = selected ? selected.split('\n') : ['']
        if (selected.endsWith('\n')) rows.pop()
        void runOperation(async () => {
            if (!match[2]) return
            await settle()
            if (visual && selected) {
                sendKeyEvent('right')
                if (selected.endsWith('\n')) sendKeyEvent('left')
            }
            const sel = iframe.contentWindow.getSelection()
            if (sel.focusOffset > 0) goToStartOfPara()
            for (let i = rows.length - 1; i >= 0 && operationRunning; i--) {
                if (document.activeElement !== iframe || !document.hasFocus()) break
                if (match[1] === 'A' && rows[i]) sendKeyEvent('down', paragraphMods())
                else if (match[1] === 'A') goToEndOfLine()
                await settle()
                await replaceText(match[2])
                goToStartOfPara()
                if (i > 0) goToStartOfPara()
            }
        })
    })
    document.body.appendChild(input)
    input.focus()
}

function selectToStartOfWord() {
    sendKeyEvent("left", wordMods(true))
}

function selectToEndOfWord() {
    sendKeyEvent("right", wordMods(true))
}

function goToEndOfWord() {
    sendKeyEvent("right", wordMods())
}

function goToStartOfWord() {
    sendKeyEvent("left", wordMods())
}

function goToDocStart(shift = false) {
    if (isMac) {
        sendKeyEvent("up", { meta: true, shift })
    } else {
        sendKeyEvent("home", { control: true, shift })
    }
}

function goToDocEnd(shift = false) {
    if (isMac) {
        sendKeyEvent("down", { meta: true, shift })
    } else {
        sendKeyEvent("end", { control: true, shift })
    }
}

function goToTop() {
    goToDocStart(true)
    longStringOp = ""
}

function selectToEndOfPara() {
    sendKeyEvent("down", paragraphMods(true))
}
function goToEndOfPara(shift = false) {
    sendKeyEvent("down", paragraphMods(shift))
    sendKeyEvent("right", { shift })
}
function goToStartOfPara(shift = false) {
    sendKeyEvent("up", paragraphMods(shift))
}


function addLineTop() {
    goToStartOfLine()
    sendKeyEvent("enter", { shift: true })
    sendKeyEvent("up")
    switchModeToInsert()
}
function addLineBottom() {
    goToEndOfLine()
    sendKeyEvent("enter", { shift: true })
    switchModeToInsert()
}

function runLongStringOp(operation = longStringOp) {
    switch (operation) {
        case "c":
            clickMenu(menuItems.cut)
            switchModeToInsert()
            break
        case "d":
            clickMenu(menuItems.cut)
            mode = 'normal'
            switchModeToNormal()
            break
        case "y":
            clickMenu(menuItems.copy)
            switchModeToNormal()
            break
        case "p":
            clickMenu(menuItems.paste)
            switchModeToNormal()
            break
        case "v":
            break
        case "g":
            goToTop()
            break
    }
}


function waitForSecondInput(key) {
    switch (key) {
        case "w":
            goToStartOfWord()
            waitForFirstInput(key)
            break
        case "p":
            goToStartOfPara()
            waitForFirstInput(key)
            break
        default:
            switchModeToNormal()
            break
    }
}

function waitForFirstInput(key) {
    switch (key) {
        case 't':
        case 'f':
            pendingFind = { motion: key, operator: longStringOp }
            mode = 'waitForFindCharacter'
            break
        case "i":
        case "a":
            switchModeToWait2()
            break
        case "w":
            selectToEndOfWord()
            runLongStringOp()
            break
        case "p":
            selectToEndOfPara()
            runLongStringOp()
            break
        case "^":
        case "_":
        case "0":
            selectToStartOfLine()
            runLongStringOp()
            break
        case "$":
            selectToEndOfLine()
            runLongStringOp()
            break
				case "G":
            goToDocEnd(true)
            runLongStringOp()
            break
        case "g":
            goToDocStart(true)
            runLongStringOp()
            break
        case longStringOp:
            goToStartOfLine()
            selectToEndOfLine()
            runLongStringOp()
            break
        default:
            switchModeToNormal()
    }
}

function waitForVisualInput(key) {
    switch (key) {
        case "w":
            sendKeyEvent("left",{control:true})
            goToStartOfWord()
            selectToEndOfWord()
            break
        case "p":
            goToStartOfPara()
            goToEndOfPara(true)
            break
    }
    mode = "visualLine"
}

function handleMultipleMotion(key) {
    if (/[0-9]/.test(key)) {
        multipleMotion.times = Number(String(multipleMotion.times)+key)
        return
    }

    if (multipleMotion.mode === 'normal' && (key === '>' || key === '<')) {
        pendingIndent = { key, count: multipleMotion.times }
        mode = 'normal'
        return
    }
    if (multipleMotion.mode === 'normal' && key === '~') {
        mode = 'normal'
        changeCase(key, multipleMotion.times)
        return
    }

    switch (multipleMotion.mode) {
        case "normal":
            repeatMotion(handleKeyEventNormal,multipleMotion.times,key)
            break
        case "visualLine":
        case "visual":
            repeatMotion(handleKeyEventVisualLine,multipleMotion.times,key)
            break
    }

    mode = multipleMotion.mode
}



function eventHandler(e) {
    if (
        ["Shift","Meta","Control","Alt",""].includes(e.key)
    ) return
    if (operationRunning) {
        e.preventDefault()
        if (e.key === 'Escape') operationRunning = false
        return
    }
        
    
    if (e.ctrlKey && mode=='insert' && e.key=='o' ){
        e.preventDefault()
        e.stopImmediatePropagation()
        switchModeToNormal()

        // Turn on state variable to indicate temperory normal mode
        tempnormal = true
        return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key == 'Escape') {
        e.preventDefault()
        const sel = iframe.contentWindow.getSelection()
        if (mode === 'insert' && sel?.isCollapsed && sel.focusNode?.nodeType === 3 &&
            sel.focusOffset > 0 && sel.focusNode.textContent[sel.focusOffset - 1] !== '\n') {
            sendKeyEvent('left')
        }
        if (mode == 'visualLine' || mode == 'visual') {
            sendKeyEvent("right")
        }
        switchModeToNormal()
        return;
    }
    if (mode != 'insert') {
        e.preventDefault()
        if (pendingIndent && mode === 'normal') {
            const pending = pendingIndent
            pendingIndent = null
            if (e.key === pending.key) {
                indentLines(e.key, pending.count)
                return
            }
        }
        switch (mode) {
            case "normal":
                handleKeyEventNormal(e.key)
                break
            case "visual":
            case "visualLine":
                handleKeyEventVisualLine(e.key)
                break
            case "waitForFirstInput":
                waitForFirstInput(e.key)
                break
            case "waitForSecondInput":
                waitForSecondInput(e.key)
                break
            case 'waitForFindCharacter':
                findForOperator(e.key)
                break
            case "waitForVisualInput":
                waitForVisualInput(e.key)
                break
            case "multipleMotion":
                handleMultipleMotion(e.key)
                break
        }
    }
}

function handleKeyEventNormal(key) {
    if (/[1-9]/.test(key)) {
        mode = "multipleMotion"
        multipleMotion.mode = "normal"
        multipleMotion.times = Number(key)
        return
    }
    
    switch (key) {
        case ':':
            openCommandLine()
            break
        case '~':
            changeCase(key)
            break
        case 'D':
        case 'C':
            deleteToEnd(key === 'C')
            break
        case '>':
        case '<':
            pendingIndent = { key, count: 1 }
            break
        case "h":
            sendKeyEvent("left")
            break
        case "j":
            sendKeyEvent("down")
            break
        case "k":
            sendKeyEvent("up")
            break
        case "l":
            sendKeyEvent("right")
            break
        case "}":
            goToEndOfPara()
            break
        case "{":
            goToStartOfPara()
            break
        case "b":
            goToStartOfWord()
            break
        case "e":
            goToEndOfWord()
            sendKeyEvent("right")
            break
        case "w":
            goToEndOfWord()
            break
        case "g":
            goToDocStart()
            break
        case "G":
            goToDocEnd()
            break
        case "c":
        case "d":
        case "y":
            longStringOp = key
            mode = "waitForFirstInput"
            break
        case "p":
            clickMenu(menuItems.paste)
            break
        case "a":
            sendKeyEvent("right")
            switchModeToInsert()
            break
        case "i":
            switchModeToInsert()
            break
        case "^":
        case "_":
        case "0":
            goToStartOfLine()
            break
        case "$":
            goToEndOfLine()
            break
        case "I":
            goToStartOfLine()
            switchModeToInsert()
            break
        case "A":
            goToEndOfLine()
            switchModeToInsert()
            break
        case "v":
            switchModeToVisual()
            break
        case "V":
            switchModeToVisualLine()
            break
        case "o":
            addLineBottom()
            break
        case "O":
            addLineTop()
            break
        case "u":
            clickMenu(menuItems.undo)
            break
        case "r":
            clickMenu(menuItems.redo)
            break
        case "/":
            clickMenu(menuItems.find)
            break
        case "x":
            sendKeyEvent("delete")
            break
				case "s":
            sendKeyEvent("delete")
            switchModeToInsert()
            break
        case "J":
            goToEndOfLine()
            sendKeyEvent("delete")
            break
        default:
            return;
    }
    // Check if operation is occuring in temperory normal mode after ctrl-o
    if (tempnormal) {
        tempnormal = false
        if (mode != 'visual' && mode != 'visualLine'){  // Switch back to insert 
            switchModeToInsert()                        // after operation
            }
    }
}

function handleKeyEventVisualLine(key) {
    if (/[1-9]/.test(key)) {
        mode = "multipleMotion"
        multipleMotion.mode = "visualLine"
        multipleMotion.times = Number(key)
        return
    }

    switch (key) {
        case ':':
            openCommandLine()
            break
        case 'U':
        case 'u':
        case '~':
            changeCase(key)
            break
        case '>':
        case '<':
            indentLines(key)
            break
        case "":
            break
        case "h":
            sendKeyEvent("left", { shift: true })
            break
        case "j":
            sendKeyEvent("down", { shift: true })
            break
        case "k":
            sendKeyEvent("up", { shift: true })
            break
        case "l":
            sendKeyEvent("right", { shift: true })
            break
        case "p":
            clickMenu(menuItems.paste)
            switchModeToNormal()
            break
        case "}":
            goToEndOfPara(true)
            break
        case "{":
            goToStartOfPara(true)
            break
        case "b":
            selectToStartOfWord()
            break
        case "e":
        case "w":
            selectToEndOfWord()
            break
        case "^":
        case "_":
        case "0":
            selectToStartOfLine()
            break
        case "$":
            selectToEndOfLine()
            break
        case "G":
            goToDocEnd(true)
            break
        case "g":
            goToDocStart(true)
            break
        case "c":
        case "d":
        case "y":
            runLongStringOp(key)
            break
        case "i":
        case "a":
            mode = "waitForVisualInput"
            break


    }
}

let menuItemElements = {}

let menuItems = {
    copy: { parent: "Edit", caption: "Copy" },
    cut: { parent: "Edit", caption: "Cut" },
    paste: { parent: "Edit", caption: "Paste" },
    redo: { parent: "Edit", caption: "Redo" },
    undo: { parent: "Edit", caption: "Undo" },
    find: { parent: "Edit", caption: "Find" },
}

function clickMenu(itemCaption) {
    simulateClick(getMenuItem(itemCaption));
}

function clickToolbarButton(captionList) {
    // Sometimes a toolbar button won't exist in the DOM until its parent has been clicked, so we
    // click all of its parents in sequence.
    for (const caption of Array.from(captionList)) {
        const els = document.querySelectorAll(`*[aria-label='${caption}']`);
        if (els.length == 0) {
            console.log(`Couldn't find the element for the button labeled ${caption}.`);
            console.log(captionList);
            return;
        }
        // Sometimes there are multiple elements that have the same label. When that happens, it's
        // ambiguous which one to click, so we log it so it's easier to debug.
        if (els.length > 1) {
            console.log(
                `Warning: there are multiple buttons with the caption ${caption}. ` +
                "We're expecting only 1.",
            );
            console.log(captionList);
        }
        simulateClick(els[0]);
    }
}
// Returns the DOM element of the menu item with the given caption. Prints a warning if a menu
// item isn't found (since this is a common source of errors in SheetKeys) unless silenceWarning
// is true.

function getMenuItem(menuItem, silenceWarning = false) {
    const caption = menuItem.caption;
    let el = menuItemElements[caption];
    if (el) return el;
    el = findMenuItem(menuItem);
    if (!el) {
        if (!silenceWarning) console.error("Could not find menu item with caption", menuItem.caption);
        return null;
    }
    return menuItemElements[caption] = el;
}

function findMenuItem(menuItem) {
    activateTopLevelMenu(menuItem.parent);
    const menuItemEls = document.querySelectorAll(".goog-menuitem");
    const caption = menuItem.caption;
    const isRegexp = caption instanceof RegExp;
    for (const el of Array.from(menuItemEls)) {
        const label = el.innerText;
        if (!label) continue;
        if (isRegexp) {
            if (caption.test(label)) {
                return el;
            }
        } else {
            if (label.startsWith(caption)) {
                return el;
            }
        }
    }
    return null;
}

function simulateClick(el, x = 0, y = 0) {
    const eventSequence = ["mouseover", "mousedown", "mouseup", "click"];
    for (const eventName of eventSequence) {
        const event = document.createEvent("MouseEvents");
        event.initMouseEvent(
            eventName,
            true, // bubbles
            true, // cancelable
            window, //view
            1, // event-detail
            x, // screenX
            y, // screenY
            x, // clientX
            y, // clientY
            false, // ctrl
            false, // alt
            false, // shift
            false, // meta
            0, // button
            null, // relatedTarget
        );
        el.dispatchEvent(event);
    }
}

function activateTopLevelMenu(menuCaption) {
    const buttons = Array.from(document.querySelectorAll(".menu-button"));
    const button = buttons.find((el) => el.innerText.trim() == menuCaption);
    if (!button) {
        throw new Error(`Couldn't find top-level button with caption ${menuCaption}`);
    }
    // Unlike submenus, top-level menus can be hidden by clicking the button a second time to
    // dismiss the menu.
    simulateClick(button);
    simulateClick(button);
}

// Initiate to Normal Mode
switchModeToNormal()

}
initializeDocsKeys()
