# DOPE – Deltek Obsidian PDF Exporter

Esporta la nota "index" di una materia e tutte le note che collega in un unico PDF impaginato come un libro, con lo stesso nome dell'index.

## Uso

Apri la nota index ed esegui il comando **DOPE PDF Exporter: Esporta index in PDF**, oppure fai clic destro sulla nota → **Esporta libro in PDF**. Si apre la finestra "Salva con nome": il PDF viene salvato lì, fuori dal vault.

## Struttura del PDF

1. **Copertina**: banner (`banner`, `banner_x`, `banner_y` del plugin Banners) e titolo dell'index.
2. **Presentazione**: le sezioni informative dell'index (Ricevimento, Materiale, Modalità esame, …).
3. **Indice**: indice da libro con numeri di pagina, cliccabile.
4. **Capitoli** del "Programma del corso", nell'ordine dell'index.
5. **Appendici**: i link isolati fuori da un elenco (es. `[[Domande Sistemi Operativi]]`).
6. **Esercitazioni**: i gruppi delle sezioni "Esercitazioni"/"Esercizi", sempre dopo i capitoli.
7. **Citazioni**: la sezione `# Citazioni` dell'index.

Il PDF ha anche i segnalibri (capitoli → note), i numeri di pagina e i link interni tra le note esportate.

## Formato dell'index

Il riferimento è `example/🐧 Sistemi Operativi`:

```markdown
<mark style="...">Programma del corso</mark>:

Capitolo 1, **"Operating Systems"**:
- [[Storia dei sistemi operativi]], [[Kernel]]
- [[SO - Architettura Monolitica|Architettura Monolitica]]

<mark style="...">Esercitazioni</mark>:

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

Le note sono renderizzate da Obsidian come in modalità lettura, quindi Excalidraw, Mermaid, LaTeX (MathJax), callout, Dataview e gli altri plugin che lavorano in modalità lettura funzionano come nell'app. La stampa usa sempre il tema chiaro, anche con il tema scuro attivo.

I disegni Excalidraw mantengono il tema con cui sono salvati: un disegno scuro resta scuro nel PDF.

## Impostazioni

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
