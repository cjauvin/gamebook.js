import re, textwrap, json, sys
from Queue import *
from pprint import pprint
from lxml import etree

if False:
    from nltk.corpus import stopwords
    stopwords = set(stopwords.words('english'))
else:
    stopwords = set(['you'])
stopwords.add('turn')

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


sections = {}
custom = json.load(open('fotw_custom.json'))
#custom = json.load(open('fotw.json'))
parser = etree.XMLParser(resolve_entities=False)
tree = etree.parse('fotw.xml', parser=parser)
root = tree.getroot()

#print 'extracting'
for sect_elem in root.findall('.//section[@class="numbered"]')[1:]:
#for sect_elem in root.findall('.//section[@id="sect%s"]' % 160):
    sect_id = sect_elem.find('.//title').text
    #sys.stdout.write('.')
    #sys.stdout.flush()
    #if int(sect_id) % 80 == 0: print
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
            opt_sect_id = re.search('idref="sect(\d+)"', s).group(1)
            options.append({'section': opt_sect_id, 'text': '\n'.join(processPara(s))})
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
                #options.remove(opt)
            elif 'evade' in opt['text']:
                combat['evasion'] = opt
                #options.remove(opt)
                if re.search('at any time|stage', opt['text']):
                    combat['evasion']['n_rounds'] = 0
                elif 'after two rounds' in opt['text']:
                    combat['evasion']['n_rounds'] = 2

    section = {'text': sect_text, 'options': options}
    if combat: section['combat'] = combat
    if is_random_pick: section['is_random_pick'] = True
    if is_special: section['is_special'] = True
    #print json.dumps(section, indent=4)

    #print '-------------------------------------'

    # merge custom content
    if sect_id in custom['sections']:
        if 'alternate_options' in custom['sections'][sect_id]:
            section['alternate_options'] = True
        if 'is_special' in custom['sections'][sect_id]:
            section['is_special'] = True
        for custom_opt in custom['sections'][sect_id].get('options', []):
            # no key to match here, so we got to match using opt.section (thus the need to search)
            for opt in section['options']:
                if opt.get('section') == custom_opt['section']:
                    if 'words' in custom_opt:
                        opt['words'] = custom_opt['words']
                    if 'requirements' in custom_opt:
                        opt['requirements'] = custom_opt['requirements']
                    if 'auto' in custom_opt:
                        opt['auto'] = True
                    break

    sections[sect_id] = section

    #print json.dumps(section, indent=4)
#print

q = Queue()
visited = set()
q.put('1')
sects = set()
while not q.empty():
    sect_id = q.get()
    print sect_id
    sects.add(sect_id)
    if sect_id == '197': continue
    for opt in sections[sect_id]['options']:
        if opt['section'] not in visited:
            q.put(opt['section'])
            visited.add(opt['section'])
