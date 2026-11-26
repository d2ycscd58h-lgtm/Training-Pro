# Datenbank der Website

Stand: 26. November 2026

meintrainingstagebuch.com hat bei DolphinPage eine eigene Datenbank. Diese Datei erklärt, was sie kann, was schon eingerichtet ist und wie man sie in `app.html` oder `index.html` einbaut. Sie ist für Menschen und für KI-Agenten gedacht, die an diesem Repository arbeiten. Markdown-Dateien werden nicht mit der Website veröffentlicht.

## Das Wichtigste in Kürze

- Die Datenbank gehört nur dieser Website. Keine andere Website kann sie lesen oder beschreiben.
- Sie ist unter derselben Adresse wie die Website erreichbar: `/_data/<sammlung>`. Es braucht kein Konto und keine Bibliothek, nur `fetch`.
- Sie besteht aus **Sammlungen** mit **Einträgen**. Ein Eintrag ist ein JSON-Objekt.
- Es gibt zwei Arten von Sammlungen:
  - **Gemeinsame Sammlungen** haben zwei Regeln, lesen und hinzufügen, jeweils `public` (die Seiten dieser Website, also alle Besucher) oder `owner` (nur der Inhaber im DolphinPage-Dashboard). Seiten können dort lesen und hinzufügen, aber nie ändern oder löschen.
  - **Private Sammlungen** (Regel `user`) halten für jede Person eigene Einträge. Die App erzeugt für die Person einen Schlüssel, der auf ihrem Gerät bleibt. Nur wer den Schlüssel hat, kann diese Einträge lesen, ändern und löschen. Andere Nutzer können es nicht, und der Inhaber im Dashboard auch nicht.

## Was schon eingerichtet ist

| Sammlung | Art | Wofür |
| --- | --- | --- |
| `feedback` | gemeinsam: lesen `owner`, hinzufügen `public`, Felder `message`, `name`, `appVersion`, `lang` | Rückmeldungen aus der App. Der Inhaber liest sie im DolphinPage-Dashboard unter „Gespeicherte Einträge“. Die App selbst kann sie nicht lesen. |
| `diary` | privat: Regel `user` | Die Trainingsdaten einer Person, damit sie auf mehreren Geräten dieselben sind. |

Beide Sammlungen sind leer und werden noch von keiner Seite benutzt.

## Schnittstelle

### Gemeinsame Sammlung: Eintrag hinzufügen

```
POST /_data/feedback
Content-Type: application/json

{"message":"Bitte Supersätze ergänzen","name":"Alex","appVersion":"27","lang":"de"}
```

Antwort `201`: `{"id":"01a2175a-6c49-7d3e-9f0a-3b1c5d7e9f10","createdAt":1795689037001}`

- Ein flaches Objekt: Werte sind Text, Zahl, `true`, `false` oder `null`. Nur die Felder der Sammlung, mindestens eines davon. Als JSON höchstens 4 KB.
- Eine gemeinsame Sammlung fasst bis zu 20.000 Einträge.

### Gemeinsame Sammlung: Einträge lesen (nur bei lesen `public`)

```
GET /_data/<sammlung>?limit=50
GET /_data/<sammlung>/<id>
```

Antwort `200`, neueste zuerst: `{"records":[{"id":"…","data":{…},"createdAt":1795689037001,"updatedAt":1795689037001}],"next":null}`

`limit` geht von 1 bis 100. `order=asc` liefert die ältesten zuerst, `cursor=<next>` die nächste Seite.

### Private Sammlung: die Einträge einer Person

Jeder Aufruf trägt den Schlüssel der Person in der Kopfzeile `Authorization: Bearer <schlüssel>`. Der Schlüssel hat 32 bis 128 Zeichen aus `A–Z a–z 0–9 - _`. DolphinPage speichert ihn nicht, sondern nur seinen Fingerabdruck (SHA-256), unter dem die Einträge liegen.

```
PUT    /_data/diary/<id>      speichert den Eintrag mit dieser Kennung (neu oder erneut)
GET    /_data/diary/<id>      liest ihn
GET    /_data/diary           listet die Einträge der Person, nach Kennung sortiert
DELETE /_data/diary/<id>      löscht einen Eintrag
DELETE /_data/diary           löscht alles, was unter diesem Schlüssel liegt
```

- Der Eintrag ist ein JSON-Objekt beliebiger Form, als JSON höchstens 256 KB. `PUT` antwortet mit `{"id":"2026-11","createdAt":…,"updatedAt":…}`.
- Kennungen haben 1 bis 64 Zeichen aus `A–Z a–z 0–9 - _`.
- Unter einem Schlüssel liegen höchstens 200 Einträge und zusammen höchstens 4 MB. **Deshalb ein Eintrag je Monat, nicht je Tag.**
- `GET /_data/diary?limit=20` liefert `{"records":[{"id","data","createdAt","updatedAt"}],"next":…}`. `limit` geht von 1 bis 50, `cursor=<next>` holt die nächste Seite, `since=<updatedAt>` nur, was sich danach geändert hat.
- **Schutz vor dem Überschreiben:** `PUT` mit der Kopfzeile `If-Match: <updatedAt der zuletzt gelesenen Fassung>` (oder `0` für einen neuen Eintrag) wird mit `412` abgelehnt, wenn ein anderes Gerät inzwischen gespeichert hat. Dann den Eintrag neu lesen, zusammenführen und noch einmal speichern.

### Für alle Aufrufe

- Speichern und Löschen müssen von einer Seite unter `https://meintrainingstagebuch.com` kommen. Der Browser schickt die Herkunft selbst mit.
- Höchstens 20 Speichervorgänge pro Minute von einer Netzwerkadresse. Änderungen deshalb sammeln und zum Beispiel erst 30 Sekunden nach der letzten Eingabe speichern.

| Status | Bedeutung | Was die App tun sollte |
| --- | --- | --- |
| `200` / `201` | gelesen oder gespeichert | weiter |
| `400` | Eintrag oder Kennung passt nicht | Fehler im Code beheben |
| `401` | Schlüssel fehlt oder hat die falsche Form (`code: data_key`) | Schlüssel mitsenden |
| `403` | Aufruf kam nicht von dieser Website | nur unter meintrainingstagebuch.com aufrufen |
| `404` | Sammlung oder Eintrag gibt es nicht, oder die Sammlung ist für Seiten geschlossen | Namen prüfen; bei privaten Einträgen: noch nichts gespeichert |
| `409` | kein Platz mehr (`code: data_full`) | ältere Einträge zusammenfassen, dem Inhaber Bescheid geben |
| `412` | ein anderes Gerät hat inzwischen gespeichert (`code: data_changed`) | neu lesen, zusammenführen, erneut speichern |
| `413` | Eintrag ist zu groß | aufteilen |
| `415` | `Content-Type: application/json` fehlt | Kopfzeile setzen |
| `429` | zu viele Speichervorgänge in kurzer Zeit | später noch einmal versuchen |
| `503` | Datenbank gerade nicht erreichbar | ohne sie weitermachen, später noch einmal versuchen |

Fehler kommen als JSON, zum Beispiel `{"error":"Not found."}`. Die App muss immer auch ohne Datenbank laufen: offline, bei `503` und unter der alten GitHub-Adresse.

## Baustein für `app.html`

Der Baustein passt zum Stil von `app.html` (ein Skript, keine Module). `lsGet`, `lsSet`, `PREF` und `LANG` gibt es dort schon. Er ist getestet: Rückmeldung senden, auf einem zweiten Gerät mit demselben Schlüssel lesen, gleichzeitiges Speichern auf zwei Geräten und Löschen.

```js
/* ================= Datenbank der Website (DolphinPage) ================= */
// Erreichbar nur unter meintrainingstagebuch.com, unter derselben Adresse wie die App.
// Unter der alten GitHub-Adresse und ohne Netz gibt es sie nicht: dann leise darauf verzichten.
const DB = {
  ready: () => location.hostname.replace(/^www\./, '') === 'meintrainingstagebuch.com' && navigator.onLine,
  // Ein Aufruf. token: Schlüssel für private Einträge, body: der Eintrag, base: zuletzt gelesene Fassung (If-Match).
  // Wirft bei jeder Antwort, die nicht in Ordnung ist, einen Fehler mit .status.
  async call(method, path, { token, body, base } = {}) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (base !== undefined) headers['If-Match'] = String(base);
    const r = await fetch('/_data/' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    if (!r.ok) throw Object.assign(new Error('Datenbank ' + r.status), { status: r.status });
    return r.json();
  }
};
```

### Beispiel 1: Rückmeldung senden (Sammlung `feedback`)

```js
// Schickt eine Rückmeldung. Gibt true zurück, wenn sie gespeichert wurde.
async function sendFeedback(text) {
  const message = String(text || '').trim().slice(0, 2000);
  if (!message || !DB.ready()) return false;
  try {
    await DB.call('POST', 'feedback', { body: { message, name: PREF.name || '', appVersion: '27', lang: LANG } });
    return true;
  } catch (e) {
    return false;   // 429: zu viele Einträge, 503: gerade nicht erreichbar. Den Text behalten und später anbieten.
  }
}
```

### Beispiel 2: Trainingsdaten zwischen Geräten abgleichen (Sammlung `diary`)

So ist es gedacht:

- Die Person schaltet den Abgleich in den Einstellungen ein. Die App erzeugt einen **Abgleich-Schlüssel** und zeigt ihn an (zum Kopieren und als QR-Code). Auf dem zweiten Gerät gibt die Person denselben Schlüssel ein.
- Die Daten werden **auf dem Gerät verschlüsselt**, bevor sie gesendet werden. Aus dem Abgleich-Schlüssel entstehen zwei Schlüssel: einer zum Anmelden, der gesendet wird, und einer zum Verschlüsseln, der das Gerät nie verlässt. DolphinPage speichert damit nur unlesbare Daten.
- Gespeichert wird ein Eintrag je Monat (`2026-11`) mit den Trainingstagen dieses Monats, dazu ein Eintrag `settings`.
- Die App bleibt die Quelle: Alles liegt weiter lokal (`tt_cache`). Der Abgleich läuft zusätzlich, wenn Netz da ist.

```js
/* ================= Abgleich zwischen Geräten (private Sammlung „diary“) ================= */
// Verschlüsselung im Browser (Web Crypto). Text <-> Bytes in der Schreibweise des Abgleich-Schlüssels (Base64 mit - und _).
const Vault = {
  text(bytes) { bytes = new Uint8Array(bytes); let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  bytes(text) { return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); },
  // Aus dem Abgleich-Schlüssel: token (wird als Bearer gesendet) und secret (verschlüsselt, bleibt auf dem Gerät).
  async keys(master) {
    const base = await crypto.subtle.importKey('raw', Vault.bytes(master), 'HKDF', false, ['deriveBits', 'deriveKey']);
    const from = info => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: new TextEncoder().encode(info) });
    return {
      token: Vault.text(await crypto.subtle.deriveBits(from('trainingstagebuch anmelden v1'), base, 256)),
      secret: await crypto.subtle.deriveKey(from('trainingstagebuch daten v1'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    };
  },
  async seal(secret, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const box = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, secret, new TextEncoder().encode(JSON.stringify(data)));
    return { v: 1, iv: Vault.text(iv), box: Vault.text(box) };
  },
  async open(secret, record) {
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Vault.bytes(record.iv) }, secret, Vault.bytes(record.box))));
  }
};

const Sync = {
  // tt_sync: { key: Abgleich-Schlüssel, seen: { <id>: updatedAt der Fassung, die dieses Gerät zuletzt gelesen oder gespeichert hat } }
  state: () => lsGet('tt_sync') || { key: '', seen: {} },
  on: () => !!Sync.state().key && DB.ready(),
  // Neuer Schlüssel für diese Person: 32 zufällige Bytes. Anzeigen, kopieren lassen, als QR-Code anbieten.
  create() { const key = Vault.text(crypto.getRandomValues(new Uint8Array(32))); lsSet('tt_sync', { key, seen: {} }); Sync.ready = null; return key; },
  // Schlüssel vom anderen Gerät übernehmen. false: Eingabe ist kein gültiger Schlüssel.
  use(key) { key = String(key || '').trim(); if (!/^[A-Za-z0-9_-]{43}$/.test(key)) return false; lsSet('tt_sync', { key, seen: {} }); Sync.ready = null; return true; },
  off() { lsSet('tt_sync', null); Sync.ready = null; },
  keys() { return Sync.ready || (Sync.ready = Vault.keys(Sync.state().key)); },
  remember(id, updatedAt) { const s = Sync.state(); s.seen[id] = updatedAt; lsSet('tt_sync', s); },

  // Liest alles, was unter dem Schlüssel liegt: { settings: {…}, '2026-11': { days: {…} }, … }
  async pull() {
    const { token, secret } = await Sync.keys(), all = {};
    let cursor = '';
    do {
      const page = await DB.call('GET', 'diary?limit=20' + (cursor ? '&cursor=' + cursor : ''), { token });
      for (const r of page.records) { all[r.id] = await Vault.open(secret, r.data); Sync.remember(r.id, r.updatedAt); }
      cursor = page.next;
    } while (cursor);
    return all;
  },

  // Speichert einen Eintrag. Hat ein anderes Gerät inzwischen gespeichert, wird dessen Fassung geholt,
  // mit merge(eigene, fremde) zusammengeführt und das Ergebnis gespeichert. Gibt zurück, was jetzt gilt.
  async push(id, data, merge) {
    const { token, secret } = await Sync.keys();
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const saved = await DB.call('PUT', 'diary/' + id, { token, body: await Vault.seal(secret, data), base: Sync.state().seen[id] || 0 });
        Sync.remember(id, saved.updatedAt);
        return data;
      } catch (e) {
        if (e.status !== 412) throw e;
        let theirs;
        try { theirs = await DB.call('GET', 'diary/' + id, { token }); }
        catch (e2) { if (e2.status !== 404) throw e2; Sync.remember(id, 0); continue; }   // dort gelöscht: neu anlegen
        Sync.remember(id, theirs.updatedAt);
        data = merge(data, await Vault.open(secret, theirs.data));
      }
    }
    throw Object.assign(new Error('Abgleich nicht möglich'), { status: 412 });
  },

  // Löscht alles, was unter dem Schlüssel auf dem Server liegt. Die Daten auf dem Gerät bleiben.
  async wipe() { const { token } = await Sync.keys(); const gone = await DB.call('DELETE', 'diary', { token }); const s = Sync.state(); s.seen = {}; lsSet('tt_sync', s); return gone; }
};
```

Einbau in den vorhandenen Speicher (`Store`, `S.days`):

```js
// Die Trainingstage eines Monats als ein Eintrag: '2026-11' -> { days: { '2026-11-26': {…}, … } }
const monthOf = day => day.slice(0, 7);
const monthData = month => ({ days: Object.fromEntries(Object.entries(S.days).filter(([day]) => monthOf(day) === month)) });
// Zusammenführen zweier Fassungen eines Monats. Hier gewinnt bei demselben Tag das eigene Gerät.
// Besser: je Tag einen Änderungszeitpunkt mitführen und die jüngere Fassung nehmen.
const mergeMonth = (mine, theirs) => ({ days: Object.assign({}, theirs.days, mine.days) });

// Nach einer Änderung an einem Trainingstag (gesammelt, z. B. 30 s nach der letzten Eingabe):
async function syncDay(day) {
  if (!Sync.on()) return;
  const merged = await Sync.push(monthOf(day), monthData(monthOf(day)), mergeMonth);
  Object.assign(S.days, merged.days); Store.saveCache();
}

// Beim Start der App und wenn das Netz zurückkommt: holen, was andere Geräte gespeichert haben.
async function syncStart() {
  if (!Sync.on()) return;
  const all = await Sync.pull();
  for (const [id, data] of Object.entries(all)) if (/^\d{4}-\d{2}$/.test(id)) Object.assign(S.days, mergeMonth(monthData(id), data).days);
  Store.saveCache(); render();
}
```

`Store` kennt aus der früheren Fassung schon einen Cloud-Modus (`mode: 'cloud'`, `saveSettings()`, `saveDay()`, die Anzeige `#sync`). Der Abgleich gehört dorthin: `saveDay()` ruft `syncDay()` auf, `saveSettings()` speichert `settings` mit `Sync.push('settings', …)`, und `init()` ruft `syncStart()`.

## Vor dem Einbau erledigen

1. **Service Worker (`sw.js`), Pflicht.** Er speichert heute jede erfolgreiche Antwort der eigenen Adresse im Zwischenspeicher und liefert sie bei Fehlern wieder aus, ohne auf den Schlüssel zu achten. Private Einträge dürfen dort nie landen. Direkt nach der Zeile mit `req.method !== 'GET'` ergänzen und die Nummer in `CACHE` erhöhen:

   ```js
   // Die Datenbank immer frisch vom Netz, nie aus dem Zwischenspeicher.
   if (new URL(req.url).pathname.startsWith('/_data/')) return;
   ```

2. **Datenschutz (`datenschutz.html`), Pflicht.** Dort steht, dass die App Daten ausschließlich auf dem Gerät speichert, dass wir sie nicht erhalten und dass es kein Nutzerkonto gibt. Vor dem Freischalten ergänzen: Der Abgleich ist freiwillig; welche Daten gesendet werden; dass sie verschlüsselt bei DolphinPage (Cloudflare) liegen und ohne den Schlüssel der Person nicht lesbar sind; wie man sie löscht (in der App „Alles löschen“, das ruft `Sync.wipe()` auf). Für Rückmeldungen: welche Angaben, wozu, und wie man sie löschen lässt.

3. **Der Schlüssel ist das Konto.** Wer ihn hat, hat die Daten; wer ihn verliert, kommt an die Kopie auf dem Server nicht mehr heran, und niemand kann ihn zurücksetzen. Die lokalen Daten bleiben. Deshalb den Schlüssel in den Einstellungen anzeigen, zum Aufbewahren auffordern und das Backup der App behalten. Den Schlüssel nie in eine Adresse nach `?` schreiben; für einen QR-Code gehört er hinter `#`, wie beim Umzug der App.

4. **Alte Adresse und offline.** Eine vom Home-Bildschirm gestartete App läuft weiter unter der alten GitHub-Adresse, dort gibt es die Datenbank nicht. `DB.ready()` fängt das ab. Nichts darf davon abhängen, dass die Datenbank antwortet.

5. **Verschlüsselung braucht `https`.** `crypto.subtle` gibt es nur auf sicheren Seiten. Unter meintrainingstagebuch.com ist das erfüllt.

## Was die Datenbank nicht kann

- Kein Zurücksetzen eines verlorenen Schlüssels und keine Anmeldung mit E-Mail und Passwort.
- Keine privaten Einträge, die mehrere Personen miteinander teilen: Ein Schlüssel ist eine Person.
- In gemeinsamen Sammlungen können Seiten nichts ändern und nichts löschen. Was dort mit lesen `public` steht, kann jeder abrufen: keine Trainingsdaten, E-Mail-Adressen oder Lizenzcodes hineinschreiben.
- Keine Dateien, nur JSON-Einträge.

## Neue Sammlungen und andere Regeln

Sammlungen legt DolphinPage an, nicht der Code dieser Website. Für eine neue Sammlung oder andere Regeln eine Anfrage im DolphinPage-Dashboard stellen oder an dolph@dolphinpage.org schreiben, mit:

- dem Namen (Kleinbuchstaben, Ziffern, `-` und `_`, beginnt mit einem Buchstaben, höchstens 40 Zeichen),
- der Art: gemeinsam mit den Regeln für lesen und hinzufügen (`public` oder `owner`) und den Feldern, die eine Seite schicken darf, oder privat (`user`).

Danach diese Datei um die neue Sammlung ergänzen.
