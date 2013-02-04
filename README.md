gamebook.js - an [IF](http://en.wikipedia.org/wiki/Interactive_fiction)-style gamebook engine
=========================================

What is it
----------

It's a twist in the classic gamebook mechanics where instead of
navigating an explicit menu of options, you are a given a console in
which you are free to type any command, after each section, using
clues from the text. The engine then tries to match your input with
one of the predefined options, yielding a gameplay more akin to
[interactive fiction][1].

[1]: http://en.wikipedia.org/wiki/Interactive_fiction

[**Try it!**](http://cjauvin.github.com/gamebook.js)

How it works
------------

The gamebook data is entirely contained in a JSON file with a simple
structure. This means that the engine operates client-side only, with
no need for any server interaction. The main object contains a
`sections` object with a key corresponding to each section:

```json
{
    "sections": {
        "1": {
            "text": "Captain D’Val and his guards...",
            "options": [{
                "section": "273",
                "text": "If you wish to draw your weapon and attack your unknown assailant,\nturn to 273.",
                "words": ["weapon", "attack", "assailant", "combat"]
            }, {
                "section": "160",
                "text": "If you wish to try to pull free of his grasp, turn to 160.",
                "words": ["pull", "free", "grasp", "struggle", "assailant"]
            }]
        },
    ...
    }
}
```

The engine will tokenize the player's input and try to match it
against each option's list of words, with a certain tolerance (using
the [Levenshtein distance][2]). The option with the greatest number of
matches is considered the chosen one (a confirmation is asked though).

Of course this mechanism is so simple that it could hardly be defined
as a command parser, but in the context of a gamebook, where there are
only a few options per section anyway, it makes sense. To increase the
illusion that it's a "real" (or deeper) parser, it has a few more
features:

* the engine uses a dictionary of synonyms (defined in the data file)
  to expand the game vocabulary

* an ambiguous command (resulting in two options having the same
  number of matches, for instance) will often gently push the player
  into making more complex entries; e.g. "assailant" alone would be
  ambiguous in the example above, whereas "attack assailant" wouldn't
  be

* there is a syntax for compound commands, for which each word must be
  matched, for example:

```json
"words": [["don't", "want"], "attack"]
```

would match "don't want" (or even "don't really want"), but not "want"
alone.

[2]: http://en.wikipedia.org/wiki/Levenshtein_distance

Thanks!
-------

The console environment was created using the [jQuery Terminal][3]
plugin.

[3]: http://terminal.jcubic.pl
