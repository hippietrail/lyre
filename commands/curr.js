import { SlashCommandBuilder } from 'discord.js';
import { config } from 'dotenv';

config();

const currUrl = new URL('https://api.apilayer.com');
currUrl.pathname = '/fixer/latest';
currUrl.searchParams.set('apikey', process.env.APILAYER_TOKEN);

let globalCachedApilayerData = null;
let globalFormattedDate = '';

// a map of ISO currency codes to various information
const globalCodeToInfo = {
    'AUD': { sym: '$', defVal: 1, name: 'Aussie dollar' },
    'BTC': { sym: '₿', defVal: 1, name: 'Bitcoin' },
    'CNY': { sym: '¥', defVal: 100, name: 'Chinese yuan' },
    'EUR': { sym: '€', defVal: 1, name: 'Euro' },
    'GBP': { sym: '£', defVal: 1, name: 'UK Pound' },
    'GEL': { sym: '₾', defVal: 1, name: 'Georgian lari' },
    'JPY': { sym: '¥', defVal: 100, name: 'Japanese yen' },
    'KHR': { sym: '៛', defVal: 10_000, name: 'Cambodian riel' },
    'KRW': { sym: '₩', defVal: 1000, name: 'South Korean won' },
    'LAK': { sym: '₭', defVal: 100_000, name: 'Lao kip' },
    'MYR': { sym: 'RM', defVal: 100, name: 'Malaysian ringgit' },
    'THB': { sym: '฿', defVal: 100, name: 'Thai baht' },
    'USD': { sym: '$', defVal: 1, name: 'US Dollar' },
    'VND': { sym: '₫', defVal: 10_000, name: 'Vietnamese dong' },
}

// a map of currency symbols to ISO currency codes
const globalSymToCode = {
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
}

class Token {
    constructor(value, isNumber = false) {
        this.value = value;
        this.isNum = isNumber;
    }

    isMaybeCode = () => /^[A-Z]{3}$/.test(this.value.toUpperCase());
    isIsoCode = () => globalCachedApilayerData.rates[this.value.toUpperCase()] !== undefined;
    isCurrSym = () => globalSymToCode[this.value] !== undefined;
    isNumber = () => this.isNum;
    
    isAmbigSym() {
        const e = globalSymToCode[this.value];
        return e && typeof e === 'object' ? e.isAmbiguous : false;
    }
}

function getCodeInfoForSym(sym) {
    const entry = globalSymToCode[sym];
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
    const entry = globalSymToCode[sym];
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
async function getApilayerData() {
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

    if (needsRefresh) {
        try {
            console.log('Fetching apilayer data...');
            globalCachedApilayerData = await (await fetch(currUrl)).json();
            globalFormattedDate = (new Date(globalCachedApilayerData.timestamp * 1000)).toLocaleString();
        } catch (error) {
            console.error('An error occurred while fetching currency data:', error);
        }
    }

    return globalCachedApilayerData;
}

function createCurrencyConverterSlashCommand(code1, name1, code2, name2) {
    return new SlashCommandBuilder()
        .setName(`${code1}${code2}`)
        .setDescription(`${name1} / ${name2}`)
        .addStringOption(option => option.setName('freeform').setDescription('free form').setRequired(false));
}

export const data = createCurrencyConverterSlashCommand('aud', 'Aussie dollar', 'thb', 'Thai baht');
export const execute = async interaction => cur1ToCur2(interaction, "AUD", "THB", 1, 100);

export const data2 = createCurrencyConverterSlashCommand('thb', 'Thai baht', 'aud', 'Aussie dollar');
export const execute2 = async interaction => cur1ToCur2(interaction, "THB", "AUD", 100, 1);

export const data3 = createCurrencyConverterSlashCommand('aud', 'Aussie dollar', 'lak', 'Lao kip');
export const execute3 = async interaction => cur1ToCur2(interaction, "AUD", "LAK", 1, 100_000);

export const data4 = createCurrencyConverterSlashCommand('lak', 'Lao kip', 'aud', 'Aussie dollar');
export const execute4 = async interaction => cur1ToCur2(interaction, "LAK", "AUD", 100_000, 1);

export const data5 = new SlashCommandBuilder()
    .setName('curr')
    .setDescription('Currency conversion')
    .addStringOption(option => option.setName('freeform').setDescription('free form').setRequired(false));

export const execute5 = curr;

function calculateCur1ToCur2Result(apilayerData, cur1, cur2, amount) {
    const cur1Amount = amount * (apilayerData.rates[cur2] / apilayerData.rates[cur1]);
    return `${
        amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } ${cur1} is ${
        cur1Amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    } ${cur2}.`;
}

function calculateDefaultCur1ToCur2Results(apilayerData, cur1, cur2, amount1, amount2) {
    return `${
        calculateCur1ToCur2Result(apilayerData, cur1, cur2, amount1)
    } ${
        calculateCur1ToCur2Result(apilayerData, cur2, cur1, amount2)
    }`;
}

// Currency converter
async function curr(interaction) {
    await interaction.deferReply();
    try {
        const freeform = interaction.options.getString('freeform');
        console.log(`curr freeform: '${freeform}'`);

        const apilayerData = await getApilayerData();

        if (freeform !== null) {
            const regex = /^(.*?)((?:[0-9]+)(?:\.[0-9][0-9])?)(.*?)$/;
            const matches = freeform.match(regex);

            // four groups: full match, optional currency symbol or code 1, amount, optional currency symbol or code 2
            if (matches && matches.length === 4) {
                const pre = matches[1].trim();  // Text before the number
                const amt = matches[2].trim();  // The actual number
                const suf = matches[3].trim();  // Text after the number

                const toks = [];
                if (pre) toks.push(new Token(pre));
                if (amt) toks.push(new Token(amt, true));
                if (suf) toks.push(new Token(suf));

                console.log(`token array length ${toks.length}: ${toks.map(t => t.value)}`);

                // Example usage of the Token and NumberToken class methods with tokenArray
                if (toks.length === 1) {
                    //await interaction.reply("error: hmm amount without either symbol or code?.");
                    await interaction.editReply("error: hmm amount without either symbol or code?.");
                }
                else if (toks.length === 2) {
                    const amount = toks[0].isNumber() ? toks[0].value : toks[1].value;
                    const symOrCode = toks[0].isNumber() ? toks[1] : toks[0];
                    if (symOrCode.isCurrSym()) {
                        //await interaction.reply(`got a symbol and an amount: ${amount} ${symOrCode.value}`);
                        await interaction.editReply(`got a symbol and an amount: ${amount} ${symOrCode.value}`);
                    } else {
                        //await interaction.reply(`got a code and an amount: ${amount} ${symOrCode.value}`);
                        await interaction.editReply(`got a code and an amount: ${amount} ${symOrCode.value}`);
                    }
                }
                else if (toks.length === 3) {
                    if (toks[0].isCurrSym() && toks[2].isCurrSym()) {
                        //await interaction.reply("error: symbols on both sides.");
                        await interaction.editReply("error: symbols on both sides.");
                    } else if (toks[0].isMaybeCode() && toks[2].isMaybeCode()) {
                        //await interaction.reply("error. codes on both sides.");
                        await interaction.editReply("error. codes on both sides.");
                    } else if ((toks[0].isCurrSym() && toks[2].isMaybeCode()) || (toks[0].isMaybeCode() && toks[2].isCurrSym())) {
                        console.log("* symbol on one side, code on the other...");
                        const sym = toks[0].isCurrSym() ? toks[0].value : toks[2].value;
                        const code = (toks[0].isCurrSym() ? toks[2].value : toks[0].value).toUpperCase();
                        const code2ForSym = getCodeInfoForSym(sym).iso;
                        if (code === code2ForSym) {
                            const code2 = code === 'AUD' ? 'THB' : 'AUD';
                            const result = calculateCur1ToCur2Result(apilayerData, code, code2, toks[1].value);
                            const reply = `${result} (as of ${globalFormattedDate})`;
                            //await interaction.reply(reply);
                            await interaction.editReply(reply);
                        } else {
                            const reply = //`error: symbol and code don't match. symbol:{${sym}}, code:{${code}}, code for symbol:{${code2ForSym}}`;
                                `error: symbol ${sym} => ${code2ForSym}, not ${code}.`;
                            //await interaction.reply(reply);
                            await interaction.editReply(reply);
                        }
                    } else {
                        const regex = /^(.+?)\s+(.+?)$/;
                        const matches = toks[2].value.match(regex);
                        if (matches && matches.length === 3) {
                            const fakeMoreToks = [...toks, matches[1], matches[2]];
                            //await interaction.reply('looks like four tokens actually. coming soon...');
                            await interaction.editReply('looks like four tokens actually. coming soon...');
                            console.log(`matches: ${JSON.stringify(fakeMoreToks)}`);
                        } else {
                            //await interaction.reply(`Syntax error. Prefix:{${toks[0].isCurrSym()}} number:{${toks[1].value}} suffix:{${toks[2].isCurrSym()}}`);
                            await interaction.editReply(`Syntax error. Prefix:{${toks[0].isCurrSym()}} number:{${toks[1].value}} suffix:{${toks[2].isCurrSym()}}`);
                        }
                    }
                } else {
                    //await interaction.reply(`Invalid number of tokens: ${toks.length}. So far only 3 tokens are supported.`);
                    await interaction.editReply(`Invalid number of tokens: ${toks.length}. So far only 3 tokens are supported.`);
                }
            }
            // any other number of groups we don't handle yet
            else {
                //await interaction.reply('Give me at least an amount and a currency. Amount can have two decimal places.');
                await interaction.editReply('Give me at least an amount and a currency. Amount can have two decimal places.');
            }
        } else {
            //await interaction.reply('Give me something to convert!');
            await interaction.editReply('Give me something to convert!');
        }
    } catch (error) {
        console.error(error);
        //await interaction.reply('You\'re probably holding it wrong.');
        await interaction.editReply('You\'re probably holding it wrong. Try again.');
    }
}

async function cur1ToCur2(interaction, cur1, cur2, cur1DefaultAmount, cur2DefaultAmount) {
    await interaction.deferReply();
    try {
        const freeform = interaction.options.getString('freeform');
        console.log(`f2b: ${cur1}${cur2} freeform: '${freeform}'`);

        const apilayerData = await getApilayerData();

        if (freeform !== null) {
            const regex = /^(.*?)((?:[0-9]+)(?:\.[0-9][0-9])?)(.*?)$/;
            const matches = freeform.match(regex);

            if (matches && matches.length === 4) {
                const pre = matches[1];     // Text before the number
                const number = matches[2];  // The actual number
                const suf = matches[3];     // Text after the number

                if (pre === "" && suf === "") {
                    const amount = parseFloat(number);
                    const result = calculateCur1ToCur2Result(apilayerData, cur1, cur2, amount);
                    const reply = `${result} (as of ${globalFormattedDate})`;
                    await interaction.editReply(reply);
                } else {
                    // TODO handle cases where pre and/or suf are not empty
                    // TODO for instance, if pre is "฿" or "₭" or "$", or suf is "AUD" or "THB" or "LAK"
                    await interaction.editReply('working on it 1...');
                }
            } else {
                console.log('No match found.');
                await interaction.editReply('wut??');
            }
        } else {
            console.log('No param.');
            const results = calculateDefaultCur1ToCur2Results(apilayerData, cur1, cur2, cur1DefaultAmount, cur2DefaultAmount);
            const reply = `${results} (as of ${globalFormattedDate})`;
            await interaction.editReply(reply);
        }
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}
