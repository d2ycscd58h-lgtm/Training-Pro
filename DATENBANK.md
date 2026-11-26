# Datenbank der Website

Stand: 26. November 2026

meintrainingstagebuch.com hat bei DolphinPage eine eigene Datenbank. Diese Datei erklärt, was sie kann, was schon eingerichtet ist und wie man sie in `app.html` oder `index.html` einbaut. Sie ist für Menschen und für KI-Agenten gedacht, die an diesem Repository arbeiten. Markdown-Dateien werden nicht mit der Website veröffentlicht.

## Das Wichtigste in Kürze

- Die Datenbank gehört nur dieser Website. Keine andere Website kann sie lesen oder beschreiben.
- Sie ist unter derselben Adresse wie die Website erreichbar: `/_data/<sammlung>`. Es braucht keinen Schlüssel, kein Konto und keine Bibliothek, nur `fetch`.
- Sie besteht aus **Sammlungen** mit **Einträgen**. Ein Eintrag ist ein JSON-Objekt.
- Jede Sammlung hat zwei Regeln, **lesen** und **hinzufügen**, jeweils `public` (die Seiten dieser Website, also alle Besucher) oder `owner` (nur der Inhaber im DolphinPage-Dashboard).
- Seiten können Einträge lesen und hinzufügen, aber nie ändern oder löschen.
- **Es gibt keine privaten Daten je Nutzer.** Was in einer Sammlung mit `lesen: public` steht, kann jeder abrufen. Mehr dazu unter „Was die Datenbank nicht kann“.

## Was schon eingerichtet ist

| Sammlung | lesen | hinzufügen | Felder |
| --- | --- | --- | --- |
| `feedback` | `owner` | `public` | `message`, `name`, `appVersion`, `lang` |

`feedback` ist für Rückmeldungen aus der App gedacht: Nutzer schicken einen Text, der Inhaber liest ihn im DolphinPage-Dashboard der Website unter „Gespeicherte Einträge“ und kann ihn dort löschen. Die App selbst kann die Rückmeldungen nicht lesen. Die Sammlung ist leer und wird noch von keiner Seite benutzt.

## Schnittstelle

### Eintrag hinzufügen

```
POST /_data/feedback
Content-Type: application/json

{"message":"Bitte Supersätze ergänzen","name":"Alex","appVersion":"27","lang":"de"}
```

Antwort `201`:

```json
{"id":"01a2175a-6c49-7d3e-9f0a-3b1c5d7e9f10","createdAt":1795689037001}
```

Regeln für einen Eintrag, den eine Seite schickt:

- Ein flaches Objekt: Werte sind Text, Zahl, `true`, `false` oder `null`. Keine Listen, keine verschachtelten Objekte.
- Nur die Felder der Sammlung, mindestens eines davon.
- Als JSON höchstens 4 KB.
- Der Aufruf muss von einer Seite unter `https://meintrainingstagebuch.com` kommen. Der Browser schickt die Herkunft selbst mit; von einer anderen Adresse aus wird der Eintrag abgelehnt.
- Höchstens 20 neue Einträge pro Minute von einer Netzwerkadresse.
- Eine Sammlung fasst bis zu 20.000 Einträge.

### Einträge lesen (nur bei `lesen: public`)

```
GET /_data/<sammlung>?limit=50
GET /_data/<sammlung>/<id>
```

Antwort `200`, neueste zuerst:

```json
{"records":[{"id":"…","data":{"…":"…"},"createdAt":1795689037001,"updatedAt":1795689037001}],"next":null}
```

`limit` geht von 1 bis 100 (ohne Angabe 50). `order=asc` liefert die ältesten zuerst. Steht in `next` eine Kennung, holt `cursor=<next>` die nächste Seite. `createdAt` und `updatedAt` sind Millisekunden seit 1970.

### Antworten, mit denen die App rechnen muss

| Status | Bedeutung | Was die App tun sollte |
| --- | --- | --- |
| `201` / `200` | gespeichert / gelesen | weiter |
| `400` | Eintrag passt nicht (falsches Feld, falscher Wert) | Fehler im Code beheben |
| `403` | Aufruf kam nicht von dieser Website | nur unter meintrainingstagebuch.com aufrufen |
| `404` | Sammlung gibt es nicht oder sie ist für Seiten geschlossen | Namen und Regel prüfen |
| `409` | Sammlung ist voll | dem Inhaber Bescheid geben |
| `413` | Eintrag ist zu groß | kürzen |
| `415` | `Content-Type: application/json` fehlt | Kopfzeile setzen |
| `429` | zu viele Einträge in kurzer Zeit | später noch einmal anbieten |
| `503` | Datenbank gerade nicht erreichbar | ohne sie weitermachen, später noch einmal versuchen |

Fehler kommen als JSON, zum Beispiel `{"error":"Not found."}`. Die App muss immer auch ohne Datenbank laufen: offline, bei `503` und unter der alten GitHub-Adresse.

## Beispiel: Rückmeldung aus der App senden

Der Baustein passt zum Stil von `app.html` (ein Skript, keine Module). `PREF` und `LANG` gibt es dort schon.

```js
/* ================= Datenbank der Website (DolphinPage) ================= */
// Erreichbar nur unter meintrainingstagebuch.com, unter derselben Adresse wie die App.
// Unter der alten GitHub-Adresse und ohne Netz gibt es sie nicht: dann leise darauf verzichten.
const DB = {
  ready: () => location.hostname.replace(/^www\./, '') === 'meintrainingstagebuch.com' && navigator.onLine,
  // Fügt einen Eintrag hinzu. Antwort: { id, createdAt }. Wirft bei jedem Fehler, mit .status.
  async add(collection, record) {
    const r = await fetch('/_data/' + collection, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record)
    });
    if (!r.ok) throw Object.assign(new Error('Datenbank ' + r.status), { status: r.status });
    return r.json();
  },
  // Liest eine Sammlung mit „lesen: public“. Antwort: { records: [{ id, data, createdAt }], next }.
  async list(collection, { limit = 50, cursor = '', order = '' } = {}) {
    const q = new URLSearchParams({ limit }); if (cursor) q.set('cursor', cursor); if (order) q.set('order', order);
    const r = await fetch('/_data/' + collection + '?' + q, { cache: 'no-store' });
    if (!r.ok) throw Object.assign(new Error('Datenbank ' + r.status), { status: r.status });
    return r.json();
  }
};

// Schickt eine Rückmeldung. Gibt true zurück, wenn sie gespeichert wurde.
async function sendFeedback(text) {
  const message = String(text || '').trim().slice(0, 2000);
  if (!message || !DB.ready()) return false;
  try {
    await DB.add('feedback', { message, name: PREF.name || '', appVersion: '27', lang: LANG });
    return true;
  } catch (e) {
    return false;   // 429: zu viele Einträge, 503: gerade nicht erreichbar. Den Text behalten und später anbieten.
  }
}
```

Aufruf, zum Beispiel aus einem Textfeld in den Einstellungen:

```js
const ok = await sendFeedback(document.querySelector('#feedback-text').value);
// ok === true: „Danke, deine Rückmeldung ist angekommen.“  ok === false: „Gerade nicht möglich, bitte später noch einmal.“
```

Was aus der Datenbank gelesen wird, kommt von Besuchern. Es wird als Text in die Seite gesetzt (`textContent` oder das vorhandene `esc()`), nie ungeprüft als HTML.

## Vor dem Einbau erledigen

1. **Service Worker (`sw.js`).** Er speichert heute jede erfolgreiche Antwort der eigenen Adresse und liefert sie bei Fehlern wieder aus. Für die Datenbank wäre das falsch (veraltete Einträge, fremde Seiten einer Liste). Direkt nach der Zeile mit `req.method !== 'GET'` ergänzen und die Nummer in `CACHE` erhöhen:

   ```js
   // Die Datenbank immer frisch vom Netz, nie aus dem Zwischenspeicher.
   if (new URL(req.url).pathname.startsWith('/_data/')) return;
   ```

2. **Datenschutz (`datenschutz.html`).** Dort steht, dass die App Daten ausschließlich auf dem Gerät speichert und dass wir sie nicht erhalten. Sobald die App etwas an die Datenbank schickt, muss die Erklärung das nennen: welche Angaben, wozu, dass sie bei DolphinPage (Cloudflare) gespeichert werden und wie man sie löschen lassen kann. Erst die Erklärung anpassen, dann die Funktion freischalten.

3. **Alte Adresse.** Eine vom Home-Bildschirm gestartete App läuft weiter unter der alten GitHub-Adresse. Dort gibt es die Datenbank nicht. `DB.ready()` fängt das ab; Bedienelemente, die die Datenbank brauchen, dort ausblenden.

4. **Offline.** Die App funktioniert ohne Netz. Nichts darf davon abhängen, dass die Datenbank antwortet.

## Was die Datenbank nicht kann

- **Keine privaten Daten je Nutzer.** Es gibt keine Anmeldung und keine Einträge, die nur eine bestimmte Person lesen kann. Eine Sammlung ist entweder für alle Besucher lesbar oder nur für den Inhaber.
- **Deshalb gehören Trainingsdaten, Vornamen zusammen mit Trainingsdaten, E-Mail-Adressen und Lizenzcodes nicht in eine Sammlung mit `lesen: public`.** Jeder könnte sie abrufen.
- **Kein Abgleich zwischen Geräten.** Ein Tagebuch, das auf mehreren Geräten gleich ist, braucht Einträge, die nur der jeweilige Nutzer lesen und ändern kann. Das gibt es noch nicht. Das Backup der App bleibt dafür der richtige Weg.
- Seiten können Einträge nicht ändern und nicht löschen. Der Inhaber löscht im Dashboard.
- Keine Dateien, nur JSON-Einträge.

Wofür sie sich heute eignet: Rückmeldungen und Wünsche, eine Warteliste oder Anmeldung für Neuigkeiten (`hinzufügen: public`, `lesen: owner`), eine Umfrage, und Inhalte, die ohnehin jeder sehen darf.

## Neue Sammlungen und andere Regeln

Sammlungen legt DolphinPage an, nicht der Code dieser Website. Für eine neue Sammlung oder andere Regeln eine Anfrage im DolphinPage-Dashboard stellen oder an dolph@dolphinpage.org schreiben, mit:

- dem Namen (Kleinbuchstaben, Ziffern, `-` und `_`, beginnt mit einem Buchstaben, höchstens 40 Zeichen),
- den Regeln für lesen und hinzufügen (`public` oder `owner`),
- den Feldern, die eine Seite schicken darf.

Danach diese Datei um die neue Sammlung ergänzen.
