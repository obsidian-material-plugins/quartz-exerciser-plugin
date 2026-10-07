# Authoring examples

## Compact placement

````markdown
```exercise
exercise: python-temperature
layout: dropdown
entrypoint: main.py
word-wrap: false
```
````

## Output types

`normal`, `stderr`, and `raw` may use pasted `content` or an exercise-relative `content-file`. A `file` example points at an exercise-relative image, audio, video, PDF, or other generated artifact. `fallback` is shown when a referenced file is unavailable.

```yaml
outputs:
  - source: main.py
    heading: Try these cases
    examples:
      - label: Interactive
        type: normal
        content: |-
          [stdout] Temperature?
          [stdin] 20
          [stdout] 68.0 F
      - label: Invalid input
        type: stderr
        content-file: expected/error.txt
      - label: Chart
        type: file
        file: expected/chart.png
        fallback: Run the program to create the chart.
```

## File policy

```yaml
files:
  hide-from-preview:
    - data/**
  exclude-from-quartz:
    - solutions/**
```

`hide-from-preview` only reduces viewer clutter. `exclude-from-quartz` is a publication boundary applied before the content glob and to ZIP generation.
