import React, { useState, useEffect, useMemo, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import './over-under.scss';

// Connection Statuses
const STATUS_DISCONNECTED = 'Disconnected';
const STATUS_CONNECTING = 'Connecting...';
const STATUS_AUTHORIZING = 'Authorizing...';
const STATUS_CONNECTED = 'Connected';

const OverUnder = observer(() => {
    const { summary_card, journal, client } = useStore();
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

    // State
    const [connectionStatus, setConnectionStatus] = useState(STATUS_DISCONNECTED);
    const [digitStats, setDigitStats] = useState(Array(10).fill(0));
    const [lastDigit, setLastDigit] = useState<number | null>(null);
    const [isAutoRunning, setIsAutoRunning] = useState(false);
    
    // Settings
    const [stake, setStake] = useState(1);
    const [entryDigit, setEntryDigit] = useState(7);
    const [isTurbo, setIsTurbo] = useState(false);
    const [selectedSymbol, setSelectedSymbol] = useState('R_100');

    const volatilityIndices = [
        { text: 'Volatility 100 Index', value: 'R_100' },
        { text: 'Volatility 75 Index', value: 'R_75' },
        { text: 'Volatility 50 Index', value: 'R_50' },
        { text: 'Volatility 25 Index', value: 'R_25' },
        { text: 'Volatility 10 Index', value: 'R_10' },
        { text: 'Volatility 100 (1s) Index', value: '1HZ100V' },
        { text: 'Volatility 75 (1s) Index', value: '1HZ75V' },
        { text: 'Volatility 50 (1s) Index', value: '1HZ50V' },
        { text: 'Volatility 25 (1s) Index', value: '1HZ25V' },
        { text: 'Volatility 10 (1s) Index', value: '1HZ10V' },
    ];

    const subscribeToTicks = (symbol: string) => {
        if (ws.current?.readyState !== 1) {
            journal.pushMessage({ message: 'WebSocket not ready. Cannot subscribe to ticks.', type: 'error' });
            return;
        }
        
        // Forget all previous tick subscriptions
        ws.current.send(JSON.stringify({ forget_all: 'ticks' }));
        
        // Reset stats
        setDigitStats(Array(10).fill(0));
        setLastDigit(null);
        
        // Subscribe to new symbol
        ws.current.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        journal.pushMessage({ message: `✅ Subscribed to ${symbol} for live ticks.`, type: 'success' });
    };

    const connectWebSocket = () => {
        // Close any existing connection
        if (ws.current) {
            ws.current.onclose = null;
            ws.current.onerror = null;
            ws.current.onmessage = null;
            ws.current.onopen = null;
            ws.current.close();
        }

        // Clear any pending reconnect attempts
        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = null;
        }

        // Check if user is logged in
        if (!client.loginid) {
            setConnectionStatus(STATUS_DISCONNECTED);
            journal.pushMessage({ message: '⚠️ Please log in to use the Over/Under tool.', type: 'warn' });
            return;
        }

        setConnectionStatus(STATUS_CONNECTING);
        journal.pushMessage({ message: '🔌 Connecting to Deriv WebSocket...', type: 'info' });

        // Create new WebSocket connection
        ws.current = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=80058');

        ws.current.onopen = () => {
            setConnectionStatus(STATUS_AUTHORIZING);
            journal.pushMessage({ message: '🔐 Authorizing...', type: 'info' });
            
            // Get the authentication token from localStorage
            const token = localStorage.getItem('authToken');
            
            if (token && ws.current?.readyState === 1) {
                ws.current.send(JSON.stringify({ authorize: token }));
            } else {
                journal.pushMessage({ message: '❌ Authentication token not found. Please log in again.', type: 'error' });
                setConnectionStatus(STATUS_DISCONNECTED);
            }
        };

        ws.current.onmessage = (msg) => {
            try {
                const data = JSON.parse(msg.data);

                // Handle errors
                if (data.error) {
                    journal.pushMessage({ message: `❌ Error: ${data.error.message}`, type: 'error' });
                    
                    if (data.msg_type === 'authorize') {
                        setConnectionStatus(STATUS_DISCONNECTED);
                        journal.pushMessage({ message: '❌ Authorization failed. Please check your login.', type: 'error' });
                    }
                    return;
                }

                // Handle authorization success
                if (data.msg_type === 'authorize') {
                    if (data.authorize) {
                        setConnectionStatus(STATUS_CONNECTED);
                        journal.pushMessage({ message: '✅ Connected and authorized successfully!', type: 'success' });
                        
                        // Subscribe to ticks after successful authorization
                        subscribeToTicks(selectedSymbol);
                    }
                }

                // Handle tick data
                if (data.msg_type === 'tick') {
                    const quote = data.tick.quote.toString();
                    const digit = parseInt(quote.charAt(quote.length - 1));
                    
                    setLastDigit(digit);
                    setDigitStats(prev => {
                        const newStats = [...prev];
                        newStats[digit] += 1;
                        return newStats;
                    });

                    // Auto-execute trade if conditions are met
                    if (isAutoRunning && digit === entryDigit) {
                        executeMultiTrade();
                    }
                }

                // Handle buy confirmation
                if (data.msg_type === 'buy') {
                    if (data.buy) {
                        journal.pushMessage({ 
                            message: `✅ Trade executed: ${data.buy.longcode} | Contract ID: ${data.buy.contract_id}`, 
                            type: 'success' 
                        });
                    }
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
                journal.pushMessage({ message: '❌ Error processing WebSocket message.', type: 'error' });
            }
        };

        ws.current.onerror = (error) => {
            console.error('WebSocket error:', error);
            journal.pushMessage({ message: '❌ WebSocket connection error.', type: 'error' });
        };

        ws.current.onclose = () => {
            setConnectionStatus(STATUS_DISCONNECTED);
            journal.pushMessage({ message: '🔌 WebSocket connection closed.', type: 'warn' });
            
            // Attempt to reconnect after 3 seconds if user is still logged in
            if (client.loginid) {
                reconnectTimeout.current = setTimeout(() => {
                    journal.pushMessage({ message: '🔄 Attempting to reconnect...', type: 'info' });
                    connectWebSocket();
                }, 3000);
            }
        };
    };

    // Initialize WebSocket connection when component mounts or loginid changes
    useEffect(() => {
        connectWebSocket();

        // Cleanup on unmount
        return () => {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
            if (ws.current) {
                ws.current.onclose = null;
                ws.current.onerror = null;
                ws.current.onmessage = null;
                ws.current.onopen = null;
                ws.current.close();
            }
        };
    }, [client.loginid]);

    // Handle symbol change
    useEffect(() => {
        if (connectionStatus === STATUS_CONNECTED) {
            subscribeToTicks(selectedSymbol);
        }
    }, [selectedSymbol]);

    const executeMultiTrade = () => {
        if (ws.current?.readyState !== 1) {
            journal.pushMessage({ message: '❌ WebSocket not connected. Cannot execute trade.', type: 'error' });
            return;
        }

        if (!client.currency) {
            journal.pushMessage({ message: '❌ Currency not available. Please check your account.', type: 'error' });
            return;
        }

        journal.pushMessage({ message: `🎯 Entry Digit ${entryDigit} Hit! Executing Multi-Trade...`, type: 'info' });
        
        // Execute DIGITOVER (Over 5)
        ws.current.send(JSON.stringify({
            buy: 1,
            price: stake,
            parameters: {
                amount: stake,
                basis: 'stake',
                contract_type: 'DIGITOVER',
                currency: client.currency,
                duration: 1,
                duration_unit: 't',
                symbol: selectedSymbol,
                barrier: '5',
            }
        }));

        // Execute DIGITUNDER (Under 4)
        ws.current.send(JSON.stringify({
            buy: 1,
            price: stake,
            parameters: {
                amount: stake,
                basis: 'stake',
                contract_type: 'DIGITUNDER',
                currency: client.currency,
                duration: 1,
                duration_unit: 't',
                symbol: selectedSymbol,
                barrier: '4',
            }
        }));
        
        // Stop auto-running if turbo mode is off
        if (!isTurbo) {
            setIsAutoRunning(false);
            journal.pushMessage({ message: '⏸️ Auto-trade stopped (Turbo mode OFF).', type: 'info' });
        }
    };

    const handleManualTrade = () => {
        if (connectionStatus !== STATUS_CONNECTED) {
            journal.pushMessage({ message: '❌ Not connected. Please wait for connection.', type: 'error' });
            return;
        }
        executeMultiTrade();
    };
    
    const totalTicks = useMemo(() => digitStats.reduce((a, b) => a + b, 0) || 1, [digitStats]);

    const getStatusClassName = () => {
        switch(connectionStatus) {
            case STATUS_CONNECTED:
                return 'connected';
            case STATUS_AUTHORIZING:
            case STATUS_CONNECTING:
                return 'authorizing';
            default:
                return 'disconnected';
        }
    };

    return (
        <div className="over-under-container">
            <div className="stats-grid">
                {digitStats.map((count, i) => {
                    const percentage = ((count / totalTicks) * 100).toFixed(1);
                    return (
                        <div key={i} className={`digit-card ${lastDigit === i ? 'active' : ''}`}>
                            <span className="digit-num">{i}</span>
                            <span className="digit-percent">{percentage}%</span>
                            <div className="digit-bar-wrapper">
                                <div className="digit-bar-fill" style={{ height: `${percentage}%` }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="controls-panel">
                <div className="input-group">
                    <label>Connection Status</label>
                    <div className={`connection-status ${getStatusClassName()}`}>
                        {connectionStatus}
                    </div>
                </div>

                <div className="input-group">
                    <label>Volatility Index</label>
                    <select 
                        className="ui-select" 
                        value={selectedSymbol} 
                        onChange={(e) => setSelectedSymbol(e.target.value)}
                        disabled={connectionStatus !== STATUS_CONNECTED}
                    >
                        {volatilityIndices.map(index => (
                            <option key={index.value} value={index.value}>{index.text}</option>
                        ))}
                    </select>
                </div>

                <div className="input-group">
                    <label>Stake ({client.currency || 'USD'})</label>
                    <input 
                        className="ui-input" 
                        type="number" 
                        min="0.35"
                        step="0.01"
                        value={stake} 
                        onChange={(e) => setStake(Number(e.target.value))} 
                    />
                </div>

                <div className="input-group">
                    <label>Entry Digit (Trigger)</label>
                    <div className="entry-config">
                        <input 
                            className="ui-input digit-entry" 
                            type="number" 
                            min="0" 
                            max="9" 
                            value={entryDigit} 
                            onChange={(e) => setEntryDigit(Number(e.target.value))} 
                        />
                        <div className={`status-led ${lastDigit === entryDigit ? 'glow' : ''}`}></div>
                    </div>
                </div>

                <div className="button-group">
                    <button 
                        className={`btn-secondary ${isTurbo ? 'active' : ''}`} 
                        onClick={() => setIsTurbo(!isTurbo)}
                    >
                        {isTurbo ? '⚡ TURBO ON' : '🐢 TURBO OFF'}
                    </button>
                    <button 
                        className={`btn-primary ${isAutoRunning ? 'running' : ''}`} 
                        onClick={() => setIsAutoRunning(!isAutoRunning)}
                        disabled={connectionStatus !== STATUS_CONNECTED}
                    >
                        {isAutoRunning ? '⏹️ STOP AUTO-TRADE' : '▶️ START AUTO-TRADE'}
                    </button>
                </div>

                <div className="button-group">
                    <button 
                        className="btn-manual" 
                        onClick={handleManualTrade}
                        disabled={connectionStatus !== STATUS_CONNECTED}
                    >
                        🎯 EXECUTE MANUAL TRADE
                    </button>
                    <button 
                        className="btn-reconnect" 
                        onClick={connectWebSocket}
                        disabled={connectionStatus === STATUS_CONNECTING || connectionStatus === STATUS_AUTHORIZING}
                    >
                        🔄 RECONNECT
                    </button>
                </div>
            </div>
        </div>
    );
});

export default OverUnder;
