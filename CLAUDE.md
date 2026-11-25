# Zasady pracy w tym repozytorium

Nad systemem pracuje równolegle kilka czatów (sesji Claude). Te zasady chronią przed tym,
żeby wchodziły sobie w drogę.

## Wersja i wydania — podbija tylko jeden czat

- **Nie zmieniaj `"version"` w `system.json`** w zwykłym PR z funkcją albo poprawką.
  W opisie PR napisz tylko „Do wydania: wymaga podbicia wersji”.
- Wersję podbija **jeden czat — ten, któremu użytkownik wprost każe wydać** („wydaj”,
  „podbij wersję”, „zrób wydanie”). Robi to tak:
  1. pobiera aktualny `main` i odczytuje z niego wersję (nie z własnej, starszej gałęzi),
  2. tworzy osobny PR, który zmienia **tylko** `version` (tytuł: `X.Y.Z: wydanie — …`, w opisie lista scalonych zmian),
  3. tuż przed scaleniem jeszcze raz sprawdza, czy `main` nie ma już tej wersji; jeśli ma — bierze następny numer.
- Numeracja: nowa funkcja → `X.Y+1.0`, same poprawki → `X.Y.Z+1`.
- Jeśli mimo to dwa wydania wezmą ten sam numer, `.github/workflows/release.yml` zakończy przebieg
  błędem „Wersja nie podbita” z listą zmienionych plików — wtedy podbij wersję osobnym PR.
