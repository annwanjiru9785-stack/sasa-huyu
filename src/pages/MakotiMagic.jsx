import React, { useState, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton';

const MakotiMagic = observer(() => {
    const { client } = useStore();
    const [is_hunting, setIsHunting] = useState(false);
    const [stake, setStake] = useState(0.35);
    const [results, setResults] = useState([]);
    const [total_pl, setTotalPL] = useState(0);

    const is_active = useRef(false);
    const stake_ref = useRef(0.35);

    useEffect(() => { stake_ref.current = stake; }, [stake]);

    useEffect(() => {
        // DIRECT BINARY LISTENER
        const sub = api_base.api.onMessage().subscribe((msg) => {
            const data = msg.data;

            // 1. THE INSTANT STRIKE
            if (is_active.current && data.msg_type === 'tick') {
                const quote = data.tick.quote.toString();
                const intercepted_digit = quote.charAt(quote.length - 1);
                
                // SINGLE SURGICAL INJECTION
                api_base.api.send({
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
                        barrier: parseInt(intercepted_digit) 
                    }
                });
                
                // Reset immediately to wait for the next manual trigger or tick
                // This prevents "Double-firing" on a jittery connection
                is_active.current = false;
                setIsHunting(false);
            }

            // 2. RESULT DATA
            if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract.is_sold) {
                const c = data.proposal_open_contract;
                setResults(prev => [{
                    target: c.barrier,
                    entry: c.entry_tick_display_value?.slice(-1),
                    exit: c.exit_tick_display_value?.slice(-1),
                    status: c.status.toUpperCase(),
                    p: c.profit
                }, ...prev].slice(0, 10));
                setTotalPL(v => v + c.profit);
            }
        });

        return () => sub.unsubscribe();
    }, [client.currency]);

    return (
        <div style={ui.container}>
            <div style={ui.header}>
                <h1 style={ui.title}>MAKOTI SURGICAL STRIKE</h1>
                <div style={ui.pl}>P/L: {total_pl.toFixed(2)}</div>
            </div>

            <div style={ui.workarea}>
                <div style={{color: '#444', fontSize: '10px'}}>STAKE</div>
                <input type="number" value={stake} onChange={(e) => setStake(e.target.value)} style={ui.input} />
                
                <button 
                    onClick={() => {
                        is_active.current = true;
                        setIsHunting(true);
                    }} 
                    disabled={is_hunting}
                    style={{...ui.btn, background: is_hunting ? '#111' : '#0f0'}}
                >
                    {is_hunting ? "WAITING FOR TICK..." : "EXECUTE STRIKE"}
                </button>
            </div>

            <div style={ui.table}>
                <div style={ui.tableHeader}>
                    <span>PREDICT</span><span>ENTRY</span><span>EXIT</span><span>RESULT</span>
                </div>
                {results.map((r, i) => (
                    <div key={i} style={ui.tableRow}>
                        <span style={{color: '#ff0'}}>{r.target}</span>
                        <span style={{color: r.target === r.entry ? '#0f0' : '#f00'}}>{r.entry}</span>
                        <span style={{fontWeight: 'bold'}}>{r.exit}</span>
                        <span style={{color: r.status === 'WON' ? '#0f0' : '#f00'}}>{r.status}</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

const ui = {
    container: { background: '#000', color: '#0f0', height: '100vh', padding: '15px', fontFamily: 'monospace' },
    header: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '10px' },
    title: { fontSize: '14px', letterSpacing: '2px' },
    pl: { fontWeight: 'bold' },
    workarea: { padding: '40px 0', textAlign: 'center' },
    input: { background: '#000', border: 'none', borderBottom: '2px solid #0f0', color: '#0f0', fontSize: '24px', textAlign: 'center', width: '100px', marginBottom: '20px' },
    btn: { width: '100%', padding: '20px', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '18px' },
    table: { marginTop: '20px' },
    tableHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#444', marginBottom: '10px' },
    tableRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #111', fontSize: '14px' }
};

export default MakotiMagic;
