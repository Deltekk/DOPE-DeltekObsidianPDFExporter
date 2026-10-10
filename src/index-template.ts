/** Empty list item; interpolated so editors do not strip its trailing space. */
const ITEM = '- ';

/** Empty subject index with the same sections as `example/🐧 Sistemi Operativi`. */
export const INDEX_TEMPLATE = `---
banner: "![[]]"
tags:
  - 📑Materia
banner_y: 0.5
---
<mark style="background: #BBFABBA6;">Ricevimento</mark>:
${ITEM}

<mark style="background: #FFB86CA6;">Materiale</mark>:
${ITEM}

<mark style="background: #ADCCFFA6;">Modalità esame</mark>:
${ITEM}

<mark style="background: #D2B3FFA6;">Argomenti prove</mark>:
${ITEM}

<mark style="background: #FF5582A6;">Programma del corso</mark>:

Capitolo 1, **""**:
${ITEM}


<mark style="background: #FFF3A3A6;">Esercizi / Esercitazioni</mark>:


<mark style="background: #FFF3A3A6;">Appunti basati su</mark>:
${ITEM}

<mark style="background: #FFB8EBA6;">Informazioni</mark>:

💳 CFU::
📆 Data Verbalizzazione::
🔁 Stato:: Da studiare ⏸️
🔟 Voto::
- [ ] 🎓 Lode
- [ ] 📌 Caratterizzante
- [ ] 🗑 Scartato

---

# Citazioni

`;
