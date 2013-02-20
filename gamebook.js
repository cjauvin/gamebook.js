/*jslint nomen: true, plusplus: true, regexp: true, unparam: true, sloppy: true, white: true, browser: true, todo: true, undef: true */
/*global $ */

$(document).ready(function($) {

    // http://ejohn.org/blog/fast-javascript-maxmin/
    Array.max = function(arr) {
        return Math.max.apply(Math, arr);
    };

    // http://stackoverflow.com/a/2648463/787842
    String.prototype.format = String.prototype.f = function() {
        var s = this,
        i = arguments.length;
        while (i--) { s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]); }
        return s;
    };

    // http://stackoverflow.com/a/4825873/787842
    Array.prototype.remove = function(elem) {
        var match = -1;
        while( (match = this.indexOf(elem)) > -1 ) {
            this.splice(match, 1);
        }
    };

    var logo = ["                            _                 _       _      ",
                "  __ _  __ _ _ __ ___   ___| |__   ___   ___ | | __  (_)___  ",
                " / _` |/ _` | '_ ` _ \\ / _ \\ '_ \\ / _ \\ / _ \\| |/ /  | / __| ",
                "| (_| | (_| | | | | | |  __/ |_) | (_) | (_) |   < _ | \\__ \\ ",
                " \\__, |\\__,_|_| |_| |_|\\___|_.__/ \\___/ \\___/|_|\\_(_)/ |___/ ",
                " |___/                                             |__/      "].join('\n'),

    isInArray = function(elem, arr) {
        return $.inArray(elem, arr) > -1;
    },

    // only first matching item
    removeByName = function(name, arr) {
        $.each(arr, function(i, item) {
            if (item.name === name) {
                arr.remove(item);
                return false;
            }
        });
    },

    // uses jsonp to avoid XSS issues
    //gamebook_url = '//projectaon.org/staff/christian/gamebook.js/fotw.php?callback=?',
    gamebook_url = 'fotw_generated.json',
    debug = true,
    data,
    synonyms = {},
    prev_section,
    curr_section = '1',
    visited_sections = [curr_section],
    autocompletion_enabled = true,
    // sequence parts
    sequence_mode = {is_active: false,
                     prompt: '[[;#000;#ff0][press any key]]',
                     which: 'engine_intro',
                     seq: [], seq_idx: 1},
    // wait for a keypress
    press_key_mode = {is_active: false,
                      prompt: '[[;#000;#ff0][press any key]]',
                      callback: $.noop},
    // yes/no question interface
    confirm_mode = {is_active: false,
                    prompt: '[[;#000;#ff0][accept y/n]]',
                    yes_callback: $.noop,
                    no_callback: $.noop},
    option_mode = {is_active: false,
                   prompt: '[[;#000;#ff0][choose an item]]',
                   range: [0, 9],
                   callback: $.noop,
                   accumulator: []},
    term,
    command,
    cmd_prompt,
    help_str =
        "Apart from the textual play commands, you can also use:\n\n" +
        "'help' or '?': show this message\n" +
        "'ac' or '!'  : show the Action Chart\n" +
        "'drop'/'use' : one of your (weapon, backpack or special) items\n" +
        "'continue'   : if the current section has only one choice, go to the next\n" +
        "'123'        : go to section 123 (if possible from current section)\n" +
        "'hint'       : show a random word from the choices of the current section\n" +
        "'choices'    : (or 'cheat') reveal the set of choices for the current section\n" +
        "'auto'       : toggle word autocompletion on/off\n" +
        "'again'      : reprint the current section\n" +
        "'restart'    : restart the game (including setup)\n" +
        "'clear'      : clear the screen\n",

    engine_intro = [logo + "\n\nWelcome to https://github.com/cjauvin/gamebook.js[gamebook.js], an http://en.wikipedia.org/wiki/Interactive_fiction[IF]-style gamebook engine created by\nhttp://christianjauv.in[Christian Jauvin].",
                    "Instead of navigating an explicit menu of choices, as in the classical\ngamebooks, you are a given a console in which you are free to type\nany command, after each section, using clues from the text. The engine\nthen tries to match your input with one of the predefined choices,\nyielding a gameplay more akin to http://en.wikipedia.org/wiki/Interactive_fiction[interactive fiction].",
                    "You're about to play an experimental and incomplete version of\nhttp://en.wikipedia.org/wiki/Fire_on_the_water[Fire on the Water], the second gamebook in the http://en.wikipedia.org/wiki/Lone_Wolf_(gamebooks)[Lone Wolf] series,\nwritten by http://en.wikipedia.org/wiki/Joe_Dever[Joe Dever] in 1984. This http://www.projectaon.org/en/Main/FireOnTheWater[electronic version] of the book\nwas created and is being distributed by http://www.projectaon.org/en/Main/Home[Project Aon]. Please note\nthat only the first 53 sections (in http://www.projectaon.org/en/svg/lw/02fotw.svgz[\"story\"], rather than numeric\norder) of the book are currently implemented (but the rest should\nfollow soon).",
                    ["How to Play", help_str]],

    //   *
    // *   *
    stars = new Array(33).join(' ') + '*\n' + new Array(31).join(' ') + '*   *',

    action_chart = {
        combat_skill: 0,
        endurance: {
            initial: 0, current: 0
        },
        kai_disciplines: [],
        weaponskill: '',
        weapons: [],
        gold: 0,
        backpack_items: [],
        has_backpack: true,
        special_items: [{name: 'Map', ac_section: 'special_items'},
                        {name: 'Seal of Hammerdal', ac_section: 'special_items'}]
    },

    initial_ac = $.extend(true, {}, action_chart),
    setup_equipment_tmp = [],

    combat_results_table = [
        [[6,0], [7,0], [8,0], [9,0], [10,0], [11,0], [12,0], [14,0], [16,0], [18,0], ['k',0], ['k',0], ['k',0]], // 0
        [[0,'k'], [0,'k'], [0,8], [0,6], [1,6], [2,5], [3,5], [4,5], [5,4], [6,4], [7,4], [8,3], [9,3]],         // 1
        [[0,'k'], [0,8], [0,7], [1,6], [2,5], [3,5], [4,4], [5,4], [6,3], [7,3], [8,3], [9,3], [10,2]],          // ..
        [[0,8], [0,7], [1,6], [2,5], [3,5], [4,4], [5,4], [6,3], [7,3], [8,3], [9,2], [10,2], [11,2]],
        [[0,8], [1,7], [2,6], [3,5], [4,4], [5,4], [6,3], [7,3], [8,2], [9,2], [10,2], [11,2], [12,2]],
        [[1,7], [2,6], [3,5], [4,4], [5,4], [6,3], [7,2], [8,2], [9,2], [10,2], [11,2], [12,2], [14,1]],
        [[2,6], [3,6], [4,5], [5,4], [6,3], [7,2], [8,2], [9,2], [10,2], [11,1], [12,1], [14,1], [16,1]],
        [[3,5], [4,5], [5,4], [6,3], [7,2], [8,2], [9,1], [10,1], [11,1], [12,0], [14,0], [16,0], [18,0]],
        [[4,4], [5,4], [6,3], [7,2], [8,1], [9,1], [10,0], [11,0], [12,0], [14,0], [16,0], [18,0], ['k',0]],
        [[5,3], [6,3], [7,2], [8,0], [9,0], [10,0], [11,0], [12,0], [14,0], [16,0], [18,0], ['k',0], ['k',0]],
        [[6,0], [7,0], [8,0], [9,0], [10,0], [11,0], [12,0], [14,0], [16,0], [18,0], ['k',0], ['k',0], ['k',0]]  // 9
    ],

    combat_results_ranges = [
        [Number.NEGATIVE_INFINITY, -11], [-10,-9], [-8,-7], [-6,-5], [-4,-3], [-2,-1], [0,0], [1,2], [3,4], [5,6],
        [7,8], [9,10], [11, Number.POSITIVE_INFINITY]
    ],

    colors = {
        'red': '#f00', 'blue': '#0f60ff', 'yellow': '#ff0'
    },

    //------------------------------------------------------------------------------------------------------------
    print = function(str, color_name) {
        if (color_name === undefined) {
            term.echo(str);
        } else {
            term.echo('[[;{0};#000]{1}]'.f(colors[color_name], str));
        }
        term.echo('\n');
    },

    //------------------------------------------------------------------------------------------------------------
    printSectionNumber = function(si) {
        print('{0}({1})'.f(new Array(38).join(' '), si), 'yellow');
    },

    //------------------------------------------------------------------------------------------------------------
    getNames = function(items) {
        return $.map(items, function (i) { return i.name; });
    },

    //------------------------------------------------------------------------------------------------------------
    // taken from: http://rosettacode.org/wiki/Levenshtein_distance#JavaScript
    levenshteinDist = function(str1, str2) {
        var m = str1.length,
        n = str2.length,
        d = [],
        i, j;
        if (!m) { return n; }
        if (!n) { return m; }
        for (i = 0; i <= m; i++) { d[i] = [i]; }
        for (j = 0; j <= n; j++) { d[0][j] = j; }
        for (j = 1; j <= n; j++) {
            for (i = 1; i <= m; i++) {
                if (str1[i-1] === str2[j-1]) { d[i][j] = d[i - 1][j - 1]; }
                else { d[i][j] = Math.min(d[i-1][j], d[i][j-1], d[i-1][j-1]) + 1; }
            }
        }
        return d[m][n];
    },

    //------------------------------------------------------------------------------------------------------------
    // http://gotochriswest.com/blog/2011/05/02/cartesian-product-of-multiple-arrays/
    cartesianProduct = function(arr) {
        return Array.prototype.reduce.call(arr, function(a, b) {
            var ret = [];
            a.forEach(function(a) {
                b.forEach(function(b) {
                    ret.push(a.concat([b]));
                });
            });
            return ret;
        }, [[]]);
    },

    //------------------------------------------------------------------------------------------------------------
    zeros = function(n) {
        var a = [];
        while (--n >= 0) {
            a[n] = 0;
        }
        return a;
    },

    //------------------------------------------------------------------------------------------------------------
    // 0--9 inc
    pickRandomNumber = function() {
        return Math.floor(Math.random() * 10);
    },

    //------------------------------------------------------------------------------------------------------------
    setConfirmMode = function(conf) {
        confirm_mode.is_active = true;
        term.set_prompt(conf.hasOwnProperty('prompt') ? conf.prompt : confirm_mode.prompt);
        var noop = function() {
            term.set_prompt(cmd_prompt);
        };
        confirm_mode.yes_callback = conf.hasOwnProperty('yes') ? conf.yes : noop;
        confirm_mode.no_callback = conf.hasOwnProperty('no') ? conf.no : noop;
    },

    //------------------------------------------------------------------------------------------------------------
    setPressKeyMode = function(callback) {
        press_key_mode.is_active = true;
        term.set_prompt(press_key_mode.prompt);
        press_key_mode.callback = callback;
    },

    //------------------------------------------------------------------------------------------------------------
    setOptionMode = function(conf) {
        option_mode.is_active = true;
        term.set_prompt(conf.hasOwnProperty('prompt') ? conf.prompt : option_mode.prompt);
        option_mode.range = conf.range;
        option_mode.callback = conf.callback;
    },

    //------------------------------------------------------------------------------------------------------------
    calculateCombatSkill = function(enemy) {
        var ac = action_chart,
        str = '{0}'.f(ac.combat_skill),
        val = ac.combat_skill,
        enemy = enemy ? enemy : {};
        if (isInArray('Sommerswerd', getNames(ac.weapons))) {
            str += ' + 8(SW)';
            val += 8;
        }
        var sommerswerd_ws = isInArray('Sommerswerd', getNames(ac.weapons)) &&
            isInArray(ac.weaponskill, ['Sword', 'Short Sword', 'Broadsword']);
        if (isInArray('Weaponskill', ac.kai_disciplines) &&
            (isInArray(ac.weaponskill, ac.weapons) || sommerswerd_ws)) {
            str += ' + 2(WS)';
            val += 2;
        }
        var mb_immune = (enemy.hasOwnProperty('immune') && enemy.immune === 'Mindblast');
        if (isInArray('Mindblast', ac.kai_disciplines) && !mb_immune) {
            str += ' + 2(MB)';
            val += 2;
        }
        if (isInArray('Shield', ac.special_items)) {
            str += ' + 2(Sh)';
            val += 2;
        }
        if (ac.weapons.length === 0) {
            str += ' - 4(NoWp)';
            val -= 4;
        }
        if (str !== '{0}'.f(ac.combat_skill)) {
            str = '{0} [[;#00f;#000]{1}]'.f(val, str);
        }
        return { str: str, val: val };
    },

    //------------------------------------------------------------------------------------------------------------
    calculateEndurance = function () {
        var ac = action_chart,
        str = '{0}'.f(ac.endurance.initial),
        val = ac.endurance.initial;
        if (isInArray('Chainmail Waistcoat', getNames(ac.special_items))) {
            str += ' + 4(CW)';
            val += 4;
        }
        if (str !== '{0}'.f(ac.endurance.initial)) {
            str = '{0} [[;#00f;#000]{1}]'.f(val, str);
        }
        return { str: str, val: val };
    },

    //------------------------------------------------------------------------------------------------------------
    updateEndurance = function(val) {
        if (val === undefined) {
            // make sure current is not > full (can happen for instance if chainmail is dropped)
            action_chart.endurance.current = Math.min(calculateEndurance().val, action_chart.endurance.current);
        } else{
            action_chart.endurance.current += Math.min(val, calculateEndurance().val - action_chart.endurance.current);
        }
        return isStillAlive();
    },

    //------------------------------------------------------------------------------------------------------------
    restart = function() {
        // needed to restore certain modifs made to the game data structure
        $.getJSON(gamebook_url, function(_data) {
            data = _data;
            action_chart = $.extend(true, {}, initial_ac);
            setup_equipment_tmp = [];
            initSequenceMode(data.setup.sequence, 'gamebook_setup');
            doSetupSequence();
        });
    },

    //------------------------------------------------------------------------------------------------------------
    isStillAlive = function() {
        if (action_chart.endurance.current <= 0) {
            confirm_mode.is_active = false;
            print('You have died..', 'red');
            print(stars, 'yellow');
            setPressKeyMode(function() {
                restart();
            });
            return false;
        }
        return true;
    },

    //------------------------------------------------------------------------------------------------------------
    addItem = function(item, drop_offer_type) { // offer_drop_mode: none, optional, force
        // meals can be sold in packs (of more than one)
        var item0 = $.isArray(item) ? item[0] : item;

        // backpack special cases
        if (item0.name === 'Backpack') {
            if (action_chart.has_backpack) {
                print('You already have a Backpack..', 'blue');
                return false;
            } else {
                action_chart.has_backpack = true;
                action_chart.backpack_items = [];
                return true;
            }
        }
        if (item0.ac_section === 'backpack_items' && !action_chart.has_backpack) {
            if (item0.hasOwnProperty('is_mandatory')) {
                print('Error: mandatory item without a Backpack!', 'blue');
            }
            print('You need a Backpack for this!', 'blue');
            if (item0.hasOwnProperty('is_consumable')) {
                print('Consume it now?', 'blue');
                setConfirmMode({
                    yes: function() {
                        updateEndurance(item0.endurance);
                        print('You gain {0} ENDURANCE points.'.f(item0.endurance), 'blue');
                        term.set_prompt(cmd_prompt);
                    }
                });
            }
            // remove item that triggered addItem, to avoid coming back
            removeByName(item0.name, data.sections[curr_section].items || []);
            return false;
        }

        // AC weapons and backpack items size limitation special cases
        var found = false;
        $.each([['weapons', 2, 'weapon'], ['backpack_items', 8, 'backpack item']], function(i, elems) {
            var ac_sect = elems[0];
            var lim = elems[1];
            if (item0.ac_section === ac_sect && action_chart[ac_sect].length === lim) {
                print('You already carry {0} weapons..'.f(lim), 'blue');
                if (isInArray(drop_offer_type, ['optional', 'force'])) {
                    var opts = drop_offer_type === 'optional' ? [{name:'None'}].concat(action_chart[ac_sect]) : action_chart[ac_sect];
                    $.each(opts, function(i, w) {
                        print('({0}) {1}'.f(i, w.name), 'blue');
                    });
                    setOptionMode({
                        range: [48, 48 + opts.length - 1],
                        prompt: '[[;#000;#ff0][choose a {0} to drop]]'.f(elems[2]),
                        callback: function(i) {
                            if (drop_offer_type === 'optional' && i === 0) { // none picked
                                // trick: remove item that triggered addItem, to avoid coming back
                                removeByName(item0.name, data.sections[curr_section].items);
                                doSection();
                                return;
                            }
                            if (drop_offer_type === 'optional') {
                                i -= 1;
                            }
                            print('You have dropped your {0}.'.f(action_chart[ac_sect][i].name), 'blue');
                            removeByName(action_chart[ac_sect][i].name, action_chart[ac_sect]);
                            doSection();
                        }
                    });
                }
                found = true;
                return false;
            }
        });
        if (found) { return false; }

        var item_arr = $.isArray(item) ? item : [item];
        $.each(item_arr, function(i, item) {
            // special case here for meals, which can be sold in packs (of more than 1)
            // we stuff as many as we can in the remaining space!
            if (item.ac_section === 'backpack_items' && action_chart.backpack_items.length === 8) { return true; }
            action_chart[item.ac_section].push(item);
        });
        return true;
    },

    //------------------------------------------------------------------------------------------------------------
    matchItem = function(input_str, ac_sections) {
        var closest = {lev: Number.POSITIVE_INFINITY, item: null};
        $.each(ac_sections || ['weapons', 'backpack_items', 'special_items'], function(i, ac_section) {
            $.each(action_chart[ac_section], function(j, item) {
                var item_name_words = item.name.split(/[^A-Za-z0-9']+/).concat(item.name);
                $.each(item_name_words, function(k, inw) {
                    var lev = levenshteinDist(input_str, inw.toLowerCase());
                    //console.log(iw, lev);
                    if (lev < 3 && lev < closest.lev) {
                        closest = {lev: lev, item: item};
                    }
                });
            });
        });
        return closest.item;
    },

    //------------------------------------------------------------------------------------------------------------
    satisfiesChoiceRequirements = function(choice) {
        var ok = true;
        $.each(Object.keys(choice.requires || []), function(j, key) {
            var value = choice.requires[key];
            if (key === 'has_visited') {
                if (!isInArray(value, visited_sections)) {
                    ok = false;
                    return false;
                }
            } else {
                // keys should correspond to ac sections
                switch (typeof value) {
                case 'string':
                    // test inclusion
                    if (!isInArray(value, action_chart[key]) && !isInArray(value, getNames(action_chart[key]))) {
                        ok = false;
                        return false;
                    }
                    break;
                case 'boolean':
                    // if array: test empty
                    if ($.isArray(action_chart[key])) {
                        // if value is true, what will make the condition false
                        if (value ? action_chart[key].length === 0 : action_chart[key].length > 0) {
                            ok = false;
                            return false;
                        }
                        // else: test falsy
                    } else {
                        if (value ? !action_chart[key] : action_chart[key]) {
                            ok = false;
                            return false;
                        }
                    }
                    break;
                case 'number':
                    // interpreted as minimum
                    if (action_chart[key] < value) {
                        ok = false;
                        return false;
                    }
                    break;
                default:
                    print('Error: requirement not defined for type {0}.'.f(typeof value), 'blue');
                    break;
                };
            }
        });
        return ok;
    },

    //------------------------------------------------------------------------------------------------------------
    setAutocompletionWords = function(sect) {
        var autocomplete_words = [];
        if (autocompletion_enabled) {
            $.each(sect.choices, function(i, choice) {
                $.each(choice.words || [], function(j, word) {
                    $.each((synonyms[word] || []).concat(word), function(k, syn) {
                        if ($.isArray(syn)) {
                            $.each(syn, function(l, synw) {
                                autocomplete_words.push(synw);
                            });
                        } else {
                            autocomplete_words.push(syn);
                        }
                    });
                });
            });
        }
        term.set_autocomplete_words(autocomplete_words);
    },

    //------------------------------------------------------------------------------------------------------------
    doSpecialCombat = function(enemy, round) {
        var sect = data.sections[curr_section];
        switch (curr_section) {

        case '7':
            var evasion_choice, combat_ratio,
            doCombatRound = function() {
                var r = pickRandomNumber(),
                s, pts, alive, win_choice;
                $.each(combat_results_ranges, function(i, range) {
                    if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
                });
                pts = combat_results_table[r][s];
                if (pts[0] === 'k') { pts[0] = enemy.endurance; }
                if (pts[1] === 'k') { pts[1] = action_chart.endurance.current; }
                if (enemy.hasOwnProperty('is_undead')) { pts[0] *= 2; }
                enemy.endurance -= Math.min(pts[0], enemy.endurance);
                action_chart.endurance.current -= Math.min(pts[1], action_chart.endurance.current);
                print('{0} loses {1} ENDURANCE points ({2} remaining)\nYou lose {3} ENDURANCE points ({4} remaining)'.f(enemy.name, pts[0], enemy.endurance, pts[1], action_chart.endurance.current), 'red');
                alive = isStillAlive();
                if (enemy.endurance <= 0 && alive) {
                    print('{0} has died.'.f(enemy.name), 'red');
                    win_choice = sect.choices[sect.combat.win.choice];
                    print('({0})'.f(win_choice.text));
                    setPressKeyMode(function() {
                        doSection(win_choice);
                    });
                    return false;
                }
                return alive;
            };

            // special aspect
            if (round === 0) {
                combat_ratio = (calculateCombatSkill(enemy).val + 2) - enemy.combat_skill;
                print('Your Combat Ratio is {0}'.f(combat_ratio), 'red');
            } else {
                combat_ratio = calculateCombatSkill(enemy).val - enemy.combat_skill;
                if (round === 1) {
                    print('Your Combat Ratio is {0}'.f(combat_ratio), 'red');
                }
            }

            if (sect.combat.hasOwnProperty('evasion') && round >= sect.combat.evasion.n_rounds) {
                setConfirmMode({
                    prompt: '[[;#000;#ff0][evade y/n]]',
                    yes: function() {
                        var r = pickRandomNumber();
                        s, pts;
                        $.each(combat_results_ranges, function(i, range) {
                            if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
                        });
                        pts = combat_results_table[r][s];
                        action_chart.endurance.current -= Math.min(pts[0], action_chart.endurance.current);
                        enemy.endurance -= pts[1];
                        print('While evading, you lose {0} ENDURANCE points ({1} remaining)'.f(pts[0], action_chart.endurance.current), 'red');
                        evasion_choice = sect.choices[sect.combat.evasion.choice];
                        print('({0})'.f(evasion_choice.text));
                        setPressKeyMode(function() {
                            doSection(evasion_choice);
                        });
                    },
                    no: function() {
                        if (doCombatRound()) {
                            doSpecialCombat(enemy, round + 1);
                        }
                    }
                });
            } else {
                setPressKeyMode(function() {
                    if (doCombatRound()) {
                        doSpecialCombat(enemy, round + 1);
                    }
                });
            }
            break;

        case '60':
            var evasion_choice,
            combat_ratio = (calculateCombatSkill(enemy).val + 2) - enemy.combat_skill;
            doCombatRound = function() {
                var r = pickRandomNumber(),
                s, pts, alive, win_choice;
                $.each(combat_results_ranges, function(i, range) {
                    if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
                });
                pts = combat_results_table[r][s];
                if (pts[0] === 'k') { pts[0] = enemy.endurance; }
                if (pts[1] === 'k') { pts[1] = action_chart.endurance.current; }
                if (round < 2) { pts[1] = 0; } // special aspect
                if (enemy.hasOwnProperty('is_undead')) { pts[0] *= 2; }
                enemy.endurance -= Math.min(pts[0], enemy.endurance);
                action_chart.endurance.current -= Math.min(pts[1], action_chart.endurance.current);
                print('{0} loses {1} ENDURANCE points ({2} remaining)\nYou lose {3} ENDURANCE points ({4} remaining)'.f(enemy.name, pts[0], enemy.endurance, pts[1], action_chart.endurance.current), 'red');
                alive = isStillAlive();
                if (enemy.endurance <= 0 && alive) {
                    print('{0} has died.'.f(enemy.name), 'red');
                    win_choice = sect.choices[sect.combat.win.choice];
                    print('({0})'.f(win_choice.text));
                    setPressKeyMode(function() {
                        doSection(win_choice);
                    });
                    return false;
                }
                return alive;
            };

            if (round === 0) {
                print('Your Combat Ratio is {0}'.f(combat_ratio), 'red');
            }

            if (sect.combat.hasOwnProperty('evasion') && round >= sect.combat.evasion.n_rounds) {
                setConfirmMode({
                    prompt: '[[;#000;#ff0][evade y/n]]',
                    yes: function() {
                        var r = pickRandomNumber();
                        s, pts;
                        $.each(combat_results_ranges, function(i, range) {
                            if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
                        });
                        pts = combat_results_table[r][s];
                        action_chart.endurance.current -= Math.min(pts[0], action_chart.endurance.current);
                        enemy.endurance -= pts[1];
                        print('While evading, you lose {0} ENDURANCE points ({1} remaining)'.f(pts[0], action_chart.endurance.current), 'red');
                        evasion_choice = sect.choices[sect.combat.evasion.choice];
                        print('({0})'.f(evasion_choice.text));
                        setPressKeyMode(function() {
                            doSection(evasion_choice);
                        });
                    },
                    no: function() {
                        if (doCombatRound()) {
                            doSpecialCombat(enemy, round + 1);
                        }
                    }
                });
            } else {
                setPressKeyMode(function() {
                    if (doCombatRound()) {
                        doSpecialCombat(enemy, round + 1);
                    }
                });
            }
            break;

        default:
            print('Error: special combat section {0} is not implemented.'.f(curr_section), 'blue');
        };
    },

    //------------------------------------------------------------------------------------------------------------
    doCombat = function(enemy, round) {
        var sect = data.sections[curr_section],
        evasion_choice,
        combat_ratio = calculateCombatSkill(enemy).val - enemy.combat_skill;
        doCombatRound = function() {
            var r = pickRandomNumber(),
            s, pts, alive, win_choice;
            $.each(combat_results_ranges, function(i, range) {
                if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
            });
            pts = combat_results_table[r][s];
            if (pts[0] === 'k') { pts[0] = enemy.endurance; }
            if (pts[1] === 'k') { pts[1] = action_chart.endurance.current; }
            if (enemy.hasOwnProperty('is_undead')) { pts[0] *= 2; }
            enemy.endurance -= Math.min(pts[0], enemy.endurance);
            action_chart.endurance.current -= Math.min(pts[1], action_chart.endurance.current);
            print('{0} loses {1} ENDURANCE points ({2} remaining)\nYou lose {3} ENDURANCE points ({4} remaining)'.f(enemy.name, pts[0], enemy.endurance, pts[1], action_chart.endurance.current), 'red');
            alive = isStillAlive();
            if (enemy.endurance <= 0 && alive) {
                print('{0} has died.'.f(enemy.name), 'red');
                win_choice = sect.choices[sect.combat.win.choice];
                print('({0})'.f(win_choice.text));
                setPressKeyMode(function() {
                    doSection(win_choice);
                });
                return false;
            }
            return alive;
        };

        if (round === 0) {
            print('Your Combat Ratio is {0}'.f(combat_ratio), 'red');
        }

        if (sect.combat.hasOwnProperty('evasion') && round >= sect.combat.evasion.n_rounds) {
            setConfirmMode({
                prompt: '[[;#000;#ff0][evade y/n]]',
                yes: function() {
                    var r = pickRandomNumber();
                    s, pts;
                    $.each(combat_results_ranges, function(i, range) {
                        if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
                    });
                    pts = combat_results_table[r][s];
                    action_chart.endurance.current -= Math.min(pts[0], action_chart.endurance.current);
                    enemy.endurance -= pts[1];
                    print('While evading, you lose {0} ENDURANCE points ({1} remaining)'.f(pts[0], action_chart.endurance.current), 'red');
                    evasion_choice = sect.choices[sect.combat.evasion.choice];
                    print('({0})'.f(evasion_choice.text));
                    setPressKeyMode(function() {
                        doSection(evasion_choice);
                    });
                },
                no: function() {
                    if (doCombatRound()) {
                        doCombat(enemy, round + 1);
                    }
                }
            });
        } else {
            setPressKeyMode(function() {
                if (doCombatRound()) {
                    doCombat(enemy, round + 1);
                }
            });
        }
    },

    //------------------------------------------------------------------------------------------------------------
    doSpecialSection = function() {
        var sect = data.sections[curr_section];
        switch (curr_section) {

        case '21':
            setPressKeyMode(function() {
                var r = pickRandomNumber(),
                g = r ? r * 3 : 30;
                action_chart.gold += g;
                print('You have picked {0}: {1} Gold Crowns.'.f(r, g), 'blue');
                print('You then pay 1 Gold Crown for the room.', 'blue');
                setConfirmMode({
                    prompt: '[[;#000;#ff0][continue y/n]]',
                    yes: function() {
                        doSection(sect.choices[0]);
                    },
                    no: function() {
                        term.set_prompt(cmd_prompt);
                    }
                });
            });
            break;

        case '57':
            setPressKeyMode(function() {
                var r = pickRandomNumber(),
                g = r ? r : 10;
                action_chart.gold -= g;
                print('You have picked {0}: you lose {1} Gold Crowns.'.f(r, g), 'blue');
                doSection();
            });
            break;

        case '69':
            if (!isInArray('Mindshield', action_chart.kai_disciplines)) {
                updateEndurance(-2);
                print('You lost ENDURANCE.', 'blue');
            }
            doSection();
            break;

        case '308':
            if (action_chart.gold < 3) {
                print("You don't have enough Gold Crowns to play.", 'blue');
                doSection();
            } else {
                setConfirmMode({
                    prompt: '[[;#000;#ff0][play y/n]]',
                    yes: function() {
                        var rolls = [],
                        i, r1, r2, msg;
                        for (i = 0; i < 6; i += 2) {
                            r1 = pickRandomNumber();
                            r2 = pickRandomNumber();
                            rolls.push([r1, r2, (r1 + r2 === 0) ? Number.POSITIVE_INFINITY : (r1 + r2)]);
                        }
                        msg = 'You roll {0}-{1}, the first player {2}-{3} and the second player {4}-{5}\n'.f(rolls[0][0], rolls[0][1], rolls[1][0],
                                                                                                                 rolls[1][1], rolls[2][0], rolls[2][1]);
                        // note that draw is not implemented (it's not really specified in the text anyway)
                        if (rolls[0][2] > rolls[1][2] && rolls[0][2] > rolls[2][2]) {
                            msg += 'You win 3 Gold Crowns!';
                            action_chart.gold += 3;
                        } else {
                            msg += 'You lose 3 Gold Crowns.';
                            action_chart.gold -= Math.min(action_chart.gold, 3);
                        }
                        print(msg, 'blue');
                        doSpecialSection();
                    },
                    no: function() {
                        doSection();
                    }
                });
            }
            break;

        case '240':
            if (isInArray('Healing', action_chart.kai_disciplines)) {
                updateEndurance(Number.POSITIVE_INFINITY);
            } else {
                updateEndurance(Math.round((calculateEndurance().val - action_chart.endurance.current) / 2));
            }
            print('Healing..', 'blue');
            doSection();
            break;

        case '12':
            setPressKeyMode(function() {
                var r = pickRandomNumber();
                if (isInArray('Healing', action_chart.kai_disciplines)) {
                    r += 2;
                }
                $.each(sect.choices, function(i, choice) {
                    if (r >= choice.range[0] && r <= choice.range[1]) {
                        print('You have picked {0}'.f(r), 'blue');
                        print('({0})'.f(choice.text));
                        setConfirmMode({
                            prompt: '[[;#000;#ff0][continue y/n]]',
                            yes: function() {
                                doSection(choice);
                            },
                            no: function() {
                                // remove all choices other than the picked one
                                data.sections[curr_section].choices = [choice];
                                term.set_prompt(cmd_prompt);
                            }
                        });
                    }
                });
            });
            break;

        default:
            print('Error: special section {0} is not implemented.'.f(curr_section), 'blue');
        };
    },

    //------------------------------------------------------------------------------------------------------------
    doSpecialChoice = function(choice) {
        switch (choice.section) {

        case '137': // section 93
            var m = command.match(/\d+/);
            if (m) {
                print('Give {0} Gold Crowns to the beggars?'.f(m[0]), 'blue');
                setConfirmMode({
                    yes: function() {
                        action_chart.gold -= Math.min(parseInt(m[0]), action_chart.gold);
                        print('You have {0} Gold Crowns remaining.'.f(action_chart.gold));
                        term.set_prompt(cmd_prompt);
                    }
                });
                return;
            } else {
                print('This command does not apply to the current context.', 'blue');
            }
            break;

        case '142':
            action_chart.special_items.push({name: 'White Pass', ac_section: 'special_items', undroppable: true});
            action_chart.gold -= 10;
            print('Your Action Chart was updated.', 'blue');
            break;

        default:
            print('Error: special choice for section {0} is not implemented.'.f(curr_section), 'blue');
        };
    },

    //------------------------------------------------------------------------------------------------------------
    doSection = function(choice) {

        if (!data.sections.hasOwnProperty(curr_section)) {
            print('Error: section {0} is not implemented.'.f(curr_section), 'blue');
            return;
        }

        if (choice !== undefined) {
            prev_section = curr_section;
            curr_section = choice.section;
            // some choices have a stat modifier
            if (choice.hasOwnProperty('endurance')) {
                updateEndurance(choice.endurance);
                if (choice.endurance < 0) {
                    print('You lose ENDURANCE.', 'blue');
                } else {
                    print('You gain ENDURANCE.', 'blue');
                }
            }
            visited_sections.push(curr_section);
            if (choice.hasOwnProperty('is_special')) {
                doSpecialChoice(choice);
            }
        }

        var sect = data.sections[curr_section];

        setAutocompletionWords(sect);

        // done only ONCE for each visited section
        if (!sect.hasOwnProperty('visited')) {
            sect.visited = true;
            printSectionNumber(curr_section);
            print(sect.text);
            if (isInArray('Healing', action_chart.kai_disciplines) && !sect.hasOwnProperty('enemies')) {
                if (action_chart.endurance.current < calculateEndurance().val) {
                    updateEndurance(1);
                    print('Healing..', 'blue');
                }
            }

            if (sect.hasOwnProperty('endurance')) {
                if (!updateEndurance(sect.endurance)) {
                    return;
                }
                if (sect.endurance < 0) {
                    print('You lose ENDURANCE.', 'blue');
                } else {
                    print('You gain ENDURANCE.', 'blue');
                }
            }

            if (prev_section && data.sections[prev_section].hasOwnProperty('must_eat') && data.sections[prev_section].must_eat) {
                print('You are hungry and thus lost some ENDURANCE.', 'blue');
                if (!updateEndurance(-3)) {
                    return;
                }
            }

            if (sect.hasOwnProperty('is_special')) {
                //sect.is_special = false; // to avoid redoing it next time
                doSpecialSection();
                return;
            }
        }

        if (sect.hasOwnProperty('combat')) {
            $.each(sect.combat.enemies, function(i, enemy) {
                if (sect.combat.hasOwnProperty('is_special')) {
                    doSpecialCombat(enemy, 0);
                } else {
                    doCombat(enemy, 0);
                }
            });
            return;
        }

        if (sect.hasOwnProperty('items')) {
            var wait_for_add_item = false;
            $.each(sect.items, function(i, item) {
                // if auto mode, the item is added automatically
                if (item.hasOwnProperty('auto')) {
                    if (!addItem(item, item.hasOwnProperty('is_mandatory') ? 'force' : 'optional')) {
                        wait_for_add_item = true;
                        return false;
                    }
                    print('The {0} was added to your Action Chart.'.f(item.name), 'blue');
                }
                // else: must be dealt with a text command (see (*))
            });
            if (wait_for_add_item) {
                if (!confirm_mode.is_active && !option_mode.is_active) {
                    // if backpack needed but anything else asked (i.e. continue)
                    doSection();
                }
                return;
            }
        }

        if (sect.hasOwnProperty('options')) {
            var items = sect.options.items;
            if (choice !== undefined) {
                option_mode.accumulator = [];
            }
            if (option_mode.is_active) { return; }
            setOptionMode({
                range: [48, 48 + items.length - 1],
                prompt: '[[;#000;#ff0][choose an item ({0} left)]]'.f(sect.options.n_to_pick - option_mode.accumulator.length),
                callback: function(i) {
                    if (i === 0) {
                        delete sect['options'];
                        doSection();
                    }
                    if (!isInArray(i, option_mode.accumulator)) {
                        if (addItem(items[i], 'optional')) { // offer_drop=optional
                            option_mode.accumulator.push(i);
                            print(items[i].name || items[i][0].name, 'blue');
                            if (option_mode.accumulator.length === sect.options.n_to_pick) {
                                delete sect['options'];
                                doSection();
                                return;
                            }
                        }
                    }
                    doSection();
                    return;
                }
            });
            return;
        }

        if (sect.hasOwnProperty('is_random_pick')) {
            setPressKeyMode(function() {
                var r = pickRandomNumber();
                $.each(sect.choices, function(i, choice) {
                    if (r >= choice.range[0] && r <= choice.range[1]) {
                        print('You have picked {0}'.f(r), 'blue');
                        print('({0})'.f(choice.text));
                        setConfirmMode({
                            prompt: '[[;#000;#ff0][continue y/n]]',
                            yes: function() {
                                doSection(choice);
                            },
                            no: function() {
                                // remove all choices other than the picked one
                                data.sections[curr_section].choices = [choice];
                                term.set_prompt(cmd_prompt);
                            }
                        });
                    }
                });
            });

        } else if (sect.choices.length === 1) {
            print(sect.choices[0].text);
            setConfirmMode({
                prompt: '[[;#000;#ff0][continue y/n]]',
                yes: function() {
                    doSection(sect.choices[0]);
                }
            });
        } else if (sect.choices.length === 0) {
            if (curr_section === '197') {
                print('Sorry, the game is not currently implemented past this section..', 'blue');
            } else { // death
                print(stars, 'yellow');
            }
            setPressKeyMode(function() { // restart
                initSequenceMode(data.setup.sequence, 'gamebook_setup');
                doSetupSequence();
            });
        } else {
            var auto_found = false;
            $.each(sect.choices, function(i, choice) {
                if (choice.hasOwnProperty('auto') && satisfiesChoiceRequirements(choice)) {
                    print(choice.text);
                    setConfirmMode({
                        yes: function() {
                            doSection(choice);
                        }
                    });
                    auto_found = true;
                    return false;
                }
            });
            // accept user input
            if (!auto_found) {
                term.set_prompt(cmd_prompt);
            }
        }
    },

    //------------------------------------------------------------------------------------------------------------
    initSequenceMode = function(seq, which) {
        sequence_mode.is_active = true;
        sequence_mode.seq = seq;
        sequence_mode.which = which;
        term.clear();
        var seq_part = sequence_mode.seq[0];
        if ($.isArray(seq_part)) {
            print(seq_part[0], 'yellow');
            print(seq_part[1]);
        } else {
            print(seq_part);
        }
        term.set_prompt(sequence_mode.prompt);
        sequence_mode.seq_idx = 1;
    },

    //------------------------------------------------------------------------------------------------------------
    printActionChart = function() {
        term.echo('COMBAT SKILL   : {0}'.f(calculateCombatSkill().str));
        term.echo('ENDURANCE      : {0} / {1}'.f(action_chart.endurance.current, calculateEndurance().str));
        var kds = [];
        $.each(action_chart.kai_disciplines, function(i, kd) {
            kds.push(kd === 'Weaponskill' ? 'Weaponskill (' + action_chart.weaponskill + ')' : kd);
        });
        kds[3] = '\n                 ' + kds[3];
        term.echo('Kai Disciplines: ' + kds.join(', '));
        term.echo('Weapons        : ' + getNames(action_chart.weapons).join(', '));
        term.echo('Gold Crowns    : ' + action_chart.gold);
        term.echo('Backpack Items : ' + (action_chart.has_backpack ? getNames(action_chart.backpack_items).join(', ') : '[---]'));
        term.echo('Special Items  : ' + getNames(action_chart.special_items).join(', ') + '\n\n');
    },

    //------------------------------------------------------------------------------------------------------------
    doSetupSequence = function() {
        // stats
        if (sequence_mode.seq_idx === 1) {
            sequence_mode.is_active = false;
            setPressKeyMode(function() {
                action_chart.combat_skill = pickRandomNumber() + 10;
                action_chart.endurance.initial = action_chart.endurance.current = pickRandomNumber() + 20;
                print('COMBAT SKILL: {0}, ENDURANCE: {1}'.f(action_chart.combat_skill, action_chart.endurance.current), 'blue');
                sequence_mode.is_active = true;
                term.set_prompt(sequence_mode.prompt);
            });
        // kai skill desc
        } else if (sequence_mode.seq_idx === 2) {
            print('Do you want to read about the Kai Disciplines?', 'blue');
            sequence_mode.is_active = false;
            setConfirmMode({
                yes: function() {
                    sequence_mode.is_active = true;
                    term.set_prompt(sequence_mode.prompt);
                    print(sequence_mode.seq[sequence_mode.seq_idx]);
                    sequence_mode.seq_idx += 1;
                    doSetupSequence();
                },
                no: function() {
                    sequence_mode.seq_idx += 10;
                    sequence_mode.is_active = true;
                    print(sequence_mode.seq[sequence_mode.seq_idx]);
                    sequence_mode.seq_idx += 1;
                    doSetupSequence();
                }
            });
        // choose kai skill
        } else if (sequence_mode.seq_idx === 13) {
            sequence_mode.is_active = false;
            setOptionMode({
                range: [48, 57],
                prompt: '[[;#000;#ff0][choose an item ({0} left)]]'.f(5 - action_chart.kai_disciplines.length),
                callback: function(i) {
                    var disc = data.setup.disciplines[i],
                    ws;
                    if (!isInArray(disc, action_chart.kai_disciplines)) {
                        action_chart.kai_disciplines.push(disc);
                        ws = '';
                        if (disc === 'Weaponskill') {
                            action_chart.weaponskill = data.setup.weapons[Math.floor(Math.random() * data.setup.weapons.length)];
                            ws = ' (' + action_chart.weaponskill + ')';
                        }
                        print('{0}{1}'.f(data.setup.disciplines[i], ws), 'blue');
                    }
                    if (action_chart.kai_disciplines.length === 5) {
                        sequence_mode.is_active = true;
                        term.set_prompt(sequence_mode.prompt);
                        term.echo(sequence_mode.seq[sequence_mode.seq_idx] + '\n\n');
                        sequence_mode.seq_idx += 1;
                    }
                    doSetupSequence();
                }
            });
        // gold
        } else if (sequence_mode.seq_idx === 14) {
            sequence_mode.is_active = false;
            setPressKeyMode(function() {
                action_chart.gold = pickRandomNumber() + 10;
                print('Gold Crowns: {0}'.f(action_chart.gold), 'blue');
                sequence_mode.is_active = true;
                term.set_prompt(press_key_mode.prompt);
            });
        // equipment
        } else if (sequence_mode.seq_idx === 15) {
            sequence_mode.is_active = false;
            setOptionMode({
                range: [48, 57],
                prompt: '[[;#000;#ff0][choose an item]] (' + (2 - setup_equipment_tmp.length) + ' left)',
                callback: function(i) {
                    var item = data.setup.equipment[i],
                    item_name = $.isArray(item) ? 'Two Meals' : item.name;
                    if (!isInArray(item_name, setup_equipment_tmp)) {
                        if ($.isArray(item)) { // meals
                            $.each(item, function(i, subitem) {
                                action_chart[subitem.ac_section].push(subitem);
                            });
                        } else {
                            action_chart[item.ac_section].push(item);
                        }
                        if (item.name === 'Chainmail Waistcoat') {
                            action_chart.endurance.current += 4;
                        }
                        setup_equipment_tmp.push(item_name);
                        print(item_name, 'blue');
                    }
                    if (setup_equipment_tmp.length === 2) {
                        sequence_mode.is_active = true;
                        term.set_prompt(sequence_mode.prompt);
                        print('Action Chart', 'yellow');
                        printActionChart();
                    } else {
                        doSetupSequence();
                    }
                }
            });
        } else if (sequence_mode.seq_idx === 16) {
            print(stars, 'yellow');
        }
    };

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

    // parser
    $('body').terminal(function(_command, term) {

        command = _command.trim().toLowerCase();
        if (!command) { return; }

        var choice_match_results = [], // list of [n_choice_matches, choice idx]'s, one for every choice, to be sorted
        input_tokens = command.split(/[^A-Za-z0-9'-]+/), // every nonalpha except "'" and "-"
        section_input = command.match(/^\d+$/),
        valid_section_input_found = false,
        matched_choice_idx, altern_choice_idx,
        sect = $.extend(true, {}, data.sections[curr_section]), // deep clone because we might modify it
        m, item, choice;

        term.echo('\n');

        if (command === 'help' || command[0] === '?') {
            print(help_str, 'blue');
            return;
        }

        if (command === 'ac' || command[0] === '!') {
            printActionChart();
            return;
        }

        if (command === 'again') {
            printSectionNumber(curr_section);
            print(sect.text);
            return;
        }

        if (command === 'restart') {
            print('Do you really want to restart?', 'blue');
            setConfirmMode({
                yes: function() {
                    restart();
                }
            });
            return;
        }

        if (isInArray(command, ['choices', 'cheat'])) {
            $.each(sect.choices, function(i, choice) {
                if (!choice.hasOwnProperty('is_artificial')) {
                    print(choice.text);
                }
            });
            return;
        }

        if (command === 'hint') {
            var words = [];
            $.each(sect.choices, function(i, choice) {
                $.each(choice.words, function(j, word) {
                    if (!$.isArray(word)) {
                        words.push(word);
                    }
                });
            });
            print(words[Math.floor(Math.random() * words.length)], 'blue');
            return;
        }

        if (command === 'auto') {
            autocompletion_enabled = !autocompletion_enabled;
            setAutocompletionWords(sect);
            print('Word autocompletion is now {0}.'.f(autocompletion_enabled ? 'on' : 'off'), 'blue');
            return;
        }

        if (command === 'continue') {
            // if only 1 non-artificial section..
            var n = $.map(sect.choices, function(c) { return !c.hasOwnProperty('is_artificial') ? 1 : 0; })
                .reduce(function(a, b) { return a + b; });
            if (n === 1) {
                // do it!
                $.each(sect.choices, function(i, choice) {
                    if (!choice.hasOwnProperty('is_artificial')) {
                        doSection(choice);
                        return false;
                    }
                });
                return;
            }
        }

        m = command.match(/^drop (.+)/);
        if (m) {
            item = matchItem(m[1].toLowerCase());
            if (item) {
                print('Drop the {0}?'.f(item.name), 'blue');
                setConfirmMode({
                    yes: function() {
                        if (item.hasOwnProperty('undroppable')) {
                            print('You cannot drop that item for the moment.', 'blue');
                        } else {
                            action_chart[item.ac_section].remove(item);
                            updateEndurance();
                            print('The item has been removed from your Action Chart.', 'blue');
                        }
                        term.set_prompt(cmd_prompt);
                    }
                });
                return;
            }
            print('(If you wanted to drop an item, not sure which one.)', 'blue');
        }

        m = command.match(/^use (.+)/);
        if (m) {
            item = matchItem(m[1].toLowerCase(), ['backpack_items', 'special_items']);
            if (item) {
                print('Use {0}?'.f(item.name), 'blue');
                setConfirmMode({
                    yes: function() {
                        if (item.hasOwnProperty('is_consumable')) {
                            if (item.hasOwnProperty('endurance')) {
                                updateEndurance(item.endurance);
                                print('You gain {0} ENDURANCE points.'.f(item.endurance), 'blue');
                            }
                            action_chart[item.ac_section].remove(item);
                        } else {
                            if (item.name === 'Meal') {
                                print("I know I'm a little fussy, but you can only 'eat' Meals (not 'use' them), sorry..", 'blue');
                            } else {
                                print("I don't know how to use that.", 'blue');
                            }
                        }
                        term.set_prompt(cmd_prompt);
                    }
                });
                return;
            }
            print('(If you wanted to use an item, not sure which one.)', 'blue');
        }

        if (command.match(/^eat.*/)) {
            if (!sect.hasOwnProperty('must_eat')) {
                print('You are not hungry enough right now.', 'blue');
            } else {
                if (!isInArray('Meal', getNames(action_chart.backpack_items))) {
                    print('You have no Meal left.', 'blue');
                } else {
                    removeByName('Meal', action_chart.backpack_items);
                    data.sections[curr_section].must_eat = false;
                    print('You eat a Meal.', 'blue');
                }
            }
            return;
        }

        // try direct section #
        if (section_input) {
            $.each(sect.choices, function(i, choice) {
                if (choice.section === section_input[0]) {
                    if (satisfiesChoiceRequirements(choice)) {
                        doSection(choice);
                        valid_section_input_found = true;
                    }
                }
            });
            if (!valid_section_input_found) {
                print('This is not possible.', 'blue');
                term.set_prompt(cmd_prompt);
            }
            return;
        }

        // if items are present.. (*)
        if (sect.hasOwnProperty('items')) {
            $.each(sect.items, function(i, item) {
                // if auto mode is not set, add artificial (engine) choices to allow getting them
                if (!item.hasOwnProperty('auto')) {
                    sect.choices.push({
                        is_artificial: true,
                        words: [['take', item.name]].concat(item.words || []),
                        item: item
                    });
                }
                // else: auto mode: add them automatically (in doSection)
            });
        }

        ////////////////////////////////
        // text command matching algo //
        ////////////////////////////////

        // for each choice of the current section..
        $.each(sect.choices, function(i, choice) {
            // a list of word match structures, one for each choice word
            var choice_word_matches = [],
            n_choice_word_matches = 0,
            choice_syn_matches,
            v_syns;
            $.each(choice.words || [], function(j, w) {
                if (!$.isArray(w)) { w = [w]; } // if w is not compound, make it one
                w = $.map(w, function(v) { return stemmer(v.toLowerCase()); });
                // match structure: maps to each choice word an array of bools: w -> [0, .. 0]
                // if w is a single word "a": "a" -> [0] (size 1 array)
                // if w is a compound word ["a", "b"], it's first coerced into "a,b",
                // and then mapped to [0, 0] (i.e because there are two words)
                choice_syn_matches = {};
                // each synonym of w has an entry in the match structure,
                // but only 1 such match is considered
                v_syns = []; // if w is compound, each subword is v
                $.each(w, function(k, v) {
                    //console.log('v: ', v, 'syns: ', synonyms[v] || []);
                    v_syns.push((synonyms[v] || []).concat(v));
                });
                $.each(cartesianProduct(v_syns), function(k, w_syns) {
                    w_syns = $.map(w_syns, function(u) { return u; }); // flatten in case a syn is itself a compound
                    //w_syns = $.map(w_syns, function(s) { return s.toLowerCase(); });
                    choice_syn_matches[w_syns] = zeros(w_syns.length);
                });
                //console.log(choice_syn_matches);
                choice_word_matches.push(choice_syn_matches);
            });
            $.each(input_tokens, function(j, w) {
                $.each(choice_word_matches, function(k, choice_syn_matches) {
                    $.each(Object.keys(choice_syn_matches), function(l, s) {
                        // split compound word into single words..
                        $.each(s.split(','), function(m, t) {
                            if (levenshteinDist(stemmer(w), t) <= 1) {
                                // and update the match bool at the proper position in
                                // the match array (0 for single word)
                                choice_word_matches[k][s][m] = 1;
                            }
                        });
                    });
                });
            });
            $.each(choice_word_matches, function(j, choice_syn_matches) {
                // for compound words, make sure that all their matching bools are 1
                // (by reducing their matching bool arrays)
                var syn_matches = $.map(choice_syn_matches, function(match_bools, s) {
                    return match_bools.reduce(function(b1, b2) { return b1 * b2; });
                });
                // since only 1 synonym match is considered, take the max (which cannot be > 1)
                n_choice_word_matches += Array.max(syn_matches);
            });
            choice_match_results.push([n_choice_word_matches, i]);
        });

        choice_match_results.sort().reverse();

        // no match, and more than one book (i.e. not artificially added) choices
        if (choice_match_results[0][0] === 0) {
            print('This command does not apply to the current context.', 'blue');
            return;
        }

        // ambiguous match: more than 2 and > 0
        if (choice_match_results.length >= 2 &&
            choice_match_results[0][0] === choice_match_results[1][0]) {
            print('Your command is ambiguous: try to reword it.', 'blue');
            return;
        }

        // at this point we have a match
        matched_choice_idx = choice_match_results[0][1];

        choice = sect.choices[matched_choice_idx];
        if (choice.hasOwnProperty('text')) { // regular book choice
            print(sect.choices[matched_choice_idx].text);
            setConfirmMode({
                yes: function() {
                    var choice = sect.choices[matched_choice_idx];
                    if (satisfiesChoiceRequirements(choice)) {
                        doSection(choice);
                    } else {
                        print('This is not possible.', 'blue');
                        term.set_prompt(cmd_prompt);
                    }
                },
                no: function() {
                    if (sect.hasOwnProperty('alternate_choices') &&
                        sect.alternate_choices) {
                        altern_choice_idx = matched_choice_idx === 0 ? 1 : 0;
                        print(sect.choices[altern_choice_idx].text);
                        setConfirmMode({
                            yes: function() {
                                doSection(sect.choices[altern_choice_idx]);
                            }
                        });
                    } else {
                        term.set_prompt(cmd_prompt);
                    }
                }
            });
        } else { // artificial/engine choice
            if (choice.hasOwnProperty('item')) {
                if (choice.item.hasOwnProperty('gold')) {
                    print('Buy the {0}?'.f(choice.item.name));
                    setConfirmMode({
                        yes: function() {
                            if (action_chart.gold >= choice.item.gold) {
                                var item = choice.item,
                                ac_sect = choice.item.ac_section;
                                // !!!
                                if (ac_sect === 'weapons' && action_chart[ac_sect].length === 2) {
                                    print("You are already carrying two weapons (use 'drop' if you really want it).", 'blue');
                                } else {
                                    action_chart[ac_sect].push(item);
                                    action_chart.gold -= choice.item.gold;
                                    print('The {0} was added to your Action Chart.'.f(item.name), 'blue');
                                }
                            } else {
                                print("You don't have enough Gold Crowns.", 'blue');
                            }
                            term.set_prompt(cmd_prompt);
                        },
                        no: function() {
                            term.set_prompt(cmd_prompt);
                        }
                    });
                } else {
                    print('Take the {0}?'.f(choice.item.name));
                    setConfirmMode({
                        yes: function() {
                            if (addItem(choice.item)) {
                                print('The {0} was added to your Action Chart.'.f(choice.item.name), 'blue');
                            }
                            term.set_prompt(cmd_prompt);
                        },
                        no: function() {
                            term.set_prompt(cmd_prompt);
                        }
                    });
                }
            } else {
                doSpecialChoice(choice);
            }

        }

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

    }, {
        prompt: '',
        greetings: '',
        history: false,
        tabcompletion: false,

        keydown: function(event, term) {
            if (sequence_mode.is_active) {
                if (sequence_mode.seq_idx < sequence_mode.seq.length) {
                    var seq_part = sequence_mode.seq[sequence_mode.seq_idx];
                    if ($.isArray(seq_part)) {
                        print(seq_part[0], 'yellow');
                        print(seq_part[1]);
                    } else {
                        print(seq_part);
                    }
                    sequence_mode.seq_idx += 1;
                    if (sequence_mode.which === 'gamebook_setup') {
                        doSetupSequence();
                    }
                    if (sequence_mode.which === 'engine_intro') {
                        // reached end of engine intro
                        if (sequence_mode.seq_idx === sequence_mode.seq.length) {
                            print('Do you want to read the book intro?');
                            sequence_mode.is_active = false;
                            setConfirmMode({
                                yes: function() {
                                    initSequenceMode(data.intro_sequence, 'gamebook_intro');
                                },
                                no: function() {
                                    initSequenceMode(data.setup.sequence, 'gamebook_setup');
                                    doSetupSequence();
                                }
                            });
                        }
                    } else if (sequence_mode.which === 'gamebook_intro') {
                        // reached end of gamebook intro
                        if (sequence_mode.seq_idx === sequence_mode.seq.length) {
                            sequence_mode.is_active = false;
                            setPressKeyMode(function() {
                                initSequenceMode(data.setup.sequence, 'gamebook_setup');
                                doSetupSequence();
                            });
                        }
                    }
                } else {
                    sequence_mode.is_active = false;
                    term.clear();
                    term.consumeSingleKeypress(); // FF keypress/keydown bug
                    doSection();
                }
                return false;
            }

            if (press_key_mode.is_active) {
                term.set_prompt(cmd_prompt);
                press_key_mode.is_active = false;
                press_key_mode.callback();
                term.consumeSingleKeypress(); // FF keypress/keydown bug
                return false;
            }

            if (confirm_mode.is_active) {
                if (event.which === 89) {
                    confirm_mode.is_active = false;
                    confirm_mode.yes_callback();
                    term.consumeSingleKeypress(); // FF keypress/keydown bug
                }
                if (event.which === 78) {
                    confirm_mode.is_active = false;
                    confirm_mode.no_callback();
                    term.consumeSingleKeypress(); // FF keypress/keydown bug
                }
                return false;
            }

            if (option_mode.is_active) {
                // 0: 48, 9:57, a:65, z:90
                if (event.which >= option_mode.range[0] &&
                    event.which <= option_mode.range[1]) {
                    option_mode.is_active = false;
                    option_mode.callback(event.which - option_mode.range[0]);
                    term.consumeSingleKeypress(); // FF keypress/keydown bug
                }
                return false;
            }

        },

        keypress: function(event, term) {
            if (sequence_mode.is_active || confirm_mode.is_active ||
                option_mode.is_active || press_key_mode.is_active) {
                return false;
            }
        },

        onInit: function(_term) {
            term = _term;
            $.getJSON(gamebook_url, function(_data) {
                data = _data;
                cmd_prompt = '[[;#ff0;#000]' + data.prompt + '] ';
                // build synonym map: w -> [w1, w2, w3, ..]
                var stemmed_synonyms = [];
                // (1) stem them
                $.each(data.synonyms, function(i, synset) {
                    // watch for jQuery.map autoflatten behavior, see:
                    // http://stackoverflow.com/questions/703355/is-there-a-jquery-map-utility-that-doesnt-automically-flatten
                    var stemmed_synset = $.map(synset, function(v) { return $.isArray(v) ?
                                                                     [$.map(v, function(u) { return stemmer(u.toLowerCase()); })] :
                                                                     stemmer(v.toLowerCase()); });
                    stemmed_synonyms.push(stemmed_synset);
                });
                // (2) organize them in a word -> synset map
                $.each(stemmed_synonyms, function(i, synset) {
                    $.each(synset, function(j, w) {
                        synonyms[w] = $.grep(synset, function(v) { return v !== w; });
                    });
                });
                data.intro_sequence[data.intro_sequence.length-1] += '\n\n' + stars;
                if (debug) {
                    action_chart.combat_skill = 10;
                    action_chart.endurance.initial = 20;
                    action_chart.endurance.current = 18;
                    action_chart.kai_disciplines = ['Weaponskill', 'Mindblast', 'Animal Kinship', 'Camouflage', 'Sixth Sense'];
                    action_chart.weaponskill = 'Broadsword';
                    addItem({name: 'Quarterstaff',ac_section:'weapons'});
                    addItem({name: 'Short Sword', ac_section: 'weapons'});
                    //action_chart.backpack_items.push(data.setup.equipment[5]); // healing potion
                    for (var i = 0; i < 8; i++) { // fill with Meals
                        //addItem({name: 'Meal', ac_section: 'backpack_items'});
                    }
                    action_chart.backpack_items.push({name: 'Meal', ac_section: 'backpack_items'})
                    action_chart.special_items.push(data.setup.equipment[3]); // chainmail
                    action_chart.gold = 10;
                    doSection({section:location.search.match(/sect=(\d+)/) ? location.search.match(/sect=(\d+)/)[1] : '1'});
                } else {
                    initSequenceMode(engine_intro, 'engine_intro');
                }
            });
        }
    });

});
