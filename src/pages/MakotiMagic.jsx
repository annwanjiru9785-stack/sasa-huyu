import React, { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton';

const MakotiMagic = observer(() => {
    const { client } = useStore();
    const [is_flooding, setIsFlooding] = useState(false);
    const [stake, setStake] = useState(0.35);
    const [results, setResults] = useState([]);
    const [total_pl, setTotalPL] = useState(0);

    // ATOMIC REFS: Bypassing the JavaScript Engine's standard queue
    const is_active = useRef(false);
    const stake_ref = useRef(0.35);
    const socket_ref = useRef(null);

    useEffect(() => { stake_ref.current = stake; }, [stake]);

    useEffect(() => {
        socket_ref.current = api_base.api;
        
        // DIRECT STREAM INTERCEPTION
        const sub = socket_ref.current.onMessage().subscribe((msg) => {
            const data = msg.data;

            // 1. THE STRIKE (HIGHEST PRIORITY - ZERO DELAY)
            if (is_active.current && data.msg_type === 'tick') {
                const quote = data.tick.quote.toString();
                const digit = quote.charAt(quote.length - 1);
                
                const payload = {
                    buy: 1,
                    price: Number(stake_ref.current),
                    parameters: {
                        amount: Number(stake_ref.current),
                        basis: 'stake',
                        contract_type: 'DIGITMATCH',
                        currency: client.currency || 'USD',
                        duration: 1,
                        duration_unit: 't',
                        symbol: '1HZ100V', 
                        barrier: parseInt(digit) 
                    }
                };

                // PACKET SATURATION: Sending 3 bursts to ensure "Gate-In"
                socket_ref.current.send(payload);
                socket_ref.current.send(payload);
                socket_ref.current.send(payload);
            }

            // 2. BACKGROUND DATA (LOGGING)
            if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract.is_sold) {
                const c = data.proposal_open_contract;
                setResults(prev => [{
                    target: c.barrier,
                    entry: c.entry_tick_display_value?.slice(-1),
                    exit: c.exit_tick_display_value?.slice(-1),
                    status: c.status.toUpperCase(),
                    p: c.profit
                }, ...prev].slice(0, 12));
                setTotalPL(v => v + c.profit);
            }
        });

        return () => sub.unsubscribe();
    }, [client.currency]);

    return (
        <div style={css.body}>
            <div style={css.statusHeader}>
                <span style={{color: is_flooding ? '#f00' : '#0f0'}}>● {is_flooding ? 'INJECTING' : 'READY'}</span>
                <span>NET: {total_pl.toFixed(2)}</span>
            </div>

            <div style={css.main}>
                <div style={css.inputLabel}>STAKE</div>
                <input type="number" value={stake} onChange={(e) => setStake(e.target.value)} style={css.input} />
                
                <button 
                    onClick={() => {
                        is_active.current = !is_active.current;
                        setIsFlooding(is_active.current);
                    }} 
                    style={{...css.btn, background: is_flooding ? '#300' : '#040', border: is_flooding ? '1px solid #f00' : '1px solid #0f0'}}
                >
                    {is_flooding ? "STOP ATTACK" : "START ULTRA-STRIKE"}
                </button>
            </div>

            <div style={css.grid}>
                <div style={css.gridHead}><span>TGT</span><span>ENT</span><span>EXT</span><span>RES</span></div>
                {results.map((r, i) => (
                    <div key={i} style={css.gridRow}>
                        <span style={{color: '#ff0'}}>{r.target}</span>
                        <span>{r.entry}</span>
                        <span style={{fontWeight: 'bold'}}>{r.exit}</span>
                        <span style={{color: r.status === 'WON' ? '#0f0' : '#f00'}}>{r.status}</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

const css = {
    body: { background: '#000', color: '#0f0', height: '100vh', padding: '10px', fontFamily: 'monospace' },
    statusHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderBottom: '1px solid #222', paddingBottom: '5px' },
    main: { padding: '30px 10px', textAlign: 'center' },
    inputLabel: { fontSize: '10px', color: '#444' },
    input: { background: '#000', border: 'none', borderBottom: '2px solid #0f0', color: '#0f0', fontSize: '24px', textAlign: 'center', width: '100px', marginBottom: '20px', outline: 'none' },
    btn: { width: '100%', padding: '20px', color: '#0f0', fontWeight: 'bold', cursor: 'pointer', fontSize: '18px' },
    grid: { marginTop: '10px', background: '#050505' },
    gridHead: { display: 'flex', justifyContent: 'space-between', padding: '5px', fontSize: '10px', color: '#444', borderBottom: '1px solid #111' },
    gridRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 5px', borderBottom: '1px solid #111', fontSize: '13px' }
};

export default MakotiMagic;
