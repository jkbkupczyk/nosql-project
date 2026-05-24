# Projekt

## Pierwsze uruchomienie projektu

Zalecanym sposobem na uruchomienie projektu jest 

1. Wystartowanie kontenera z bazą MongoDB `podman compose up -d`
2. Wystartowanie aplikacji -> `npm start`
3. Zasilenie bazy inicjalnymi danymi np. poprzez wykonanie skryptu [init/seed.js](init/seed.js)

## Stop

```bash
podman compose down -v
```
