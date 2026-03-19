
self.onmessage = (event) => {
    const { ticks, contract_type, barrier } = event.data;

    const calculateInstability = (
        p_ticks: number[],
        p_contract_type: string,
        p_barrier: string
    ): number => {
        if (p_ticks.length < 30) return Infinity;

        // ── DIFFERS mode: score based on how often digits repeat within 1, 2, or 3 ticks ──
        // Lower score = digits change frequently = good for differs strategy
        if (p_contract_type === 'DIGITDIFF') {
            const sample = p_ticks.slice(-100);
            const n = sample.length;

            let repeat_1 = 0; // same digit as the immediately previous tick
            let repeat_2 = 0; // same digit as 2 ticks ago
            let repeat_3 = 0; // same digit as 3 ticks ago

            for (let i = 1; i < n; i++) {
                if (sample[i] === sample[i - 1]) repeat_1++;
            }
            for (let i = 2; i < n; i++) {
                if (sample[i] === sample[i - 2]) repeat_2++;
            }
            for (let i = 3; i < n; i++) {
                if (sample[i] === sample[i - 3]) repeat_3++;
            }

            // Normalise each count to a 0-100 percentage
            const pct_1 = (repeat_1 / (n - 1)) * 100;
            const pct_2 = (repeat_2 / (n - 2)) * 100;
            const pct_3 = (repeat_3 / (n - 3)) * 100;

            // Weight immediate repeats the most, then 2-step, then 3-step
            // Lower combined score = digits vary more = better volatility for differs
            return (pct_1 * 3.0) + (pct_2 * 2.0) + (pct_3 * 1.0);
        }

        // ── OVER / UNDER mode: original trend + frequency scoring ──
        const barrier_num = parseInt(p_barrier, 10);
        let target_digits: number[] = [];

        if (p_contract_type === 'DIGITOVER') {
            for (let i = 0; i <= barrier_num; i++) target_digits.push(i);
        } else if (p_contract_type === 'DIGITUNDER') {
            for (let i = barrier_num; i < 10; i++) target_digits.push(i);
        }

        if (target_digits.length === 0) return Infinity;

        const recent_ticks = p_ticks.slice(-50);

        const first_half  = recent_ticks.slice(0, 25);
        const second_half = recent_ticks.slice(25, 50);

        const countInFirstHalf  = first_half.filter(t  => target_digits.includes(t)).length;
        const countInSecondHalf = second_half.filter(t => target_digits.includes(t)).length;

        const percentInFirstHalf  = (countInFirstHalf  / 25) * 100;
        const percentInSecondHalf = (countInSecondHalf / 25) * 100;

        const trend = percentInSecondHalf - percentInFirstHalf;

        const totalCount   = recent_ticks.filter(t => target_digits.includes(t)).length;
        const totalPercent = (totalCount / 50) * 100;

        return (trend * 2.0) + totalPercent;
    };

    const score = calculateInstability(ticks, contract_type, barrier);
    self.postMessage({ score });
};
