export function ago(t) {
    const m = 1000 * 60;
    const h = m * 60;
    const d = h * 24;
    const w = d * 7;
    const mo = d * 365 / 12;
    const [n, u] = t > mo
        ? [Math.floor(t / mo), 'month']
        : t > w
            ? [Math.floor(t / w), 'week']
            : t > d
                ? [Math.floor(t / d), 'day']
                : t > h
                    ? [Math.floor(t / h), 'hour']
                    : t > m
                        ? [Math.floor(t / m), 'minute']
                        : [Math.floor(t), 'second'];
    return `${n} ${u}${n !== 1 ? 's' : ''} ago`
}
