export function ago(t) {
    const m = 1000 * 60;
    const h = m * 60;
    const d = h * 24;
    const w = d * 7;
    const mo = d * 365 / 12;
    const [n, u] = t > mo
        ? [Math.floor(t / mo * 2) / 2, 'month']
        : t > w
            ? [Math.floor(t / w * 2) / 2, 'week']
            : t > d
                ? [Math.floor(t / d * 2) / 2, 'day']
                : t > h
                    ? [Math.floor(t / h * 2) / 2, 'hour']
                    : t > m
                        ? [Math.floor(t / m * 2) / 2, 'minute']
                        : [Math.floor(t * 2) / 2, 'second'];
    return `${n} ${u}${n !== 1 ? 's' : ''} ago`
}
