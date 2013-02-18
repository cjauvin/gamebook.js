import re, textwrap, json, sys
from collections import OrderedDict
from Queue import *
from pprint import pprint
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
    para = para.replace('<ch.thinspace/>', "")
    para = re.sub('</?quote/?>', "\"", para)
    para = re.sub('</?onomatopoeia>', '', para)
    para = re.sub('<footref.*?/>', '', para)
    return textwrap.wrap(para, 80)

sections = OrderedDict()
custom = json.load(open('fotw_custom.json'))
parser = etree.XMLParser(resolve_entities=False)
tree = etree.parse('fotw.xml', parser=parser)
root = tree.getroot()

stopwords = set(stopwords.words('english'))
for w in ['turn', 'wish']:
    stopwords.add(w)

for sect_elem in root.findall('.//section[@class="numbered"]')[1:]:
#for sect_elem in root.findall('.//section[@id="sect%s"]' % 27):
    sect_id = sect_elem.find('.//title').text
    sect_paras = []
    options = []
    combat = {}
    enemies = []
    rnt_found = False
    ac_found = False
    stats_found = False
    undead_found = False
    sommerswerd_found = False
    immune_to_mindblast_found = False
    illustration_found = False
    must_eat = False
    list_found = False
    footref_found = False
    for item in sect_elem.find('data'):
        s = etree.tostring(item).strip()
        for subitem in item:
            if subitem.tag == 'footref':
                footref_found = True
        if '<a idref="random">Random Number Table</a>' in s:
            rnt_found = True
            s = s.replace('<a idref="random">Random Number Table</a>', 'Random Number Table')
        for a in ['COMBAT SKILL', 'ENDURANCE']:
            if '<typ class="attribute">%s</typ>' % a in s:
                s = s.replace('<typ class="attribute">%s</typ>' % a, a)
                stats_found = True
        if '<a idref=\"action\">Action Chart</a>' in s:
            ac_found = True
            s = s.replace('<a idref=\"action\">Action Chart</a>', 'Action Chart')
        if 'undead' in s.lower():
            undead_found = True
        if 'sommerswerd' in s.lower():
            sommerswerd_found = True
        if 'immune' in s.lower() and 'mindblast' in s.lower():
            immune_to_mindblast_found = True
        if 'Meal' in s and 'must' in s:
            must_eat = True
        if item.tag == 'p':
            sect_paras.append(processPara(s))
        if item.tag == 'ul':
            list_found = True
        elif item.tag == 'combat':
            e = {'name': item.find('.//enemy').text,
                 'combat_skill': int(item.find('..//enemy-attribute[@class="combatskill"]').text),
                 'endurance': int(item.find('..//enemy-attribute[@class="endurance"]').text)}
            enemies.append(e)
            sect_paras.append(['%s: COMBAT SKILL %d, ENDURANCE %d' % (e['name'], e['combat_skill'], e['endurance'])])
        elif item.tag == 'choice':
            opt_sect_id = re.search('idref="sect(\d+)"', s).group(1)
            options.append({'section': opt_sect_id, 'text': '\n'.join(processPara(s))})
        else:
            if item.tag == 'illustration':
                illustration_found = True
    sect_text = '\n\n'.join(['\n'.join(p) for p in sect_paras])
    is_random_pick = False
    if rnt_found and re.search('\d-\d', options[0]['text']):
        is_random_pick = True
        for opt in options:
            if re.search('(\d)-(\d)', opt['text']):
                opt['range'] = [int(s) for s in re.search('(\d)-(\d)', opt['text']).groups()]
            else:
                n = int(re.search('(\d)', opt['text']).group(1))
                opt['range'] = [n, n]
    elif len(options) > 1:
        for opt in options:
            words = []
            for w in re.split("[^A-Za-z0-9'-]+", opt['text']): # every nonalpha except "'" and "-"
                w = w.lower()
                if len(w) < 3 or w in stopwords or re.match('\d+', w): continue
                words.append(w)
            opt['words'] = words
    if enemies:
        combat['enemies'] = enemies
        for i, opt in enumerate(options):
            if 'win' in opt['text']:
                combat['win'] = {'option': i}
            elif 'evade' in opt['text']:
                combat['evasion'] = {'option': i}
                if re.search('at any time|stage', opt['text']):
                    combat['evasion']['n_rounds'] = 0
                elif 'after two rounds' in opt['text']:
                    combat['evasion']['n_rounds'] = 2

    section = {'text': sect_text, 'options': options}
    if combat:
        if undead_found or sommerswerd_found:
            assert len(combat['enemies']) == 1
            combat['enemies'][0]['is_undead'] = True
        if immune_to_mindblast_found:
            assert len(combat['enemies']) == 1
            combat['enemies'][0]['immune'] = "Mindblast"
        if 'win' not in combat and len(options) == 1:
            combat['win'] = {'option': 0}
        section['combat'] = combat

    if is_random_pick: section['is_random_pick'] = True
    if must_eat: section['must_eat'] = True

    # merge custom content
    if sect_id in custom['sections']:
        cust_sect = custom['sections'][sect_id]
        if 'alternate_options' in cust_sect:
            section['alternate_options'] = True
        if 'is_special' in cust_sect:
            section['is_special'] = True
        if 'items' in cust_sect:
            section['items'] = cust_sect['items']
        if 'endurance' in cust_sect:
            section['endurance'] = cust_sect['endurance']
        if 'combat' in cust_sect:
            section['combat'].update(cust_sect['combat'])
        for custom_opt in custom['sections'][sect_id].get('options', []):
            # no key to match here, so we got to match using opt.section (thus the need to search)
            #print custom_opt['section']
            for opt in section['options']:
                if opt.get('section') == custom_opt['section']:
                    opt.update(custom_opt)
                    break

    sections[sect_id] = section

    # special case reporting
    report = []
    if ac_found:
        report.append('ac')
    if rnt_found and not is_random_pick:
        report.append('rnt')
    if stats_found:
        report.append('stats')
    if footref_found:
        report.append('footref')
#    if illustration_found:
#        report.append('illustration')
    # if must_eat:
    #     report.append('must eat')
    if list_found:
        report.append('list')
    if report and sect_id not in custom['sections']: #True:
        print '%s: %s' % (sect_id, ', '.join(report))

#exit()

q = Queue()
visited = set()
q.put('1')
section_od = OrderedDict()
to_set = []
while not q.empty():
    sect_id = q.get()
    to_set.append(sect_id)
    section_od[sect_id] = sections[sect_id]
#    if sect_id == '197': continue
    for opt in sections[sect_id]['options']:
        if opt['section'] not in visited:
            q.put(opt['section'])
            visited.add(opt['section'])

result_od = OrderedDict()
setup_od = OrderedDict()
for f in ['sequence', 'disciplines', 'weapons', 'equipment']:
    setup_od[f] = custom['setup'][f]
custom['setup'] = setup_od
for f in ['prompt', 'intro_sequence', 'setup', 'synonyms']:
    result_od[f] = custom[f]
result_od['sections'] = section_od
#json.dump(result_od, open('fotw_generated.json', 'w'), indent=4)
open('fotw_generated.json', 'w').write('\n'.join([line.rstrip() for line in json.dumps(result_od, indent=4).split('\n')]))

print 'produced %d sections' % len(result_od['sections'])
