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
let lastFind = null
let operatorCount = 1
let operatorMotionCount = 0
let operation = null
let editRequestId = 0
const settle = async () => {
    await new Promise(resolve => setTimeout(resolve, 50))
    operation?.signal.throwIfAborted()
}
let cursorRoot = null

function updateCursorAppearance() {
    // Collaborator cursors have a name label; the local cursor's label is empty.
    if (!cursorRoot?.isConnected || cursorRoot.querySelector('.kix-cursor-name')?.textContent.trim()) {
        cursorRoot?.classList.remove('docskeys-block-cursor')
        cursorRoot = Array.from(document.querySelectorAll('.kix-cursor')).find(cursor =>
            cursor.querySelector('.kix-cursor-caret') &&
            !cursor.querySelector('.kix-cursor-name')?.textContent.trim()
        )
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

// Simulate Docs keypresses in the page context.
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
    const editor = doc.querySelector('[contenteditable="true"]') || doc.body
    editor.focus()
}

function deleteToEnd(change) {
    selectToEndOfLine()
    if (!iframe.contentWindow.getSelection().isCollapsed) sendKeyEvent('backspace')
    if (change) switchModeToInsert()
    else switchModeToNormal()
}

function startFind(motion, count = 1) {
    pendingFind = { motion, count, operator: mode === 'waitForFirstInput' ? longStringOp : null }
    mode = 'waitForFindCharacter'
}

function findCharacter(character, repeat = false) {
    const { motion, count, operator } = pendingFind
    pendingFind = null
    const backward = motion === motion.toUpperCase()
    const till = motion.toLowerCase() === 't'
    if (backward) selectToStartOfLine()
    else selectToEndOfLine()
    const sel = iframe.contentWindow.getSelection()
    const remaining = Array.from(sel.toString())
    if (!sel.isCollapsed) sendKeyEvent(backward ? 'right' : 'left')
    if (backward) remaining.reverse()
    let index = backward ? -1 : 0
    if (repeat && till && remaining[backward ? 0 : 1] === character) index++
    lastFind = repeat ? lastFind : { motion, character }
    for (let i = 0; i < count; i++) {
        index = remaining.indexOf(character, index + 1)
        if (index < 0) { switchModeToNormal(); return }
    }
    const distance = index + (backward ? 1 : 0) - (till ? 1 : 0)
    const steps = distance + (operator && !backward ? 1 : 0)
    if (operator && !steps) { switchModeToNormal(); return }
    for (let i = 0; i < steps; i++) sendKeyEvent(backward ? 'left' : 'right', { shift: !!operator })
    if (!operator) switchModeToNormal()
    else if (operator === 'y') runLongStringOp('y')
    else {
        if (!sel.isCollapsed) sendKeyEvent('backspace')
        if (operator === 'c') switchModeToInsert()
        else switchModeToNormal()
    }
}

function repeatFind(reverse, count = 1) {
    if (!lastFind) { switchModeToNormal(); return }
    const motion = reverse ? (lastFind.motion === lastFind.motion.toLowerCase()
        ? lastFind.motion.toUpperCase() : lastFind.motion.toLowerCase()) : lastFind.motion
    startFind(motion, count)
    findCharacter(lastFind.character, true)
}

async function runOperation(action) {
    if (operation) return
    operation = new AbortController()
    try { await action() }
    catch (error) { if (!operation.signal.aborted) console.warn('DocsKeys:', error) }
    finally { operation = null; mode = 'normal'; switchModeToNormal() }
}

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') operation?.abort()
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
    activateTopLevelMenu('Format')
    for (const caption of ['Text', 'Capitalization', label]) {
        let item
        for (let attempt = 0; attempt < 30; attempt++) {
            item = findMenuItem({ caption })
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
    void runOperation(async () => {
        if (key === '~' && !visual) selectToEndOfLine()
        const sel = iframe.contentWindow.getSelection()
        const selected = sel.toString()
        if (!selected) return
        if (key === 'U' || key === 'u') {
            await capitalizeSelection(key === 'U' ? 'UPPERCASE' : 'lowercase')
            if (!sel.isCollapsed) sendKeyEvent('left')
            return
        }
        const characters = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(selected), part => part.segment)
            .slice(0, visual ? undefined : count)
        const upper = character => character === character.toLowerCase()
        sendKeyEvent('left')
        // One native capitalization command per run of the same case, preserving formatting.
        for (let start = 0; start < characters.length;) {
            let end = start + 1
            while (end < characters.length && upper(characters[end]) === upper(characters[start])) end++
            for (let i = start; i < end; i++) sendKeyEvent('right', { shift: true })
            await settle()
            const text = sel.toString()
            if (text.toLowerCase() !== text.toUpperCase()) {
                await capitalizeSelection(upper(characters[start]) ? 'UPPERCASE' : 'lowercase')
            }
            if (!sel.isCollapsed) sendKeyEvent('right')
            start = end
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
            for (let i = rows.length - 1; i >= 0; i--) {
                if (document.activeElement !== iframe || !document.hasFocus()) break
                if (match[1] === 'A' && rows[i]) sendKeyEvent('down', paragraphMods())
                else if (match[1] === 'A') goToEndOfLine()
                await settle()
                await replaceText(match[2])
                operation.signal.throwIfAborted()
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
    clickMenu(operation === 'y' ? menuItems.copy : menuItems.cut)
    if (operation === 'c') switchModeToInsert()
    else {
        if (operation === 'd') mode = 'normal'
        switchModeToNormal()
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
    if (/^[0-9]$/.test(key) && (operatorMotionCount || key !== '0')) {
        operatorMotionCount = operatorMotionCount * 10 + Number(key)
        return
    }
    switch (key) {
        case 't':
        case 'f':
        case 'T':
        case 'F':
            startFind(key, operatorCount * (operatorMotionCount || 1))
            break
        case ';':
        case ',':
            repeatFind(key === ',', operatorCount * (operatorMotionCount || 1))
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
        default:
            mode = 'normal'
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
    if (/^[0-9]$/.test(key)) {
        multipleMotion.times = Number(String(multipleMotion.times)+key)
        return
    }

    if (multipleMotion.mode === 'normal' && ['>', '<', '~', 'f', 't', 'F', 'T', ';', ',', 'd', 'c', 'y'].includes(key)) {
        mode = 'normal'
        handleKeyEventNormal(key, multipleMotion.times)
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
    if (operation) {
        e.preventDefault()
        if (e.key === 'Escape') operation.abort()
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
                findCharacter(e.key)
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

function handleKeyEventNormal(key, count = 1) {
    if (/^[1-9]$/.test(key)) {
        mode = "multipleMotion"
        multipleMotion.mode = "normal"
        multipleMotion.times = Number(key)
        return
    }
    
    switch (key) {
        case 'f':
        case 't':
        case 'F':
        case 'T':
            startFind(key, count)
            break
        case ';':
        case ',':
            repeatFind(key === ',', count)
            break
        case ':':
            openCommandLine()
            break
        case '~':
            changeCase(key, count)
            break
        case 'D':
        case 'C':
            deleteToEnd(key === 'C')
            break
        case '>':
        case '<':
            pendingIndent = { key, count }
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
            operatorCount = count
            operatorMotionCount = 0
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
    if (/^[1-9]$/.test(key)) {
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

// Returns the DOM element of the menu item with the given caption. Prints a warning if a menu
// item isn't found (since this is a common source of errors in SheetKeys) unless silenceWarning
// is true.

function getMenuItem(menuItem, silenceWarning = false) {
    const caption = menuItem.caption;
    let el = menuItemElements[caption];
    if (el?.isConnected) return el;
    el = findMenuItem(menuItem);
    if (!el) {
        if (!silenceWarning) console.error("Could not find menu item with caption", menuItem.caption);
        return null;
    }
    return menuItemElements[caption] = el;
}

function findMenuItem(menuItem) {
    if (menuItem.parent) activateTopLevelMenu(menuItem.parent);
    for (const el of document.querySelectorAll(".goog-menuitem")) {
        if (el.getClientRects().length && el.innerText.startsWith(menuItem.caption)) return el;
    }
    return null;
}

function simulateClick(el) {
    for (const type of ["mouseover", "mousedown", "mouseup", "click"]) {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, detail: 1 }));
    }
}

function activateTopLevelMenu(menuCaption) {
    const buttons = Array.from(document.querySelectorAll(".menu-button"));
    const button = buttons.find((el) => el.innerText.trim() == menuCaption);
    if (!button) {
        throw new Error(`Couldn't find top-level button with caption ${menuCaption}`);
    }
    simulateClick(button);
}

// Initiate to Normal Mode
switchModeToNormal()

}
initializeDocsKeys()
