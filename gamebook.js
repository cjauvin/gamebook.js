var gamebook = function() {

    // general error handler which redirects to the terminal, for easier/friendlier reporting
    window.onerror = function(msg, url, line_no) {
        // assumes that engine is defined and that it has a working terminal
        if (engine && engine.term) {
            engine.term.echo('\n[[;#0f60ff;#000]There was an exception at line {0}:] [[;#f00;#000]{1}]'.f(line_no, msg));
            engine.term.echo('\n[[;#0f60ff;#000]Really sorry about that.. (a quick note about it at ' +
                             'cjauvin@gmail.com would be\nvery helpful and appreciated, if you feel like it).]');
            engine.term.echo('\n');
            //return false; // prevent any further catching mechanism
        }
        return false;
    };

    var logo =
        "                            _                 _       _            \n" +
        "  __ _  __ _ _ __ ___   ___| |__   ___   ___ | | __  (_)___        \n" +
        " / _` |/ _` | '_ ` _ \\ / _ \\ '_ \\ / _ \\ / _ \\| |/ /  | / __|  \n" +
        "| (_| | (_| | | | | | |  __/ |_) | (_) | (_) |   < _ | \\__ \\     \n" +
        " \\__, |\\__,_|_| |_| |_|\\___|_.__/ \\___/ \\___/|_|\\_(_)/ |___/ \n" +
        " |___/                                             |__/            ";

    var help_str =
        "Apart from the textual play commands, you can also use:\n\n" +
        "help or ? : show this message\n" +
        "ac or !   : show the Action Chart\n" +
        "drop/use  : one of your (weapon, backpack or special) items\n" +
        "continue  : if the current section has only one choice, go to the next\n" +
        "123       : go to section 123 (if possible from current section)\n" +
        "hint      : show a random word from the choices of the current section\n" +
        "cheat     : (or choices) reveal the set of choices for the current section\n" +
        "auto      : toggle word autocompletion on/off\n" +
        "again     : reprint the current section\n" +
        "save/load : save and restore the game state at any point\n" +
        "restart   : restart the game (including setup)\n" +
        "clear     : clear the screen\n";

    var action_chart = {
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
    };

    //------------------------------------------------------------------------------------------------------------

    var engine = {

        // uses jsonp to avoid XSS issues
        //gamebook_url: '//projectaon.org/staff/christian/gamebook.js/fotw.php?callback=?',
        gamebook_url: 'fotw_generated.json',
        debug: true,
        data: {},
        synonyms: {},
        raw_synonyms: {}, // unstemmed (nicer for autocompletion)
        autocompletion_enabled: true,
        term: null,
        command: '',
        command_split_regexp: /[^A-Za-z0-9'-]+/, // every nonalpha except "'" and "-"
        cmd_prompt: '',

        //------------------------------------------------------------------------------------------------------------
        // STATE variables

        action_chart: $.extend(true, {}, action_chart),
        prev_section: null,
        curr_section: '1',
        visited_sections: ['1'],

        //------------------------------------------------------------------------------------------------------------
        // book-specific routines

        special_sections: {},
        special_choices: {},
        special_combats: {},

        //------------------------------------------------------------------------------------------------------------
        // command-line interaction modes

        // sequence parts
        sequence_mode: {
            is_active: false,
            prompt: '[[;#000;#ff0][press any key]]',
            which: 'engine_intro',
            seq: [],
            seq_idx: 1
        },
        // wait for a keypress
        press_key_mode: {
            is_active: false,
            prompt: '[[;#000;#ff0][press any key]]',
            callback: $.noop
        },
        // yes/no question interface
        confirm_mode: {
            is_active: false,
            prompt: '[[;#000;#ff0][accept y/n]]',
            yes_callback: $.noop,
            no_callback: $.noop
        },
        // ranged options (e.g. 0--9 or a--z input) interface
        option_mode: {
            is_active: false,
            prompt: '[[;#000;#ff0][choose an item]]',
            range: [48, 57], // i.e. 0--9, by default
            callback: $.noop,
            accumulator: []
        },
        // number input interface (any # of digits followed by ENTER)
        number_input_mode: {
            is_active: false,
            prompt: '[[;#000;#ff0][enter a number]]',
            default_prompt: '[[;#000;#ff0][enter a number]]',
            callback: $.noop,
            accumulator: ''
        },

        //------------------------------------------------------------------------------------------------------------

        combat_results_table: [
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

        combat_results_ranges: [
            [Number.NEGATIVE_INFINITY, -11], [-10,-9], [-8,-7], [-6,-5], [-4,-3], [-2,-1], [0,0], [1,2], [3,4], [5,6],
            [7,8], [9,10], [11, Number.POSITIVE_INFINITY]
        ],

        colors: {
            'red': '#f00', 'blue': '#0f60ff', 'yellow': '#ff0'
        },

        help_str: help_str,
        engine_intro: [logo + "\n\nWelcome to https://github.com/cjauvin/gamebook.js[gamebook.js], an http://en.wikipedia.org/wiki/Interactive_fiction[IF]-style gamebook engine created by\nhttp://christianjauv.in[Christian Jauvin].",
                        "Instead of navigating an explicit menu of choices, as in the classical\ngamebooks, you are a given a console in which you are free to type\nany command, after each section, using clues from the text. The engine\nthen tries to match your input with one of the predefined choices,\nyielding a gameplay more akin to http://en.wikipedia.org/wiki/Interactive_fiction[interactive fiction].",
                        "You're about to play an experimental and incomplete version of\nhttp://en.wikipedia.org/wiki/Fire_on_the_water[Fire on the Water], the second gamebook in the http://en.wikipedia.org/wiki/Lone_Wolf_(gamebooks)[Lone Wolf] series,\nwritten by http://en.wikipedia.org/wiki/Joe_Dever[Joe Dever] in 1984. This http://www.projectaon.org/en/Main/FireOnTheWater[electronic version] of the book\nwas created and is being distributed by http://www.projectaon.org/en/Main/Home[Project Aon]. Please note\nthat only the first 53 sections (in http://www.projectaon.org/en/svg/lw/02fotw.svgz[\"story\"], rather than numeric\norder) of the book are currently implemented (but the rest should\nfollow soon).",
                        ["How to Play", help_str]],

        //   *
        // *   *
        stars: new Array(33).join(' ') + '*\n' + new Array(31).join(' ') + '*   *',

        //------------------------------------------------------------------------------------------------------------
        echo: function(str, color_name) {
            if (color_name === undefined) {
                this.term.echo(str);
            } else {
                this.term.echo('[[;{0};#000]{1}]'.f(this.colors[color_name], str));
            }
            this.term.echo('\n');
        },

        //------------------------------------------------------------------------------------------------------------
        initSequenceMode: function(seq, which) {
            this.sequence_mode.is_active = true;
            this.sequence_mode.seq = seq;
            this.sequence_mode.which = which;
            this.term.clear();
            var seq_part = this.sequence_mode.seq[0];
            if ($.isArray(seq_part)) {
                this.echo(seq_part[0], 'yellow');
                this.echo(seq_part[1]);
            } else {
                this.echo(seq_part);
            }
            this.term.set_prompt(this.sequence_mode.prompt);
            this.sequence_mode.seq_idx = 1;
        },

        //------------------------------------------------------------------------------------------------------------
        doSetupSequence: function() {
            // stats
            if (this.sequence_mode.seq_idx === 1) {
                this.sequence_mode.is_active = false;
                this.setPressKeyMode(function() {
                    this.action_chart.combat_skill = this.pickRandomNumber() + 10;
                    this.action_chart.endurance.initial = this.action_chart.endurance.current = this.pickRandomNumber() + 20;
                    this.echo('COMBAT SKILL: {0}, ENDURANCE: {1}'.f(this.action_chart.combat_skill,
                                                                     this.action_chart.endurance.current), 'blue');
                    this.sequence_mode.is_active = true;
                    this.term.set_prompt(this.sequence_mode.prompt);
                });
                // kai skill desc
            } else if (this.sequence_mode.seq_idx === 2) {
                this.echo('Do you want to read about the Kai Disciplines?', 'blue');
                this.sequence_mode.is_active = false;
                this.setConfirmMode({
                    yes: function() {
                        this.sequence_mode.is_active = true;
                        this.term.set_prompt(this.sequence_mode.prompt);
                        this.echo(this.sequence_mode.seq[this.sequence_mode.seq_idx]);
                        this.sequence_mode.seq_idx += 1;
                        this.doSetupSequence();
                    },
                    no: function() {
                        this.sequence_mode.seq_idx += 10;
                        this.sequence_mode.is_active = true;
                        this.echo(this.sequence_mode.seq[this.sequence_mode.seq_idx]);
                        this.sequence_mode.seq_idx += 1;
                        this.doSetupSequence();
                    }
                });
                // choose kai skill
            } else if (this.sequence_mode.seq_idx === 13) {
                this.sequence_mode.is_active = false;
                this.setOptionMode({
                    prompt: '[[;#000;#ff0][choose an item ({0} left)]]'.f(5 - this.action_chart.kai_disciplines.length),
                    callback: function(i) {
                        var disc = this.data.setup.disciplines[i],
                        ws;
                        if (!isInArray(disc, this.action_chart.kai_disciplines)) {
                            this.action_chart.kai_disciplines.push(disc);
                            ws = '';
                            if (disc === 'Weaponskill') {
                                this.action_chart.weaponskill = this.data.setup.weapons[Math.floor(Math.random() *
                                                                                                   this.data.setup.weapons.length)];
                                ws = ' (' + this.action_chart.weaponskill + ')';
                            }
                            this.echo('{0}{1}'.f(this.data.setup.disciplines[i], ws), 'blue');
                        }
                        if (this.action_chart.kai_disciplines.length === 5) {
                            this.sequence_mode.is_active = true;
                            this.term.set_prompt(this.sequence_mode.prompt);
                            this.term.echo(this.sequence_mode.seq[this.sequence_mode.seq_idx] + '\n\n');
                            this.sequence_mode.seq_idx += 1;
                        }
                        this.doSetupSequence();
                    }
                });
                // gold
            } else if (this.sequence_mode.seq_idx === 14) {
                this.sequence_mode.is_active = false;
                this.setPressKeyMode(function() {
                    this.action_chart.gold = this.pickRandomNumber() + 10;
                    this.echo('Gold Crowns: {0}'.f(this.action_chart.gold), 'blue');
                    this.sequence_mode.is_active = true;
                    this.term.set_prompt(this.press_key_mode.prompt);
                });
                // equipment
            } else if (this.sequence_mode.seq_idx === 15) {
                this.sequence_mode.is_active = false;
                if (!this.data.setup.hasOwnProperty('equipment_tmp')) {
                    this.data.setup.equipment_tmp = [];
                }
                this.setOptionMode({
                    prompt: '[[;#000;#ff0][choose an item]] (' + (2 - this.data.setup.equipment_tmp.length) + ' left)',
                    callback: function(i) {
                        var item = this.data.setup.equipment[i],
                        item_name = $.isArray(item) ? 'Two Meals' : item.name;
                        if (!isInArray(item_name, this.data.setup.equipment_tmp)) {
                            if ($.isArray(item)) { // meals
                                each(this, item, function(i, subitem) {
                                    this.action_chart[subitem.ac_section].push(subitem);
                                });
                            } else {
                                this.action_chart[item.ac_section].push(item);
                            }
                            if (item.name === 'Chainmail Waistcoat') {
                                this.action_chart.endurance.current += 4;
                            }
                            this.data.setup.equipment_tmp.push(item_name);
                            this.echo(item_name, 'blue');
                        }
                        if (this.data.setup.equipment_tmp.length === 2) {
                            this.sequence_mode.is_active = true;
                            this.term.set_prompt(this.sequence_mode.prompt);
                            this.echo('Action Chart', 'yellow');
                            this.printActionChart();
                        } else {
                            this.doSetupSequence();
                        }
                    }
                });
            } else if (this.sequence_mode.seq_idx === 16) {
                this.echo(this.stars, 'yellow');
            }
        },

        //------------------------------------------------------------------------------------------------------------
        printActionChart: function() {
            this.term.echo('COMBAT SKILL   : {0}'.f(this.calculateCombatSkill().str));
            this.term.echo('ENDURANCE      : {0} / {1}'.f(this.action_chart.endurance.current,
                                                          this.calculateEndurance().str));
            var kds = [];
            each(this, this.action_chart.kai_disciplines, function(i, kd) {
                kds.push(kd === 'Weaponskill' ? 'Weaponskill (' + this.action_chart.weaponskill + ')' : kd);
            });
            kds[3] = '\n                 ' + kds[3];
            this.term.echo('Kai Disciplines: ' + kds.join(', '));
            this.term.echo('Weapons        : ' + getNames(this.action_chart.weapons).join(', '));
            this.term.echo('Gold Crowns    : ' + this.action_chart.gold);
            this.term.echo('Backpack Items : ' + (this.action_chart.has_backpack ? getNames(this.action_chart.backpack_items).join(', ') : '[No Backpack]'));
            this.term.echo('Special Items  : ' + getNames(this.action_chart.special_items).join(', ') + '\n\n');
        },

        //------------------------------------------------------------------------------------------------------------
        matchItem: function(input_str, ac_sections) {
            var closest = {lev: Number.POSITIVE_INFINITY, item: null};
            each(this, ac_sections || ['weapons', 'backpack_items', 'special_items'], function(i, ac_section) {
                each(this, this.action_chart[ac_section], function(j, item) {
                    var item_name_words = item.name.split(this.command_split_regexp).concat(item.name);
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
        setPressKeyMode: function(callback) {
            this.press_key_mode.is_active = true;
            this.term.set_prompt(this.press_key_mode.prompt);
            this.press_key_mode.callback = $.proxy(callback, this);
        },

        //------------------------------------------------------------------------------------------------------------
        setConfirmMode: function(conf) {
            this.confirm_mode.is_active = true;
            this.term.set_prompt(conf.hasOwnProperty('prompt') ? conf.prompt : this.confirm_mode.prompt);
            var noop = $.proxy(function() {
                this.term.set_prompt(this.cmd_prompt);
            }, this);
            this.confirm_mode.yes_callback = conf.hasOwnProperty('yes') ? $.proxy(conf.yes, this) : noop;
            this.confirm_mode.no_callback = conf.hasOwnProperty('no') ? $.proxy(conf.no, this) : noop;
        },

        //------------------------------------------------------------------------------------------------------------
        setOptionMode: function(conf) {
            this.option_mode.is_active = true;
            this.term.set_prompt(conf.hasOwnProperty('prompt') ? conf.prompt : this.option_mode.prompt);
            this.option_mode.range = conf.hasOwnProperty('range') ? conf.range : this.option_mode.range;
            this.option_mode.callback = $.proxy(conf.callback, this);
        },

        //------------------------------------------------------------------------------------------------------------
        setNumberInputMode: function(conf) {
            this.number_input_mode.is_active = true;
            this.number_input_mode.prompt = conf.hasOwnProperty('prompt') ? conf.prompt : this.number_input_mode.default_prompt;
            this.term.set_prompt(this.number_input_mode.prompt);
            this.number_input_mode.callback = $.proxy(conf.callback, this);
            this.number_input_mode.accumulator = '';
        },

        //------------------------------------------------------------------------------------------------------------
        setCmdPrompt: function() {
            // don't do it if any keypress mode is active
            if (!(this.confirm_mode.is_active || this.option_mode.is_active ||
                 this.press_key_mode.is_active || this.number_input_mode.is_active)) {
                this.term.set_prompt(this.cmd_prompt);
            }
        },

        //------------------------------------------------------------------------------------------------------------
        calculateCombatSkill: function(enemy) {
            var ac = this.action_chart,
            str = '{0}'.f(ac.combat_skill),
            val = ac.combat_skill,
            enemy = enemy ? enemy : {},
            sect = this.data.sections[this.curr_section];

            // Sommerswerd
            if (isInArray('Sommerswerd', getNames(ac.special_items))) {
                str += ' + 8(SW)';
                val += 8;
            }
            // Weaponskill
            if (isInArray('Weaponskill', ac.kai_disciplines)) {
                var special_item_ws = false;
                each(this, this.action_chart.special_items, function(i, si) {
                    if (isInArray(ac.weaponskill, si.weaponskills)) {
                        special_item_ws = true;
                        return false;
                    }
                });
                if (isInArray(ac.weaponskill, ac.weapons) || special_item_ws) {
                    str += ' + 2(WS)';
                    val += 2;
                }
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
            var has_special_weapon = false;
            each(this, ac.special_items, function(i, w) {
                if (w.hasOwnProperty('is_weaponlike')) {
                    has_special_weapon = true;
                    return false;
                }
            });
            if (ac.weapons.length === 0 && !has_special_weapon) {
                str += ' - 4(NoWp)';
                val -= 4;
            }
            // special case: if in combat, check for a possible temporary modifier
            if (sect.hasOwnProperty('combat')) {
                val += sect.combat.combat_skill || 0;
            }
            if (str !== '{0}'.f(ac.combat_skill)) {
                str = '{0} [[;#00f;#000]{1}]'.f(val, str);
            }
            return {
                str: str,
                val: val
            };
        },

        //------------------------------------------------------------------------------------------------------------
        calculateEndurance: function () {
            var ac = this.action_chart,
            str = '{0}'.f(ac.endurance.initial),
            val = ac.endurance.initial;
            if (isInArray('Chainmail Waistcoat', getNames(ac.special_items))) {
                str += ' + 4(CW)';
                val += 4;
            }
            if (str !== '{0}'.f(ac.endurance.initial)) {
                str = '{0} [[;#00f;#000]{1}]'.f(val, str);
            }
            return {
                str: str,
                val: val
            };
        },

        //------------------------------------------------------------------------------------------------------------
        updateEndurance: function(val) {
            if (val === undefined) {
                // make sure current is not > full (can happen for instance if chainmail is dropped)
                this.action_chart.endurance.current = Math.min(this.calculateEndurance().val,
                                                               this.action_chart.endurance.current);
            } else{
                this.action_chart.endurance.current += Math.min(val,
                                                                this.calculateEndurance().val - this.action_chart.endurance.current);
            }
            return this.isStillAlive();
        },

        //------------------------------------------------------------------------------------------------------------
        restart: function() {
            // needed to restore certain modifs made to the game data structure
            $.getJSON(this.gamebook_url, $.proxy(function(_data) {
                this.data = _data;
                this.action_chart = action_chart;
                this.initSequenceMode(this.data.setup.sequence, 'gamebook_setup');
                this.doSetupSequence();
            }, this));
        },

        //------------------------------------------------------------------------------------------------------------
        isStillAlive: function() {
            if (this.action_chart.endurance.current <= 0) {
                this.confirm_mode.is_active = false;
                this.echo('You have died..', 'red');
                this.echo(this.stars, 'yellow');
                this.setPressKeyMode(function() {
                    this.restart();
                });
                return false;
            }
            return true;
        },

        //------------------------------------------------------------------------------------------------------------
        // 0--9 inc
        pickRandomNumber: function() {
            return Math.floor(Math.random() * 10);
        },

        //------------------------------------------------------------------------------------------------------------
        addItem: function(item, offer_replacement) {

            var sect = this.data.sections[this.curr_section];

            if ((sect.n_picked_items + (item.hasOwnProperty('item_worth') ? item['item_worth'] : 1)) > sect.n_items_to_pick) {
                this.echo('You already picked {0} items.'.f(sect.n_picked_items), 'blue');
                return;
            }

            // backpack special cases
            if (item.name === 'Backpack' && this.action_chart.has_backpack) {
                this.echo('You already have a Backpack.', 'blue');
                return;
            }

            if (item.ac_section === 'backpack_items' && !this.action_chart.has_backpack) {
                this.echo('You need a Backpack for this!', 'blue');
                if (item.hasOwnProperty('is_consumable')) {
                    this.echo('Consume it now?', 'blue');
                    this.setConfirmMode({
                        yes: function() {
                            this.updateEndurance(item.endurance);
                            this.echo('You gain {0} ENDURANCE points.'.f(item.endurance), 'blue');
                            this.term.set_prompt(this.cmd_prompt);
                            removeByName(item.name, sect.items || []);
                        }
                    });
                    return;
                }
                return;
            }

            // AC weapons and backpack items size limitation special cases
            var ac_sect_full = false;
            each(this, [['weapons', 2, 'weapon'], ['backpack_items', 8, 'backpack item']], function(i, elems) {
                var ac_sect = elems[0];
                var lim = elems[1];
                if (item.ac_section === ac_sect && this.action_chart[ac_sect].length === lim) {
                    var comm = (item.hasOwnProperty('gold') || item.hasOwnProperty('gold_max')) ? 'buy' : 'take';
                    this.echo('Cannot {0} {1}: you already carry {2} {3}s.'.f(comm, item.name, lim, elems[2]), 'blue');
                    if (offer_replacement) {
                        var opts = [{name:'None'}].concat(this.action_chart[ac_sect]);
                        each(this, opts, function(i, opt) {
                            this.echo('({0}) {1}'.f(i, opt.name), 'blue');
                        });
                        this.setOptionMode({
                            range: [48, 48 + opts.length - 1],
                            prompt: '[[;#000;#ff0][choose a {0} to replace]]'.f(elems[2]),
                            callback: function(i) {
                                if (i === 0) { // none picked
                                    // trick: remove item that triggered addItem, to avoid coming back
                                    this.doSection();
                                    return;
                                }
                                i -= 1;
                                this.echo('You have replaced your {0} by a {1}.'.f(this.action_chart[ac_sect][i].name, item.name), 'blue');
                                // remove replaced item from ac
                                removeByName(this.action_chart[ac_sect][i].name, this.action_chart[ac_sect] || []);
                                // add new item
                                this.action_chart[ac_sect].push(item);
                                // remove new item from section
                                removeByName(item.name, sect.items || []);
                                sect.n_picked_items += item.hasOwnProperty('item_worth') ? item['item_worth'] : 1;
                                this.doSection();
                            }
                        });
                    }
                    ac_sect_full = true;
                    return false; // get out of $.each
                }
            });
            if (ac_sect_full) { return; }

            // from here: normal case, i.e. add item

            // need to buy?
            if (item.hasOwnProperty('gold')) {
                if (this.action_chart.gold >= item.gold) {
                    this.action_chart.gold -= item.gold;
                } else {
                    this.echo("You don't have enough Gold Crowns.", 'blue');
                    return;
                }
            }
            if (item.hasOwnProperty('gold_max')) {
                this.action_chart.gold -= Math.min(item.gold_max, this.action_chart.gold);
            }

            removeByName(item.name, sect.items || []);
            sect.n_picked_items += item.hasOwnProperty('item_worth') ? item['item_worth'] : 1;

            if (item.name === 'Backpack') {
                this.action_chart.has_backpack = true;
                this.action_chart.backpack_items = [];
                this.echo('You now carry a Backpack.', 'blue');
            } else if (item.ac_section === 'gold') {
                this.action_chart.gold += item.value;
                this.echo('The Gold has been added to your Action Chart.', 'blue');
            } else {
                this.action_chart[item.ac_section].push(item);
                this.echo('The {0} has been added to your Action Chart.'.f(item.name), 'blue');
            }
        },

        //------------------------------------------------------------------------------------------------------------
        satisfiesChoiceRequirements: function(choice) {
            var that = this;
            // array of 0/1's, to be reduced
            var getReqBools = function(req_obj) {
                return $.map(req_obj, function(v, k) {
                    switch (typeof v) {
                    case 'string':
                        // regexp matching
                        return Number(matchInArray(v, that.action_chart[k]) ||
                                      matchInArray(v, getNames(that.action_chart[k])));
                    case 'number':
                        // interpreted as minimum
                        return Number(that.action_chart[k] >= v);
                    default:
                        that.echo('Error: requirement not defined for type {0}.'.f(typeof value), 'blue');
                        return 0;
                    };
                });
            };
            var bools = $.map(choice, function(v, k) {
                switch (k) {
                case 'requires':
                    // coerce bools to ints for reduce (even though adding/multiplying bools works,
                    // let's follow the Zen of Python here)
                    return Number(getReqBools(v).reduce(function(b1, b2) { return b1 * b2; }) > 0);
                case 'requires_or':
                    return Number(getReqBools(v).reduce(function(b1, b2) { return b1 + b2; }) > 0);
                case 'requires_not':
                    return Number(getReqBools(v).reduce(function(b1, b2) { return b1 + b2; }) === 0);
                default:
                    // non-requirement-related choice key
                    return 1;
                }
            });
            // outer req clauses (requires, requires_or, requires_not) are AND-ed
            return bools.reduce(function(b1, b2) { return b1 * b2; });
        },

        //------------------------------------------------------------------------------------------------------------
        hasNonAutoItems: function(sect) {
            var found = false;
            $.each(sect.items || [], function(i, item) {
                if (!item.hasOwnProperty('auto')) {
                    found = true;
                    return false;
                }
            });
            return found;
        },

        //------------------------------------------------------------------------------------------------------------
        setAutocompletionWords: function(sect) {
            var autocomplete_words = [];
            if (this.autocompletion_enabled) {
                each(this, sect.choices, function(i, choice) {
                    each(this, choice.words || [], function(j, word) {
                        if (isInArray(word, choice.prevent_autocompletion || [])) {
                            return false;
                        }
                        // show raw synonyms here (instead of stemmed ones)
                        each(this, (this.raw_synonyms[word] || []).concat(word), function(k, syn) {
                            if ($.isArray(syn)) {
                                each(this, syn, function(l, synw) {
                                    autocomplete_words.push(synw);
                                });
                            } else {
                                autocomplete_words.push(syn);
                            }
                        });
                    });
                });
            }
            this.term.set_autocomplete_words(autocomplete_words);
        },

        //------------------------------------------------------------------------------------------------------------
        printSectionNumber: function(si) {
            this.echo('{0}({1})'.f(new Array(38).join(' '), si), 'yellow');
        },

        //------------------------------------------------------------------------------------------------------------
        doSection: function(choice) {

            if (!this.data.sections.hasOwnProperty(this.curr_section)) {
                this.echo('Error: section {0} is not implemented.'.f(this.curr_section), 'blue');
                return;
            }

            if (this.confirm_mode.is_active || this.option_mode.is_active ||
                this.press_key_mode.is_active || this.number_input_mode.is_active) {
                return;
            }

            if (choice !== undefined) {

                if (choice.hasOwnProperty('is_special')) {
                    // careful here: the key is a pair: [prev_section, choice.section], which
                    // gets flattened to a comma-sep string as the dict key
                    if (this.special_choices.hasOwnProperty([this.curr_section, choice.section])) {
                        if (!this.special_choices[[this.curr_section, choice.section]](this, choice)) {
                            this.echo('This is not possible', 'blue');
                            return;
                        }
                    } else {
                        this.echo('Error: special choice {0} for section {1} is not implemented.'.f(choice.section, this.prev_section), 'blue');
                    }
                }

                this.prev_section = this.curr_section;
                this.curr_section = choice.section;
                // some choices have modifiers
                if (choice.hasOwnProperty('endurance')) {
                    this.updateEndurance(choice.endurance);
                    if (choice.endurance < 0) {
                        this.echo('You lose ENDURANCE.', 'blue');
                    } else {
                        this.echo('You gain ENDURANCE.', 'blue');
                    }
                }
                if (choice.hasOwnProperty('gold')) {
                    this.action_chart.gold += choice.gold;
                    this.echo('You now have {0} Gold Crowns.'.f(this.action_chart.gold), 'blue');
                }
                if (!isInArray(this.curr_section, this.visited_sections)) {
                    this.visited_sections.push(this.curr_section);
                }

            }

            var sect = this.data.sections[this.curr_section];

            this.setAutocompletionWords(sect);

            // done only ONCE for each visited section
            if (!sect.hasOwnProperty('visited')) {

                sect.visited = true;
                sect.n_items_to_pick = sect.hasOwnProperty('n_items_to_pick') ? sect.n_items_to_pick : Number.POSITIVE_INFINITY;
                sect.n_picked_items = 0;
                this.printSectionNumber(this.curr_section);
                this.echo(sect.text);
                if (isInArray('Healing', this.action_chart.kai_disciplines) && !sect.hasOwnProperty('enemies')) {
                    if (this.action_chart.endurance.current < this.calculateEndurance().val) {
                        this.updateEndurance(1);
                        this.echo('Healing..', 'blue');
                    }
                }

                if (this.hasNonAutoItems(sect)) {
                    this.echo('There are items.', 'blue');
                }

                if (sect.hasOwnProperty('endurance')) {
                    if (!this.updateEndurance(sect.endurance)) {
                        return;
                    }
                    if (sect.endurance < 0) {
                        this.echo('You lose ENDURANCE.', 'blue');
                    } else {
                        this.echo('You gain ENDURANCE.', 'blue');
                    }
                }

                if (this.prev_section && this.data.sections[this.prev_section].hasOwnProperty('must_eat') &&
                    this.data.sections[this.prev_section].must_eat) {
                    this.echo('You are hungry and lose ENDURANCE.', 'blue');
                    // must_eat is possibly an int, to specify a endurance penalty different than the default (-3)
                    var e = typeof this.data.sections[this.prev_section].must_eat === 'number' ? this.data.sections[this.prev_section].must_eat : -3;
                    if (!this.updateEndurance(e)) {
                        return;
                    }
                }

                // option to remove choices for which satisfiesChoiceRequirements is false
                if (sect.hasOwnProperty('trim_choices')) {
                    sect.choices = $.grep(sect.choices, $.proxy(function(choice) {
                        return this.satisfiesChoiceRequirements(choice);
                    }, this));
                }

                if (sect.hasOwnProperty('is_special')) {
                    if (this.special_sections.hasOwnProperty(this.curr_section)) {
                        this.special_sections[this.curr_section](this, sect);
                    } else {
                        this.echo('Error: special section {0} is not implemented.'.f(this.curr_section), 'blue');
                    }
                    return;
                }

            }

            if (sect.hasOwnProperty('combat')) {
                if (sect.combat.enemies.length > 0) {
                    // combat first enemy and the others (if any) will be chained at the end
                    if (sect.combat.hasOwnProperty('is_special')) {
                        if (this.special_combats.hasOwnProperty(this.curr_section)) {
                            this.special_combats[this.curr_section](this, sect, sect.combat.enemies[0], 0);
                        } else {
                            this.echo('Error: special combat section {0} is not implemented.'.f(this.curr_section), 'blue');
                        }
                    } else {
                        this.doCombat(sect.combat.enemies[0], 0);
                    }
                }
                return;
            }

            // auto items only
            if (sect.hasOwnProperty('items')) {
                var found_auto_item = false;
                each(this, sect.items, function(i, item) {
                    if (item.hasOwnProperty('auto')) {
                        delete item['auto'];
                        this.addItem(item); //, 'optional');
                        found_auto_item = true;
                        return false;
                    } // else, !auto: must be dealt with a text command (see (*))
                });
                if (found_auto_item) {
                    this.doSection(); // return for more
                    return;
                }
            }

            if (sect.hasOwnProperty('is_random_pick')) {
                this.setPressKeyMode(function() {
                    var r = this.pickRandomNumber();
                    each(this, sect.choices, function(i, choice) {
                        if (r >= choice.range[0] && r <= choice.range[1]) {
                            this.echo('You have picked {0}'.f(r), 'blue');
                            this.echo('({0})'.f(choice.text));
                            this.setConfirmMode({
                                prompt: '[[;#000;#ff0][continue y/n]]',
                                yes: function() {
                                    this.doSection(choice);
                                },
                                no: function() {
                                    // remove all choices other than the picked one
                                    this.data.sections[this.curr_section].choices = [choice];
                                    this.term.set_prompt(this.cmd_prompt);
                                }
                            });
                        }
                    });
                });
            } else if (sect.choices.length === 1 && !this.hasNonAutoItems(sect)) {
                this.echo(sect.choices[0].text);
                this.setConfirmMode({
                    prompt: '[[;#000;#ff0][continue y/n]]',
                    yes: function() {
                        this.doSection(sect.choices[0]);
                    }
                });
            } else if (sect.choices.length === 0) {
                // death
                this.echo(this.stars, 'yellow');
                this.setPressKeyMode(function() { // restart
                    this.initSequenceMode(this.data.setup.sequence, 'gamebook_setup');
                    this.doSetupSequence();
                });
            } else {
                var auto_choice_found = false;
                each(this, sect.choices, function(i, choice) {
                    if (choice.hasOwnProperty('auto') &&
                        this.satisfiesChoiceRequirements(choice)) {
                        this.echo(choice.text);
                        this.setConfirmMode({
                            yes: function() {
                                this.doSection(choice);
                            }
                        });
                        auto_choice_found = true;
                        return false;
                    }
                });
                // accept user input
                if (!auto_choice_found) {
                    this.term.set_prompt(this.cmd_prompt);
                }
            }
        },

        //------------------------------------------------------------------------------------------------------------
        doCombat: function(enemy, round) {
            var sect = this.data.sections[this.curr_section],
            evasion_choice, ac = this.action_chart,
            combat_ratio = this.calculateCombatSkill(enemy).val - enemy.combat_skill,
            doCombatRound = $.proxy(function() {
                var r = this.pickRandomNumber(),
                s, pts, alive, win_choice;
                $.each(this.combat_results_ranges, function(i, range) {
                    if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
                });
                pts = this.combat_results_table[r][s];
                if (pts[0] === 'k') { pts[0] = enemy.endurance; }
                if (pts[1] === 'k') { pts[1] = ac.endurance.current; }
                if (enemy.hasOwnProperty('double_damage')) { pts[0] *= 2; }
                if (enemy.hasOwnProperty('has_mindforce') && !isInArray('Mindshield', ac.kai_disciplines)) {
                    pts[1] += 2;
                }
                enemy.endurance -= Math.min(pts[0], enemy.endurance);
                ac.endurance.current -= Math.min(pts[1], ac.endurance.current);
                this.echo('{0} loses {1} ENDURANCE points ({2} remaining)\nYou lose {3} ENDURANCE points ({4} remaining)'.f(enemy.name, pts[0], enemy.endurance, pts[1], ac.endurance.current), 'red');
                alive = this.isStillAlive();
                if (enemy.endurance <= 0 && alive) {
                    this.echo('{0} has died.'.f(enemy.name), 'red');
                    sect.combat.enemies.remove(sect.combat.enemies[0]);
                    if (sect.combat.enemies.length === 0) {
                        win_choice = sect.choices[sect.combat.win.choice];
                        // only keep the combat win choice
                        sect.choices = [win_choice];
                        if (!this.hasNonAutoItems(sect)) {
                            this.echo('({0})'.f(win_choice.text));
                            this.setConfirmMode({
                                prompt: '[[;#000;#ff0][continue y/n]]',
                                yes: function() {
                                    this.doSection(win_choice);
                                }
                            });
                        }
                    } else {
                        this.setPressKeyMode(function() {
                            this.doSection();
                        });
                    }
                    return false;
                }
                return alive;
            }, this);

            if (round === 0) {
                this.echo('Your Combat Ratio is {0}'.f(combat_ratio), 'red');
            }

            if (sect.combat.hasOwnProperty('evasion') && round >= sect.combat.evasion.n_rounds) {
                this.setConfirmMode({
                    prompt: '[[;#000;#ff0][evade y/n]]',
                    yes: function() {
                        var r = this.pickRandomNumber(),
                        s, pts;
                        $.each(this.combat_results_ranges, function(i, range) {
                            if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
                        });
                        pts = this.combat_results_table[r][s];
                        ac.endurance.current -= Math.min(pts[0], ac.endurance.current);
                        enemy.endurance -= pts[1];
                        this.echo('While evading, you lose {0} ENDURANCE points ({1} remaining)'.f(pts[0], ac.endurance.current), 'red');
                        evasion_choice = sect.choices[sect.combat.evasion.choice];
                        this.echo('({0})'.f(evasion_choice.text));
                        this.setPressKeyMode(function() {
                            this.doSection(evasion_choice);
                        });
                    },
                    no: function() {
                        if (doCombatRound()) {
                            this.doCombat(enemy, round + 1);
                        }
                    }
                });
            } else {
                this.setPressKeyMode(function() {
                    if (doCombatRound()) {
                        this.doCombat(enemy, round + 1);
                    }
                });
            }
        }


    }; // end of engine object

    //------------------------------------------------------------------------------------------------------------
    //------------------------------------------------------------------------------------------------------------

    $(document).ready(function($) {

        ////////////////////
        // command parser //
        ////////////////////

        $('body').terminal(function(_command, term) {

            var command = _command.trim().toLowerCase();
            if (!command) { return; }
            engine.command = command;

            var choice_match_results = [], // list of [n_choice_matches, choice idx]'s, one for every choice, to be sorted
            input_tokens = command.split(engine.command_split_regexp), // every nonalpha except "'" and "-"
            section_input = command.match(/^\d+$/),
            valid_section_input_found = false,
            matched_choice_idx, altern_choice_idx,
            sect = $.extend(true, {}, engine.data.sections[engine.curr_section]), // deep clone because we might add artificial choices
            m, item, choice;

            engine.term.echo('\n');

            if (command === 'help' || command[0] === '?') {
                engine.echo(engine.help_str, 'blue');
                return;
            }

            if (command === 'ac' || command[0] === '!') {
                engine.printActionChart();
                return;
            }

            if (command === 'again') {
                engine.printSectionNumber(engine.curr_section);
                engine.echo(sect.text);
                return;
            }

            if (command === 'restart') {
                engine.echo('Do you really want to restart?', 'blue');
                engine.setConfirmMode({
                    yes: function() {
                        engine.restart();
                    }
                });
                return;
            }

            if (command === 'save') {
                localStorage['action_chart'] = JSON.stringify(engine.action_chart);
                localStorage['prev_section'] = JSON.stringify(engine.prev_section);
                localStorage['curr_section'] = JSON.stringify(engine.curr_section);
                localStorage['visited_sections'] = JSON.stringify(engine.visited_sections);
                engine.echo("The game state was saved (use 'load' to restore it at any moment).", 'blue');
                return;
            }

            if (command === 'load') {
                if (localStorage['action_chart'] && localStorage['prev_section'] &&
                    localStorage['curr_section'] && localStorage['visited_sections']) {
                    $.getJSON(engine.gamebook_url, function(_data) {
                        engine.data = _data;
                        engine.action_chart = JSON.parse(localStorage['action_chart']);
                        engine.prev_section = JSON.parse(localStorage['prev_section']);
                        engine.curr_section = JSON.parse(localStorage['curr_section']);
                        engine.visited_sections = JSON.parse(localStorage['visited_sections']);
                        engine.echo("The previous game state was restored.", 'blue');
                        engine.doSection();
                    });
                } else {
                    engine.echo('There is no saved state to restore.', 'blue');
                }
                return;
            }

            if (isInArray(command, ['choices', 'cheat'])) {
                $.each(sect.choices, function(i, choice) {
                    if (!choice.hasOwnProperty('is_artificial')) {
                        engine.echo(choice.text);
                    }
                });
                return;
            }

            if (command === 'hint') {
                var words = [];
                $.each(sect.choices, function(i, choice) {
                    $.each(choice.words || [], function(j, word) {
                        if (!$.isArray(word)) {
                            words.push(word);
                        }
                    });
                });
                if (words.length > 0) {
                    engine.echo(words[Math.floor(Math.random() * words.length)], 'blue');
                } else {
                    engine.echo('Nothing to hint about here!', 'blue');
                }
                return;
            }

            if (command === 'auto') {
                engine.autocompletion_enabled = !engine.autocompletion_enabled;
                engine.setAutocompletionWords(sect);
                engine.echo('Word autocompletion is now {0}.'.f(engine.autocompletion_enabled ? 'on' : 'off'), 'blue');
                return;
            }

            if (command === 'continue') {
                // if only 1 non-artificial section, offer it right away
                var real_choices = $.grep(sect.choices, function(c) {
                    return !c.hasOwnProperty('is_artificial');
                });
                if (real_choices.length === 1) {
                    engine.doSection(real_choices[0]);
                    return;
                }
            }

            m = command.match(/^drop (.+)/);
            if (m) {
                item = engine.matchItem(m[1].toLowerCase());
                if (item) {
                    engine.echo('Drop your {0}?'.f(item.name), 'blue');
                    engine.setConfirmMode({
                        yes: function() {
                            if (item.ac_section === 'special_items') {
                                engine.echo('You cannot drop that item here.', 'blue');
                            } else {
                                engine.action_chart[item.ac_section].remove(item);
                                engine.updateEndurance();
                                engine.echo('The {0} has been removed from your Action Chart.'.f(item.name), 'blue');
                            }
                            engine.term.set_prompt(engine.cmd_prompt);
                        }
                    });
                    return;
                }
                engine.echo('(If you wanted to drop an item, not sure which one.)', 'blue');
            }

            m = command.match(/^use (.+)/);
            if (m) {
                item = engine.matchItem(m[1].toLowerCase(), ['backpack_items', 'special_items']);
                if (item) {
                    engine.echo('Use your {0}?'.f(item.name), 'blue');
                    engine.setConfirmMode({
                        yes: function() {
                            if (item.hasOwnProperty('is_consumable')) {
                                if (item.hasOwnProperty('endurance')) {
                                    engine.updateEndurance(item.endurance);
                                    engine.echo('You gain {0} ENDURANCE points.'.f(item.endurance), 'blue');
                                }
                                engine.action_chart[item.ac_section].remove(item);
                            } else {
                                if (item.name === 'Meal') {
                                    engine.echo("I know I'm a little fussy, but you can only 'eat' Meals (not 'use' them), sorry..", 'blue');
                                } else {
                                    engine.echo("I don't know how to use that.", 'blue');
                                }
                            }
                            engine.term.set_prompt(engine.cmd_prompt);
                        }
                    });
                    return;
                }
                engine.echo('(If you wanted to use an item, not sure which one.)', 'blue');
            }

            if (command.match(/^eat.*/)) {
                if (!sect.hasOwnProperty('must_eat')) {
                    engine.echo('You are not hungry enough right now.', 'blue');
                } else {
                    if (!isInArray('Meal', getNames(engine.action_chart.backpack_items))) {
                        // special rule for Laumspur Meal
                        if (!isInArray('Laumspur Meal', getNames(engine.action_chart.backpack_items))) {
                            engine.echo('You have no Meal left.', 'blue');
                        } else {
                            removeByName('Laumspur Meal', engine.action_chart.backpack_items);
                            engine.data.sections[engine.curr_section].must_eat = false;
                            engine.updateEndurance(3);
                            engine.echo('You eat a Laumspur Meal (and gain ENDURANCE).', 'blue');
                        }
                    } else {
                        removeByName('Meal', engine.action_chart.backpack_items);
                        engine.data.sections[engine.curr_section].must_eat = false;
                        engine.echo('You eat a Meal.', 'blue');
                    }
                }
                return;
            }

            // try direct section #
            if (section_input) {
                $.each(sect.choices, function(i, choice) {
                    if (choice.section === section_input[0]) {
                        if (engine.satisfiesChoiceRequirements(choice)) {
                            engine.doSection(choice);
                            valid_section_input_found = true;
                        }
                    }
                });
                if (!valid_section_input_found) {
                    engine.echo('This is not possible.', 'blue');
                    engine.term.set_prompt(engine.cmd_prompt);
                }
                return;
            }

            // if items are present.. (*)
            if (sect.hasOwnProperty('items')) {
                var single_item_names = []; // avoid repetitions when there are identical items offered
                $.each(sect.items, function(i, item) {
                    // if auto mode is not set, add artificial (engine) choices to allow getting them
                    if (!item.hasOwnProperty('auto')) {
                        if (isInArray(item.name, single_item_names)) { return true; }
                        var words = [];
                        if (item.hasOwnProperty('sellable')) {
                            words.push('sell');
                        }
                        if (item.hasOwnProperty('gold') || item.hasOwnProperty('gold_max')) {
                            words.push('buy');
                        }
                        if (words.length === 0) {
                            words.push('take');
                        }
                        if (item.hasOwnProperty('words')) {
                            words = words.concat(item.words);
                        } else {
                            words = words.concat(item.name.split(engine.command_split_regexp));
                        }
                        single_item_names.push(item.name);
                        sect.choices.push({
                            is_artificial: true,
                            words: words,
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
                        v_syns.push((engine.synonyms[v] || []).concat(v));
                    });
                    $.each(cartesianProduct(v_syns), function(k, w_syns) {
                        w_syns = $.map(w_syns, function(u) { return u; }); // flatten in case a syn is itself a compound
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
                                // match if edit dist is <= 1 and first letters match (to prevent meal/heal[ing]
                                // to match due to the stemmer) I'm not sure that this is the right way to do it,
                                // maybe imposing a strict match would actually be better
                                if (levenshteinDist(stemmer(w), t) <= 1 && w[0] == t[0]) {
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
                        // here the left part is reduced to 0 or 1, which we multiply by the size of the array,
                        // to give more weight to compound words, in case there's a tie
                        // (i.e. 'sword' vs 'short sword' items of section 181)
                        return match_bools.reduce(function(b1, b2) { return b1 * b2; }) * match_bools.length;
                    });
                    // since only 1 synonym match is considered, take the max
                    n_choice_word_matches += Array.max(syn_matches);
                    // if (Array.max(syn_matches) > 0) {
                    //     console.log(choice_syn_matches, Array.max(syn_matches));
                    // }
                });
                //choice_match_results.push([n_choice_word_matches, i]);
                choice_match_results.push([n_choice_word_matches, choice]);
            });

            // sort by # of matches
            choice_match_results.sort().reverse();

            // no match, and more than one real (i.e. not artificially added) choices
            if (choice_match_results[0][0] === 0) {
                engine.echo('Your command does not apply to the current context.', 'blue');
                return;
            }

            // ambiguous match: more than 1 and > 0
            if (choice_match_results.length >= 2 &&
                choice_match_results[0][0] === choice_match_results[1][0]) {
                if (sect.hasOwnProperty('no_ambiguity')) {
                    // simply continue.. (and we'll pick first)
                } else {
                    engine.echo('Your command is ambiguous: try to reword it.', 'blue');
                    return;
                }
            }

            // at this point we have a match
            choice = choice_match_results[0][1];

            if (!choice.hasOwnProperty('is_artificial')) { // regular book choice
                engine.echo(choice.text);
                engine.setConfirmMode({
                    yes: function() {
                        if (engine.satisfiesChoiceRequirements(choice)) {
                            engine.doSection(choice);
                        } else {
                            engine.echo('This is not possible.', 'blue');
                            engine.term.set_prompt(engine.cmd_prompt);
                        }
                    },
                    no: function() {
                        if (sect.hasOwnProperty('alternate_choices')) {
                            var real_choices = $.grep(sect.choices, function(c) {
                                return !c.hasOwnProperty('is_artificial');
                            });
                            if (real_choices.length !== 2) {
                                engine.echo('Error: section {0} has alternate_choices for {1} choices.'.f(engine.curr_section, real_choices.length), 'blue');
                            }
                            var altern_choice = choice === real_choices[0] ? real_choices[1] : real_choices[0];
                            engine.echo(altern_choice.text);
                            engine.setConfirmMode({
                                yes: function() {
                                    engine.doSection(altern_choice);
                                }
                            });
                        } else {
                            engine.term.set_prompt(engine.cmd_prompt);
                        }
                    }
                });
            } else { // artificial/engine choice
                if (choice.hasOwnProperty('item')) {
                    var item = choice.item;
                    if (command.match(/^sell/) && item.hasOwnProperty('sellable')) {
                        if (!isInArray(item.name, getNames(engine.action_chart[item.ac_section]))) {
                            engine.echo("You don't possess that item.", 'blue');
                            engine.term.set_prompt(engine.cmd_prompt);
                            return;
                        }
                        engine.echo('Sell your {0}?'.f(item.name), 'blue');
                        engine.setConfirmMode({
                            yes: function() {
                                removeByName(item.name, engine.action_chart[item.ac_section]);
                                engine.action_chart.gold += item.sellable;
                                engine.echo('You gain {0} Gold Crowns.'.f(item.sellable), 'blue');
                                engine.term.set_prompt(engine.cmd_prompt);
                            },
                            no: function() {
                                engine.term.set_prompt(engine.cmd_prompt);
                            }
                        });
                    } else {
                        engine.echo('{0} the {1}?'.f(item.hasOwnProperty('gold') || item.hasOwnProperty('gold_max') ? 'Buy' : 'Take',
                                                      item.name));
                        engine.setConfirmMode({
                            yes: function() {
                                engine.addItem(item);
                                engine.setCmdPrompt();
                                engine.doSection(); // to offer continue if there is now only one option (not sure!)
                            },
                            no: function() {
                                engine.setCmdPrompt();
                            }
                        });
                    }
                } else {
                    // this is only for section 93, I'm not sure if it's the right way to do it
                    if (engine.special_choices.hasOwnProperty([engine.curr_section, choice.section])) {
                        engine.special_choices[[engine.curr_section, choice.section]](engine, choice);
                    } else {
                        engine.echo('Error: special choice {0} for section {1} is not implemented.'.f(choice.section, engine.curr_section), 'blue');
                    }
                }

            }

    //------------------------------------------------------------------------------------------------------------
    //------------------------------------------------------------------------------------------------------------

        }, {

            prompt: '',
            greetings: '',
            history: false,
            tabcompletion: false,
            displayExceptions: true,

            keydown: function(event, term) {

                if (engine.sequence_mode.is_active) {
                    if (engine.sequence_mode.seq_idx < engine.sequence_mode.seq.length) {
                        var seq_part = engine.sequence_mode.seq[engine.sequence_mode.seq_idx];
                        if ($.isArray(seq_part)) {
                            engine.echo(seq_part[0], 'yellow');
                            engine.echo(seq_part[1]);
                        } else {
                            engine.echo(seq_part);
                        }
                        engine.sequence_mode.seq_idx += 1;
                        if (engine.sequence_mode.which === 'gamebook_setup') {
                            engine.doSetupSequence();
                        }
                        if (engine.sequence_mode.which === 'engine_intro') {
                            // reached end of engine intro
                            if (engine.sequence_mode.seq_idx === engine.sequence_mode.seq.length) {
                                engine.echo('Do you want to read the book intro?');
                                engine.sequence_mode.is_active = false;
                                engine.setConfirmMode({
                                    yes: function() {
                                        engine.initSequenceMode(engine.data.intro_sequence, 'gamebook_intro');
                                    },
                                    no: function() {
                                        engine.initSequenceMode(engine.data.setup.sequence, 'gamebook_setup');
                                        engine.doSetupSequence();
                                    }
                                });
                            }
                        } else if (engine.sequence_mode.which === 'gamebook_intro') {
                            // reached end of gamebook intro
                            if (engine.sequence_mode.seq_idx === engine.sequence_mode.seq.length) {
                                engine.sequence_mode.is_active = false;
                                engine.setPressKeyMode(function() {
                                    engine.initSequenceMode(engine.data.setup.sequence, 'gamebook_setup');
                                    engine.doSetupSequence();
                                });
                            }
                        }
                    } else {
                        engine.sequence_mode.is_active = false;
                        engine.term.clear();
                        engine.term.consumeSingleKeypress(); // FF keypress/keydown bug
                        engine.doSection();
                    }
                    return false;
                }

                if (engine.press_key_mode.is_active) {
                    engine.term.set_prompt(engine.cmd_prompt);
                    engine.press_key_mode.is_active = false;
                    engine.press_key_mode.callback();
                    engine.term.consumeSingleKeypress(); // FF keypress/keydown bug
                    return false;
                }

                if (engine.confirm_mode.is_active) {
                    if (event.which === 89) {
                        engine.confirm_mode.is_active = false;
                        engine.confirm_mode.yes_callback();
                        engine.term.consumeSingleKeypress(); // FF keypress/keydown bug
                    }
                    if (event.which === 78) {
                        engine.confirm_mode.is_active = false;
                        engine.confirm_mode.no_callback();
                        engine.term.consumeSingleKeypress(); // FF keypress/keydown bug
                    }
                    return false;
                }

                if (engine.option_mode.is_active) {
                    // 0: 48, 9:57, a:65, z:90
                    if (event.which >= engine.option_mode.range[0] &&
                        event.which <= engine.option_mode.range[1]) {
                        engine.option_mode.is_active = false;
                        engine.option_mode.callback(event.which - engine.option_mode.range[0]);
                        engine.term.consumeSingleKeypress(); // FF keypress/keydown bug
                    }
                    return false;
                }

                if (engine.number_input_mode.is_active) {
                    // 0: 48, 9:57
                    if (event.which >= 48 && event.which <= 57) {
                        engine.number_input_mode.accumulator += (event.which - 48).toString();
                        engine.term.set_prompt(engine.number_input_mode.prompt + engine.number_input_mode.accumulator);
                    } else if (event.which === 13) { // enter
                        if (engine.number_input_mode.accumulator.length >= 1) {
                            engine.number_input_mode.is_active = false;
                            engine.number_input_mode.callback(parseInt(engine.number_input_mode.accumulator, 10));
                            engine.term.consumeSingleKeypress(); // FF keypress/keydown bug
                        }
                    } else if (event.which === 8) {
                        engine.number_input_mode.accumulator = engine.number_input_mode.accumulator.substring(0, engine.number_input_mode.accumulator.length - 1);
                        engine.term.set_prompt(engine.number_input_mode.prompt + engine.number_input_mode.accumulator);
                    }
                    return false;
                }

            },

            keypress: function(event, term) {
                if (engine.sequence_mode.is_active || engine.confirm_mode.is_active ||
                    engine.option_mode.is_active || engine.press_key_mode.is_active ||
                    engine.number_input_mode.is_active) {
                    return false;
                }
            },

            onInit: function(_term) {
                engine.term = _term;
                $.getJSON(engine.gamebook_url, function(_data) {
                    engine.data = _data;
                    engine.cmd_prompt = '[[;#ff0;#000]' + engine.data.prompt + '] ';
                    // build synonym map: w -> [w1, w2, w3, ..]
                    var stemmed_synonyms = [];
                    // (1) stem them
                    $.each(engine.data.synonyms, function(i, synset) {
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
                            engine.synonyms[w] = $.grep(synset, function(v) { return v !== w; });
                        });
                    });
                    // raw, unstemmed syns (for autocompletion)
                    $.each(engine.data.synonyms, function(i, synset) {
                        $.each(synset, function(j, w) {
                            engine.raw_synonyms[w] = $.grep(synset, function(v) { return v !== w; });
                        });
                    });
                    engine.data.intro_sequence[engine.data.intro_sequence.length-1] += '\n\n' + engine.stars;
                    if (engine.debug) {
                        engine.action_chart.combat_skill = 30;
                        engine.action_chart.endurance.initial = 20;
                        engine.action_chart.endurance.current = 18;
                        engine.action_chart.kai_disciplines = ['Weaponskill', 'Mindblas', 'Animal Kinship',
                                                               'Camouflage', 'Tracking'];
                        engine.action_chart.weaponskill = 'Spear';
                        engine.addItem({name: 'Quarterstaff',ac_section:'weapons'});
                        //engine.addItem({name: 'Short Sword', ac_section: 'weapons'});
                        //engine.addItem(engine.data.setup.equipment[5]); // healing potion
                        for (var i = 0; i < 8; i++) { // fill with Meals
                            //engine.addItem({name: 'Meal', ac_section: 'backpack_items'});
                        }
                        engine.addItem({name: 'Meal', ac_section: 'backpack_items'});
                        engine.addItem({name: 'Laumspur Meal', ac_section: 'backpack_items'});
                        engine.addItem({name: 'Red Pass', ac_section: 'special_items'});
                        engine.addItem({name: 'White Pass', ac_section: 'special_items'});
                        engine.addItem({"name": "Magic Spear", "ac_section": "special_items", "is_weaponlike": true,
                                        "weaponskills": ["Spear"]});
                        //engine.action_chart.special_items.push(engine.data.setup.equipment[3]); // chainmail
                        engine.action_chart.gold = 50;
                        engine.doSection({section:location.search.match(/sect=(\d+)/) ? location.search.match(/sect=(\d+)/)[1] : '1'});
                    } else {
                        engine.initSequenceMode(engine.engine_intro, 'engine_intro');
                    }
                });
            }
        });

    });

    return engine;

}();
