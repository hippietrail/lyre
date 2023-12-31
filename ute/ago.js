export function ago(t) {
    const m = 1000 * 60;
    const h = m * 60;
    const d = h * 24;
    const w = d * 7;
    return t > w
        ? `${Math.floor(t / w)} weeks ago`
        : t > d
            ? `${Math.floor(t / d)} days ago`
            : t > h
                ? `${Math.floor(t / h)} hours ago`
                : `${Math.floor(t / m)} minutes ago`;
}
