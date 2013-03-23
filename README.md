# gamebook.js - an [IF](http://en.wikipedia.org/wiki/Interactive_fiction)-style gamebook engine

## What is it

It's an experimental crossbreed between [interactive fiction][if] (IF) and
[gamebooks][gb]: instead of navigating an explicit set of choices, you are
free to type any command after each section. The engine then tries to
match what you typed with the best available choice, using a
parser. The parser is quite simple (as it wouldn't really make sense
for it to be otherwise) but nevertheless uses some techniques like
stemming and synonym matching, to improve flexibility (and fun!) a
bit. To read more about the idea:

http://cjauvin.blogspot.ca/2013/03/suspension-of-parser-disbelief.html

It currently implements the full version of [Fire on the Water][2], the
second book in the [Lone Wolf][3] series, whose content is freely available
(for doing such mashups) through [Project Aon][4].

#[**Try playing it first!**](http://projectaon.org/staff/christian/gamebook.js)

[if]: http://en.wikipedia.org/wiki/Interactive_fiction
[gb]: http://en.wikipedia.org/wiki/Gamebook
[2]: http://en.wikipedia.org/wiki/Fire_on_the_water
[3]: http://en.wikipedia.org/wiki/Lone_Wolf_(gamebooks)
[4]: http://www.projectaon.org/en/Main/Home

## How it works

### Gamebook Content

The gamebook data is entirely contained in a [JSON file][5] with a simple
structure (and is the only part that can't versioned since it is copyrighted material, which 
has to hosted on Project Aon's web server).
This means that the engine operates client-side only, with
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

[5]: http://www.projectaon.org/staff/christian/gamebook.js/fotw.html

The extraction of content from the original Project Aon [XML file][6] is 
semi-automated using a [Python script][7], which weaves it with another customized, 
handcrafted "override" file, to yield a single final [JSON file][5].

[6]: http://www.projectaon.org/en/xml/02fotw.xml
[7]: https://github.com/cjauvin/gamebook.js/blob/master/xml2json.py

### Parser

The engine will tokenize the player's input and try to match it
against each option's list of words, with a certain tolerance (using
[word stemming][8] and synonym matching). The option with the greatest number of
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

[8]: http://en.wikipedia.org/wiki/Word_stemming

### Pluggable Book-Specific Interface

The engine is contained in a [single module][9] that should (more or less) 
implement the general logic of any Lone Wolf gamebook (expanding it to be 
more general and implement *any* gamebook would require much more work).
The book-specific logic (not to be confused with its content) is kept separate 
in a [module][10] with a straightforward pluggable interface:

```javascript
var fotw_special_sections = {
    '144': function(engine, sect) {
        engine.action_chart.gold = 0;
        engine.echo('You have lost all your Gold.', 'blue');
        engine.doSection();
    }, [...]
}
```

which in this example implements a special behavior for section 144 of 
FotW, which is triggered by simply setting the `is_special` flag set to `true` 
for that section in the JSON content file (there are also similar mechanisms 
for special choices and combats).

[9]: https://github.com/cjauvin/gamebook.js/blob/master/gamebook.js
[10]: https://github.com/cjauvin/gamebook.js/blob/master/fotw.js

## Installation and dependencies

The engine is pretty straigthforward to install and serve (via your preferred 
web server), but you have to pay special attention to these aspects:

### jQuery Terminal

The console is implemented using [jQuery Terminal][11], which I modified to 
add word autocompletion and some other minor things, so make sure you are 
using the [word-completion][12] branch of my [forked repo][12].

[11]: http://terminal.jcubic.pl
[12]: https://github.com/cjauvin/jquery.terminal/tree/word-completion

### Gamebook Content Access

Since the JSON gamebook content contains copyrighted material, it must be 
hosted on [Project Aon][4]'s web server (I obtained permission to host the 
entire codebase for the FotW demo). As the gamebook.js codebase is not limited 
by that restriction, it can access the content remotely, via JSONP. In the 
case of FotW, for instance, it would mean using that value for the `gamebook_url`
engine variable:

```javascript
gamebook_url: '//projectaon.org/staff/christian/gamebook.js/fotw.php?callback=?'
```

### Porter Stemmer

A [JS version][porterjs] of the [Porter stemmer][porter] is also used (without modification).

[porterjs]: https://github.com/kristopolous/Porter-Stemmer
[porter]: http://en.wikipedia.org/wiki/Porter_stemmer

