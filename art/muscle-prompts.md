# Muscle-hub image prompts — 25-part matched series

One prompt per hub picture, in the same voice as the master prompt that produced the two
full-body figures. Copy one block per generation, whole.

**Habits that keep the series matched:**

- **Always attach one of the existing full-body images as the style reference** in the same
  generation. The consistency clause in each prompt points at it.
- Generate over time in any order; the site takes them incrementally. Save each result as
  `<slug>.png` using the filename in its heading — the slugs are the site's own routing
  names, so delivery is drop-in.
- These prompts render an athletic **male** figure to match the master series. If you'd
  rather this set be female (or want both later), swap the physique line — everything else
  stands. One figure per muscle is enough for the hub pages.

**Four deliberate differences from the master prompt** (don't "fix" them back):

1. **Square canvas 4096 × 4096** — single-region images, not a front/back pair.
2. **No reserved label margins** — these images never receive labels; the page supplies the
   title. The anatomy fills ~70% of the frame, centered.
3. **Muscles are filled, not just outlined** — solid luminous gold with fiber-direction
   striations; surrounding anatomy stays as faint outline.
4. **A three-tone gold system** distinguishes the parts of a muscle (see below).

## The color system

Everything stays in the gold family — no muscle group gets its own hue. Three fixed tones,
all luminous and metallic, on the same #0A0A0A background:

| Tone | Hex | Description |
|---|---|---|
| **Light** | `#F2DE9C` | pale luminous gold |
| **Mid** | `#D4AF37` | classic metallic gold (the series' line color) |
| **Deep** | `#9C7420` | deep antique gold — darker, but still rich and glowing, never muddy brown |

**The rule that makes it work: a region's tone is its identity, fixed across the whole
series.** The upper chest is Light in `chest.png` and Light again in `upper-chest.png`;
the lats are Mid in `back.png` and Mid in `lats.png`. Clicking from a group page into a
region page shows the same color, so the tones teach the anatomy instead of being
decoration.

Fixed assignments (the prompts below already encode these — this table is the reference):

| Group | Light `#F2DE9C` | Mid `#D4AF37` | Deep `#9C7420` |
|---|---|---|---|
| Chest | Upper chest | Middle chest | Lower chest |
| Back | Mid back | Lats | Spinal erectors |
| Shoulders | Front delt | Side delt | Rear delt |
| Arms | Biceps | Triceps | Forearms |
| Legs | Quads, Calves | Hamstrings, Abductors | Glutes, Adductors |
| Traps | Upper traps | Middle traps | Lower traps |
| Core | Abs | — | Obliques |

(Legs has six regions and three tones, so tones repeat — the assignment is chosen so
neighbouring regions always differ. Core uses only Light and Deep for maximum separation
between its two regions.)

In the **region images** (batches 2–3), the focal muscle is filled in its assigned tone
and everything else stays faint outline — the siblings do NOT get their tones there, so
the focal region pops.

Suggested order: the 7 category images first (every hub page gets art immediately —
sub-hubs can borrow their parent's picture until their own lands), then the 11 distinct
muscles, then the 7 region variants last — they're the same body part with a different
zone lit, which is the hardest thing to keep consistent.

---

## Batch 1 — the 7 categories

### 1. Chest — `chest.png`

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: front view of a male torso from the base of the neck to the upper abdomen.
Center the subject with even margins on every side; the anatomy fills roughly 70% of the
canvas. Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render both pectoral muscles as the focal point, with their three regions
distinguished by three fixed tones of luminous metallic gold — all clearly the same gold
family, differing only in lightness:
- Upper chest (clavicular band, just below the collarbones): pale luminous gold #F2DE9C.
- Middle chest (sternal band, the broad central mass): classic metallic gold #D4AF37.
- Lower chest (the underside curve of the pecs): deep antique gold #9C7420, still rich
  and glowing, never muddy brown.
Each band is a solid fill with subtle fiber-direction striations and a gentle glow, with
a crisp clean boundary line where the bands meet. Render the shoulders, upper arms, neck
and upper abs as thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: upper chest, middle chest, lower chest, the
center separation between the pecs, and the border against the front delts. Every boundary
must be clean and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 2. Back — `back.png`

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: back view of a male torso from the base of the neck to the top of the glutes.
Center the subject with even margins on every side; the anatomy fills roughly 70% of the
canvas. Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the three back muscles as the focal point, each in its own fixed tone of
luminous metallic gold — all clearly the same gold family, differing only in lightness:
- Mid back (the region between and around the shoulder blades): pale luminous gold #F2DE9C.
- Lats (the wide V fanning from the armpits toward the lower spine): classic metallic
  gold #D4AF37.
- Spinal erectors (the two columns along the spine down to the pelvis): deep antique gold
  #9C7420, still rich and glowing, never muddy brown.
Each muscle is a solid fill with subtle fiber-direction striations and a gentle glow, with
crisp clean boundary lines where they meet. Render the trapezius, rear delts, arms and
glutes as thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: the mid-back region, lats, spinal erectors, and
their borders against the traps above and the glutes below. Every boundary must be clean
and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 3. Shoulders — `shoulders.png`

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: three-quarter view of a male shoulder with the upper arm and the adjacent
edges of the chest and upper back for context. Center the subject with even margins on
every side; the anatomy fills roughly 70% of the canvas. Do not reserve any empty space
for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the full deltoid as the focal point, its three heads distinguished by
three fixed tones of luminous metallic gold — all clearly the same gold family, differing
only in lightness:
- Front delt (anterior head, facing forward): pale luminous gold #F2DE9C.
- Side delt (lateral head, capping the shoulder): classic metallic gold #D4AF37.
- Rear delt (posterior head, facing backward): deep antique gold #9C7420, still rich and
  glowing, never muddy brown.
Each head is a solid fill with subtle fiber-direction striations converging toward the
upper arm and a gentle glow, with crisp clean boundary lines between the heads. Render the
chest edge, trap edge and upper arm as thin faint gold contour outlines at clearly lower
intensity.

Clearly define anatomical boundaries for: front delt, side delt, rear delt, and their
borders against the chest, traps, biceps and triceps. Every boundary must be clean and
suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 4. Arms — `arms.png`

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: three-quarter view of one complete male arm from the deltoid to the wrist,
elbow slightly bent so both the upper arm and forearm read clearly. Center the subject
with even margins on every side; the anatomy fills roughly 70% of the canvas. Do not
reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the arm musculature as the focal point, its three muscle groups
distinguished by three fixed tones of luminous metallic gold — all clearly the same gold
family, differing only in lightness:
- Biceps (front of the upper arm): pale luminous gold #F2DE9C.
- Triceps (back of the upper arm): classic metallic gold #D4AF37.
- Forearm muscles (elbow to wrist): deep antique gold #9C7420, still rich and glowing,
  never muddy brown.
Each group is a solid fill with subtle fiber-direction striations and a gentle glow, with
crisp clean boundary lines between them. Render the deltoid and the hand as thin faint
gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: biceps, triceps, the brachialis between them,
and the forearm flexor and extensor groups. Every boundary must be clean and suitable for
SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 5. Legs — `legs.png`

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: three-quarter view of both male legs from the hip to the ankle, feet slightly
apart in a natural stance. Center the subject with even margins on every side; the anatomy
fills roughly 70% of the canvas. Do not reserve any empty space for labels — none will be
added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the leg musculature as the focal point, its regions distinguished by
three fixed tones of luminous metallic gold — all clearly the same gold family, differing
only in lightness, assigned so neighbouring regions always differ:
- Quads (front thigh) and Calves (lower leg): pale luminous gold #F2DE9C.
- Hamstrings (back thigh) and Abductors (outer thigh/hip): classic metallic gold #D4AF37.
- Glutes and Adductors (inner thigh): deep antique gold #9C7420, still rich and glowing,
  never muddy brown.
Each region is a solid fill with subtle fiber-direction striations and a gentle glow,
with crisp clean boundary lines where regions meet. Render the torso edge and the feet as
thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: quads, hamstrings, glutes, calves, adductors
(inner thigh) and abductors (outer thigh/hip). Every boundary must be clean and suitable
for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 6. Neck and Traps — `traps.png`

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: back view of a male neck and upper back, from the base of the skull to the
mid-back, shoulders included for context. Center the subject with even margins on every
side; the anatomy fills roughly 70% of the canvas. Do not reserve any empty space for
labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the trapezius as the focal point — the full diamond shape with its three
fiber regions distinguished by three fixed tones of luminous metallic gold, all clearly
the same gold family, differing only in lightness:
- Upper traps (neck to shoulder line): pale luminous gold #F2DE9C.
- Middle traps (across the shoulder blades): classic metallic gold #D4AF37.
- Lower traps (the descending tail toward the mid-back): deep antique gold #9C7420, still
  rich and glowing, never muddy brown.
Each region is a solid fill with subtle fiber-direction striations and a gentle glow, with
crisp clean boundary lines between the regions, plus the neck musculature above rendered
in classic metallic gold definition lines. Render the deltoids and lats as thin faint gold
contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: upper traps, middle traps, lower traps, the neck
muscles, and the borders against the rear delts and lats. Every boundary must be clean and
suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 7. Core — `core.png`

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: front view of a male torso from the lower chest to the pelvis. Center the
subject with even margins on every side; the anatomy fills roughly 70% of the canvas. Do
not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the core as the focal point, its two regions distinguished by two fixed
tones of luminous metallic gold — the same gold family, differing only in lightness:
- Abs (rectus abdominis, the central column with its segments): pale luminous gold #F2DE9C.
- Obliques (along both sides of the waist): deep antique gold #9C7420, still rich and
  glowing, never muddy brown.
Each is a solid fill with subtle fiber-direction striations and a gentle glow, with crisp
clean boundary lines between the abs and the obliques. Render the lower chest and hips as
thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: the rectus abdominis segments, the linea alba
center line, the external obliques, and the border against the lower chest. Every boundary
must be clean and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

---

## Batch 2 — the 11 distinct muscles

Each region image fills the focal muscle in **its series tone** (the same color it carries
in its group image) and keeps everything else as faint outline.

### 8. Lats — `lats.png` · series tone: classic gold #D4AF37

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: back view of a male torso from the shoulders to the waist. Center the subject
with even margins on every side; the anatomy fills roughly 70% of the canvas. Do not
reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the latissimus dorsi as the single focal point — both lats in solid
classic metallic gold #D4AF37 (this muscle's fixed color throughout the series), with
subtle fiber-direction striations fanning from the armpits down toward the lower spine in
the classic V-taper, and a gentle glow. Render the trapezius, mid-back, spinal erectors,
rear delts and arms as thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: the lats against the traps above, the spinal
erectors along the spine, and teres major near the armpit. Every boundary must be clean
and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 9. Spinal Erectors — `spinal-erectors.png` · series tone: deep gold #9C7420

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: back view of a male lower torso from the mid-back to the top of the glutes.
Center the subject with even margins on every side; the anatomy fills roughly 70% of the
canvas. Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the spinal erectors as the single focal point — the two muscular columns
running vertically along either side of the spine, in solid deep antique gold #9C7420
(this muscle's fixed color throughout the series), still rich and glowing, never muddy
brown, with subtle vertical fiber-direction striations and a gentle glow. Render the lats
above and the glutes below as thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: the two erector columns, the spine between them,
and their borders against the lats and glutes. Every boundary must be clean and suitable
for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 10. Biceps — `biceps.png` · series tone: light gold #F2DE9C

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: front view of a male upper arm flexed at roughly 90 degrees, from the
shoulder to the wrist. Center the subject with even margins on every side; the anatomy
fills roughly 70% of the canvas. Do not reserve any empty space for labels — none will be
added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the biceps as the single focal point — the long and short heads in solid
pale luminous gold #F2DE9C (this muscle's fixed color throughout the series), with subtle
fiber-direction striations along the muscle belly and a gentle glow. Render the deltoid,
triceps underside and forearm as thin faint gold contour outlines at clearly lower
intensity.

Clearly define anatomical boundaries for: the two biceps heads, the brachialis beneath,
and the borders against the deltoid and forearm. Every boundary must be clean and suitable
for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 11. Triceps — `triceps.png` · series tone: classic gold #D4AF37

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: rear view of an extended male upper arm from the shoulder to the wrist.
Center the subject with even margins on every side; the anatomy fills roughly 70% of the
canvas. Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the triceps as the single focal point — long, lateral and medial heads
forming the horseshoe shape, in solid classic metallic gold #D4AF37 (this muscle's fixed
color throughout the series), with subtle fiber-direction striations and a gentle glow.
Render the rear delt and forearm as thin faint gold contour outlines at clearly lower
intensity.

Clearly define anatomical boundaries for: the three triceps heads and their borders
against the rear delt and forearm. Every boundary must be clean and suitable for SVG
tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 12. Forearms — `forearms.png` · series tone: deep gold #9C7420

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: view of a male forearm from the elbow to the fingertips, thumb up in a
neutral grip. Center the subject with even margins on every side; the anatomy fills
roughly 70% of the canvas. Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the forearm musculature as the single focal point — the brachioradialis
and the flexor and extensor groups in solid deep antique gold #9C7420 (this muscle's
fixed color throughout the series), still rich and glowing, never muddy brown, with
subtle fiber-direction striations running toward the wrist and a gentle glow. Render the
upper arm end and the hand as thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: brachioradialis, the flexor group, the extensor
group, and the border at the elbow. Every boundary must be clean and suitable for SVG
tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 13. Glutes — `glutes.png` · series tone: deep gold #9C7420

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: rear view of male hips from the lower back to the upper thigh. Center the
subject with even margins on every side; the anatomy fills roughly 70% of the canvas. Do
not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the glutes as the single focal point — gluteus maximus with gluteus
medius above it on the hip, in solid deep antique gold #9C7420 (this muscle's fixed color
throughout the series), still rich and glowing, never muddy brown, with subtle
fiber-direction striations and a gentle glow. Render the lower back and hamstrings as
thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: gluteus maximus, gluteus medius, and the borders
against the spinal erectors above and the hamstrings below. Every boundary must be clean
and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 14. Quads — `quads.png` · series tone: light gold #F2DE9C

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: front view of a male thigh from the hip to just below the knee. Center the
subject with even margins on every side; the anatomy fills roughly 70% of the canvas. Do
not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the quadriceps as the single focal point — rectus femoris in the center,
vastus lateralis on the outside, and the vastus medialis teardrop above the knee, in
solid pale luminous gold #F2DE9C (this muscle's fixed color throughout the series), with
subtle fiber-direction striations and a gentle glow. Render the hip, inner thigh and knee
as thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: rectus femoris, vastus lateralis, vastus
medialis, and the border against the adductors on the inner thigh. Every boundary must be
clean and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 15. Hamstrings — `hamstrings.png` · series tone: classic gold #D4AF37

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: rear view of a male thigh from the glute fold to just below the knee. Center
the subject with even margins on every side; the anatomy fills roughly 70% of the canvas.
Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the hamstrings as the single focal point — biceps femoris on the outside
with semitendinosus and semimembranosus on the inside, in solid classic metallic gold
#D4AF37 (this muscle's fixed color throughout the series), with subtle fiber-direction
striations running down toward the knee and a gentle glow. Render the glutes above and
the calf below as thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: the outer and inner hamstring muscles, the glute
fold above, and the split behind the knee. Every boundary must be clean and suitable for
SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 16. Calves — `calves.png` · series tone: light gold #F2DE9C

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: rear view of a male lower leg from the knee to the ankle. Center the subject
with even margins on every side; the anatomy fills roughly 70% of the canvas. Do not
reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the calf as the single focal point — the two gastrocnemius heads with
the soleus visible beneath them and the Achilles tendon below, in solid pale luminous
gold #F2DE9C (this muscle's fixed color throughout the series), with subtle
fiber-direction striations and a gentle glow. Render the hamstring end and the foot as
thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: the inner and outer gastrocnemius heads, the
soleus, and the Achilles tendon. Every boundary must be clean and suitable for SVG
tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 17. Adductors (Inner Thighs) — `adductors.png` · series tone: deep gold #9C7420

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: front view of male thighs with the legs slightly apart, from the pelvis to
the knees, so the inner-thigh region reads clearly. Center the subject with even margins
on every side; the anatomy fills roughly 70% of the canvas. Do not reserve any empty space
for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the inner thighs as the single focal point — the adductor group running
from the groin down the inside of each thigh, in solid deep antique gold #9C7420 (this
muscle's fixed color throughout the series), still rich and glowing, never muddy brown,
with subtle fiber-direction striations and a gentle glow. Render the quads and knees as
thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: the adductor group and its border against the
quads on each thigh. Every boundary must be clean and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 18. Abductors (Outer Thighs) — `abductors.png` · series tone: classic gold #D4AF37

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: side view of a male hip and outer thigh, from the waist to the knee. Center
the subject with even margins on every side; the anatomy fills roughly 70% of the canvas.
Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the outer thigh and hip as the single focal point — gluteus medius and
tensor fasciae latae at the hip with the outer-thigh line running down toward the knee,
in solid classic metallic gold #D4AF37 (this muscle's fixed color throughout the series),
with subtle fiber-direction striations and a gentle glow. Render the gluteus maximus
behind and the quads in front as thin faint gold contour outlines at clearly lower
intensity.

Clearly define anatomical boundaries for: gluteus medius, tensor fasciae latae, and their
borders against the gluteus maximus and the quads. Every boundary must be clean and
suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

---

## Batch 3 — the 7 region variants (hardest; generate last)

For all three chest variants, generate with the SAME composition as `chest.png` and change
only which band is filled — ideally in the same session with `chest.png` attached as the
reference, so the three read as one image with a moving highlight. Same for the three delt
heads against `shoulders.png`. Each variant's fill is its series tone.

### 19. Upper Chest — `upper-chest.png` · series tone: light gold #F2DE9C

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image,
and the identical torso composition as the chest image in this series.

Composition: front view of a male torso from the base of the neck to the upper abdomen.
Center the subject with even margins on every side; the anatomy fills roughly 70% of the
canvas. Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render ONLY the upper chest as the focal point — the clavicular band of the
pectorals, running just below the collarbones toward the shoulders, in solid pale
luminous gold #F2DE9C (this region's fixed color throughout the series), with subtle
fiber-direction striations and a gentle glow. Render the middle and lower chest,
shoulders and abs as thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: the upper chest band against the middle chest
below it, the collarbones above, and the front delts to the sides. Every boundary must be
clean and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 20. Middle Chest — `middle-chest.png` · series tone: classic gold #D4AF37

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image,
and the identical torso composition as the chest image in this series.

Composition: front view of a male torso from the base of the neck to the upper abdomen.
Center the subject with even margins on every side; the anatomy fills roughly 70% of the
canvas. Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render ONLY the middle chest as the focal point — the sternal band of the
pectorals, the broad central mass fanning from the sternum toward the armpits, in solid
classic metallic gold #D4AF37 (this region's fixed color throughout the series), with
subtle horizontal fiber-direction striations and a gentle glow. Render the upper and
lower chest, shoulders and abs as thin faint gold contour outlines at clearly lower
intensity.

Clearly define anatomical boundaries for: the middle chest band against the upper band
above and the lower band below, the sternum line in the center, and the front delts to
the sides. Every boundary must be clean and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 21. Lower Chest — `lower-chest.png` · series tone: deep gold #9C7420

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image,
and the identical torso composition as the chest image in this series.

Composition: front view of a male torso from the base of the neck to the upper abdomen.
Center the subject with even margins on every side; the anatomy fills roughly 70% of the
canvas. Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render ONLY the lower chest as the focal point — the lower band of the
pectorals forming the underside curve of the chest, in solid deep antique gold #9C7420
(this region's fixed color throughout the series), still rich and glowing, never muddy
brown, with subtle fiber-direction striations and a gentle glow. Render the upper and
middle chest, shoulders and abs as thin faint gold contour outlines at clearly lower
intensity.

Clearly define anatomical boundaries for: the lower chest band against the middle chest
above and the abs below, and the clean underside line of the pecs. Every boundary must be
clean and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 22. Mid Back — `mid-back.png` · series tone: light gold #F2DE9C

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: back view of a male upper torso from the neck to the mid-back, both shoulder
blades fully in frame. Center the subject with even margins on every side; the anatomy
fills roughly 70% of the canvas. Do not reserve any empty space for labels — none will be
added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render the mid-back as the single focal point — the region between and around
the shoulder blades (the rhomboid area, with teres major near the armpit), in solid pale
luminous gold #F2DE9C (this region's fixed color throughout the series), with subtle
fiber-direction striations angling from the spine toward the shoulder blades and a gentle
glow. Render the trapezius above, the lats below and the rear delts as thin faint gold
contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: the mid-back region between the shoulder
blades, teres major, and the borders against the traps and lats. Every boundary must be
clean and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 23. Front Delts — `front-delts.png` · series tone: light gold #F2DE9C

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: front view of a male shoulder with the upper chest and upper arm for
context. Center the subject with even margins on every side; the anatomy fills roughly
70% of the canvas. Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render ONLY the front deltoid head as the focal point — the anterior portion of
the shoulder facing forward, in solid pale luminous gold #F2DE9C (this region's fixed
color throughout the series), with subtle fiber-direction striations converging toward
the upper arm and a gentle glow. Render the side delt behind it, the chest and the biceps
as thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: the front delt against the side delt, the upper
chest, and the biceps below. Every boundary must be clean and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 24. Side Delts — `side-delts.png` · series tone: classic gold #D4AF37

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: direct side profile of a male shoulder with the upper arm for context.
Center the subject with even margins on every side; the anatomy fills roughly 70% of the
canvas. Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render ONLY the side deltoid head as the focal point — the lateral portion
capping the shoulder, in solid classic metallic gold #D4AF37 (this region's fixed color
throughout the series), with subtle fiber-direction striations converging toward the
upper arm and a gentle glow. Render the front and rear delt heads on either side, and the
upper arm, as thin faint gold contour outlines at clearly lower intensity.

Clearly define anatomical boundaries for: the side delt against the front delt, the rear
delt, and the upper arm below. Every boundary must be clean and suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```

### 25. Rear Delts — `rear-delts.png` · series tone: deep gold #9C7420

```
Create a premium bodybuilding anatomy illustration for a fitness website — one image in a
matched 25-part muscle series.

Canvas size: 4096 × 4096 pixels (1:1 square), ultra-high resolution.

This illustration is part of a matched anatomy series. Use identical line style, glow
intensity, contrast, rendering quality, and background as the attached reference image.

Composition: back view of a male shoulder with the upper back and upper arm for context.
Center the subject with even margins on every side; the anatomy fills roughly 70% of the
canvas. Do not reserve any empty space for labels — none will be added.

Background: solid color #0A0A0A. Absolutely no gradients, textures, patterns, lighting
effects, shadows, reflections, smoke, particles, environmental elements, or decorative
effects.

Physique: realistic athletic adult male, moderate muscular development, approximately
12–15% body fat, natural appearance, not a professional bodybuilder, no exaggerated
musculature, no extreme vascularity.

Style: luxury minimalist technical anatomy vector illustration in precise luminous
metallic gold lines.

Emphasis: render ONLY the rear deltoid head as the focal point — the posterior portion of
the shoulder facing backward, in solid deep antique gold #9C7420 (this region's fixed
color throughout the series), still rich and glowing, never muddy brown, with subtle
fiber-direction striations converging toward the upper arm and a gentle glow. Render the
side delt, the traps, the mid-back and the triceps as thin faint gold contour outlines at
clearly lower intensity.

Clearly define anatomical boundaries for: the rear delt against the side delt, the traps
above, the mid-back inward, and the triceps below. Every boundary must be clean and
suitable for SVG tracing.

No text, no labels, no arrows, no callouts, no legends, no logos, no watermark, no
decorative elements.

Ultra-clean vector quality, premium modern design, consistent line thickness, sharp edges,
high anatomical accuracy.
```
