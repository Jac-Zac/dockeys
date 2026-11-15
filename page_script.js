// source- https://github.com/philc/sheetkeys/blob/master/page_scripts/page_script.js

// This script gets inserted into the page by our content script.
// It receives requests from the content script to simulate keypresses.
// Messages are passed to this script via "doc-keys-simulate-keypress" events, which are dispatched
// on the window object by the content script.

// How to simulate a keypress in Chrome: http://stackoverflow.com/a/10520017/46237
// Note that we have to do this keypress simulation in an injected script, because events dispatched
// by content scripts do not preserve overridden properties.
// - args: an object with keys keyCode, shiftKey
const simulateKeyEvent = function(eventType, el, args) {
    // How to do this in Chrome: http://stackoverflow.com/q/10455626/46237
    const event = document.createEvent("KeyboardEvent");
    Object.defineProperty(event, "keyCode", {
        get() {
            return this.keyCodeVal;
        },
    });
    Object.defineProperty(event, "which", {
        get() {
            return this.keyCodeVal;
        },
    });
    const mods = args.mods || {};
    event.initKeyboardEvent(
        eventType, // eventName
        true, // canBubble
        true, //canceleable
        document.defaultView, // view
        "", // keyIdentifier string
        false, // (not sure)
        !!mods.control, // control
        !!mods.alt, // alt
        !!mods.shift, // shift
        !!mods.meta, // meta
        args.keyCode, // keyCode
        args.keyCode, // (not sure)
    );
    event.keyCodeVal = args.keyCode;
    Object.defineProperty(event, "altKey", {
        get() {
            return !!mods.alt;
        },
    });
    Object.defineProperty(event, "metaKey", {
        get() {
            return !!mods.meta;
        },
    });
    el.dispatchEvent(event);
};

const editorEl = document.querySelector(".docs-texteventtarget-iframe").contentDocument.activeElement;

window.addEventListener("doc-keys-simulate-keypress", function(event) {
    const args = event.detail
    simulateKeyEvent("keydown", editorEl, args);
    simulateKeyEvent("keyup", editorEl, args);
});

// Plain-text insertion at the current Docs accessibility selection, used by :normal I/A.
window.addEventListener('doc-keys-edit-text', async event => {
    const { id, text } = event.detail
    const result = error => window.dispatchEvent(new CustomEvent('doc-keys-edit-result', { detail: { id, error } }))
    const frame = document.querySelector('.docs-texteventtarget-iframe')
    const doc = frame?.contentDocument
    const target = doc?.querySelector('[contenteditable="true"]') || doc?.body
    if (!target || document.activeElement !== frame || typeof text !== 'string') {
        result('Editor unavailable')
        return
    }
    const before = target.textContent
    let observer, timer
    const changed = new Promise(resolve => {
        observer = new MutationObserver(() => { if (target.textContent !== before) resolve(true) })
        observer.observe(target, { childList: true, characterData: true, subtree: true })
        timer = setTimeout(() => resolve(false), 1500)
    })
    try {
        const data = new DataTransfer()
        data.setData('text/plain', text)
        target.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertReplacementText',
            data: text, dataTransfer: data, bubbles: true, cancelable: true }))
        result(await changed ? null : 'Edit not confirmed')
    } catch (error) { result(error.message) }
    finally { observer.disconnect(); clearTimeout(timer) }
})

