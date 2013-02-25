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

};

var fotw_special_combats = {

};