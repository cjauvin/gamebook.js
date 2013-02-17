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

    // uses jsonp to avoid XSS issues
    //gamebook_url = '//projectaon.org/staff/christian/gamebook.js/fotw.php?callback=?',
    gamebook_url = 'fotw_generated.json',
    debug = true,
    data,
    synonyms = {},
    prev_section,
    curr_section = '1',
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
    choice_mode = {is_active: false,
                   prompt: '[[;#000;#ff0][choose an item]]',
                   range: [0, 9],
                   callback: $.noop},
    term,
    cmd_prompt,
    help_str =
        "Apart from the textual play commands, you can also use:\n\n" +
        "'help' or '?': show this message\n" +
        "'ac' or '!'  : show the Action Chart\n" +
        "'drop'/'use' : one of your inventory items\n" +
        "'continue'   : if the current section has only one option, go to the next\n" +
        "'123'        : go to section 123 (if possible from current section)\n" +
        "'hint'       : show a random word from the options of the current section\n" +
        "'options'    : reveal the set of options for the current section\n" +
        "'auto'       : toggle word autocompletion on/off\n" +
        "'again'      : print the current section\n" +
        "'restart'    : restart the game (including setup)\n" +
        "'clear'      : clear the screen\n",

    engine_intro = [logo + "\n\nWelcome to https://github.com/cjauvin/gamebook.js[gamebook.js], an http://en.wikipedia.org/wiki/Interactive_fiction[IF]-style gamebook engine created by\nhttp://christianjauv.in[Christian Jauvin].",
                    "Instead of navigating an explicit menu of options, as in the classical\ngamebooks, you are a given a console in which you are free to type\nany command, after each section, using clues from the text. The engine\nthen tries to match your input with one of the predefined options,\nyielding a gameplay more akin to http://en.wikipedia.org/wiki/Interactive_fiction[interactive fiction].",
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
        meals: 0,
        backpack_items: [],
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

    print = function(str, color_name) {
        if (color_name === undefined) {
            term.echo(str);
        } else {
            term.echo('[[;{0};#000]{1}]'.f(colors[color_name], str));
        }
        term.echo('\n');
    },

    printSectionNumber = function(si) {
        print('{0}({1})'.f(new Array(38).join(' '), si), 'yellow');
    },

    getNames = function(items) {
        return $.map(items, function (i) { return i.name; });
    },

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

    zeros = function(n) {
        var a = [];
        while (--n >= 0) {
            a[n] = 0;
        }
        return a;
    },

    // 0--9 inc
    pickRandomNumber = function() {
        return Math.floor(Math.random() * 10);
    },

    setConfirmMode = function(conf) {
        confirm_mode.is_active = true;
        term.set_prompt(conf.hasOwnProperty('prompt') ? conf.prompt : confirm_mode.prompt);
        var noop = function() {
            term.set_prompt(cmd_prompt);
        };
        confirm_mode.yes_callback = conf.hasOwnProperty('yes') ? conf.yes : noop;
        confirm_mode.no_callback = conf.hasOwnProperty('no') ? conf.no : noop;
    },

    setPressKeyMode = function(callback) {
        press_key_mode.is_active = true;
        term.set_prompt(press_key_mode.prompt);
        press_key_mode.callback = callback;
    },

    setChoiceMode = function(conf) {
        choice_mode.is_active = true;
        term.set_prompt(conf.hasOwnProperty('prompt') ? conf.prompt : choice_mode.prompt);
        choice_mode.range = conf.range;
        choice_mode.callback = conf.callback;
    },

    calculateCombatSkill = function(enemy) {
        var ac = action_chart,
        str = '{0}'.f(ac.combat_skill),
        val = ac.combat_skill,
        enemy = enemy ? enemy : {};
        if (isInArray('Weaponskill', ac.kai_disciplines) && isInArray(ac.weaponskill, ac.weapons)) {
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

    updateEndurance = function(val) {
        if (val === undefined) {
            // make sure current is not > full (can happen for instance if chainmail is dropped)
            action_chart.endurance.current = Math.min(calculateEndurance().val, action_chart.endurance.current);
        } else{
            action_chart.endurance.current += Math.min(val, calculateEndurance().val - action_chart.endurance.current);
        }
    },

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

    satisfiesOptionRequirements = function(opt) {
        var ok = true;
        if (opt.hasOwnProperty('requirements')) {
            $.each(opt.requirements, function(i, req) {
                if (typeof req.value === 'string') {
                    if (!isInArray(req.value, action_chart[req.type])) {
                        ok = false;
                        return false;
                    }
                } else if (typeof req.value === 'boolean') {
                    if (action_chart[req.type].length === 0) {
                        ok = false;
                        return false;
                    }
                }
            });
        }
        return ok;
    },

    setAutocompletionWords = function(sect) {
        var autocomplete_words = [];
        if (autocompletion_enabled) {
            term.set_prompt(cmd_prompt);
            $.each(sect.options, function(i, opt) {
                $.each(opt.words || [], function(j, word) {
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

    doCombatSpecial = function(enemy, round) {

        var sect = data.sections[curr_section];

        switch (curr_section) {

        case '7':
            var evasion_opt, combat_ratio,
            doCombatRound = function() {
                var r = pickRandomNumber();
                s, pts, alive, win_opt;
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
                    win_opt = sect.options[sect.combat.win.option];
                    print('({0})'.f(win_opt.text));
                    setPressKeyMode(function() {
                        doSection(win_opt.section);
                    });
                    return false;
                }
                return alive;
            };

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
                        evasion_opt = sect.options[sect.combat.evasion.option];
                        print('({0})'.f(evasion_opt.text));
                        setPressKeyMode(function() {
                            doSection(evasion_opt.section);
                        });
                    },
                    no: function() {
                        if (doCombatRound()) {
                            doCombatSpecial(enemy, round + 1);
                        }
                    }
                });
            } else {
                setPressKeyMode(function() {
                    if (doCombatRound()) {
                        doCombatSpecial(enemy, round + 1);
                    }
                });
            }
            break;
        };

    },

    doCombat = function(enemy, round) {
        var sect = data.sections[curr_section],
        evasion_opt,
        combat_ratio = calculateCombatSkill(enemy).val - enemy.combat_skill;
        doCombatRound = function() {
            var r = pickRandomNumber();
            s, pts, alive, win_opt;
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
                win_opt = sect.options[sect.combat.win.option];
                print('({0})'.f(win_opt.text));
                setPressKeyMode(function() {
                    doSection(win_opt.section);
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
                    evasion_opt = sect.options[sect.combat.evasion.option];
                    print('({0})'.f(evasion_opt.text));
                    setPressKeyMode(function() {
                        doSection(evasion_opt.section);
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
                        doSection(sect.options[0].section);
                    },
                    no: function() {
                        term.set_prompt(cmd_prompt);
                    }
                });
            });
            break;

        case '40':
            updateEndurance(Number.POSITIVE_INFINITY);
            print('Your ENDURANCE was restored.', 'blue');
            doSection();
            break;

        case '31':
            updateEndurance(6);
            print('You gained ENDURANCE..', 'blue');
            doSection();
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
                            msg += 'You lose 3 Gold Crowns..';
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

        case '29':
        case '321':
        case '154':
            updateEndurance(-2);
            print('Lost ENDURANCE..', 'blue');
            doSection();
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
                $.each(sect.options, function(i, opt) {
                    if (r >= opt.range[0] && r <= opt.range[1]) {
                        print('You have picked {0}'.f(r), 'blue');
                        print('({0})'.f(opt.text));
                        setConfirmMode({
                            prompt: '[[;#000;#ff0][continue y/n]]',
                            yes: function() {
                                doSection(opt.section);
                            },
                            no: function() {
                                // remove all options other than the picked one
                                data.sections[curr_section].options = [opt];
                                term.set_prompt(cmd_prompt);
                            }
                        });
                    }
                });
            });
            break;

        default:
            print('Error: special section {0} is not implemented.'.f(curr_section), 'blue');
        }
    },

    doSection = function(next_section) {
        if (!data.sections.hasOwnProperty(curr_section)) {
            print('Error: section {0} is not implemented.'.f(curr_section), 'blue');
            return;
        }
        if (next_section !== undefined) {
            prev_section = curr_section;
            curr_section = next_section;
        }
        var sect = data.sections[curr_section];
        if (data.sections[prev_section].hasOwnProperty('must_eat') && data.sections[prev_section].must_eat) {
            print('You are hungry and thus lose ENDURANCE..', 'blue');
            updateEndurance(-3);
        }
        if (!isStillAlive()) { return; }
        setAutocompletionWords(sect);
        if (!sect.hasOwnProperty('visited')) {
            printSectionNumber(curr_section);
            print(sect.text);
            sect.visited = true;
            if (isInArray('Healing', action_chart.kai_disciplines) && !sect.hasOwnProperty('enemies')) {
                if (action_chart.endurance.current < calculateEndurance().val) {
                    updateEndurance(1);
                    print('Healing..', 'blue');
                }
            }
        }
        if (sect.hasOwnProperty('is_special') && sect.is_special) {
            sect.is_special = false; // to avoid redoing it next time
            doSpecialSection();
            return;
        }
        if (sect.hasOwnProperty('combat')) {
            $.each(sect.combat.enemies, function(i, enemy) {
                if (sect.combat.hasOwnProperty('is_special')) {
                    doCombatSpecial(enemy, 0);
                } else {
                    doCombat(enemy, 0);
                }
            });
            return;
        }
        if (sect.hasOwnProperty('items')) {
            $.each(sect.items, function(i, item) {
                // if auto mode, the item is added automatically
                if (item.hasOwnProperty('auto')) {
                    action_chart[item.ac_section].push(item);
                    print('The {0} was added to your Action Chart.'.f(item.name), 'blue');
                }
                // else: it must dealt with a command (see (*))
            });
        }
        if (sect.hasOwnProperty('is_random_pick')) {
            setPressKeyMode(function() {
                var r = pickRandomNumber();
                $.each(sect.options, function(i, opt) {
                    if (r >= opt.range[0] && r <= opt.range[1]) {
                        print('You have picked {0}'.f(r), 'blue');
                        print('({0})'.f(opt.text));
                        setConfirmMode({
                            prompt: '[[;#000;#ff0][continue y/n]]',
                            yes: function() {
                                doSection(opt.section);
                            },
                            no: function() {
                                // remove all options other than the picked one
                                data.sections[curr_section].options = [opt];
                                term.set_prompt(cmd_prompt);
                            }
                        });
                    }
                });
            });
        } else if (sect.options.length === 1) {
            print(sect.options[0].text);
            setConfirmMode({
                prompt: '[[;#000;#ff0][continue y/n]]',
                yes: function() {
                    doSection(sect.options[0].section);
                }
            });
        } else if (sect.options.length === 0) {
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
            $.each(sect.options, function(i, opt) {
                if (opt.hasOwnProperty('auto') && satisfiesOptionRequirements(opt)) {
                    print(opt.text);
                    setConfirmMode({
                        yes: function() {
                            doSection(opt.section);
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
        term.echo('Meals          : ' + action_chart.meals);
        term.echo('Backpack Items : ' + getNames(action_chart.backpack_items).join(', '));
        term.echo('Special Items  : ' + getNames(action_chart.special_items).join(', ') + '\n\n');
    },

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
            setChoiceMode({
                range: [48, 57],
                prompt: '[[;#000;#ff0][choose an item]] (' + (5 - action_chart.kai_disciplines.length) + ' left)',
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
            setChoiceMode({
                range: [48, 57],
                prompt: '[[;#000;#ff0][choose an item]] (' + (2 - setup_equipment_tmp.length) + ' left)',
                callback: function(i) {
                    var item = data.setup.equipment[i];
                    if (!isInArray(item.name, setup_equipment_tmp)) {
                        if (item.hasOwnProperty('value')) {
                            action_chart[item.ac_section] += item.value;
                        } else {
                            action_chart[item.ac_section].push(item);
                        }
                        if (item.name === 'Chainmail Waistcoat') {
                            action_chart.endurance.current += 4;
                        }
                        setup_equipment_tmp.push(item.name);
                        print(item.name, 'blue');
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
    },

    matchInventoryItem = function(input_str, ac_sections) {
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
    };

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

    // parser
    $('body').terminal(function(command, term) {

        command = command.trim().toLowerCase();
        if (!command) { return; }

        var opt_match_results = [], // list of [n_opt_matches, opt idx]'s, one for every option, to be sorted
        input_tokens = command.split(/[^A-Za-z0-9']+/), // every nonalpha except "'"
        section_input = command.match(/\d+/),
        valid_section_input_found = false,
        matched_opt_idx, altern_opt_idx,
        sect = $.extend(true, {}, data.sections[curr_section]), // deep clone because we might modify it
        m, item, opt;

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

        if (command === 'options') {
            $.each(sect.options, function(i, opt) {
                print(opt.text);
            });
            return;
        }

        if (command === 'hint') {
            var words = [];
            $.each(sect.options, function(i, opt) {
                $.each(opt.words, function(j, word) {
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
            if (sect.options.length === 1) {
                doSection(sect.options[0].section);
                return;
            }
        }

        m = command.match(/^drop (.+)/);
        if (m) {
            item = matchInventoryItem(m[1].toLowerCase());
            if (item) {
                print('Drop the {0} from your inventory?'.f(item.name), 'blue');
                setConfirmMode({
                    yes: function() {
                        action_chart[item.ac_section].remove(item);
                        updateEndurance();
                        term.set_prompt(cmd_prompt);
                    }
                });
                return;
            }
            print('(If you wanted to drop an inventory item, not sure which one.)', 'blue');
        }

        m = command.match(/^use (.+)/);
        if (m) {
            item = matchInventoryItem(m[1].toLowerCase(), ['backpack_items', 'special_items']);
            if (item) {
                print('Use {0}?'.f(item.name), 'blue');
                setConfirmMode({
                    yes: function() {
                        if (item.hasOwnProperty('effect') && item.effect.type === 'consumable') {
                            if (item.effect.hasOwnProperty('endurance')) {
                                updateEndurance(item.effect.endurance);
                                print('You gained {0} ENDURANCE points.'.f(item.effect.endurance), 'blue');
                            }
                            action_chart[item.ac_section].remove(item);
                        } else {
                            print("I don't know how to use that.", 'blue');
                        }
                        term.set_prompt(cmd_prompt);
                    }
                });
                return;
            }
            print('(If you wanted to use an inventory item, not sure which one.)', 'blue');
        }

        if (command.match(/^eat.*/)) {
            if (!sect.hasOwnProperty('must_eat')) {
                print('You are not hungry enough to eat.', 'blue');
            } else {
                if (action_chart.meals === 0) {
                    print('You have no Meal left.', 'blue');
                } else {
                    action_chart.meals -= 1;
                    data.sections[curr_section].must_eat = false;
                    print('You eat a Meal ({0} left).'.f(action_chart.meals), 'blue');
                }
            }
            return;
        }

        // try direct section #
        if (section_input) {
            $.each(sect.options, function(i, opt) {
                if (opt.section === section_input[0]) {
                    if (satisfiesOptionRequirements(opt)) {
                        doSection(opt.section);
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
                // if auto mode is not set, add artificial (engine) options to allow getting them
                if (!item.hasOwnProperty('auto')) {
                    sect.options.push({
                        words: [['take', item.name]].concat(item.words || []),
                        item: item
                    });
                }
                // else: auto mode: add them automatically (in doSection)
            });
        }

        ///////////////////////////
        // command matching algo //
        ///////////////////////////

        // for each option of the current section..
        $.each(sect.options, function(i, opt) {
            // a list of word match structures, one for each option word
            var opt_word_matches = [],
            n_opt_word_matches = 0,
            opt_syn_matches,
            v_syns;
            $.each(opt.words || [], function(j, w) {
                if (!$.isArray(w)) { w = [w]; } // if w is not compound, make it one
                w = $.map(w, function(v) { return stemmer(v.toLowerCase()); });
                // match structure: maps to each option word an array of bools: w -> [0, .. 0]
                // if w is a single word "a": "a" -> [0] (size 1 array)
                // if w is a compound word ["a", "b"], it's first coerced into "a,b",
                // and then mapped to [0, 0] (i.e because there are two words)
                opt_syn_matches = {};
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
                    opt_syn_matches[w_syns] = zeros(w_syns.length);
                });
                //console.log(opt_syn_matches);
                opt_word_matches.push(opt_syn_matches);
            });
            $.each(input_tokens, function(j, w) {
                $.each(opt_word_matches, function(k, opt_syn_matches) {
                    $.each(Object.keys(opt_syn_matches), function(l, s) {
                        // split compound word into single words..
                        $.each(s.split(','), function(m, t) {
                            if (levenshteinDist(stemmer(w), t) <= 1) {
                                // and update the match bool at the proper position in
                                // the match array (0 for single word)
                                opt_word_matches[k][s][m] = 1;
                            }
                        });
                    });
                });
            });
            $.each(opt_word_matches, function(j, opt_syn_matches) {
                // for compound words, make sure that all their matching bools are 1
                // (by reducing their matching bool arrays)
                var syn_matches = $.map(opt_syn_matches, function(match_bools, s) {
                    return match_bools.reduce(function(b1, b2) { return b1 * b2; });
                });
                // since only 1 synonym match is considered, take the max (which cannot be > 1)
                n_opt_word_matches += Array.max(syn_matches);
            });
            opt_match_results.push([n_opt_word_matches, i]);
        });

        opt_match_results.sort().reverse();

        // no match, and more than one book (i.e. not artificially added) options
        if (opt_match_results[0][0] === 0) {
            print('This command does not apply to the current context.', 'blue');
            return;
        }

        // ambiguous match: more than 2 and > 0
        if (opt_match_results.length >= 2 &&
            opt_match_results[0][0] === opt_match_results[1][0]) {
            print('Your command is ambiguous: try to reword it.', 'blue');
            return;
        }

        // at this point we have a match
        matched_opt_idx = opt_match_results[0][1];

        opt = sect.options[matched_opt_idx];
        if (opt.hasOwnProperty('text')) { // regular book option
            print(sect.options[matched_opt_idx].text);
            setConfirmMode({
                yes: function() {
                    var opt = sect.options[matched_opt_idx];
                    if (satisfiesOptionRequirements(opt)) {
                        doSection(opt.section);
                    } else {
                        print('This is not possible.', 'blue');
                        term.set_prompt(cmd_prompt);
                    }
                },
                no: function() {
                    if (sect.hasOwnProperty('alternate_options') &&
                        sect.alternate_options) {
                        altern_opt_idx = matched_opt_idx === 0 ? 1 : 0;
                        print(sect.options[altern_opt_idx].text);
                        setConfirmMode({
                            yes: function() {
                                doSection(sect.options[altern_opt_idx].section);
                            }
                        });
                    } else {
                        term.set_prompt(cmd_prompt);
                    }
                }
            });
        } else { // artificial/engine option
            if (opt.hasOwnProperty('item')) {
                if (opt.item.hasOwnProperty('gold')) {
                    print('Buy the {0}?'.f(opt.item.name));
                    setConfirmMode({
                        yes: function() {
                            if (action_chart.gold >= opt.item.gold) {
                                var item = opt.item,
                                ac_sect = opt.item.ac_section;
                                // !!!
                                if (ac_sect === 'weapons' && action_chart[ac_sect].length === 2) {
                                    print("You are already carrying two weapons (use 'drop' if you really want it).", 'blue');
                                } else {
                                    action_chart[ac_sect].push(item);
                                    action_chart.gold -= opt.item.gold;
                                    print('The {0} was added to the Action Chart.'.f(item.name), 'blue');
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
                    print('Take the {0}?'.f(opt.item.name));
                    setConfirmMode({
                        yes: function() {
                            var item = opt.item,
                            ac_sect = opt.item.ac_section;
                            if (ac_sect === 'weapons' && action_chart[ac_sect].length === 2) {
                                print("You are already carrying two weapons (use 'drop' if you really want it).", 'blue');
                            } else {
                                action_chart[ac_sect].push(item);
                                print('The {0} was added to the Action Chart.'.f(item.name), 'blue');
                            }
                            term.set_prompt(cmd_prompt);
                        },
                        no: function() {
                            term.set_prompt(cmd_prompt);
                        }
                    });
                }
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

            if (choice_mode.is_active) {
                // 0: 48, 9:57, a:65, z:90
                if (event.which >= choice_mode.range[0] &&
                    event.which <= choice_mode.range[1]) {
                    choice_mode.is_active = false;
                    choice_mode.callback(event.which - choice_mode.range[0]);
                    term.consumeSingleKeypress(); // FF keypress/keydown bug
                }
                return false;
            }

        },

        keypress: function(event, term) {
            if (sequence_mode.is_active || confirm_mode.is_active ||
                choice_mode.is_active || press_key_mode.is_active) {
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
                    action_chart.combat_skill = 16;
                    action_chart.endurance.initial = 20;
                    action_chart.endurance.current = 18;
                    action_chart.kai_disciplines = ['Weaponskill', 'Mindblast', 'Animal Kinship', 'Camouflage'];
                    action_chart.weaponskill = 'Sword';
                    action_chart.weapons = [{name: 'Sword',ac_section:'weapons'}, {name: 'Short Sword', ac_section: 'weapons'}];
                    action_chart.backpack_items.push(data.setup.equipment[5]); // healing potion
                    action_chart.special_items.push(data.setup.equipment[3]); // chainmail
                    action_chart.gold = 11;
                    action_chart.meals = 2;
                    doSection(location.search.match(/sect=(\d+)/) ? location.search.match(/sect=(\d+)/)[1] : '1');

                } else {
                    initSequenceMode(engine_intro, 'engine_intro');
                }
            });
        }
    });

});
