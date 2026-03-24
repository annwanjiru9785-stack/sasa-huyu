import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, Square, Activity, TrendingUp, ShieldCheck, Zap,
    Info, ChevronDown, ChevronUp, Terminal, Trash2,
    BarChart2, Settings, Layers, Cpu, RefreshCw,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import './over-under.scss';

type Strategy = 'over_under' | 'differs' | 'rise_fall' | 'manual';

const STRATEGIES: {
    value: Strategy;
    label: string;
    short: string;
    icon: React.ReactNode;
    color: string;
    glow: string;
    desc: string;
}[] = [
    {
        value: 'over_under',
        label: 'Over 5 / Under 4',
        short: 'O5/U4',
        icon: <Zap size={16} />,
        color: '#3b82f6',
        glow: 'rgba(59,130,246,0.35)',
        desc: 'Fires both contracts on trigger',
    },
    {
        value: 'differs',
        label: 'Differs',
        short: 'DIFF',
        icon: <Activity size={16} />,
        color: '#a855f7',
        glow: 'rgba(168,85,247,0.35)',
        desc: 'Pushback reversal pattern',
    },
    {
        value: 'rise_fall',
        label: 'Rise / Fall',
        short: 'R/F',
        icon: <TrendingUp size={16} />,
        color: '#10b981',
        glow: 'rgba(16,185,129,0.35)',
        desc: 'MACD momentum detection',
    },
    {
        value: 'manual',
        label: 'Manual',
        short: 'MAN',
        icon: <Settings size={16} />,
        color: '#f97316',
        glow: 'rgba(249,115,22,0.35)',
        desc: 'Custom contract & barrier',
    },
];

const Toggle = ({
    value,
    onChange,
    disabled,
    color = '#3b82f6',
}: {
    value: boolean;
    onChange: () => void;
    disabled?: boolean;
    color?: string;
}) => (
    <button
        className={`ou-toggle ${value ? 'on' : ''}`}
        style={value ? { '--tc': color } as React.CSSProperties : {}}
        onClick={onChange}
        disabled={disabled}
    >
        <span className='ou-toggle__thumb' />
    </button>
);

const OverUnder = observer(() => {
    const { over_under } = useStore();
    const {
        connection_status, tick_history, last_digit, is_auto_running,
        stake, martingale, is_volatility_changer, is_differs_mode,
        is_2term_mode, is_rise_fall_mode, is_automate, use_second_trigger,
        is_manual_mode, manual_contract_type, manual_barrier,
        recovery_contract_type, recovery_barrier, use_recovery_delay,
        entry_digit, second_entry_digit, is_turbo, selected_symbol,
        debug_info, is_analyzing_volatility, is_authorizing,
        setStake, setMartingale, setIsVolatilityChanger, setIsDiffersMode,
        setIs2termMode, setIsRiseFallMode, setIsAutomate, setUseSecondTrigger,
        setIsManualMode, setManualContractType, setManualBarrier,
        setRecoveryContractType, setRecoveryBarrier, setUseRecoveryDelay,
        setEntryDigit, setSecondEntryDigit, setIsTurbo, setSelectedSymbol,
        connectWebSocket, handleStartStop, clearDebug,
    } = over_under;

    const [showGuide, setShowGuide] = useState(false);
    const [showRecovery, setShowRecovery] = useState(false);

    const activeStrategy: Strategy = is_differs_mode ? 'differs'
        : is_rise_fall_mode ? 'rise_fall'
        : is_manual_mode ? 'manual'
        : 'over_under';

    const activeMeta = STRATEGIES.find(s => s.value === activeStrategy)!;

    const selectStrategy = (s: Strategy) => {
        if (is_auto_running || is_authorizing) return;
        setIsDiffersMode(s === 'differs');
        setIsRiseFallMode(s === 'rise_fall');
        setIsManualMode(s === 'manual');
    };

    useEffect(() => {
        if (over_under.connection_status === 'Offline') connectWebSocket();
        return () => over_under.dispose();
    }, [connectWebSocket, over_under]);

    const digitStats = useMemo(() => {
        const stats = Array(10).fill(0);
        tick_history.forEach(d => { if (d >= 0 && d <= 9) stats[d]++; });
        return stats;
    }, [tick_history]);

    const { maxIdx, minIdx } = useMemo(() => {
        if (!tick_history.length) return { maxIdx: -1, minIdx: -1 };
        let maxVal = -1, minVal = Infinity, maxIdx = -1, minIdx = -1;
        digitStats.forEach((v, i) => {
            if (v > maxVal) { maxVal = v; maxIdx = i; }
            if (v < minVal) { minVal = v; minIdx = i; }
        });
        return { maxIdx, minIdx };
    }, [digitStats, tick_history.length]);

    const totalTicks = tick_history.length || 1;

    const volatilityOptions = [
        { label: 'V 10 Index',       value: 'R_10' },
        { label: 'V 25 Index',       value: 'R_25' },
        { label: 'V 50 Index',       value: 'R_50' },
        { label: 'V 75 Index',       value: 'R_75' },
        { label: 'V 100 Index',      value: 'R_100' },
        { label: 'V 10 (1s)',        value: '1HZ10V' },
        { label: 'V 25 (1s)',        value: '1HZ25V' },
        { label: 'V 50 (1s)',        value: '1HZ50V' },
        { label: 'V 75 (1s)',        value: '1HZ75V' },
        { label: 'V 100 (1s)',       value: '1HZ100V' },
    ];

    const statusState = is_authorizing ? 'pulse'
        : connection_status === 'Account Connected' ? 'ok'
        : connection_status === 'Live Ticks' ? 'live'
        : 'off';

    const statusText = is_authorizing ? 'Authorizing'
        : connection_status === 'Account Connected' ? 'Connected'
        : connection_status === 'Live Ticks' ? 'Live'
        : connection_status || 'Offline';

    const ctaLabel = useMemo(() => {
        if (is_authorizing) return 'AUTHORIZING…';
        if (is_auto_running) return is_analyzing_volatility ? 'SCANNING MARKETS…' : 'STOP BOT';
        return 'START BOT';
    }, [is_auto_running, is_analyzing_volatility, is_authorizing]);

    const disabled = is_auto_running || is_authorizing;

    return (
        <div className='ou-root'>

            {/* ══════════════ GUIDE FAB ══════════════ */}
            <button className='ou-fab' onClick={() => setShowGuide(true)}>
                <Info size={15} />
                <span>Guide</span>
            </button>

            {/* ══════════════ GUIDE MODAL ══════════════ */}
            <AnimatePresence>
                {showGuide && (
                    <motion.div className='ou-overlay'
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setShowGuide(false)}>
                        <motion.div className='ou-modal'
                            initial={{ opacity: 0, y: 20, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.97 }}
                            onClick={e => e.stopPropagation()}>
                            <div className='ou-modal__head'>
                                <span><Info size={16} /> Strategy Guide</span>
                                <button onClick={() => setShowGuide(false)}>×</button>
                            </div>
                            <div className='ou-modal__body'>
                                {[
                                    { color: 'blue', title: 'Market Settings', items: [
                                        '<strong>Index</strong> — Choose which volatility market to trade.',
                                        '<strong>Volatility Changer</strong> — Auto-scans all 10 indices and switches to the best one for your strategy.',
                                    ]},
                                    { color: 'blue', title: 'Over 5 / Under 4', items: [
                                        'Waits for your Trigger Digit, then places Over 5 and Under 4 simultaneously.',
                                        '<strong>2ND Trigger</strong> — Requires two consecutive matching digits before firing.',
                                        '<strong>Turbo Mode</strong> — Re-triggers immediately after each settled round.',
                                    ]},
                                    { color: 'purple', title: 'Differs (Pushback)', items: [
                                        '3+ consecutive ticks in one direction followed by a reversal. Bot places a Differs contract on the reversal digit.',
                                        '<strong>2-Term Compound</strong> — Compounds profit onto the next stake.',
                                        '<strong>Auto Cycle</strong> — Restarts after each round.',
                                    ]},
                                    { color: 'green', title: 'Rise / Fall', items: [
                                        'Uses MACD trend detection on the live tick stream to place Rise or Fall contracts.',
                                    ]},
                                    { color: 'orange', title: 'Manual', items: [
                                        'You choose the Contract Type (Over/Under/Differs), Barrier, and Trigger Digit.',
                                    ]},
                                    { color: 'red', title: 'Recovery System', items: [
                                        'After a loss, bot uses Martingale-scaled stake with your Recovery Type until loss is recovered.',
                                        '<strong>Trigger Wait</strong> — Waits for trigger digit before recovery trades.',
                                    ]},
                                ].map(sec => (
                                    <div key={sec.title} className='ou-modal__section'>
                                        <div className={`ou-modal__sh ${sec.color}`}>{sec.title}</div>
                                        {sec.items.map((item, i) => (
                                            <p key={i} dangerouslySetInnerHTML={{ __html: item }} />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══════════════ HEADER ══════════════ */}
            <div className='ou-header'>
                <div className='ou-header__brand'>
                    <div className='ou-header__icon'>
                        <Zap size={18} />
                    </div>
                    <div>
                        <div className='ou-header__title'>Over / Under Terminal</div>
                        <div className='ou-header__sub'>Synthetic Indices · Digit Strategy Engine</div>
                    </div>
                </div>
                <div className={`ou-pill ou-pill--${statusState}`}>
                    <span className='ou-pill__dot' />
                    <span>{statusText}</span>
                </div>
            </div>

            {/* ══════════════ HEATMAP ══════════════ */}
            <div className='ou-heatmap'>
                {digitStats.map((count, i) => {
                    const pct = (count / totalTicks) * 100;
                    const isHot = i === maxIdx && count > 0;
                    const isCold = i === minIdx && count > 0;
                    const isActive = last_digit === i;
                    return (
                        <motion.div
                            key={i}
                            className={`ou-cell ${isActive ? 'ou-cell--active' : ''} ${isHot ? 'ou-cell--hot' : isCold ? 'ou-cell--cold' : ''}`}
                            whileHover={{ y: -4, scale: 1.04 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                        >
                            <div className='ou-cell__top'>
                                {isHot ? <span className='ou-badge ou-badge--hot'>HOT</span>
                                    : isCold ? <span className='ou-badge ou-badge--cold'>LOW</span>
                                    : <span className='ou-badge ou-badge--empty' />}
                            </div>
                            <div className='ou-cell__digit'>{i}</div>
                            <div className='ou-cell__track'>
                                <motion.div
                                    className='ou-cell__fill'
                                    animate={{ height: `${Math.max(pct, 2)}%` }}
                                    transition={{ duration: 0.4, ease: 'easeOut' }}
                                    style={{
                                        background: isHot
                                            ? 'linear-gradient(180deg,#10b981,#059669)'
                                            : isCold
                                            ? 'linear-gradient(180deg,#ef4444,#b91c1c)'
                                            : 'linear-gradient(180deg,#3b82f6,#1d4ed8)',
                                    }}
                                />
                            </div>
                            <div className='ou-cell__pct'>{pct.toFixed(0)}%</div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ══════════════ MAIN LAYOUT ══════════════ */}
            <div className='ou-layout'>

                {/* ── CONFIG PANEL ── */}
                <div className='ou-config'>

                    {/* Config header */}
                    <div className='ou-config__head'>
                        <span className='ou-config__head-title'><Cpu size={15} /> Configuration</span>
                        <span className='ou-config__head-strategy' style={{ color: activeMeta.color }}>
                            {activeMeta.icon}&nbsp;{activeMeta.short}
                        </span>
                    </div>

                    {/* ── MARKET ── */}
                    <div className='ou-section'>
                        <div className='ou-section__label'><BarChart2 size={12} /> Market</div>
                        <div className='ou-section__row'>
                            <div className='ou-field ou-field--grow'>
                                <label className='ou-label'>Index</label>
                                <select
                                    className='ou-select'
                                    value={selected_symbol}
                                    onChange={e => setSelectedSymbol(e.target.value)}
                                    disabled={disabled}
                                >
                                    {volatilityOptions.map(v => (
                                        <option key={v.value} value={v.value}>{v.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className='ou-field'>
                                <label className='ou-label'>Vol. Changer</label>
                                <div className='ou-toggle-row'>
                                    <Toggle
                                        value={is_volatility_changer}
                                        onChange={() => setIsVolatilityChanger(!is_volatility_changer)}
                                        disabled={disabled}
                                        color='#3b82f6'
                                    />
                                    <span className={`ou-toggle-label ${is_volatility_changer ? 'on' : ''}`}>
                                        {is_volatility_changer ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── STRATEGY ── */}
                    <div className='ou-section'>
                        <div className='ou-section__label'><Layers size={12} /> Strategy</div>
                        <div className='ou-strat-grid'>
                            {STRATEGIES.map(s => (
                                <button
                                    key={s.value}
                                    className={`ou-strat ${activeStrategy === s.value ? 'ou-strat--active' : ''}`}
                                    style={activeStrategy === s.value
                                        ? { '--sc': s.color, '--sg': s.glow } as React.CSSProperties
                                        : {}}
                                    onClick={() => selectStrategy(s.value)}
                                    disabled={disabled}
                                >
                                    <span className='ou-strat__icon'>{s.icon}</span>
                                    <div>
                                        <div className='ou-strat__name'>{s.label}</div>
                                        <div className='ou-strat__desc'>{s.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── STRATEGY OPTIONS ── */}
                    <AnimatePresence mode='wait'>
                        <motion.div
                            key={activeStrategy}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.16 }}
                        >
                            {activeStrategy === 'over_under' && (
                                <div className='ou-section'>
                                    <div className='ou-section__label'><Zap size={12} /> Trigger</div>
                                    <div className='ou-section__row'>
                                        <div className='ou-field'>
                                            <label className='ou-label'>Trigger Digit</label>
                                            <div className='ou-trigger-row'>
                                                <div className='ou-dbox'>
                                                    <input
                                                        type='number' min='0' max='9'
                                                        value={entry_digit}
                                                        onChange={e => setEntryDigit(Number(e.target.value))}
                                                        disabled={disabled}
                                                    />
                                                    <span className={`ou-led ${over_under.last_digit === entry_digit ? 'ou-led--on' : ''}`} />
                                                </div>
                                                {use_second_trigger && (
                                                    <div className='ou-dbox'>
                                                        <input
                                                            type='number' min='0' max='9'
                                                            value={second_entry_digit}
                                                            onChange={e => setSecondEntryDigit(Number(e.target.value))}
                                                            disabled={disabled}
                                                        />
                                                        <span className={`ou-led ${over_under.last_last_digit === entry_digit && over_under.last_digit === second_entry_digit ? 'ou-led--on' : ''}`} />
                                                    </div>
                                                )}
                                                <button
                                                    className={`ou-chip ${use_second_trigger ? 'ou-chip--on' : ''}`}
                                                    onClick={() => setUseSecondTrigger(!use_second_trigger)}
                                                    disabled={disabled}
                                                >
                                                    2ND
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeStrategy === 'differs' && (
                                <div className='ou-section'>
                                    <div className='ou-section__label'><Activity size={12} /> Options</div>
                                    <div className='ou-section__row'>
                                        <div className='ou-field'>
                                            <label className='ou-label'>2-Term Compound</label>
                                            <div className='ou-toggle-row'>
                                                <Toggle value={is_2term_mode} onChange={() => setIs2termMode(!is_2term_mode)} disabled={disabled} color='#a855f7' />
                                                <span className={`ou-toggle-label ${is_2term_mode ? 'on' : ''}`} style={is_2term_mode ? { color: '#a855f7' } : {}}>{is_2term_mode ? 'ON' : 'OFF'}</span>
                                            </div>
                                        </div>
                                        <div className='ou-field'>
                                            <label className='ou-label'>Auto Cycle</label>
                                            <div className='ou-toggle-row'>
                                                <Toggle value={is_automate} onChange={() => setIsAutomate(!is_automate)} disabled={disabled} color='#a855f7' />
                                                <span className={`ou-toggle-label ${is_automate ? 'on' : ''}`} style={is_automate ? { color: '#a855f7' } : {}}>{is_automate ? 'ON' : 'OFF'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeStrategy === 'rise_fall' && (
                                <div className='ou-section'>
                                    <div className='ou-section__label'><TrendingUp size={12} /> Options</div>
                                    <div className='ou-section__row'>
                                        <div className='ou-field'>
                                            <label className='ou-label'>Auto Cycle</label>
                                            <div className='ou-toggle-row'>
                                                <Toggle value={is_automate} onChange={() => setIsAutomate(!is_automate)} disabled={disabled} color='#10b981' />
                                                <span className={`ou-toggle-label ${is_automate ? 'on' : ''}`} style={is_automate ? { color: '#10b981' } : {}}>{is_automate ? 'ON' : 'OFF'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeStrategy === 'manual' && (
                                <div className='ou-section'>
                                    <div className='ou-section__label'><Settings size={12} /> Contract</div>
                                    <div className='ou-section__row'>
                                        <div className='ou-field ou-field--grow'>
                                            <label className='ou-label'>Contract Type</label>
                                            <select className='ou-select' value={manual_contract_type}
                                                onChange={e => setManualContractType(e.target.value)} disabled={disabled}>
                                                <option value='DIGITOVER'>Over</option>
                                                <option value='DIGITUNDER'>Under</option>
                                                <option value='DIGITDIFF'>Differs</option>
                                            </select>
                                        </div>
                                        <div className='ou-field'>
                                            <label className='ou-label'>Barrier</label>
                                            <input className='ou-input' type='number' min='0' max='9'
                                                value={manual_barrier}
                                                onChange={e => setManualBarrier(e.target.value)}
                                                disabled={disabled} />
                                        </div>
                                    </div>
                                    <div className='ou-section__row' style={{ marginTop: 12 }}>
                                        <div className='ou-field'>
                                            <label className='ou-label'>Trigger Digit</label>
                                            <div className='ou-trigger-row'>
                                                <div className='ou-dbox'>
                                                    <input type='number' min='0' max='9' value={entry_digit}
                                                        onChange={e => setEntryDigit(Number(e.target.value))} disabled={disabled} />
                                                    <span className={`ou-led ${over_under.last_digit === entry_digit ? 'ou-led--on' : ''}`} />
                                                </div>
                                                {use_second_trigger && (
                                                    <div className='ou-dbox'>
                                                        <input type='number' min='0' max='9' value={second_entry_digit}
                                                            onChange={e => setSecondEntryDigit(Number(e.target.value))} disabled={disabled} />
                                                        <span className={`ou-led ${over_under.last_last_digit === entry_digit && over_under.last_digit === second_entry_digit ? 'ou-led--on' : ''}`} />
                                                    </div>
                                                )}
                                                <button className={`ou-chip ${use_second_trigger ? 'ou-chip--on' : ''}`}
                                                    onClick={() => setUseSecondTrigger(!use_second_trigger)} disabled={disabled}>
                                                    2ND
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* ── STAKE & RISK ── */}
                    <div className='ou-section'>
                        <div className='ou-section__label'><BarChart2 size={12} /> Stake &amp; Risk</div>
                        <div className='ou-section__row'>
                            <div className='ou-field'>
                                <label className='ou-label'>Stake ($)</label>
                                <input className='ou-input' type='number' min='0.35' step='0.1'
                                    value={stake} onChange={e => setStake(Number(e.target.value))} disabled={disabled} />
                            </div>
                            <div className='ou-field'>
                                <label className='ou-label'>Martingale ×</label>
                                <input className='ou-input' type='number' min='1' step='0.1'
                                    value={martingale} onChange={e => setMartingale(Number(e.target.value))} disabled={disabled} />
                            </div>
                            <div className='ou-field'>
                                <label className='ou-label'>Turbo</label>
                                <div className='ou-toggle-row'>
                                    <Toggle value={is_turbo} onChange={() => setIsTurbo(!is_turbo)} disabled={disabled} color='#f59e0b' />
                                    <span className={`ou-toggle-label ${is_turbo ? 'on' : ''}`} style={is_turbo ? { color: '#f59e0b' } : {}}>{is_turbo ? 'ON' : 'OFF'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── RECOVERY ── */}
                    <div className='ou-section ou-section--collapse'>
                        <button className='ou-collapse-btn' onClick={() => setShowRecovery(!showRecovery)}>
                            <span><ShieldCheck size={12} /> Recovery System</span>
                            {showRecovery ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <AnimatePresence>
                            {showRecovery && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <div className='ou-section__row' style={{ padding: '12px 0 4px' }}>
                                        <div className='ou-field ou-field--grow'>
                                            <label className='ou-label'>Recovery Type</label>
                                            <select className='ou-select' value={recovery_contract_type}
                                                onChange={e => setRecoveryContractType(e.target.value)} disabled={disabled}>
                                                <option value='DIGITOVER'>Over</option>
                                                <option value='DIGITUNDER'>Under</option>
                                                <option value='DIGITDIFF'>Differs</option>
                                            </select>
                                        </div>
                                        <div className='ou-field'>
                                            <label className='ou-label'>Barrier</label>
                                            <input className='ou-input' type='number' min='0' max='9'
                                                value={recovery_barrier}
                                                onChange={e => setRecoveryBarrier(e.target.value)} disabled={disabled} />
                                        </div>
                                        <div className='ou-field'>
                                            <label className='ou-label'>Trigger Wait</label>
                                            <div className='ou-toggle-row'>
                                                <Toggle value={use_recovery_delay} onChange={() => setUseRecoveryDelay(!use_recovery_delay)} disabled={disabled} color='#ef4444' />
                                                <span className={`ou-toggle-label ${use_recovery_delay ? 'on' : ''}`} style={use_recovery_delay ? { color: '#ef4444' } : {}}>{use_recovery_delay ? 'ON' : 'OFF'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* ── CTA ── */}
                    <div className='ou-cta-wrap'>
                        <motion.button
                            className={`ou-cta ${is_auto_running ? 'ou-cta--stop' : 'ou-cta--start'}`}
                            style={{
                                '--ac': is_auto_running ? '#ef4444' : activeMeta.color,
                                '--ag': is_auto_running ? 'rgba(239,68,68,0.4)' : activeMeta.glow,
                            } as React.CSSProperties}
                            onClick={handleStartStop}
                            disabled={is_authorizing}
                            whileHover={!is_authorizing ? { scale: 1.02 } : {}}
                            whileTap={!is_authorizing ? { scale: 0.98 } : {}}
                        >
                            <span className='ou-cta__icon'>
                                {is_auto_running
                                    ? (is_analyzing_volatility ? <RefreshCw size={18} className='ou-spin' /> : <Square size={18} />)
                                    : <Play size={18} />}
                            </span>
                            <span className='ou-cta__label'>{ctaLabel}</span>
                            {is_auto_running && <span className='ou-cta__pulse' />}
                        </motion.button>
                    </div>
                </div>

                {/* ── MONITOR PANEL ── */}
                <div className='ou-monitor'>
                    <div className='ou-monitor__head'>
                        <span><Terminal size={14} /> Live Monitor</span>
                        <button className='ou-monitor__clear' onClick={clearDebug}>
                            <Trash2 size={13} />
                        </button>
                    </div>
                    <div className='ou-monitor__body'>
                        {debug_info.length === 0 ? (
                            <div className='ou-monitor__empty'>
                                <Zap size={28} />
                                <span>Waiting for signals…</span>
                            </div>
                        ) : (
                            <div className='ou-monitor__logs'>
                                {debug_info.map((line, i) => {
                                    const isWin = /WON/i.test(line);
                                    const isLoss = /LOST/i.test(line);
                                    const isPattern = /PATTERN/i.test(line);
                                    const cls = isWin ? 'ou-log--win' : isLoss ? 'ou-log--loss' : isPattern ? 'ou-log--pattern' : '';
                                    return (
                                        <div key={i} className={`ou-log ${cls}`}>
                                            <span className='ou-log__bar' />
                                            <span className='ou-log__text'>{line}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default OverUnder;
