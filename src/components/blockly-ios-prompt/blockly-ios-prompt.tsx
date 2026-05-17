import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './blockly-ios-prompt.scss';

/**
 * Replaces the browser's native window.prompt() with an iOS-style bottom-sheet.
 *
 * Strategy:
 *  1. Patch window.Blockly.FieldNumber.prototype.showEditor_ (and FieldTextInput)
 *     so we capture a reference to the active field BEFORE window.prompt is called.
 *  2. Override window.prompt to show our modal and return the current defaultValue
 *     synchronously (Blockly therefore makes no change itself).
 *  3. When the user confirms in our modal we call field.setValue() directly.
 */

let _activeField: any = null;

const BlocklyIOSPrompt: React.FC = () => {
    const [visible, setVisible]       = useState(false);
    const [inputVal, setInputVal]     = useState('');
    const [title, setTitle]           = useState('Change Value');
    const [hint, setHint]             = useState('');
    const inputRef                    = useRef<HTMLInputElement>(null);
    const originalPromptRef           = useRef<typeof window.prompt | null>(null);

    const show = useCallback((msg: string, dflt: string) => {
        setTitle('Change Value');
        setHint(msg || '');
        setInputVal(dflt ?? '');
        setVisible(true);
        setTimeout(() => inputRef.current?.select(), 120);
    }, []);

    const hide = useCallback(() => {
        setVisible(false);
        _activeField = null;
    }, []);

    const confirm = useCallback(() => {
        if (_activeField) {
            try {
                const parsed = parseFloat(inputVal);
                _activeField.setValue(isNaN(parsed) ? inputVal : parsed);
            } catch (_) {
                /* ignore setValue errors */
            }
        }
        hide();
    }, [inputVal, hide]);

    /* ── Patch Blockly & window.prompt once on mount ── */
    useEffect(() => {
        /* Override window.prompt */
        originalPromptRef.current = window.prompt;
        (window as any).prompt = (message?: string, defaultValue?: string) => {
            show(message || '', defaultValue || '');
            // Return the default synchronously so Blockly's own code is a no-op
            return defaultValue ?? null;
        };

        /* Patch Blockly field editors to capture field reference */
        const tryPatch = () => {
            const B = (window as any).Blockly;
            if (!B) { setTimeout(tryPatch, 600); return; }

            const patchField = (FieldCtor: any, label: string) => {
                if (!FieldCtor?.prototype?.showEditor_) return;
                const orig = FieldCtor.prototype.showEditor_;
                FieldCtor.prototype.showEditor_ = function (e: Event) {
                    _activeField = this;
                    setTitle(`Edit ${label}`);
                    orig.call(this, e);
                };
            };

            patchField(B.FieldNumber,    'Number');
            patchField(B.FieldTextInput, 'Text');
            patchField(B.FieldDropdown,  'Option');
        };

        tryPatch();

        return () => {
            if (originalPromptRef.current) {
                window.prompt = originalPromptRef.current;
            }
        };
    }, [show]);

    if (!visible) return null;

    return createPortal(
        <div className='bip-backdrop' onClick={hide}>
            <div className='bip-sheet' onClick={e => e.stopPropagation()}>
                {/* iOS drag handle */}
                <div className='bip-handle' />

                <div className='bip-header'>
                    <span className='bip-title'>{title}</span>
                    {hint && <span className='bip-hint'>{hint}</span>}
                </div>

                <input
                    ref={inputRef}
                    className='bip-input'
                    type='number'
                    inputMode='decimal'
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter')  confirm();
                        if (e.key === 'Escape') hide();
                    }}
                    autoFocus
                />

                <div className='bip-actions'>
                    <button className='bip-btn bip-btn--cancel'  onClick={hide}>Cancel</button>
                    <button className='bip-btn bip-btn--confirm' onClick={confirm}>Done</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BlocklyIOSPrompt;
