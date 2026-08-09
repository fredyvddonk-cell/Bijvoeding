Bijvoeding Voorraad 2.7.2 - PWA

Bestanden die de PWA mogelijk maken:
- manifest.webmanifest
- service-worker.js
- icon-192.png
- icon-512.png

Gebruik:
1. Vervang de bestanden in je huidige VS Code/GitHub projectmap door de inhoud van deze map.
2. Commit en push naar GitHub.
3. Wacht tot GitHub Pages de wijziging heeft gepubliceerd.
4. Open de website op je telefoon.
5. Kies in de browser voor Installeren / Toevoegen aan startscherm.

De service worker gebruikt 'network first': bij internet probeert de app eerst de nieuwste versie op te halen. Bij geen verbinding gebruikt hij de lokaal opgeslagen bestanden.
