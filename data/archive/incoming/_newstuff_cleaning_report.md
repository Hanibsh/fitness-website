# newstuff.csv import — cleaning + calibration report

Raw rows: **66**. Kept: **51**. Dropped: **15**.

## Dropped rows — 15
- **Bent Over Barbell Row, Overhand Grip** — dup of mother's "Barbell Bent Over Row"
- **Seated Cable Row, Overhand Grip** — dup of mother's "Seated Cable Row"
- **Seated Cable Row, Neutral Grip** — dup of mother's "Close Grip Cable Row"
- **Seated Cable Row, Single Arm** — mother's "Seated Cable Row" is already Laterality=Can Be Both
- **Plate Loaded Chest Supported Row Machine, Wide Grip** — intra-file dup of "...Overhand, Wide" (identical muscles); that row survives (has a confirmed single-arm sibling)
- **Plate Loaded Chest Supported Row Machine, Overhand, Wide, Single Arm** — merges into "...Overhand, Wide" (exact bilateral sibling)
- **Plate Loaded Single Arm Chest Supported Low Row Machine, Neutral Grip, Narrow** — "Low" naming slip; merges into "Plate Loaded Chest Supported Row Machine, Neutral Grip, Narrow"
- **Overhand Grip Lat Pulldown** — dup of mother's "Lat Pulldown"
- **Lat Pulldown, Single Arm** — mother already has "Cable One Arm Lat Pulldown" + "Braced Single Arm Cable Pulldown"
- **Neutral Grip Plate Loaded Lat Pulldown, Single Arm** — merges into "Neutral Grip Plate Loaded Lat Pulldown" (exact bilateral sibling)
- **Underhand Grip Plate Loaded Lat Pulldown, Single Arm** — merges into "Underhand Grip Plate Loaded Lat Pulldown" (exact bilateral sibling)
- **Overhand Grip Pull Up** — dup of mother's "Pull-Up"
- **Overhand Grip Pull Up, Weighted** — dup of mother's "Weighted Pull-Up"
- **Underhand Grip Pull Up** — dup of mother's "Reverse Grip Pull-Up"
- **Flat Dumbbell Pullover** — dup of mother's "Dumbbell Pullover" (stays filed under Chest/Hybrid)

## Laterality set to "Can Be Both" — 4
- Plate Loaded Chest Supported Row Machine, Overhand, Wide
- Plate Loaded Chest Supported Row Machine, Neutral Grip, Narrow
- Neutral Grip Plate Loaded Lat Pulldown
- Underhand Grip Plate Loaded Lat Pulldown

## Enum vocabulary fixed (Good->High / Moderate->Average / Low->Unstable / Minor->No) — 19
- Bent Over Row With Bands
- Seated Row With Bands
- Bent Over Barbell Row, Underhand Grip
- T-Bar Row
- Bent Over Dumbbell Row, Overhand Grip
- Bent Over Dumbbell Row, Neutral Grip
- Kettlebell Bent Over Row
- Single Arm Dumbbell Row
- Single Arm Landmine Row
- Inverted Row, Overhand Grip
- Inverted Row, Underhand Grip
- Behind The Neck Lat Pulldown
- Wide Grip Pull Up, Weighted
- Neutral Grip Pull Up, Weighted
- Underhand Grip Pull Up, Weighted
- Overhand Grip Pull Up, With Band
- Neutral Grip Pull Up, With Band
- Underhand Grip Pull Up, With Band
- Human Pullover

## Fatigue/Recovery/Rest/Profile explicitly calibrated — 51

## NOT calibrated (unexpected — should be 0) — 0
