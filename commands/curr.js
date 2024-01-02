import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import { config } from 'dotenv';

config();

const currEarl = new Earl('https://api.apilayer.com', '/fixer/latest', {
    apikey: process.env.APILAYER_TOKEN,
});

let globalCachedApilayerData = null;
let globalFormattedDate = '';

// a map of ISO currency codes to various information
// TODO what about narrow vs wide won and yuan/yen symbols?
const globalCodeToInfo = {
    'AUD': { sym: '$', defAmt: 1, name: 'Aussie dollar' },          // TODO narrow/wide symbol and variants? 💲$﹩＄
    'BTC': { sym: '₿', defAmt: 1, name: 'Bitcoin' },
    'CNY': { sym: '¥', defAmt: 100, name: 'Chinese yuan' },         // TODO narrow/wide symbol and variants? ¥￥元
    'EUR': { sym: '€', defAmt: 1, name: 'Euro' },
    'GBP': { sym: '£', defAmt: 1, name: 'UK Pound' },
    'GEL': { sym: '₾', defAmt: 1, name: 'Georgian lari' },
    'IDR': { sym: 'Rp', defAmt: 10_000, name: 'Indonesian rupiah' },
    'JPY': { sym: '¥', defAmt: 100, name: 'Japanese yen' },         // TODO narrow/wide symbol variants? ¥￥円
    'KHR': { sym: '៛', defAmt: 10_000, name: 'Cambodian riel' },
    'KRW': { sym: '₩', defAmt: 1000, name: 'South Korean won' },    // TODO narrow/wide symbol and variants? ₩￦
    'LAK': { sym: '₭', defAmt: 100_000, name: 'Lao kip' },
    'MYR': { sym: 'RM', defAmt: 100, name: 'Malaysian ringgit' },
    'SGD': { sym: '$', defAmt: 1, name: 'Singapore dollar' },       // TODO narrow/wide symbol and variants? 💲$﹩＄
    'THB': { sym: '฿', defAmt: 100, name: 'Thai baht' },
    'TWD': { sym: '$', defAmt: 1, name: 'Taiwan dollar' },          // TODO narrow/wide symbol and variants? 💲$﹩＄
    'USD': { sym: '$', defAmt: 1, name: 'US Dollar' },              // TODO narrow/wide symbol and variants? 💲$﹩＄
    'VND': { sym: '₫', defAmt: 10_000, name: 'Vietnamese dong' },
}

// a map of currency symbols to ISO currency codes
const globalSymToInfo = {
    // non-alphabetic
    '$': { iso: 'AUD', isAmbiguous: true }, // symbol also used by: USD
    '฿': { iso: 'THB', isAmbiguous: false },
    '€': { iso: 'EUR', isAmbiguous: false},
    '£': { iso: 'GBP', isAmbiguous: false },
    '₾': { iso: 'GEL', isAmbiguous: false },
    '₭': { iso: 'LAK', isAmbiguous: false },
    '₩': { iso: 'KRW', isAmbiguous: false },
    '¥': { iso: 'JPY', isAmbiguous: true }, // symbol also used by : CNY
    '៛': { iso: 'KHR', isAmbiguous: false },
    '₫': { iso: 'VND', isAmbiguous: false },
    '₿': { iso: 'BTC', isAmbiguous: false},
    // alphabetic
    'RM': { iso: 'MYR', isAmbiguous: false },
    'RMB': { iso: 'CNY', isAmbiguous: false },
    'UKP': { iso: 'GBP', isAmbiguous: false },
}

class Token {
    constructor(value, isNumber = false) {
        this.value = value;
        this.isNum = isNumber;
    }

    // only checks if this token is three uppercase letters, the form of an ISO currency code
    isMaybeCode = () => /^[A-Z]{3}$/.test(this.value.toUpperCase());

    // checks if this token is actually a valid ISO currency code supported by apilayer
    // TODO isIsoCode might need to fetch the apilayer exchange rate data
    isSupportedCode = () => globalCachedApilayerData.rates[this.value.toUpperCase()] !== undefined;
    
    // checks if this token is one of our hard-coded currency symbols
    isCurrSym = () => globalSymToInfo[this.value.toUpperCase()] !== undefined;
    
    // checks if this token is a number
    isNumber = () => this.isNum;
    
    // checks if this token is an ambiguous currency symbol
    isAmbigSym() {
        const e = globalSymToInfo[this.value];
        return e && typeof e === 'object' ? e.isAmbiguous : false;
    }
}

function getCodeInfoForSym(sym) {
    const entry = globalSymToInfo[sym];
    if (entry) {
        if (typeof entry === 'object') {
            return entry;
        } else {
            return { isAmbiguous: false, iso: entry };
        }
    }
    return null;
}

function getDefaultCodeForSym(sym) {
    const entry = globalSymToInfo[sym];
    if (entry) {
        if (typeof entry === 'object') {
            return entry.iso;
        } else {
            return entry;
        }
    }
    return null;
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Retrieves data from the apilayer API if the cached data is outdated or does not exist.
 *
 * @return {Object} The data retrieved from the apilayer API.
 */
async function getApilayerData(isDataStale) {
    if (isDataStale) {
        try {
            console.log('Fetching apilayer data...');
            globalCachedApilayerData = await (await fetch(currEarl.getUrlString())).json();
            console.log('Got apilayer data.');
            //console.log(`Got apilayer data:\n  ${Object.keys(globalCachedApilayerData)}\n  ${Object.keys(globalCachedApilayerData.rates)}`);
            globalFormattedDate = (new Date(globalCachedApilayerData.timestamp * 1000)).toLocaleString();
        } catch (error) {
            console.error('An error occurred while fetching currency data:', error);
        }
    }

    return globalCachedApilayerData;
}

function needToRefreshApiLayerData() {
    let needsRefresh = false;
    if (globalCachedApilayerData === undefined || globalCachedApilayerData === null) {
        console.log('no cached apilayer data');
        needsRefresh = true;
    } else {
        const mins = Math.floor((Date.now() - globalCachedApilayerData.timestamp * 1_000) / 60_000); // Calculate elapsed minutes
        console.log(`Elapsed: ${mins} minutes`);

        if (mins > 15) {
            console.log('cached apilayer data is over 15 minutes old');
            needsRefresh = true;
        }
    }
    return needsRefresh;
}

export const data = new SlashCommandBuilder()
    .setName('curr')
    .setDescription('Currency conversion')
    .addStringOption(option => option.setName('freeform').setDescription('free form').setRequired(false));

export const execute = curr;

// Converts `amount` from `cur1` to `cur2`
function calculateCur1ToCur2Result(apilayerData, cur1, cur2, amount) {
    const cur1Amount = amount * (apilayerData.rates[cur2] / apilayerData.rates[cur1]);
    return `${
        amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } ${cur1} is ${
        cur1Amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } ${cur2}.`;
}

// Converts `amount1` from `cur1` to `cur2` and `amount2` from `cur2` to `cur1`
// Useful for getting two-way exchange rates
function calculateDefaultCur1ToCur2Results(apilayerData, cur1, cur2, amount1, amount2) {
    //console.log(`[HIPP] calculateDefaultCur1ToCur2Results: ${cur1}, ${cur2}, ${amount1}, ${amount2}`);
    return `${
        calculateCur1ToCur2Result(apilayerData, cur1, cur2, amount1)
    } ${
        calculateCur1ToCur2Result(apilayerData, cur2, cur1, amount2)
    }`;
}

async function replyOrEdit(interaction, isEdit, reply) {
    console.log(`[HIPP] replyOrEdit: ${isEdit ? 'edit' : 'reply'}: ${reply}`);
    await (isEdit ? interaction.editReply(reply) : interaction.reply(reply));
}

// Currency converter
// This will be the main/only command
// Will do different things depending on its parameters
async function curr(interaction) {
    const needDeferEdit = needToRefreshApiLayerData();
    console.log(`[HIPP] curr: ${needDeferEdit ? 'edit' : 'reply'}`);
    if (needDeferEdit) await interaction.deferReply();
    try {
        const freeform = interaction.options.getString('freeform');
        console.log(`curr freeform: '${freeform}'`);

        const apilayerData = await getApilayerData(needDeferEdit);

        if (freeform === null) {
            await replyOrEdit(interaction, needDeferEdit, 'Give me something to convert!');
            return;
        }

        const parsley = [
            [/^(.*?)((?:[0-9]+)(?:\.[0-9][0-9])?)(.*?)$/, 3, currAmountWithCodeAndOrSym],
            [/^([A-Za-z]{3})\s?([A-Za-z]{3})$/, 2, currTwoCodes],
            [/^([A-Za-z]{3})$/, 1, currOneCode]
        ];
    
        let matched = false;
        for (const [reg, num, fun] of parsley) {
            const match = freeform.match(reg);
            if (match && match.length === num + 1) {
                await replyOrEdit(interaction, needDeferEdit, fun(apilayerData, match));
                matched = true;
                break;
            }
        }
    
        if (!matched) {
            await replyOrEdit(interaction, needDeferEdit, 'Give me at least an amount and a currency. Amount can have two decimal places.');
        }
    } catch (error) {
        console.error(error);
        await replyOrEdit(interaction, needDeferEdit, 'You\'re probably holding it wrong. Try again.');
    }
}

function currOneCode(apilayerData, matches) {
    const cur1 = matches[1].toUpperCase();
    const cur2 = cur1 === 'AUD' ? 'THB' : 'AUD';
    const results = calculateDefaultCur1ToCur2Results(apilayerData, cur1, cur2,
        globalCodeToInfo[cur1].defAmt, globalCodeToInfo[cur2].defAmt);
    return results;
}

function currTwoCodes(apilayerData, matches) {
    const cur1 = matches[1].toUpperCase();
    const cur2 = matches[2].toUpperCase();
    const results = calculateDefaultCur1ToCur2Results(apilayerData, cur1, cur2,
        globalCodeToInfo[cur1].defAmt, globalCodeToInfo[cur2].defAmt);
    return results;
}

function currAmountWithCodeAndOrSym(apilayerData, matches) {
    console.log(`[HIPP] amountWithCodeAndOrSym: ${matches[1]}, ${matches[2]}, ${matches[3]}`);
    const pre = matches[1].trim(); // Text before the number
    const amt = matches[2].trim(); // The actual number
    const suf = matches[3].trim(); // Text after the number

    const toks = [];
    if (pre) toks.push(new Token(pre));
    if (amt) toks.push(new Token(amt, true));
    if (suf) toks.push(new Token(suf));

    console.log(`token array length ${toks.length}: ${toks.map(t => t.value)}`);

    if (toks.length === 1) {
        return "error: hmm amount without either symbol or code?.";
    } else if (toks.length === 2) {
        const amount = toks[0].isNumber() ? toks[0].value : toks[1].value;
        const symOrCode = toks[0].isNumber() ? toks[1] : toks[0];
        if (symOrCode.isCurrSym()) {
            return currSymOnly(apilayerData, amount, symOrCode);
        } else {
            return currCodeOnly(apilayerData, amount, symOrCode);
        }
    } else if (toks.length === 3) {
        if (toks[0].isCurrSym() && toks[2].isCurrSym()) {
            return "error: symbols on both sides.";
        } else if (toks[0].isMaybeCode() && toks[2].isMaybeCode()) {
            return "error. codes on both sides.";
        } else if ((toks[0].isCurrSym() && toks[2].isMaybeCode()) || (toks[0].isMaybeCode() && toks[2].isCurrSym())) {
            return currSymAndCode(apilayerData, toks);
        } else {
            console.log('[HIPP] curr: hit the \'else\'');
            const regex = /^(.+?)\s+(.+?)$/;
            const matches = toks[2].value.match(regex);
            if (matches && matches.length === 3) {
                const newToks = [...toks.slice(0, 2), new Token(matches[1]), new Token(matches[2])];
                console.log(`matches: ${JSON.stringify(newToks, null, 2)}`);
                return 'looks like more than 3 tokens actually. coming soon...';
            } else {
                return `Syntax error. Prefix:{${toks[0].isCurrSym()}} number:{${toks[1].value}} suffix:{${toks[2].isCurrSym()}}`;
            }
        }
    } else {
        return `Invalid number of tokens: ${toks.length}. So far only 3 tokens are supported.`;
    }
}

function currSymAndCode(apilayerData, toks) {
    const sym = toks[0].isCurrSym() ? toks[0].value : toks[2].value;
    const code = (toks[0].isCurrSym() ? toks[2].value : toks[0].value).toUpperCase();
    const symForCode = globalCodeToInfo[code].sym;
    if (sym === symForCode) {
        const code2 = code === 'AUD' ? 'THB' : 'AUD';
        const result = calculateCur1ToCur2Result(apilayerData, code, code2, toks[1].value);
        return `${result} (as of ${globalFormattedDate})`;
    } else {
        var reply = `Umm ${code} is ${symForCode}, not ${sym}, which is ${getDefaultCodeForSym(sym)}`;
        if (globalSymToInfo[sym].isAmbiguous) {
            reply += ', etc';
        }
        reply += '.';
        return reply;
    }
}

// like currSymAndCode but only has three-letter code so doesn't have to check if it matches the currency symbol
// but does have to consider whether it's a code supported by apilayer
function currCodeOnly(apilayerData, amount, codeTok) {
    const code = codeTok.value.toUpperCase();
    if (!(code in apilayerData.rates)) {
        return `${code} isn't a known currency code.`;
    }
    const code2 = code === 'AUD' ? 'THB' : 'AUD';
    const result = calculateCur1ToCur2Result(apilayerData, code, code2, amount);
    return `${result} (as of ${globalFormattedDate})`;
}

// like currSymAndCode but only has currency symbol so doesn't have to check if it matches the ISO currency code
// but does have to consider whether the symbol is ambiguous
function currSymOnly(apilayerData, amount, symTok) {
    const sym = symTok.value.toUpperCase();
    const code = getCodeInfoForSym(sym).iso;
    const code2 = code === 'AUD' ? 'THB' : 'AUD';
    const result = calculateCur1ToCur2Result(apilayerData, code, code2, amount);
    const reply = [result];
    if (globalSymToInfo[sym].isAmbiguous) {
        reply.push(`(assuming ${sym} means ${getDefaultCodeForSym(sym)})`);
    }
    reply.push(`(as of ${globalFormattedDate})`);
    return reply.join(' ');
}
