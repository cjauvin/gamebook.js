import re, textwrap, json, sys
from collections import OrderedDict
from Queue import *
from pprint import pprint
from lxml import etree
from nltk.corpus import stopwords

width = 80

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
    para = re.sub('</?signpost>', '', para)
    return textwrap.wrap(para, width)

sections = OrderedDict()
custom = json.load(open('fotw_custom.json'))
parser = etree.XMLParser(resolve_entities=False)
tree = etree.parse('fotw.xml', parser=parser)
root = tree.getroot()

stopwords = set(stopwords.words('english'))
for w in ['turn', 'wish', 'want', 'turning']:
    stopwords.add(w)

for sect_elem in root.findall('.//section[@class="numbered"]')[1:]:
#for sect_elem in root.findall('.//section[@id="sect%s"]' % 181):
    sect_id = sect_elem.find('.//title').text
    sect_paras = []
    choices = []
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
    mindforce_found = False
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
        if 'Mindforce' in s:
            mindforce_found = True
        if item.tag == 'p':
            sect_paras.append(processPara(s))
        if item.tag == 'signpost':
            s = processPara(s)[0]
            spacer = ' ' * ((width - len(s)) / 2)
            sect_paras.append([spacer + s])
        if item.tag == 'ul':
            for li in item:
                lis = processPara(etree.tostring(li).strip())[0]
                lis = re.sub('</?li>', '', lis)
                sect_paras.append(['* %s' % lis])
            list_found = True
        elif item.tag == 'combat':
            e = {'name': item.find('.//enemy').text,
                 'combat_skill': int(item.find('..//enemy-attribute[@class="combatskill"]').text),
                 'endurance': int(item.find('..//enemy-attribute[@class="endurance"]').text)}
            enemies.append(e)
            sect_paras.append(['%s: COMBAT SKILL %d, ENDURANCE %d' % (e['name'], e['combat_skill'], e['endurance'])])
        elif item.tag == 'choice':
            choice_sect_id = re.search('idref="sect(\d+)"', s).group(1)
            choices.append({'section': choice_sect_id, 'text': '\n'.join(processPara(s))})
        else:
            if item.tag == 'illustration':
                illustration_found = True
    sect_text = '\n\n'.join(['\n'.join(p) for p in sect_paras])
    is_random_pick = False
    if rnt_found and re.search('\d-\d', choices[0]['text']):
        is_random_pick = True
        for choice in choices:
            if re.search('(\d+)-(\d+)', choice['text']):
                choice['range'] = [int(s) for s in re.search('(\d+)-(\d+)', choice['text']).groups()]
            else:
                n = int(re.search('(\d)', choice['text']).group(1))
                choice['range'] = [n, n]
    elif len(choices) > 1:
        for choice in choices:
            words = []
            for w in re.split("[^A-Za-z0-9'-]+", choice['text']): # every nonalpha except "'" and "-"
                w = w.lower()
                if len(w) < 3 or w in stopwords or re.match('\d+', w): continue
                words.append(w)
            choice['words'] = words
    if enemies:
        combat['enemies'] = enemies
        for i, choice in enumerate(choices):
            if 'win' in choice['text'] or 'if you kill' in choice['text'].lower():
                combat['win'] = {'choice': i}
            elif 'evade' in choice['text']:
                combat['evasion'] = {'choice': i}
                if re.search('at any time|stage', choice['text']):
                    combat['evasion']['n_rounds'] = 0
                elif 'after two rounds' in choice['text']:
                    combat['evasion']['n_rounds'] = 2

    section = {'text': sect_text, 'choices': choices}
    if combat:
        if undead_found or sommerswerd_found:
            assert len(combat['enemies']) == 1
            combat['enemies'][0]['double_damage'] = True
        if immune_to_mindblast_found:
            assert len(combat['enemies']) == 1
            combat['enemies'][0]['immune'] = "Mindblast"
        if mindforce_found:
            assert len(combat['enemies']) == 1
            combat['enemies'][0]['has_mindforce'] = True
        if 'win' not in combat and len(choices) == 1:
            combat['win'] = {'choice': 0}
        section['combat'] = combat

    if is_random_pick: section['is_random_pick'] = True
    if must_eat: section['must_eat'] = True

    # merge custom content
    if sect_id in custom['sections']:
        cust_sect = custom['sections'][sect_id]
        if 'alternate_choices' in cust_sect:
            section['alternate_choices'] = True
        if 'is_special' in cust_sect:
            section['is_special'] = True
        if 'items' in cust_sect:
            section['items'] = cust_sect['items']
        if 'endurance' in cust_sect:
            section['endurance'] = cust_sect['endurance']
        if 'combat' in cust_sect:
            section['combat'].update(cust_sect['combat'])
        if 'options' in cust_sect:
            section['options'] = cust_sect['options']
        if 'must_eat' in cust_sect:
            if cust_sect['must_eat']:
                section['must_eat'] = cust_sect['must_eat'] # possibly a int
            else:
                del section['must_eat']
        if 'text' in cust_sect:
            section['text'] = cust_sect['text']
        if 'n_items_to_pick' in cust_sect:
            section['n_items_to_pick'] = cust_sect['n_items_to_pick']
        if 'trim_choices' in cust_sect:
            section['trim_choices'] = True
        if 'reduce_choices' in cust_sect:
            section['reduce_choices'] = True
        for custom_choice in custom['sections'][sect_id].get('choices', []):
            # no key to match here, so we got to match using choice.section (thus the need to search)
            #print custom_choice['section']
            for choice in section['choices']:
                if choice.get('section') == custom_choice['section'] and 'is_artificial' not in custom_choice:
                    choice.update(custom_choice)
                    break
            if 'is_artificial' in custom_choice:
                choices.append(custom_choice)

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

section_od = OrderedDict()
for sect_id in range(1, 351):
    sect_id = str(sect_id)
    section_od[sect_id] = sections[sect_id]

# q = Queue()
# visited = set()
# q.put('1')
# section_od = OrderedDict()
# to_set = []
# while not q.empty():
#     sect_id = q.get()
#     to_set.append(sect_id)
#     section_od[sect_id] = sections[sect_id]
# #    if sect_id == '197': continue
#     for choice in sections[sect_id]['choices']:
#         if choice['section'] not in visited:
#             q.put(choice['section'])
#             visited.add(choice['section'])

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

#print 'produced %d sections' % len(result_od['sections'])
