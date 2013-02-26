var fotw_special_sections = {

    "12": function(engine) {
        var sect = engine.data.sections[engine.curr_section];
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

    '21': function(engine) {
        engine.setPressKeyMode(function() {
            var r = engine.pickRandomNumber(),
            g = r ? r * 3 : 30;
            engine.action_chart.gold += g;
            engine.print('You have picked {0}: {1} Gold Crowns.'.f(r, g), 'blue');
            engine.print('You then pay 1 Gold Crown for the room.', 'blue');
            engine.setConfirmMode({
                prompt: '[[;#000;#ff0][continue y/n]]',
                yes: function() {
                    engine.doSection(sect.choices[0]);
                }
            });
        });
    }

};

var fotw_special_choices = {

    "338,349": function(engine, choice) {
        removeByName('Magic Spear', engine.action_chart.special_items);
        engine.print('You have lost your Magic Spear', 'blue');
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
    }

};

var fotw_special_combats = {

    "270": function(engine, enemy, round) {
        var evasion_choice, combat_ratio,
        sect = engine.data.sections[engine.curr_section];
        doCombatRound = function() {
            var r = engine.pickRandomNumber(),
            s, pts, alive, win_choice;
            $.each(engine.combat_results_ranges, function(i, range) {
                if (combat_ratio >= range[0] && combat_ratio <= range[1]) { s = i; }
            });
            pts = engine.combat_results_table[r][s];
            if (pts[0] === 'k') { pts[0] = enemy.endurance; }
            if (pts[1] === 'k') { pts[1] = engine.action_chart.endurance.current; }
            if (enemy.hasOwnProperty('double_damage')) { pts[0] *= 2; }
            enemy.endurance -= Math.min(pts[0], enemy.endurance);
            engine.action_chart.endurance.current -= Math.min(pts[1], engine.action_chart.endurance.current);
            engine.print('{0} loses {1} ENDURANCE points ({2} remaining)\nYou lose {3} ENDURANCE points ({4} remaining)'.f(enemy.name, pts[0], enemy.endurance, pts[1], engine.action_chart.endurance.current), 'red');
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
                    engine.action_chart.endurance.current -= Math.min(pts[0], engine.action_chart.endurance.current);
                    enemy.endurance -= pts[1];
                    engine.print('While evading, you lose {0} ENDURANCE points ({1} remaining)'.f(pts[0], engine.action_chart.endurance.current), 'red');
                    evasion_choice = sect.choices[sect.combat.evasion.choice];
                    engine.print('({0})'.f(evasion_choice.text));
                    engine.setPressKeyMode(function() {
                        engine.doSection(evasion_choice);
                    });
                },
                no: function() {
                    if (doCombatRound()) {
                        engine.special_combats[engine.curr_section](engine, enemy, round + 1);
                    }
                }
            });
        } else {
            engine.setPressKeyMode(function() {
                if (doCombatRound()) {
                    engine.special_combats[engine.curr_section](engine, enemy, round + 1);
                }
            });
        }
    }
};
