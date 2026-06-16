# STEM Study Buddy

Interactive web quizzes for biology, chemistry, and more. Live site: [stemstudybuddy.com](https://stemstudybuddy.com/)

## Project structure

```
index.html          Home page (subjects)
biology.html        Biology quiz catalog
chemistry.html      Chemistry quiz catalog
quiz.html           Quiz player
data/
  catalog.json      Subject layout, quiz metadata, and grouping
  biology/*.json    Biology quiz content
  chemistry/*.json  Chemistry quiz content
js/
  catalog-utils.js  Shared catalog and card rendering
  subject.js        Subject page logic
  quiz.js           Quiz engine
  nav.js            Header, breadcrumbs, recent quizzes
  theme.js          Dark mode
  stem-text.js      Formula/subscript rendering
css/styles.css      Global styles
```

## Adding a new quiz

1. **Create the quiz JSON** at `data/{subject}/{quiz_id}.json`
2. **Register it** in `data/catalog.json` under the subject (include `id`, `title`, `icon`, `description`, and unit if biology)
3. Question count, types, and availability are detected automatically from the JSON file

If the JSON file exists, the quiz appears as available. If not, the catalog entry shows as "Coming soon."

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

## Quiz modes

Quizzes support three modes (chosen on the quiz page):

- **Practice** — immediate feedback, explanations, skip, scoring
- **Study** — same feedback without score tracking
- **Exam** — no hints or skip; results at the end

URL parameter: `quiz.html?quiz=biology/mitosis&mode=exam`

## Local development

This is a static site — no build step required. Serve the folder with any static file server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`

## Analytics

Quiz completions fire a Google Analytics event (`quiz_complete`) with subject, quiz name, mode, and score.
