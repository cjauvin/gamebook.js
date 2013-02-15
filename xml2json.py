import re, textwrap, json
from lxml import etree
from nltk.corpus import stopwords


def processPara(para):
    para = re.sub('</?p/?>', '', para)
    para = re.sub('</?choice( idref=".*?")?/?>', '', para)
    para = re.sub('</?link-text/?>', '', para)
    para = re.sub('</?cite/?>', '', para)
    para = para.replace('<ch.apos/>', "'")
    para = para.replace('<ch.endash/>', "-")
    para = para.replace('<ch.emdash/>', "-")
    para = para.replace('<ch.ellips/>', "...")
    para = re.sub('</?quote/?>', "\"", para)
    return textwrap.wrap(para, 80)

stopwords = set(stopwords.words('english'))
stopwords.add('turn')

parser = etree.XMLParser(resolve_entities=False)
tree = etree.parse('fotw.xml', parser=parser)
root = tree.getroot()

sections = {}

sect_id = '3'

#for section in root.findall('.//section[@class="numbered"]')[1:]:
for sect_elem in root.findall('.//section[@id="sect%s"]' % sect_id):
    sect_paras = []
    options = []
    combat = {}
    enemies = []
    rnt_found = False
    is_special = False
    for item in sect_elem.find('data'):
        s = etree.tostring(item).strip()
        if item.tag == 'p':
            if '<a idref="random">Random Number Table</a>' in s:
                rnt_found = True
                s = s.replace('<a idref="random">Random Number Table</a>', 'Random Number Table')
            for a in ['COMBAT SKILL', 'ENDURANCE']:
                if '<typ class="attribute">%s</typ>' % a in s:
                    s = s.replace('<typ class="attribute">%s</typ>' % a, a)
                    is_special = True
            sect_paras.append(processPara(s))
        elif item.tag == 'combat':
            e = {'name': item.find('.//enemy').text,
                 'combat_skill': int(item.find('..//enemy-attribute[@class="combatskill"]').text),
                 'endurance': int(item.find('..//enemy-attribute[@class="endurance"]').text)}
            enemies.append(e)
            sect_paras.append(['%s: COMBAT SKILL %d, ENDURANCE %d' % (e['name'], e['combat_skill'], e['endurance'])])
        elif item.tag == 'choice':
            sect_id = re.search('idref="sect(\d+)"', s).group(1)
            options.append({'section': sect_id, 'text': '\n'.join(processPara(s))})
    sect_text = '\n\n'.join(['\n'.join(p) for p in sect_paras])
    is_random_pick = False
    if rnt_found and re.search('\d-\d', options[0]['text']):
        is_random_pick = True
        for opt in options:
            opt['range'] = [int(s) for s in re.search('(\d)-(\d)', opt['text']).groups()]
    elif len(options) > 1:
        for opt in options:
            words = []
            for w in re.split('\W+', opt['text']):
                w = w.lower()
                if len(w) < 3 or w in stopwords or re.match('\d+', w): continue
                words.append(w)
            opt['words'] = words
    if enemies:
        combat['enemies'] = enemies
        for opt in reversed(options):
            if 'win' in opt['text']:
                combat['win'] = opt
                options.remove(opt)
            elif 'evade' in opt['text']:
                combat['evasion'] = opt
                options.remove(opt)
                if re.search('at any time|stage', opt['text']):
                    combat['evasion']['n_rounds'] = 0
                elif 'after two rounds' in opt['text']:
                    combat['evasion']['n_rounds'] = 2
    section = {'text': sect_text, 'options': options}
    if combat: section['combat'] = combat
    if is_random_pick: section['is_random_pick'] = True
    if is_special: section['is_special'] = True
    print json.dumps(section, indent=4)
    sections[sect_elem.find('.//title').text] = section
    exit()
