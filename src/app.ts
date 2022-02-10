import { Editor, TokenFormat } from './index';

const shortcuts: Record<string, (editor: Editor) => void> = {
    'Cmd+Z': editor => editor.undo(),
    'Cmd+Y': editor => editor.redo(),
    'Cmd+Shift+Z': editor => editor.redo(),
    'Cmd+B': editor => editor.toggleFormat(TokenFormat.Bold),
    'Cmd+I': editor => editor.toggleFormat(TokenFormat.Italic),
    'Cmd+U': editor => editor.toggleFormat(TokenFormat.Strike),
    'Cmd+Shift+C': editor => editor.toggleFormat(TokenFormat.Monospace),
    'Ctrl+L': editor => editor.pickLink(),
};

let activeEditor: Editor;
const toolbar = document.querySelector<HTMLElement>('.toolbar');
const editor = new Editor(document.querySelector('#text-editor'), {
    value: 'Привет, мир! 😇',
    shortcuts,
    parse: {
        textEmoji: true,
        hashtag: true,
        mention: true,
        command: true,
        userSticker: true,
        link: true,
        stickyLink: true
    },
    emoji: renderEmoji,
    resetFormatOnNewline: true,
    html: true
});
editor
    .on('editor-selectionchange', (evt: CustomEvent) => onSelectionChange(evt.detail.editor))
    .on('editor-formatchange', (evt: CustomEvent) => updateToolbarState(evt.detail.editor));

const mdEditor = new Editor(document.querySelector('#md-editor'), {
    value: 'Привет, *markdown* мир! 😇',
    shortcuts,
    parse: {
        textEmoji: true,
        hashtag: true,
        mention: true,
        command: true,
        userSticker: true,
        link: true,
        markdown: true
    },
    emoji: renderEmoji
});
mdEditor
    .on('editor-selectionchange', (evt: CustomEvent) => onSelectionChange(evt.detail.editor))
    .on('editor-formatchange', (evt: CustomEvent) => updateToolbarState(evt.detail.editor));

toolbar.addEventListener('mousedown', evt => {
    const btn = (evt.target as HTMLElement).closest<HTMLElement>('.toolbar-btn');
    if (btn) {
        evt.preventDefault();
        const format = btn.dataset.format;
        if (format) {
            activeEditor.toggleFormat(Number(format));
        } else if (btn.classList.contains('link')) {
            activeEditor.pickLink();
        }
    }
});

/**
 * Тестовая функция для проверки вывода эмоджи как картинки
 */
function renderEmoji(emoji: string, elem: HTMLElement) {
    if (emoji == null) {
        return;
    }

    const codePoints = [];
    let i = 0;
    let cp = 0;
    while (i < emoji.length) {
        cp = emoji.codePointAt(i);
        i += cp > 0xFFFF ? 2 : 1;

        if (cp !== 0xFE0F && cp !== 0x200D) {
            codePoints.push(cp.toString(16));
        }
    }

    const url = `//st.mycdn.me/static/emoji/3-1-1/20/${codePoints.join('-')}@2x.png`;
    if (!elem) {
        elem = document.createElement('img');
    }

    if (elem.getAttribute('src') !== url) {
        elem.setAttribute('src', url);
    }

    return elem;
}

function onSelectionChange(editor: Editor) {
    activeEditor = editor;
    const sel = editor.getSelection();
    if (sel[0] !== sel[1]) {
        showToolbar(editor);
        updateToolbar(editor);
    } else {
        hideToolbar();
    }
}

function updateToolbar(editor: Editor) {
    const sel = window.getSelection();
    if (sel) {
        const r = sel.getRangeAt(0);
        if (r) {
            const rect = r.getClientRects().item(0);
            const editorRect = editor.element.getBoundingClientRect();
            if (rect && editorRect) {
                toolbar.style.left = `${rect.left - editorRect.left - 5}px`;
                toolbar.style.top = `${rect.top - editorRect.top - toolbar.offsetHeight - 5}px`;
                updateToolbarState(editor);
            }
        }
    }
}

function updateToolbarState(editor: Editor) {
    if (toolbar.classList.contains('hidden')) {
        return;
    }

    const token = editor.tokenForPos(editor.getSelection()[0]);
    for (const btn of toolbar.querySelectorAll<HTMLElement>('.toolbar-btn')) {
        const format = Number(btn.dataset.format || '0');
        if (format) {
            btn.classList.toggle('selected', Boolean(token.format & format));
        }

        if (btn.classList.contains('link')) {
            btn.classList.toggle('selected', Boolean((token.type === 'link' && !token.auto) || (token.format & 128)));
        }
    }
}

function hideToolbar() {
    toolbar.classList.add('hidden');
}

function showToolbar(editor: Editor) {
    toolbar.classList.remove('hidden');
    if (toolbar.parentElement !== editor.element.parentElement) {
        editor.element.parentElement.appendChild(toolbar);
    }
}

window['editor'] = editor;
window['mdEditor'] = mdEditor;
