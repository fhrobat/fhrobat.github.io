# NLA radar: raccoglie da più fonti le novità di algebra lineare numerica e scrive radar.json.
# Lo lancia ogni mattina una GitHub Action (che pubblica il json su un ramo a parte, senza ripubblicare il sito);
# in locale serve per l'anteprima.
# Uso: python -I radar/fetch_radar.py [file di uscita, default radar/radar.json] [radar.json di ieri]
# Se una fonte non risponde si tiene quello che c'era nel json di ieri (se c'è).
import datetime as dt
import email.utils
import html
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

# alcuni siti rifiutano certi user agent (MathWorks quello standard di Python, johndcook.com e francisbach.com
# questo): si prova il secondo
UAS = ['python-urllib/3 nla-radar (+https://fhrobat.github.io)', 'nla-radar/1.0 (+https://fhrobat.github.io)']
NOW = dt.datetime.now(dt.timezone.utc)
TODAY = NOW.date().isoformat()

# blog attivi: nome mostrato, home, feed, livello (1 = numerical analysis / NLA, 2 = matematica in generale)
BLOGS = [
    ('Nick Trefethen', 'https://trefethen.net/', 'https://trefethen.net/feed/', 1),
    ('Ethan Epperly', 'https://www.ethanepperly.com/', 'https://www.ethanepperly.com/index.php/feed/', 1),
    ('Tamara Kolda', 'https://www.mathsci.ai/', 'https://www.mathsci.ai/post/index.xml', 1),
    ('Gabriel Peyré', 'https://www.gpeyre.com/blog/', 'https://www.gpeyre.com/blog/rss.xml', 1),
    ('Francis Bach', 'https://francisbach.com/', 'https://francisbach.com/feed/', 1),
    ('Nicolas Boumal', 'https://www.racetothebottom.xyz/', 'https://www.racetothebottom.xyz/index.xml', 1),
    ('Fredrik Johansson', 'https://fredrikj.net/blog/', 'https://fredrikj.net/blog/rss.xml', 2),
    ('Terence Tao', 'https://terrytao.wordpress.com/', 'https://terrytao.wordpress.com/feed/', 2),
    ('John D. Cook', 'https://www.johndcook.com/blog/', 'https://www.johndcook.com/blog/feed/', 2),
    ('Ben Recht', 'https://www.argmin.net/', 'https://www.argmin.net/feed', 2),
]
PER_BLOG = 3
OLD = {}   # il radar.json di ieri, per le fonti che oggi non rispondono

# parole che rendono un preprint di math.NA (o un evento) "di algebra lineare numerica"
NLA = re.compile(r'\b(matri(x|ces)|eigen\w*|singular value|svd|krylov|lanczos|arnoldi|gmres|conjugate gradient|'
                 r'precondition\w*|low[- ]rank|rank[- ]revealing|linear (system|algebra|solver)s?|least[- ]squares|'
                 r'tensor\w*|nystr\w*|sketch\w*|randomi[sz]ed (numerical )?linear|qr |lu |cholesky|'
                 r'lyapunov|sylvester|riccati|toeplitz|hierarchical matri\w*|trace estimat\w*|'
                 r'nla\b|householder|pseudospectr\w*|iterative (method|solver)s?|multigrid)', re.I)


def get(url, timeout=40):
    for i, ua in enumerate(UAS):
        req = urllib.request.Request(url, headers={'User-Agent': ua, 'Accept': '*/*'})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (403, 406) or i == len(UAS) - 1:
                raise


def text(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()


def fix(s):
    # alcune pagine arrivano con l'UTF-8 codificato due volte ("MiÄ™dlar")
    try:
        return s.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s


def date_of(s):
    if not s:
        return ''
    try:
        return email.utils.parsedate_to_datetime(s).date().isoformat()
    except (TypeError, ValueError):
        pass
    m = re.match(r'\d{4}-\d{2}-\d{2}', s)
    return m.group(0) if m else ''


# accenti LaTeX -> caratteri combinanti (acuto, grave, circonflesso, dieresi, tilde, cediglia, caron, ...)
ACCENTS = {"'": '\u0301', '`': '\u0300', '^': '\u0302', '"': '\u0308', '~': '\u0303', 'c': '\u0327',
           'v': '\u030c', 'H': '\u030b', '=': '\u0304', '.': '\u0307', 'u': '\u0306', 'k': '\u0328'}
LETTERS = {'l': 'ł', 'L': 'Ł', 'o': 'ø', 'O': 'Ø', 'ss': 'ß', 'ae': 'æ', 'aa': 'å', 'i': 'ı'}
SPECIAL = re.compile(r'\\(l|L|o|O|ss|ae|aa|i)(?![A-Za-z])\s*')
ACCENT = re.compile(r'\\([\'`^"~=.]|[cvHuk](?=[{ ]))\s*\{?([A-Za-z])\}?')


def untex(s):
    # nomi degli autori di arXiv: Micha{\l} -> Michał, J\"org -> Jörg, Fran\c{c}ois -> François
    s = SPECIAL.sub(lambda m: LETTERS[m.group(1)], s)
    s = ACCENT.sub(lambda m: m.group(2) + ACCENTS[m.group(1)], s)
    return unicodedata.normalize('NFC', s.replace('{', '').replace('}', ''))


def first_url(s):
    m = re.search(r'https?://[^\s<>"\')\]]+', s or '')
    return m.group(0).rstrip('.,;') if m else ''


def rss_items(raw):
    root = ET.fromstring(raw)
    atom = '{http://www.w3.org/2005/Atom}'
    out = []
    for it in root.iter('item'):
        out.append({'title': text(it.findtext('title')), 'url': (it.findtext('link') or '').strip(),
                    'date': date_of(it.findtext('pubDate')), 'description': it.findtext('description') or '',
                    'creator': it.findtext('{http://purl.org/dc/elements/1.1/}creator') or ''})
    for it in root.iter(atom + 'entry'):
        link = it.find(atom + 'link')
        out.append({'title': text(it.findtext(atom + 'title')), 'url': link.get('href') if link is not None else '',
                    'date': date_of(it.findtext(atom + 'published') or it.findtext(atom + 'updated')),
                    'description': it.findtext(atom + 'summary') or '', 'creator': ''})
    return out


# ------------------------------------------------------------------ fonti

def arxiv():
    items = []
    for it in rss_items(get('https://rss.arxiv.org/rss/math.NA')):
        d = it['description']
        kind = re.search(r'Announce Type:\s*(\w+)', d)
        if kind and kind.group(1) not in ('new', 'cross'):
            continue                                    # le nuove versioni di vecchi lavori no
        abstract = text(re.sub(r'^.*?Abstract:', '', d, flags=re.S))
        if not NLA.search(it['title'] + ' ' + abstract):
            continue
        authors = [untex(a.strip()) for a in text(it['creator']).split(',') if a.strip()]
        items.append({'title': it['title'], 'url': it['url'], 'date': it['date'],
                      'authors': authors[:4] + (['et al.'] if len(authors) > 4 else [])})
    return items


def blogs():
    out = []
    for name, home, feed, tier in BLOGS:
        try:
            posts = [p for p in rss_items(get(feed)) if p['title']]
        except Exception as e:                           # un blog giù non ferma gli altri: restano i post di ieri
            print('  blog', name, 'failed:', e)
            out += [p for p in OLD.get('blogs', []) if p.get('source') == name]
            continue
        posts.sort(key=lambda p: p['date'], reverse=True)
        for p in posts[:PER_BLOG]:
            out.append({'source': name, 'home': home, 'title': p['title'], 'url': p['url'], 'date': p['date'], 'tier': tier})
    out.sort(key=lambda p: p['date'], reverse=True)
    return out


def townsend():
    # niente feed per gli essay: si legge la pagina (data, titolo, rivista, link)
    s = get('https://alextownsend.net/essays/').decode('utf-8', 'replace')
    s = s[s.find('<main'):] if '<main' in s else s
    out = []
    for block in re.findall(r'<article.*?</article>', s, flags=re.S):
        t = [x for x in (text(x) for x in re.split(r'<[^>]+>', block)) if x and x != '↗']
        url = re.search(r'href="([^"]+)"', block)
        date = next((x for x in t if re.match(r'(January|February|March|April|May|June|July|August|September|'
                                                r'October|November|December)( \d{1,2},)? \d{4}$', x)), '')
        if not url or not date:
            continue
        try:
            iso = dt.datetime.strptime(date, '%B %d, %Y').date().isoformat()
        except ValueError:
            iso = dt.datetime.strptime(date, '%B %Y').date().isoformat()
        i = t.index(date)
        title = t[i + 1] if i + 1 < len(t) else ''
        href = url.group(1)
        if href.startswith('/'):
            href = 'https://alextownsend.net' + href
        out.append({'source': 'Alex Townsend', 'home': 'https://alextownsend.net/essays/', 'title': title,
                    'url': href, 'date': iso, 'venue': t[i - 1] if i > 0 else '', 'tier': 1})
    out.sort(key=lambda p: p['date'], reverse=True)
    return out[:PER_BLOG]


def digest():
    base = 'https://na-digest.coecis.cornell.edu/na-digest-html/'
    idx = get(base).decode('utf-8', 'replace')
    m = re.search(r'href="(\d\d/v\d+n\d+\.html)"[^>]*>\s*Digest for ([^<]+)', idx)
    url = base + m.group(1)
    page = get(url).decode('utf-8', 'replace')
    t = [x for x in (text(x) for x in re.split(r'<[^>]+>', page)) if x]
    i = t.index("Today's Topics:") if "Today's Topics:" in t else -1
    topics = []
    for x in t[i + 1:]:
        if x.startswith('See this issue') or x.startswith('---'):
            break
        topics.append(fix(x))
    vol = re.search(r'Volume (\d+) : Issue (\d+)', ' '.join(t))
    return {'url': url, 'date': m.group(2).strip(), 'issue': 'Vol. %s, issue %s' % vol.groups() if vol else '',
            'topics': topics}


# liste della comunità: annunci di linear algebra (ILAS-NET) e del gruppo di Pisa (NumPi)
COMMUNITY = [
    ('ILAS-NET', 'https://ilasic.org/ilas-net/', 'https://us10.campaign-archive.com/feed?u=6f8674f5d780d2dc591d397c9&id=dbda1af1a5', 6),
    ('NumPi Pisa', 'https://numpi.dm.unipi.it/', 'https://numpi.dm.unipi.it/feed/', 3),
]


def community():
    out = []
    for name, home, feed, n in COMMUNITY:
        posts = sorted((p for p in rss_items(get(feed)) if p['title']), key=lambda p: p['date'], reverse=True)
        out += [{'source': name, 'home': home, 'title': p['title'], 'url': p['url'], 'date': p['date']} for p in posts[:n]]
    return out


MONTH = {m: i + 1 for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'])}
DATE = re.compile(r'(?:(\d{1,2})(?:st|nd|rd|th)?\s+([A-Z][a-z]{2,8})\.?,?\s+(20\d\d))|'
                  r'(?:([A-Z][a-z]{2,8})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d\d))|(20\d\d-\d\d-\d\d)')
KINDS = [('minisymposium', r'minisymposi|mini-symposi|special session|invited session'),
         ('grants', r'travel|grant|funding|financial support|student support|award|fellowship|bursar'),
         ('registration', r'registration|register'),
         ('contributed', r'abstract|contributed|talk|poster|submission|paper|call for')]


def kind_of(s):
    for k, rx in KINDS:
        if re.search(rx, s, re.I):
            return k
    return 'other'


def iso(m):
    try:
        if m.group(7):
            return m.group(7)
        d, mon, y = (m.group(1), m.group(2), m.group(3)) if m.group(1) else (m.group(5), m.group(4), m.group(6))
        return dt.date(int(y), MONTH[mon[:3].lower()], int(d)).isoformat()
    except (KeyError, ValueError):
        return ''


def deadlines_in(text_, before):
    # le scadenze scritte negli annunci: una data preceduta (nella stessa frase) da "deadline", "due", "by", ...
    out = []
    for sent in re.split(r'(?<=[.!?\n])\s+', text_):
        if not re.search(r'deadline|due|by |until|before|open', sent, re.I):
            continue
        for m in DATE.finditer(sent):
            d = iso(m)
            if d and TODAY <= d < before:
                label = re.sub(r'\s+', ' ', sent).strip()[:140]
                out.append({'type': kind_of(sent[:m.start()] or sent), 'label': label, 'date': d})
    return out


def short_names(s):
    # sigle come "PASC27", "OES 2027", "M2P 2027": servono ad agganciare gli avvisi di scadenza al loro evento
    return {x.replace(' ', '').lower() for x in re.findall(r'\b[A-Z][A-Za-z0-9]*[A-Z0-9][A-Za-z]*\s?(?:20)?\d\d\b', s)}


def events():
    d = json.loads(get('https://na-digest.coecis.cornell.edu/load-events.php'))
    out, notices = [], []
    for e in d['events']:
        start = e.get('start') or ''
        end = e.get('end') or start
        if end > start:                                # il calendario del Digest ha la fine esclusiva
            end = (dt.date.fromisoformat(end[:10]) - dt.timedelta(days=1)).isoformat()
        if end < TODAY or e.get('category') not in ('conference', 'workshop', 'course', 'other'):
            continue
        title = fix(e.get('title', ''))
        desc = fix(e.get('description', ''))
        if re.match(r'(call for|extended deadline)', title, re.I) or 'deadline' in title.lower():
            # un avviso di scadenza: la data dell'avviso è la scadenza, l'evento vero è a parte
            notices.append({'names': short_names(title), 'type': kind_of(title), 'label': title, 'date': start,
                            'url': first_url(desc)})
            continue
        out.append({'title': title, 'start': start, 'end': end, 'category': e.get('category'),
                    'url': first_url(desc), 'nla': bool(NLA.search(title + ' ' + desc)),
                    'names': short_names(title), 'deadlines': deadlines_in(desc, start)})
    for n in notices:
        for e in out:
            if n['names'] & e['names'] and n['date'] < e['start'] and all(x['date'] != n['date'] for x in e['deadlines']):
                e['deadlines'].append({'type': n['type'], 'label': n['label'], 'date': n['date'], 'url': n['url']})
    # lo stesso evento annunciato due volte (per esempio una volta con la data sola): resta il più lungo
    out.sort(key=lambda e: (e['start'], e['end']))
    keep = []
    for e in sorted(out, key=lambda e: e['end'] + e['start'], reverse=True):
        if not any(e['names'] & k['names'] and e['nla'] == k['nla'] for k in keep if e['names']):
            keep.append(e)
    for e in keep:
        e.pop('names')
        seen, uniq = set(), []
        for x in sorted(e['deadlines'], key=lambda x: x['date']):
            if (x['date'], x['type']) not in seen:
                seen.add((x['date'], x['type']))
                uniq.append(x)
        e['deadlines'] = uniq
    keep.sort(key=lambda e: e['start'])
    return keep


def conferences(evts):
    # l'elenco curato (radar/conferences.json, date e scadenze verificate sui siti ufficiali) più gli eventi NLA
    # del Digest che non ci sono già; solo quelli curati hanno le coordinate per la mappa
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'conferences.json')
    try:
        curated = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError):
        curated = []
    out = []
    for c in curated:
        end = c.get('end') or c.get('start')
        ahead = [x for x in c.get('deadlines', []) if x.get('date', '') >= TODAY]
        if end >= TODAY or ahead:
            out.append(dict(c, source='curated'))
    known = set()
    for c in out:
        known |= short_names(c.get('name', '') + ' ' + c.get('short', ''))
    starts = {c['start'] for c in out}
    for e in evts:
        # già nell'elenco curato: stessa sigla, oppure stesso giorno di inizio (il Digest usa spesso un altro nome)
        if e['nla'] and not (short_names(e['title']) & known) and e['start'] not in starts:
            out.append({'name': e['title'], 'short': e['title'][:24], 'url': e['url'], 'start': e['start'],
                        'end': e['end'], 'deadlines': e['deadlines'], 'source': 'NA Digest'})
    out.sort(key=lambda c: c['start'])
    return out


def jobs():
    s = get('https://na-digest.coecis.cornell.edu/jobs.php').decode('utf-8', 'replace')
    out = []
    parts = re.split(r'class="category-heading">([^<]*)</h3>', s)
    for kind, block in zip(parts[1::2], parts[2::2]):
        for li in re.findall(r'<li class="job-item"(.*?)</li>', block, flags=re.S):
            subj = re.search(r'data-subject="([^"]*)"', li)
            msg = re.search(r'data-message="([^"]*)"', li, flags=re.S)
            dl = re.search(r'data-deadline="([^"]*)"', li)
            deadline = ''
            if dl and dl.group(1).strip():
                try:
                    deadline = dt.datetime.strptime(dl.group(1).strip(), '%B %d, %Y').date().isoformat()
                except ValueError:
                    deadline = ''
            if deadline and deadline < TODAY:
                continue
            out.append({'title': fix(html.unescape(subj.group(1))) if subj else '', 'kind': kind.replace(' Positions', '').strip(),
                        'deadline': deadline, 'url': first_url(html.unescape(msg.group(1))) if msg else ''})
    return out


def classics():
    # archivi di chi non scrive più: i "What Is" di Nick Higham e i post di Cleve Moler
    out = []
    s = get('https://nhigham.com/index-of-what-is-articles/').decode('utf-8', 'replace')
    seen = set()
    for url, title in re.findall(r'<a [^>]*href="(https://nhigham\.com/\d{4}/\d\d/\d\d/what-is[^"]*)"[^>]*>(.*?)</a>', s, flags=re.S):
        if url not in seen:
            seen.add(url)
            out.append({'source': 'Nick Higham', 'title': text(title), 'url': url, 'date': url.split('/')[3]})
    for page in range(1, 6):
        try:
            posts = json.loads(get('https://blogs.mathworks.com/cleve/wp-json/wp/v2/posts?per_page=100&page=%d'
                                   '&_fields=date,title,link' % page))
        except Exception:
            break
        if not posts:
            break
        for p in posts:
            out.append({'source': 'Cleve Moler', 'title': text(p['title']['rendered']), 'url': p['link'],
                        'date': p['date'][:4]})
    return out


# ------------------------------------------------------------------ main

def main():
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'radar.json')
    old_path = sys.argv[2] if len(sys.argv) > 2 else dest
    try:
        old = json.load(open(old_path, encoding='utf-8'))
    except (OSError, ValueError):
        old = {}
    OLD.update(old)
    data = {'updated': NOW.isoformat(timespec='minutes')}
    for key, fn in [('arxiv', arxiv), ('blogs', blogs), ('townsend', townsend), ('digest', digest), ('community', community),
                    ('events', events), ('jobs', jobs), ('classics', classics)]:
        try:
            data[key] = fn()
            print('%-9s ok %s' % (key, len(data[key])))
        except Exception as e:
            data[key] = old.get(key, [] if key != 'digest' else {})
            print('%-9s FAILED (%s), kept yesterday\'s' % (key, e))
    data['conferences'] = conferences(data.get('events', []))
    # gli essay di Townsend stanno con i blog
    data['blogs'] = sorted(data['blogs'] + data.pop('townsend'), key=lambda p: p['date'], reverse=True)
    os.makedirs(os.path.dirname(os.path.abspath(dest)), exist_ok=True)
    with open(dest, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print('->', dest, os.path.getsize(dest), 'bytes')


if __name__ == '__main__':
    main()
