var fotw_special_sections = {

    "12": function(engine, sect) {
        engine.setPressKeyMode(function() {
            var r = engine.pickRandomNumber();
            if (isInArray('Healing', engine.action_chart.kai_disciplines)) {
                r += 2;
            }
            $.each(sect.choices, function(i, choice) {
                if (r >= choice.range[0] && r <= choice.range[1]) {
                    engine.print('You have picked {0}'.f(r), 'blue');
                    engine.print('({0})'.f(choice.text));
                    engine.setConfirmMode({
                        prompt: '[[;#000;#ff0][continue y/n]]',
                        yes: function() {
                            engine.doSection(choice);
                        },
                        no: function() {
                            // remove all choices other than the picked one
                            engine.data.sections[engine.curr_section].choices = [choice];
                            engine.term.set_prompt(engine.cmd_prompt);
                        }
                    });
                }
            });
        });
    },

    '21': function(engine, sect) {
        engine.setPressKeyMode(function() {
            var r = engine.pickRandomNumber(),
            g = r ? r * 3 : 30;
            engine.action_chart.gold += g;
            engine.print('You have picked {0}: {1} Gold Crowns.'.f(r, g), 'blue');
            engine.print('You then pay 1 Gold Crown for the room.', 'blue');
            engine.doSection();
        });
    },

    '57': function(engine, sect) {
        engine.setPressKeyMode(function() {
            var r = engine.pickRandomNumber(),
            g = r ? r : 10;
            engine.action_chart.gold -= g;
            engine.print('You have picked {0}: you lose {1} Gold Crowns.'.f(r, g), 'blue');
            engine.doSection();
        });
    },

    '69': function(engine, sect) {
        if (!isInArray('Mindshield', engine.action_chart.kai_disciplines)) {
            engine.updateEndurance(-2);
            engine.print('You lost ENDURANCE.', 'blue');
        }
        engine.doSection();
    },

    '116': function(engine, sect) {
        engine.setPressKeyMode(function() {
            var r = engine.pickRandomNumber();
            engine.action_chart.gold += (r + 5);
            engine.print('You have picked {0}: you win {1} Gold Crowns.'.f(r, (r + 5)), 'blue');
            engine.action_chart.gold -= 1;
            engine.print('You pay 1 Gold Crown for the room.', 'blue');
            engine.doSection();
        });
    },

    '122': function(engine, sect) {
        if (isInArray('Sixth Sense', engine.action_chart.kai_disciplines)) {
            engine.print(sect.choices[0].text);
            engine.setConfirmMode({
                yes: function() {
                    engine.doSection(sect.choices[0]);
                },
                no: function() {
                    // remove two random pick choices
                    sect.choices.remove(sect.choices[1]);
                    sect.choices.remove(sect.choices[1]);
                    engine.term.set_prompt(engine.cmd_prompt);
                }
            });
        } else {
            engine.print('If not, pick a number from the Random Number Table.');
            sect.choices.remove(sect.choices[0]);
            sect.is_random_pick = true;
            engine.doSection();
        }
    },

    '141': function(engine, sect) {
        if (isInArray('Chainmail Waistcoat', getNames(engine.action_chart.special_items))) {
            removeByName('Chainmail Waistcoat', engine.action_chart.special_items);
            engine.print('You lose your Chainmail Waistcoat.', 'blue');
        }
        engine.doSection();
    },

    '144': function(engine, sect) {
        engine.action_chart.gold = 0;
        engine.print('You have lost all your Gold.', 'blue');
        engine.doSection();
    },

    '150': function(engine, sect) {
        if (isInArray('Hunting', action_chart.kai_disciplines)) {
            sect.must_eat = false;
            engine.print('You use your Kai Discipline of Hunting.', 'blue');
        }
        engine.doSection();
    },

    '194': function(engine, sect) {
        engine.action_chart.weapons = [];
        engine.action_chart.backpack_items = [];
        engine.action_chart.special_items = [];
        engine.action_chart.gold = 0;
        engine.action_chart.has_backpack = false;
        engine.print('You have lost all your belongings (including your Backpack).', 'blue');
        engine.doSection();
    },

    '238': function(engine, sect) {
        sect.choices[0].is_artificial = true; // this choice is restricted to losing so we
        if (!sect.hasOwnProperty('gain')) {
            sect.gain = 0; // max of 40
        }
        if (engine.action_chart.gold === 0) {        // don't want to offer it
            engine.print("You don't have enough Gold Crowns to play.", 'blue');
            engine.doSection();
            return;
        }
        engine.setConfirmMode({
            prompt: '[[;#000;#ff0][play y/n]]',
            yes: function() {
                engine.setOptionMode({
                    prompt: '[[;#000;#ff0][how much gold to bet]]',
                    callback: function(n_golds) {
                        if (n_golds > engine.action_chart.gold) {
                            engine.print("You don't have that much Gold Crowns.", 'blue');
                            engine.special_sections['238'](engine, sect);
                            return;
                        }
                        engine.setOptionMode({
                            prompt: '[[;#000;#ff0][on what number]]',
                            callback: function(n) {
                                var r = engine.pickRandomNumber();
                                var g = 0;
                                if (n === r) {
                                    g = n_golds * 8;
                                } else if (isInArray(Math.abs(r - n), [1, 9])) { // 0 and 9 are adjacent
                                    g = n_golds * 5;
                                } else {
                                    g = -n_golds;
                                }
                                if (g > 0) {
                                    if (sect.gain + g >= 40) {
                                        engine.action_chart.gold += (40 - sect.gain);
                                        engine.print('The ball falls on {0}: you win {1} Gold Crowns ({2} left).'.f(r, (40 - sect.gain), engine.action_chart.gold), 'blue');
                                        engine.print('You have gained the table maximum.', 'blue');
                                        engine.doSection();
                                        return;
                                    }
                                    sect.gain += g;
                                    engine.action_chart.gold += g;
                                    engine.print('The ball falls on {0}: you win {1} Gold Crowns ({2} left).'.f(r, g, engine.action_chart.gold), 'blue');
                                } else {
                                    engine.action_chart.gold += g;
                                    engine.print('The ball falls on {0}: you lose {1} Gold Crowns ({2} left).'.f(r, -g, engine.action_chart.gold), 'blue');
                                    if (engine.action_chart.gold === 0) {
                                        delete sect.choices[0]['is_artificial'];
                                        sect.choices = [sect.choices[0]];
                                        engine.doSection();
                                        return;
                                    }
                                }
                                engine.special_sections['238'](engine, sect);
                            }
                        });
                    }
                });
            }
        });
    },

    '240': function(engine, sect) {
        if (isInArray('Healing', engine.action_chart.kai_disciplines)) {
            engine.updateEndurance(Number.POSITIVE_INFINITY);
        } else {
            engine.updateEndurance(Math.round((engine.calculateEndurance().val - engine.action_chart.endurance.current) / 2));
        }
        engine.print('Healing..', 'blue');
        engine.doSection();
    },

    '276': function(engine, sect) {
        if (isInArray('Mindblast', engine.action_chart.kai_disciplines)) {
            sect.choices[0].auto = true;
            sect.choices = [sect.choices[0]];
            delete sect['combat'];
        }
        engine.doSection();
    },

    '308': function(engine, sect) {
        if (engine.action_chart.gold < 3) {
            engine.print("You don't have enough Gold Crowns to play.", 'blue');
            engine.doSection();
            return;
        }
        engine.setConfirmMode({
            prompt: '[[;#000;#ff0][play y/n]]',
            yes: function() {
                var rolls = [],
                i, r1, r2, msg;
                for (i = 0; i < 6; i += 2) {
                    r1 = engine.pickRandomNumber();
                    r2 = engine.pickRandomNumber();
                    rolls.push([r1, r2, (r1 + r2 === 0) ? Number.POSITIVE_INFINITY : (r1 + r2)]);
                }
                msg = 'You roll {0}-{1}, the first player {2}-{3} and the second player {4}-{5}\n'.f(rolls[0][0], rolls[0][1], rolls[1][0],
                                                                                                     rolls[1][1], rolls[2][0], rolls[2][1]);
                // note that draw is not implemented (it's not really specified in the text anyway)
                if (rolls[0][2] > rolls[1][2] && rolls[0][2] > rolls[2][2]) {
                    msg += 'You win 3 Gold Crowns!';
                    engine.action_chart.gold += 3;
                } else {
                    msg += 'You lose 3 Gold Crowns.';
                    engine.action_chart.gold -= Math.min(engine.action_chart.gold, 3);
                }
                engine.print(msg, 'blue');
                engine.special_sections['308'](engine, sect);
            }
        });
    },

    '313': function(engine, sect) {
        removeByName('Magic Spear', engine.action_chart.special_items);
        engine.print('You have lost the Magic Spear.', 'blue');
        engine.doSection();
    },

    '337': function(engine, sect) {
        engine.action_chart.weapons = [];
        engine.action_chart.backpack_items = [];
        engine.print('You have lost your Weapons and Backpack Items.', 'blue');
        engine.doSection();
    }

};

//------------------------------------------------------------------------------------------------------------

var fotw_special_choices = {

    // section,choice

    '75,142': function(engine, choice) {
        engine.action_chart.gold -= 10;
    },

    "93,137": function(engine, choice) {
        var m = engine.command.match(/\d+/);
        if (m) {
            engine.print('Give {0} Gold Crowns to the beggars?'.f(m[0]), 'blue');
            engine.setConfirmMode({
                yes: function() {
                    engine.action_chart.gold -= Math.min(parseInt(m[0]), engine.action_chart.gold);
                    engine.print('You have {0} Gold Crowns remaining.'.f(engine.action_chart.gold));
                    engine.term.set_prompt(engine.cmd_prompt);
                }
            });
            return;
        } else {
            engine.print('This command does not apply to the current context.', 'blue');
        }
    },

    '36,145': function(engine, choice) {
        // search for any Laumspur product
        $.each(engine.action_chart.backpack_items, function(i, item) {
            if (item.name.match('Laumspur')) {
                removeByName(item.name, engine.action_chart.backpack_items);
                return false;
            }
        });
    },

     '217,199': function(engine, choice) {
         engine.action_chart.gold -= 1;
         engine.print('You pay 1 Gold Crown.', 'blue');
     },

    "338,349": function(engine, choice) {
        removeByName('Magic Spear', engine.action_chart.special_items);
        engine.print('You have lost your Magic Spear', 'blue');
    }

};

//------------------------------------------------------------------------------------------------------------

var fotw_special_combats = {

    "7": function(engine, sect, enemy, round) {
        var evasion_choice, combat_ratio,
        ac = engine.action_chart,
        doCombatRound = function() {
            var r = engine.pickRandomNumber(),
            s, pts, alive, win_choice;
            $.each(engine.combat_results_ranges, function(i, range) {
                if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
            });
            pts = engine.combat_results_table[r][s];
            if (pts[0] === 'k') { pts[0] = enemy.endurance; }
            if (pts[1] === 'k') { pts[1] = ac.endurance.current; }
            if (enemy.hasOwnProperty('double_damage')) { pts[0] *= 2; }
            enemy.endurance -= Math.min(pts[0], enemy.endurance);
            ac.endurance.current -= Math.min(pts[1], ac.endurance.current);
            engine.print('{0} loses {1} ENDURANCE points ({2} remaining)\nYou lose {3} ENDURANCE points ({4} remaining)'.f(enemy.name, pts[0], enemy.endurance, pts[1], ac.endurance.current), 'red');
            alive = engine.isStillAlive();
            if (enemy.endurance <= 0 && alive) {
                engine.print('{0} has died.'.f(enemy.name), 'red');
                win_choice = sect.choices[sect.combat.win.choice];
                engine.print('({0})'.f(win_choice.text));
                engine.setConfirmMode({
                    prompt: '[[;#000;#ff0][continue y/n]]',
                    yes: function() {
                        engine.doSection(win_choice);
                    },
                    no: function() {
                        // only keep the combat win choice
                        sect.choices = [win_choice];
                        engine.term.set_prompt(engine.cmd_prompt);
                    }
                });
                return false;
            }
            return alive;
        };

        // special aspect
        if (round === 0) {
            combat_ratio = (engine.calculateCombatSkill(enemy).val + 2) - enemy.combat_skill;
            engine.print('Your Combat Ratio is {0}'.f(combat_ratio), 'red');
        } else {
            combat_ratio = engine.calculateCombatSkill(enemy).val - enemy.combat_skill;
            if (round === 1) {
                engine.print('Your Combat Ratio is now {0}'.f(combat_ratio), 'red');
            }
        }

        if (sect.combat.hasOwnProperty('evasion') && round >= sect.combat.evasion.n_rounds) {
            engine.setConfirmMode({
                prompt: '[[;#000;#ff0][evade y/n]]',
                yes: function() {
                    var r = engine.pickRandomNumber(),
                    s, pts;
                    $.each(engine.combat_results_ranges, function(i, range) {
                        if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
                    });
                    pts = engine.combat_results_table[r][s];
                    ac.endurance.current -= Math.min(pts[0], ac.endurance.current);
                    enemy.endurance -= pts[1];
                    engine.print('While evading, you lose {0} ENDURANCE points ({1} remaining)'.f(pts[0], ac.endurance.current), 'red');
                    evasion_choice = sect.choices[sect.combat.evasion.choice];
                    engine.print('({0})'.f(evasion_choice.text));
                    engine.setPressKeyMode(function() {
                        engine.doSection(evasion_choice);
                    });
                },
                no: function() {
                    if (doCombatRound()) {
                        engine.special_combats[engine.curr_section](engine, sect, enemy, round + 1);
                    }
                }
            });
        } else {
            engine.setPressKeyMode(function() {
                if (doCombatRound()) {
                    engine.special_combats[engine.curr_section](engine, sect, enemy, round + 1);
                }
            });
        }
    },

    '60': function(engine, sect, enemy, round) {
        var evasion_choice,
        ac = engine.action_chart,
        combat_ratio = (engine.calculateCombatSkill(enemy).val + 2) - enemy.combat_skill,
        doCombatRound = function() {
            var r = engine.pickRandomNumber(),
            s, pts, alive, win_choice;
            $.each(engine.combat_results_ranges, function(i, range) {
                if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
            });
            pts = engine.combat_results_table[r][s];
            if (pts[0] === 'k') { pts[0] = enemy.endurance; }
            if (pts[1] === 'k') { pts[1] = ac.endurance.current; }
            if (round < 2) { pts[1] = 0; } // special aspect
            if (enemy.hasOwnProperty('double_damage')) { pts[0] *= 2; }
            enemy.endurance -= Math.min(pts[0], enemy.endurance);
            ac.endurance.current -= Math.min(pts[1], ac.endurance.current);
            engine.print('{0} loses {1} ENDURANCE points ({2} remaining)\nYou lose {3} ENDURANCE points ({4} remaining)'.f(enemy.name, pts[0], enemy.endurance, pts[1], ac.endurance.current), 'red');
            alive = engine.isStillAlive();
            if (enemy.endurance <= 0 && alive) {
                engine.print('{0} has died.'.f(enemy.name), 'red');
                win_choice = sect.choices[sect.combat.win.choice];
                engine.print('({0})'.f(win_choice.text));
                engine.setConfirmMode({
                    prompt: '[[;#000;#ff0][continue y/n]]',
                    yes: function() {
                        engine.doSection(win_choice);
                    },
                    no: function() {
                        // only keep the combat win choice
                        sect.choices = [win_choice];
                        engine.term.set_prompt(engine.cmd_prompt);
                    }
                });
                return false;
            }
            return alive;
        };

        if (round === 0) {
            engine.print('Your Combat Ratio is {0}'.f(combat_ratio), 'red');
        }

        if (sect.combat.hasOwnProperty('evasion') && round >= sect.combat.evasion.n_rounds) {
            engine.setConfirmMode({
                prompt: '[[;#000;#ff0][evade y/n]]',
                yes: function() {
                    var r = engine.pickRandomNumber(),
                    s, pts;
                    $.each(engine.combat_results_ranges, function(i, range) {
                        if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
                    });
                    pts = engine.combat_results_table[r][s];
                    ac.endurance.current -= Math.min(pts[0], action_chart.endurance.current);
                    enemy.endurance -= pts[1];
                    engine.print('While evading, you lose {0} ENDURANCE points ({1} remaining)'.f(pts[0], ac.endurance.current), 'red');
                    evasion_choice = sect.choices[sect.combat.evasion.choice];
                    engine.print('({0})'.f(evasion_choice.text));
                    engine.setPressKeyMode(function() {
                        engine.doSection(evasion_choice);
                    });
                },
                no: function() {
                    if (doCombatRound()) {
                        engine.special_combats['60'](engine, sect, enemy, round + 1);
                    }
                }
            });
        } else {
            engine.setPressKeyMode(function() {
                if (doCombatRound()) {
                    engine.special_combats['60'](engine, sect, enemy, round + 1);
                }
            });
        }
    },

    '276': function(engine, sect, enemy, round) {
        var evasion_choice,
        ac = engine.action_chart,
        combat_ratio = engine.calculateCombatSkill(enemy).val - enemy.combat_skill,
        doCombatRound = function() {
            var r = engine.pickRandomNumber(),
            s, pts, alive, win_choice, lost_choice;
            $.each(engine.combat_results_ranges, function(i, range) {
                if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
            });
            pts = engine.combat_results_table[r][s];
            if (pts[0] === 'k') { pts[0] = enemy.endurance; }
            if (pts[1] === 'k') { pts[1] = ac.endurance.current; }
            if (enemy.hasOwnProperty('double_damage')) { pts[0] *= 2; }
            enemy.endurance -= Math.min(pts[0], enemy.endurance);
            ac.endurance.current -= Math.min(pts[1], ac.endurance.current);
            engine.print('{0} loses {1} ENDURANCE points ({2} remaining)\nYou lose {3} ENDURANCE points ({4} remaining)'.f(enemy.name, pts[0], enemy.endurance, pts[1], ac.endurance.current), 'red');
            if (enemy.endurance <= 0) {
                ac.endurance.current = sect.initial_endurance;
                engine.print('You have won.', 'red');
                win_choice = sect.choices[2];
                engine.print('({0})'.f(win_choice.text));
                engine.setConfirmMode({
                    prompt: '[[;#000;#ff0][continue y/n]]',
                    yes: function() {
                        engine.doSection(win_choice);
                    },
                    no: function() {
                        sect.choices = [win_choice];
                        engine.term.set_prompt(engine.cmd_prompt);
                    }
                });
                return false;
            } else if (ac.endurance.current === 0) {
                ac.endurance.current = sect.initial_endurance;
                engine.print('You have lost.', 'red');
                lost_choice = sect.choices[1];
                engine.print('({0})'.f(lost_choice.text));
                engine.setConfirmMode({
                    prompt: '[[;#000;#ff0][continue y/n]]',
                    yes: function() {
                        engine.doSection(lost_choice);
                    },
                    no: function() {
                        sect.choices = [lost_choice];
                        engine.term.set_prompt(engine.cmd_prompt);
                    }
                });
                return false;
            }
            return true;
        };

        if (round === 0) {
            sect.initial_endurance = ac.endurance.current;
            print('Your Combat Ratio is {0}'.f(combat_ratio), 'red');
        }

        engine.setPressKeyMode(function() {
            if (doCombatRound()) {
                engine.special_combats['276'](engine, sect, enemy, round + 1);
            }
        });
    }

};

// ganon/dorier
fotw_special_combats["270"] = fotw_special_combats["7"];
