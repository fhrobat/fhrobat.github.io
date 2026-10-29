# Manutenzione del sito

Guida per aggiornare e mantenere https://fhrobat.github.io senza aiuto.
Il file è nel repo ma escluso dalla build (`exclude:` in `_config.yml`), quindi non finisce online.

---

## 1. Come funziona in due righe

- Sito **Jekyll 4** (tema no-style-please, molto personalizzato), repo `fhrobat/fhrobat.github.io`, branch **`master`**.
- Ogni push su `master` avvia l'Action **"Deploy Jekyll site to Pages"** (`.github/workflows/jekyll.yml`): build e pubblicazione in 1–2 minuti.
  Si controlla nella scheda *Actions* del repo. Se diventa rossa, il sito resta alla versione precedente.
- I push che toccano solo `radar/**` non ricostruiscono il sito.

## 2. Dove sta cosa

| Cosa | File |
|---|---|
| Nome, email, link (Email/GitHub/Scholar/...), foto e bio della home | `_config.yml` → `bio:` (HTML) |
| Descrizione per Google e anteprime dei link | `_config.yml` → `description:` (solo testo) |
| News in cima alla home (ne mostra 4) | `_data/news.yml` |
| Pubblicazioni, Talk, Education, Teaching, Extra | `_data/menu.yml` (HTML dentro `content: \|`) |
| Pagine singole (publications.html, talks.html, ...) | `publications.md`, `talks.md`, ... (leggono da `menu.yml`, di solito non si toccano) |
| Timeline della home | `_includes/timeline.html` (lista `<ol class="tl-data">`) |
| Animazioni dei paper | `assets/anims/*.mp4` |
| Slide in PDF | `assets/slides/` |
| Ordine dei blocchi della home | `_layouts/home.html` |
| Stile | `_sass/` (`organic.scss` = linea verticale della home) e `assets/css/main.scss` |
| Favicon | `favicon.svg`, `favicon-32.png`, `favicon.ico`, `apple-touch-icon.png` |
| Minigiochi | `_includes/{minigames,foosball,kart,mathsrun}.html`, `assets/js/games/`, `assets/games/`, `assets/kart/` |
| NLA radar | `_includes/radar*.html`, `assets/js/radar.js`, `_sass/radar.scss`, `radar/` (script + `conferences.json`) |

**Copie di lavoro.** Timeline, minigiochi, radar, cartone e animazioni hanno la versione "sorgente" in
`OneDrive/Desktop/claude/` (cartelle `timeline/`, `minigames/`, `foosball/`, `kart/`, `mathsrun/`, `radar/`, `organic/`, `site_anims/`).
Per queste parti si modifica **la copia di lavoro** e poi si copia nel sito (sezione 5). Se cambi solo il sito,
la modifica si perde alla pubblicazione successiva dalla copia di lavoro.

---

## 3. Aggiornamenti frequenti

### Aggiungere una news
In cima a `_data/news.yml` (prima la più recente):
```yaml
- date: Nov 2026
  text: 'Talk at XYZ, Oxford (<a href="assets/slides/file.pdf" target="_blank" rel="noopener">slides</a>)'
```
Usa gli apici singoli attorno a `text`. Se nel testo serve un apostrofo, scrivilo doppio (`''`) oppure usa `’`.

### Aggiungere un paper
In `_data/menu.yml`, sezione `publications`: copia un `<li>` esistente e mettilo in cima. Contiene:
- titolo in `<strong>`, autori in `<em>`, anno (+ rivista: "2026, to appear in SIMAX");
- i badge arXiv / PDF / Code / Slides (`<a class="badge" ...>`) e il bottone BibTeX;
- il BibTeX dentro `<pre class="bib-src" hidden>`.
- Animazione facoltativa: `<li class="has-anim">` + `<video class="paper-anim" src="assets/anims/Nome.mp4" ...>`. Senza video usa `<li>` semplice.

Ricordati anche di: news in `news.yml`, tappa nella timeline (sotto).

### Aggiungere un talk
Sezione `talks` di `menu.yml`, nuovo `<li>` in cima:
```html
<li>
  <strong>Titolo</strong><br>
  <em>20 Oct 2026 &emsp; Nome del seminario, Luogo, Paese</em><br>
  <span class="paper-links"><a class="badge" href="assets/slides/file.pdf" target="_blank" rel="noopener">Slides</a></span>
</li>
```
Il PDF delle slide va in `assets/slides/`. Formato date: "20 Oct 2026", trattino lungo "–" per gli intervalli, "now" per le cose in corso.

### Teaching, Education, Extra
Stesse regole: un `<li>` nella sezione giusta di `menu.yml`. Non cambiare `id:`, `url:` e `kind:` delle sezioni,
perché li usano le pagine, la timeline e la linea della home.

### Aggiungere una tappa alla timeline
In `_includes/timeline.html` (o meglio nella copia di lavoro `Desktop/claude/timeline/timeline.html`, poi copiala sopra),
un `<li>` dentro `<ol class="tl-data">`, **in ordine di data**:
```html
<li data-d="2026-11" data-k="talk"><span class="tl-when">Nov 2026</span><span class="tl-what">Talk at XYZ, Oxford</span></li>
```
- `data-d` data (`AAAA` o `AAAA-MM`), `data-to` per una durata, `data-k` tipo: `paper`, `talk`, `edu`, `prize`, `teach`, `role`, `event`.
- Facoltativi: `data-anim="assets/anims/X.mp4"` (paper), `data-map="pisa>oxford"` (viaggio; i luoghi stanno in `PLACES` nello script),
  `data-deck` (slide), `data-medal`/`data-rank`, `data-hl` (entra nella versione breve del film), `data-toon` (scena del cartone).
- Il commento in cima alla lista spiega tutti gli attributi.

### Nuova animazione Manim per un paper
Sorgenti in `Desktop/claude/site_anims/paper_anims.py`. Render:
```
manim -r 960,540 --fps 30 paper_anims.py NomeScena
```
Copia l'mp4 in `assets/anims/` (tieni il file piccolo, qualche MB al massimo).

### Bio, foto, link
In `_config.yml`: `bio:` per la home, `description:` per i motori di ricerca, `social.links` per i profili.
La foto è `hrobat.jpg` + `hrobat-300.webp` e `hrobat-600.webp`: se la cambi, rigenera tutte e tre.

---

## 4. Pubblicare una modifica

1. Clona (o aggiorna) il repo:
   ```
   git clone https://github.com/fhrobat/fhrobat.github.io.git
   ```
   oppure `git pull` se lo hai già.
2. Modifica, poi `git add` + `git commit -m "cosa hai cambiato"`.
3. **Prima di ogni push controlla che nessuno stia giocando ai minigiochi** (un deploy fa perdere la partita a chi ricarica):
   ```
   python -I minigames/players_online.py --wait
   ```
   da `Desktop/claude`. Aspetta finché non gioca nessuno, poi esce.
4. `git push` su `master`.
5. Guarda la scheda *Actions* finché il deploy diventa verde, poi ricarica il sito con Ctrl+F5.

Piccole correzioni di testo si possono fare anche dal sito di GitHub (icona della matita sul file), ma il controllo dei giocatori va fatto lo stesso.

---

## 5. Parti che si pubblicano da `Desktop/claude`

| Parte | Comando (da `Desktop/claude`) |
|---|---|
| Minigiochi (foosball, kart, Maths Run, schede) | `python -I minigames/publish.py <cartella del repo>` |
| Radar (html, js, scss, script, conferenze, workflow) | `python -I radar/publish.py <cartella del repo>` |
| Timeline | copia `timeline/timeline.html` in `_includes/timeline.html` |
| Cartone del ▶ play | copia `timeline/toon.js` in `assets/timeline/toon.js` |
| Linea della home | `organic/organic.scss` → `_sass/organic.scss`, `organic/organic.js` → `assets/js/organic.js` |

**Non copiare** `foosball.html` o `kart.html` direttamente in `_includes`: ci pensa `publish.py`, che separa il codice e lo carica solo al primo click.

Anteprime locali: ogni cartella ha `build_preview.py` (es. `python -I timeline/build_preview.py`) e una configurazione in `.claude/launch.json`.
In locale non c'è Jekyll, quindi la verifica finale si fa sul sito pubblicato.

---

## 6. Cose automatiche

- **NLA radar**: l'Action "NLA radar" (`.github/workflows/radar.yml`) gira ogni giorno alle 05:17 UTC, raccoglie arXiv, blog, NA Digest ecc. e scrive `radar.json` sul branch `radar-data`. La home lo legge da lì: **il sito non si ricostruisce**.
  Se il radar è vuoto o vecchio, guarda l'ultima esecuzione in *Actions*. Si può rilanciare a mano con *Run workflow*.
- **Convegni**: il task settimanale "nla-conferences-weekly-check" (lunedì 09:00) ricontrolla `radar/conferences.json` e scrive `radar/conferences.proposed.json` + un resoconto. Per applicarlo basta chiedere a Claude "applica le modifiche proposte ai convegni del radar", poi pubblicare con `radar/publish.py`.
- **Classifiche dei minigiochi**: Firebase Realtime Database, progetto `online-foosball`. I nomi ammessi stanno in `foosball/names.txt`.
  Dopo una modifica: `python -I foosball/build_names.py` rigenera i nomi nel gioco e `firebase-rules.json`. Le regole vanno **incollate a mano nella console Firebase** (Realtime Database → Rules → Publish).
  Punteggi falsi o di prova si cancellano dalla console (Data).
- **Statistiche visite**: GoatCounter, account `fhrobat`.

---

## 7. Trappole note

- **KaTeX gira su tutto l'HTML, script compresi.** Un `\[ ... \]`, `\( ... \)` o `$$` dentro un include o un `<script>` diventa una formula e rompe il JavaScript. In locale non si vede, quindi cercali prima del push.
- Non usare nomi di classe generici (`news`, `title`, ...) nei nuovi componenti: il CSS del sito li stila già.
- In `_sass/organic.scss` niente commenti `//`, solo `/* */`.
- Dark mode = tutta la pagina invertita con un filtro CSS. I link blu diventano arancioni ed è voluto. Le immagini che non vanno invertite hanno la classe `no-reinvert`.
- I titoli delle sezioni in `menu.yml` sono usati anche dalla timeline per aprire la sezione giusta: se ne rinomini uno, aggiorna anche `SECTIONS` in `timeline.html`.
- La build classica di Pages usa ancora Jekyll 3: se aggiungi file da escludere, mettili nella lista `exclude:` di `_config.yml`, che riscrive quella predefinita.
- Il Gemfile non ha la gem `github-pages`: la build vera è l'Action, non la build classica.

---

## 8. Cose ancora aperte

- `logo.png` (3.4 MB) non è più usato come favicon ma è ancora pubblicato. Si può togliere dopo aver controllato che nessun file lo usi.
- Pages compila due volte (build classica + Action): in *Settings → Pages* imposta *Source* su *GitHub Actions*.
- `minigames/players_online.py` controlla foosball e kart ma **non Maths Run** (`run/presence`): va aggiunto.
- Ghost "Francesco" del kart da registrare (`kart.html?record=1`).

---

## 9. Se qualcosa si rompe

1. Scheda *Actions*: se il deploy è rosso, apri il log, l'errore è quasi sempre YAML (indentazione o apici in `menu.yml`/`news.yml`).
2. Sito online ma una parte non va: apri la console del browser (F12) e cerca errori JavaScript (spesso è la trappola di KaTeX).
3. Per tornare indietro: `git revert <commit>` e push. Si annulla il commit senza perdere la storia.
