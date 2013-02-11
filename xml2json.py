import re, textwrap
from lxml import etree
from collections import namedtuple


Section = namedtuple('Section', ['sect_id', 'wrapped_text', 'text', 'options', 'is_random_pick'])
Option = namedtuple('Option', ['sect_id', 'wrapped_text', 'text', 'range'])
Enemy = namedtuple('Enemy', ['name', 'combat_skill', 'endurance', 'win_option'])

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

parser = etree.XMLParser(resolve_entities=False)
tree = etree.parse('fotw.xml', parser=parser)
root = tree.getroot()

sections = []

#for section in root.findall('.//section[@class="numbered"]')[1:]:
for sect_elem in root.findall('.//section[@id="sect348"]'):
    sect_paras = []
    options = []
    enemies = []
    rnt_found = False
    for item in sect_elem.find('data'):
        s = etree.tostring(item).strip()
        if item.tag == 'p':
            if '<a idref="random">Random Number Table</a>' in s:
                rnt_found = True
                s = s.replace('<a idref="random">Random Number Table</a>', 'Random Number Table')
            sect_paras.append(processPara(s))
        if item.tag == 'combat':
            e = Enemy(item.find('.//enemy').text,
                                 int(item.find('..//enemy-attribute[@class="combatskill"]').text),
                                 int(item.find('..//enemy-attribute[@class="endurance"]').text), None)
            enemies.append(e)
            sect_paras.append(['%s: COMBAT SKILL %d, ENDURANCE %d' % (e.name, e.combat_skill, e.endurance)])
        if item.tag == 'choice':
            sect_id = re.search('idref="sect(\d+)"', s).group(1)
            p = processPara(s)
            options.append(Option(sect_id, processPara(s), '\n'.join(p), None))
    sect_text = '\n\n'.join(['\n'.join(p) for p in sect_paras])
    #print sect_text
    is_random_pick = False
    if rnt_found and re.search('\d-\d', options[0].text):
        is_random_pick = True
        for i, opt in enumerate(options):
            options[i] = opt._replace(range=re.search('(\d)-(\d)', opt.text).groups())
    section = Section(sect_elem.find('.//title').text, sect_paras, sect_text, options, is_random_pick)
    sections.append(section)
    exit()


