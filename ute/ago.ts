export function ago(t) {
    const s = 1000;
    const m = s * 60;
    const h = m * 60;
    const d = h * 24;
    const w = d * 7;
    const mo = d * 365.25 / 12;
    const y = d * 365.25;
    const de = y * 10;
    const c = de * 20;
    const x = [
        [c, 'century'],
        [de, 'decade'],
        [y, 'year'],
        [mo, 'month'],
        [w, 'week'],
        [d, 'day'],
        [h, 'hour'],
        [m, 'minute'],
        [s, 'second'],
    ];

    let n;
    var u;
    let v;
    let q;
    for (let i = 0; i < x.length; i++) {
        [v, u] = x[i];
        if (t >= v) break;
    }
    [n, q] = div(t, v);
    return `${
        n !== 0 || q === 0 ? n : ''
    }${
        ['', '¼', '½', '¾'][q]
    } ${u}${
        n === 1 && q === 0 ? '' : 's'
    } ago`;

    function div(t, v) {
        const d = t/v;
        const i = Math.floor(d);
        return [i, Math.floor((d - i) * 4)];
    }
}
