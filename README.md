# STEM Study Buddy

Interactive study tools and quizzes for biology, chemistry, and more. Live site: [stemstudybuddy.com](https://stemstudybuddy.com/)

## Project structure

```
index.html              Home page (subject cards)
biology.html            Biology quiz catalog
chemistry.html          Chemistry quiz catalog
quiz.html               Standard quiz player (MC + drag & drop)
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
  lewis.js              Lewis diagram builder and validation
  nav.js                Header, breadcrumbs, recent quizzes
  theme.js              Dark mode
  stem-text.js          Formula/subscript rendering
css/styles.css          Global styles (subject themes, dark mode)
```

## Catalog (`data/catalog.json`)

Each subject defines its own layout:

- **Biology** uses grouped `units` (each with a name and quiz list), plus an optional `comingSoon` section.
- **Chemistry** uses a flat `quizzes` list and a `comingSoon` section.

Catalog entries need `id`, `title`, `icon`, and `description`. Question count, types, and availability are detected automatically from the JSON file when present.

If the JSON file exists, the entry appears as available with a **Start Quiz** button. If not, it shows as **Coming soon**.

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
- `dataFile` — JSON filename (without `.json`) used to load structure count and title

## Adding a new quiz

1. **Create the quiz JSON** at `data/{subject}/{quiz_id}.json`
2. **Register it** in `data/catalog.json` under the subject (include unit grouping for biology)
3. Reload the subject page — metadata fills in automatically

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
    }
  ]
}
```

### Question fields

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | `"multiple_choice"` or `"drag_and_drop"` |
| `prompt.text` | One of text/image | Question text |
| `prompt.image` | One of text/image | Path to image (e.g. `images/biology/mitosis/prophase.png`) |
| `options` | MC only | Array of answer choices (shuffled at runtime) |
| `categories` | Drag only | Drop zone labels |
| `answer` | Yes | Correct option or category name |
| `explanation` | No | Teaching note shown after each answer |

### Optional top-level field

- `categories` — shared drop zones for all drag questions in a quiz (alternative to per-question `categories`)

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

## Local development

This is a static site — no build step required. Serve the project root with any static file server and open it in a browser.

## Analytics

Quiz completions fire a Google Analytics event (`quiz_complete`) with subject, quiz name, mode, and score.
