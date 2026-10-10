# DOPE – Deltek Obsidian PDF Exporter

Esporta la nota "index" di una materia e tutte le note che collega in un unico PDF impaginato come un libro, con lo stesso nome dell'index.

## Uso

### Esportare

Apri la nota index ed esegui il comando **DOPE PDF Exporter: Esporta index in PDF**, oppure fai clic destro sulla nota → **Esporta libro in PDF**. Nel menù che si apre scegli:

- **Tema**: uno dei temi installati o quello predefinito di Obsidian;
- **Modalità**: chiara o scura (in quella scura lo sfondo copre tutta la pagina);
- **Cartella** (con **Sfoglia**) e **Nome file**.

Le scelte vengono ricordate per l'export successivo. Il tema viene applicato solo durante la stampa: le impostazioni di aspetto non vengono modificate. Durante l'export il menù mostra la fase in corso, una barra di progresso in percentuale e il tempo stimato rimanente.

### Inizializzare un nuovo index

In una nota vuota esegui **DOPE PDF Exporter: Inizializza index materia**: vengono scritti il frontmatter e tutte le sezioni dell'index di riferimento (Ricevimento, Materiale, Modalità esame, Argomenti prove, Programma del corso, Esercizi / Esercitazioni, Appunti basati su, Informazioni, Citazioni). Su una nota non vuota il comando non fa nulla.

## Struttura del PDF

1. **Copertina**: banner (campo `banner` del plugin Banners, stampato per intero, senza ritagli) e titolo dell'index.
2. **Presentazione**: le sezioni informative dell'index (Ricevimento, Materiale, Modalità esame, …).
3. **Indice**: indice da libro con numeri di pagina, cliccabile.
4. **Capitoli** del "Programma del corso", nell'ordine dell'index.
5. **Appendici**: i link isolati fuori da un elenco (es. `[[Domande Sistemi Operativi]]`).
6. **Esercitazioni**: i gruppi della sezione "Esercizi / Esercitazioni", sempre dopo i capitoli.
7. **Citazioni**: la sezione `# Citazioni` dell'index.

Il PDF ha anche i segnalibri (capitoli → note), i numeri di pagina e i link interni tra le note esportate.

## Formato dell'index

Il riferimento è `example/🐧 Sistemi Operativi`:

```markdown
<mark style="...">Programma del corso</mark>:

Capitolo 1, **"Operating Systems"**:
- [[Storia dei sistemi operativi]], [[Kernel]]
- [[SO - Architettura Monolitica|Architettura Monolitica]]

<mark style="...">Esercizi / Esercitazioni</mark>:

Processi:
- [[SO - Processi - Esercizio 1]]

[[Domande Sistemi Operativi]]

# Citazioni
> [!Quote]
> ...
```

- Le sezioni iniziano con una riga `<mark>…</mark>:` o con un titolo markdown.
- Un capitolo è una riga che termina con `:` seguita da un elenco di link. `Capitolo N, "Titolo"` diventa il capitolo N con quel titolo.
- Un alias (`[[nota|alias]]`) viene usato come titolo nell'indice.
- Una nota collegata più volte viene stampata una sola volta; le altre voci dell'indice puntano alla prima.
- I link a file PDF inseriscono le pagine di quel PDF nella stessa posizione.
- I link a note inesistenti vengono ignorati e riportati nella console.

## Compatibilità

Le note sono renderizzate da Obsidian come in modalità lettura, quindi Excalidraw, Mermaid, LaTeX (MathJax), callout, Dataview e gli altri plugin che lavorano in modalità lettura funzionano come nell'app. Durante la stampa l'app mostra per qualche secondo il tema scelto, poi torna a quello attuale.

Da Obsidian 1.14 i diagrammi Mermaid vanno abilitati per ogni vault (**Impostazioni → Editor → Mostra i diagrammi Mermaid nelle note**). Se non lo sono, il menù di export mostra un pulsante **Abilita**, e nel PDF viene stampato il codice del diagramma al posto del diagramma.

Il codice usa i colori predefiniti di Obsidian, perché alcuni temi (es. Dracula Gemini) li definiscono solo per lo sfondo scuro.

I disegni Excalidraw mantengono il tema con cui sono salvati: un disegno scuro resta scuro nel PDF.

## Impostazioni

Tema, cartella e nome si scelgono nel menù di export. Nelle impostazioni del plugin:

- **Formato pagina**: A3, A4, A5, Letter, Legal.
- **Scala di stampa**: dimensione del contenuto (predefinita 70%, come l'export nativo).
- **Ogni nota su una nuova pagina**.
- **Apri il PDF dopo l'export**.

## Sviluppo

```bash
npm install
npm run dev     # build in watch
npm run build   # type-check + build di produzione
npm test        # test del parser dell'index e del post-processing PDF
npm run lint
```

Solo desktop: usa la stampa PDF di Electron e `pdf-lib` per indice, segnalibri e unione dei PDF. Nessuna richiesta di rete.
