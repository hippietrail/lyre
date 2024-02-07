export function humanFriendlyListFormatter(arrayOfStrings: string[], conj: string = 'and') {
    if (arrayOfStrings.length === 0) return '';
    else if (arrayOfStrings.length === 1) return arrayOfStrings[0];
    else if (arrayOfStrings.length === 2) return `${arrayOfStrings[0]} ${conj} ${arrayOfStrings[1]}`;
    else return `${arrayOfStrings.slice(0, -1).join(', ')}, ${conj} ${arrayOfStrings[arrayOfStrings.length - 1]}`;
}
