---
name: Emplacement stable de R1
description: Règle durable pour éviter la perte du workspace CitiCigars Admin R1.
---

Conserver l’application R1 directement dans le workspace racine aligné sur la véritable lignée GitHub. Ne pas recréer de worktree externe ou sous `.local`.

**Why:** les worktrees externes utilisés précédemment disparaissaient et rendaient le Preview dépendant d’un chemin éphémère.

**How to apply:** toute validation, tout lanceur d’artefact et tout Preview R1 doivent exécuter l’application depuis le répertoire stable `CitiCigarsAdmin` du workspace principal.