# STEM Study Buddy

Interactive study tools and quizzes for biology, chemistry, and more. Live site: [stemstudybuddy.com](https://stemstudybuddy.com/)

## Project structure

```
index.html              Home page (subject cards)
biology.html            Biology quiz catalog
chemistry.html          Chemistry quiz catalog
quiz.html               Standard quiz player (MC, drag, fill-in)
lewis.html              Lewis dot structure practice
data/
  catalog.json          Subject layout, quiz metadata, and coming-soon entries
  biology/*.json        Biology quiz content
  chemistry/*.json      Chemistry quiz content and interactive tools
images/
  backgrounds/          Subject page background patterns (light/dark)
  favicons/             Subject icons
  biology/              Quiz images
js/
  catalog-utils.js      Shared catalog loading and card rendering
  subject.js            Subject page logic
  quiz.js               Quiz engine
  ion-quiz.js           Polyatomic ion bank, skills, and fill-in matching
  lewis.js              Lewis diagram builder and validation
  nav.js                Header, breadcrumbs, recent quizzes
  theme.js              Dark mode
  stem-text.js          Formula/subscript rendering
css/styles.css          Global styles (subject themes, dark mode)
```

## Catalog (`data/catalog.json`)

Each subject defines its own layout:

- **Biology** uses grouped `units` (each with a name and quiz list), plus an optional `comingSoon` section.
- **Chemistry** uses a flat `quizzes` list and an optional `comingSoon` section.

Catalog entries need `id`, `title`, `icon`, and `description`. Question count and types are stored on each entry (`questionCount`, `types`) so subject pages can render without fetching every quiz file.

After adding or editing quiz JSON, refresh those fields:

```bash
node scripts/sync-catalog-stats.js
```

Use `--check` in CI to fail if the catalog is stale. Entries in a subject's quiz list show **Start Quiz**; placeholders belong in `comingSoon`.

### Interactive practice entries

Tools that are not standard quizzes (e.g. Lewis dot structures) can link to a dedicated page:

```json
{
  "id": "lewis",
  "title": "Lewis Dot Structures",
  "icon": "💠",
  "description": "Build Lewis diagrams by placing bond lines and lone-pair electrons.",
  "href": "lewis.html",
  "dataFile": "lewis_structures"
}
```

- `href` — page to open instead of `quiz.html`
- `dataFile` — JSON filename (without `.json`) used to sync `itemCount`

## Adding a new quiz

1. **Create the quiz JSON** at `data/{subject}/{quiz_id}.json`
2. **Register it** in `data/catalog.json` under the subject (include unit grouping for biology)
3. **Sync catalog stats** with `node scripts/sync-catalog-stats.js`

To show a placeholder before content is ready, add a catalog entry without creating the JSON file, or move it to `comingSoon`.

## Quiz JSON format

```json
{
  "title": "My Quiz",
  "questions": [
    {
      "type": "multiple_choice",
      "prompt": { "text": "Question text here?" },
      "options": ["A", "B", "C", "D"],
      "answer": "B",
      "explanation": "Optional. Shown after answering."
    },
    {
      "type": "drag_and_drop",
      "prompt": { "text": "Prompt to categorize" },
      "categories": ["Category A", "Category B"],
      "answer": "Category A",
      "explanation": "Optional explanation."
    },
    {
      "type": "drag_sentence",
      "prompt": { "text": "Complete the sentence." },
      "sentence": ["A typical call starts with ", null, ", then ", null, "."],
      "blanks": ["dispatch", "transport"],
      "bank": ["dispatch", "transport", "billing"],
      "explanation": "Optional explanation."
    },
    {
      "type": "fill_in",
      "prompt": { "text": "What is the charge of sulfate?" },
      "answers": ["2-", "-2"],
      "answer": "²⁻",
      "explanation": "Optional explanation."
    }
  ]
}
```

### Question fields

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | `"multiple_choice"`, `"drag_and_drop"`, `"drug_worksheet"`, `"drag_sentence"`, `"fill_in"`, or `"net_ionic"` |
| `prompt.text` | One of text/image | Question text |
| `prompt.image` | One of text/image | Path to image (e.g. `images/biology/mitosis/prophase.png`) |
| `options` | MC only | Array of answer choices (shuffled at runtime) |
| `categories` | Drag only | Drop zone labels |
| `sentence` | Drag sentence only | Array of strings and `null` blanks |
| `blanks` | Drag sentence only | Correct words in blank order |
| `bank` | Drag sentence / net ionic | Draggable words (may include distractors; shuffled at runtime) |
| `reaction` | Net ionic only | `true` if a reaction occurs |
| `reactants` / `products` | Net ionic only | Term objects `{ "species": "Ag⁺", "coeff": 1 }` (coeff optional, default 1) |
| `answers` | Fill-in only | Accepted typed answers (normalized at runtime) |
| `answer` | MC / drag / fill-in | Correct option, category, or display answer |
| `explanation` | No | Teaching note shown after each answer |

### Optional top-level fields

- `categories` — shared drop zones for all drag questions in a quiz (alternative to per-question `categories`)
- `disclaimer` — note shown on the mode screen and quiz footer (for example a course-table caveat)
- `referenceTable` — optional table shown on each question, with a hide/show toggle (`title`, `note`, `columns`, `rows[].cells`)

## Polyatomic ions

Data lives at `data/chemistry/polyatomic_ions.json`. The quiz is an **ion bank** plus a skill picker rather than a static `questions` array. Students choose Practice or Exam and one or more drills:

- Given the name, write the formula (`SO4` and `SO₄` both count)
- Given the formula, pick the name
- Given the name, write the charge (`2-`, `-2`, and `²⁻` all count)
- Given the formula, write the charge

Selecting every drill is the mixed quiz. Each selected skill produces one question per ion.

```json
{
  "title": "Polyatomic Ions",
  "skills": [
    {
      "id": "name_to_formula",
      "label": "Given the name, write the formula",
      "examplePrompt": "sulfate",
      "exampleAnswer": "SO₄"
    }
  ],
  "ions": [
    {
      "name": "sulfate",
      "formula": "SO4",
      "formulaDisplay": "SO₄",
      "charges": ["2-", "-2"],
      "explanation": "Sulfate is SO₄²⁻. Sulfite is SO₃²⁻."
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `formula` | ASCII formula used for typed matching |
| `formulaDisplay` | Unicode formula shown in prompts and feedback |
| `charges` | Accepted typed charge strings (same variants as the original study script) |
| `examplePrompt` / `exampleAnswer` | Optional pair shown on the skill picker as **Shown** and **Answer** |

URL parameters: `quiz.html?quiz=chemistry/polyatomic_ions&mode=practice&skills=name_to_charge,formula_to_name`

Catalog stats for ion-bank quizzes use the ion count (`questionCount: 18`). After editing the ion list, run `node scripts/sync-catalog-stats.js`.

```bash
node ci/test-ion-quiz.js
```

## Lewis dot structures

Data lives at `data/chemistry/lewis_structures.json`. Each molecule defines atoms, bonds, lone-pair counts, and optional resonance variants.

```json
{
  "title": "Lewis Dot Structures",
  "molecules": [
    {
      "id": "co2",
      "name": "Carbon dioxide",
      "formula": "CO₂",
      "layout": "linear",
      "atoms": [
        { "id": "o1", "symbol": "O" },
        { "id": "c", "symbol": "C" },
        { "id": "o2", "symbol": "O" }
      ],
      "answer": {
        "bonds": { "0-1": 2, "1-2": 2 },
        "loneDots": { "o1": 4, "o2": 4 }
      },
      "explanation": "Optional feedback after checking."
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `layout` | `linear`, `trigonal_planar`, `tetrahedral`, or `octahedral` |
| `answer.bonds` | Bond order between atom indices (`"0-1": 2` = double bond) |
| `answer.loneDots` | Total lone electrons per atom ID |
| `answer.variants` | Explicit alternate valid answers (legacy; still supported) |
| `answer.patterns` | Bond-order patterns expanded into variants (preferred for resonance) |
| `charge` | Ion charge (e.g. `-1`); displays brackets and superscript |

### Answer patterns (resonance molecules)

Use `answer.patterns` instead of hand-writing every variant. Each pattern lists bond orders from the central atom to each peripheral atom (in atom-index order). Set `"permute": true` when equivalent atoms can swap positions (e.g. the three oxygens in SO₃).

```json
"answer": {
  "patterns": [
    {
      "peripheralOrders": [1, 2, 2],
      "peripheralLoneByOrder": { "1": 6, "2": 4 },
      "permute": true
    }
  ]
}
```

| Pattern field | Description |
|---------------|-------------|
| `peripheralOrders` | Bond order to each peripheral atom (same order as non-central atoms in `atoms`) |
| `peripheralLoneByOrder` | Lone electrons on a peripheral atom by its bond order (`"1"`: 6, `"2"`: 4, etc.) |
| `centralLone` | Lone electrons on the central atom (optional, default 0) |
| `permute` | If true, expand all unique order permutations (optional, default false) |

Run data lint and validation tests after editing molecules:

```bash
node ci/test-lewis.js
```

Install the local pre-commit hook (runs automatically when Lewis files are staged):

```bash
sh scripts/install-git-hooks.sh
```

Pull requests that touch Lewis data also run `ci/test-lewis.js` in GitHub Actions before merge to `main`.

Lone-pair placement is validated by total electron count per atom, not fixed slot positions. Wrong answers and skips show an example diagram.

## Quiz modes

Quizzes support three modes (chosen on the quiz page):

- **Practice** — immediate feedback, explanations, skip, scoring
- **Study** — same feedback without score tracking
- **Exam** — no hints or skip; results at the end

URL parameter: `quiz.html?quiz=biology/mitosis&mode=exam`

Ion-bank quizzes also accept `skills` as a comma-separated list of skill ids.

## Local development

This is a static site — no build step required. Serve the project root with any static file server and open it in a browser.

## Analytics

Quiz completions fire a Google Analytics event (`quiz_complete`) with subject, quiz name, mode, and score.
