// source- https://github.com/philc/sheetkeys/blob/master/page_scripts/page_script.js

// This script gets inserted into the page by our content script.
// It receives requests from the content script to simulate keypresses.
// Messages are passed to this script via "doc-keys-simulate-keypress" events, which are dispatched
// on the window object by the content script.

const simulateKeyEvent = function(eventType, el, { keyCode, mods = {} }) {
    el.dispatchEvent(new KeyboardEvent(eventType, {
        bubbles: true, cancelable: true, view: window, keyCode, which: keyCode,
        ctrlKey: !!mods.control, altKey: !!mods.alt,
        shiftKey: !!mods.shift, metaKey: !!mods.meta,
    }));
};

function getEditor() {
    const doc = document.querySelector('.docs-texteventtarget-iframe')?.contentDocument
    return doc?.querySelector('[contenteditable="true"]') || doc?.body
}

window.addEventListener("doc-keys-simulate-keypress", function(event) {
    const editorEl = getEditor()
    if (!editorEl) return
    const args = event.detail
    simulateKeyEvent("keydown", editorEl, args);
    simulateKeyEvent("keyup", editorEl, args);
});

// Plain-text insertion at the current Docs accessibility selection, used by :normal I/A.
window.addEventListener('doc-keys-edit-text', async event => {
    const { id, text } = event.detail
    const result = error => window.dispatchEvent(new CustomEvent('doc-keys-edit-result', { detail: { id, error } }))
    const target = getEditor()
    if (!target || document.activeElement !== target.ownerDocument.defaultView.frameElement ||
        !document.hasFocus() || typeof text !== 'string') {
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

