# Obsidian Workout Tracker (Hevy Style) 🏋️‍♂️

Natywna wtyczka treningowa dla Obsidian.md inspirowana aplikacją **Hevy**. Pozwala na planowanie treningów, prowadzenie aktywnej sesji treningowej na siłowni (telefon Android / iPhone / komputer), automatyczny timer odpoczynku z powiadomieniami na smartwatch oraz trwałe zapisywanie wyników w 100% czystych plikach Markdown w Twoim vaulcie.

---

## 🚀 Jak zainstalować wtyczkę w Obsidianie?

Masz do wyboru dwie niezwykle proste metody:

### Sposób 1: Przez wtyczkę BRAT (Najwygodniejsza metoda – polecana!)
Wtyczka zawiera już wstępnie skompilowany plik `main.js`, więc nie musisz nic kompilować na komputerze ani telefonie!

1. W Obsidianie wejdź w **Ustawienia** -> **Wtyczki społeczności (Community plugins)**.
2. Wyszukaj i zainstaluj wtyczkę **BRAT** (Beta Reviewers Auto-update Tester) oraz ją włącz.
3. W ustawieniach wtyczki **BRAT** kliknij przycisk **Add Beta plugin** (lub użyj skrótu `Ctrl+P` / palety poleceń: `BRAT: Add a beta plugin for testing`).
4. Wklej link do Twojego repozytorium na GitHubie, np.:
   ```text
   https://github.com/TWOJA_NAZWA/obsidian-workout-tracker
   ```
5. Kliknij **Add Plugin**. BRAT automatycznie pobierze `manifest.json`, `main.js` oraz `styles.css`.
6. Przejdź do **Ustawienia** -> **Wtyczki społeczności** i włącz suwakiem **Workout Tracker (Hevy Style)**. Gotowe!

---

### Sposób 2: Instalacja ręczna (kopiowanie plików)

Jeśli nie korzystasz z BRAT, wystarczy skopiować 3 pliki:

1. W folderze swojego vaulta przejdź do ukrytego katalogu:
   ```text
   .obsidian/plugins/
   ```
   *(Jeśli na telefonie lub komputerze nie widzisz folderu `.obsidian`, włącz pokazywanie ukrytych plików).*
2. Utwórz w nim nowy podfolder o nazwie:
   ```text
   obsidian-workout-tracker
   ```
3. Skopiuj do tego podfolderu 3 pliki z tego repozytorium:
   - `manifest.json`
   - `main.js`
   - `styles.css`
4. Uruchom ponownie Obsidian (lub przeładuj aplikację).
5. Włącz wtyczkę w **Ustawienia** -> **Wtyczki społeczności**.

---

## 🛠️ Jak skompilować wtyczkę ze źródeł (dla programistów)

Jeśli dokonasz zmian w plikach TypeScript w folderze `src/`:

1. Zainstaluj zależności:
   ```bash
   npm install
   ```
2. Zbuduj produkcyjną paczkę `main.js`:
   ```bash
   npm run build:plugin
   ```
3. Wygenerowany plik `main.js` jest od razu gotowy do wrzucenia na GitHub / do Obsidian.

---

## 📂 Struktura plików w Vaulcie (100% Markdown & Offline)

Wtyczka automatycznie tworzy i zarządza następującymi folderami w vaulcie:

```text
Twoj-Vault/
├── Workouts/
│   ├── Templates/               # Szablony treningów (np. Trening A (Góra).md)
│   ├── Exercises/               # Baza wiedzy o ćwiczeniach z techniką wykonania
│   ├── Logs/                    # Automatycznie generowane dzienniki z sesji
│   └── Body Tracker.md          # Centralna tabela z pomiarami wagi i obwodów
```

### 1. Szablon treningu (`Workouts/Templates/Trening A.md`)
```markdown
---
type: workout-template
name: Trening A (Góra ciała)
defaultRestSeconds: 90
exercises:
  - name: Wyciskanie sztangi leżąc
    sets: 3
    targetReps: 8-10
    defaultWeight: 80
  - name: Wiosłowanie hantlem
    sets: 3
    targetReps: 10-12
    defaultWeight: 32
---
# Trening A (Góra ciała)
Opis i wskazówki do rozgrzewki.
```

### 2. Notatka ćwiczenia (`Workouts/Exercises/Wyciskanie sztangi leżąc.md`)
```markdown
---
type: exercise
muscleGroup: Klatka piersiowa
secondaryMuscles: [Triceps, Przedni akton barku]
cover: "attachments/bench.png"
defaultRest: 120
---
# Wyciskanie sztangi leżąc

### Instrukcja techniczna:
1. Ściągnij łopatki i wbij stopy w podłoże.
2. Opuść sztangę do mostka.
3. Wyciskaj po lekkim łuku w górę.
```

### 3. Log z treningu (`Workouts/Logs/2026-09-13-Trening-A.md`)
```markdown
---
type: workout-log
template: "[[Workouts/Templates/Trening A|Trening A]]"
date: 2026-09-13
startTime: "18:00:00"
endTime: "18:52:30"
duration: "00:52:30"
totalVolumeKg: 4250
completedSets: 15
---
# Trening A (2026-09-13)

## [[Workouts/Exercises/Wyciskanie sztangi leżąc|Wyciskanie sztangi leżąc]]
| Seria | Poprzednio | Ciężar (kg) | Powtórzenia | Status |
|:-----:|:----------:|:-----------:|:-----------:|:------:|
| 1 | 80kg × 10 | 80.0 | 10 | ✓ |
| 2 | 82.5kg × 8 | 82.5 | 8 | ✓ |
| 3 | 82.5kg × 6 | 85.0 | 6 | ✓ |
```

---

## 📱 Najważniejsze funkcje w stylu Hevy

- **Ghost Text (Zero-Click Logging):** Poprzedni ciężar i powtórzenia pojawiają się jako delikatny placeholder w polach serii. Kliknięcie zielonego przycisku `[ ✓ ]` natychmiast zatwierdza te wartości bez konieczności wpisywania ich z klawiatury!
- **Auto-Rest Timer z Paskiem Postępu:** Po zatwierdzeniu serii automatycznie odlicza czas przerwy.
- **Powiadomienie PUSH na zegarek:** Po zakończeniu przerwy wysyłane jest powiadomienie systemowe (Android WebView Notification), które automatycznie pojawia się na sparowanym smartwatchu (Garmin, Wear OS, Amazfit itp.).
- **Dźwięk & Wibracje:** Wbudowany podwójny dzwonek (Web Audio API bez zewnętrznych plików) oraz haptyka.
- **Odporność na zamknięcie aplikacji (Android LMK):** Każda zmiana w trakcie treningu zapisywana jest natychmiast w pamięci podręcznej pluginu. Po zminimalizowaniu aplikacji lub ubiciu procesu przez telefon sesję można wznowić jednym kliknięciem bez utraty danych!
