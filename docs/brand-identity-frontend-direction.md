# Brand Identity Frontend Direction

This document is not a description of the current UI. It is the recommended frontend design direction for Linket if the goal is to build a sharper brand identity around premium everyday carry, ambition, modern connection, and product pride.

## 1. Brand Thesis

Linket should not feel like a cheerful startup tool.

It should feel like a carried object with status.

Not flashy. Not loud. Not sterile. Not corporate-soft.

It should feel like:

- a premium accessory you keep on you
- a modern tool for people who move through the world and introduce themselves often
- technology with physical presence
- ambition translated into material, interface, and ritual

The emotional message is simple:

**I take myself seriously. I show up well. I carry tools that keep up.**

## 2. Who The Interface Is Talking To

The site should speak to people who:

- work the room instead of hiding behind the room
- meet people in real life, on the ground, in motion
- care about what they carry, not just what they wear
- see accessories as extensions of identity
- want their tech to feel current, useful, and quietly expensive

This is not a gamer brand, not a crypto brand, and not a "founder hustle wallpaper" brand.

It is modern masculine, but not cartoon masculine.

The masculine quality should come from:

- restraint
- material richness
- confidence
- clean lines
- tactile detail
- clarity under pressure

Not from aggression, cliches, or faux luxury.

## 3. Core Visual Idea

**Linket should look like a premium everyday-carry object that happens to open into software.**

That means the frontend should borrow its visual cues from:

- machined metal
- smoked glass
- soft black leather
- brushed hardware
- precise edge finishing
- compact field gear

The current warm, playful, peach-heavy softness is approachable, but it does not fully express "premium product you carry every day."

The optimized direction should feel closer to:

- pocketable
- tactile
- urban
- composed
- expensive without looking delicate

## 4. Brand Personality In UI Terms

### The brand is:

- sharp
- grounded
- intentional
- ambitious
- polished
- modern
- tactile

### The brand is not:

- bubbly
- whimsical
- over-friendly
- pastel-first
- cute
- generic SaaS
- futuristic in a sci-fi way

## 5. Frontend Design North Star

The frontend should answer this question on every screen:

**Does this feel like something a driven person would be proud to carry, use, and show?**

If the answer is "it looks nice," that is not enough.

It should feel like:

- a personal object
- a social weapon
- a modern calling card
- a product with edge and discipline

## 6. Visual Language

### A. Color Direction

The palette should move away from soft consumer warmth as the primary identity and toward a controlled material palette.

Recommended base palette:

- `Obsidian` `#0C0F13`
  Primary background. This is the brand floor.
- `Graphite` `#171B22`
  Elevated surfaces, nav, panels, shell containers.
- `Gunmetal` `#232934`
  Secondary surfaces, borders, structural UI.
- `Bone` `#F3EEE6`
  Main light text and premium contrast tone.
- `Stone` `#A4ACB8`
  Secondary text, labels, restrained metadata.
- `Brass` `#B88A44`
  Premium accent. Use for highlights, active states, controlled glows.
- `Ice Signal` `#79C5E8`
  Technology accent. Use sparingly for scan states, NFC moments, motion, and analytical details.
- `Oxide` `#7A3C2C`
  Deep warm note for danger, friction, or emphasis with character.

### Color behavior

- Dark should be the hero environment, not an alternate mode.
- Light should feel like bone, paper, ceramic, and premium packaging, not white app chrome.
- Accent color usage should be disciplined.
- The interface should never feel rainbow-coded.

### Recommended balance

- 70% dark neutrals
- 20% warm light contrast
- 8% brass
- 2% ice signal

That ratio matters. Premium brands lose their authority when they over-accent.

## 7. Typography Direction

The current brand language would benefit from more authority and less softness.

### Headline typography should feel:

- compressed enough to feel strong
- elegant enough to feel premium
- contemporary enough to feel tech-forward

Recommended direction:

- Headline family: something in the lane of `Sohne`, `Neue Haas Grotesk Display`, `PP Neue Montreal`, or a similar hard-edged neo-grotesk
- UI/body family: `Inter`, `Manrope`, or a similarly disciplined sans
- Optional numeric/detail family: `IBM Plex Mono` or `Geist Mono` for specs, scan counts, timestamps, and product identifiers

### Typography rules

- Headlines should be bold, dense, and decisive
- Subheads should feel editorial, not bloggy
- Body text should be spare and measured
- Avoid overly rounded, playful, or bubbly letterforms for hero moments

### Tone of typography

The type should say:

**precision, ambition, modern hardware**

Not:

**friendly productivity app**

## 8. Layout Direction

### General layout principle

Every major page should feel built like a product tray, not a blog page.

Use:

- strong horizontal divisions
- anchored content blocks
- deliberate empty space
- wider breathing room around product moments
- asymmetry where it adds status

Avoid:

- endless centered marketing stacks
- too many identical rounded cards
- soft floaty layouts with no backbone

### Grid strategy

Desktop:

- 12-column system
- generous side margins
- clear relationship between product imagery and message

Tablet:

- 8-column system
- tighter but still premium spacing

Mobile:

- 4-column system
- heavier vertical rhythm
- clearer sectional locking
- product moments should still feel composed, not collapsed

### Page rhythm

The best rhythm for Linket is:

1. Statement
2. Product presence
3. Social proof
4. Real-world usage
5. Functional credibility
6. Conversion

This is stronger than treating every page like a content article.

## 9. Hero Design Direction

The hero should stop feeling like a "nice startup landing page" and start feeling like a campaign image for a premium tool.

### Hero composition

Left side:

- hard, direct headline
- short supporting copy
- one primary CTA
- one secondary action
- small trust line or status line

Right side:

- large product render or product-in-hand visual
- not just a dashboard mock
- show the object first, software second

### Stronger hero message examples

- `Tap in. Stand out.`
- `A sharper way to be remembered.`
- `Carry your next introduction.`
- `The everyday accessory that opens opportunity.`
- `Built for people who meet the world in person.`

The hero should frame Linket as a modern ritual object:

take it out, tap it, be remembered.

## 10. Product Imagery Direction

This brand cannot rely mainly on generic SaaS mockups.

It needs imagery that proves Linket belongs in someone's hand, pocket, keys, bag, desk drop, or daily routine.

### Show Linket in contexts like:

- clipped to a key ring on a clean table
- next to a wallet, watch, phone, or notebook
- in-hand during an introduction
- worn into a campus, venue, studio, showroom, field event, or business setting
- resting on textured materials like leather, metal, canvas, stone, dark wood

### Avoid:

- smiling stock-team software photos
- empty floating UI mockups with no object relationship
- generic office scenes that could sell any app
- too much abstract illustration

The product should be photographed like a premium accessory, not a swag item.

## 11. Interface Materiality

The frontend should imply physical material without becoming skeuomorphic.

### Surfaces should feel like:

- smoked glass
- coated aluminum
- satin ceramic
- soft black polymer

### How to express that in UI

- subtle grain or directional gradients
- thin edge highlights
- disciplined shadows with low blur and weight
- controlled reflections
- slightly cool surface tones with warm metallic accents

### Components should look machined

Buttons, pills, nav elements, and cards should feel:

- compact
- engineered
- balanced
- dense in a good way

Not oversized and soft for the sake of friendliness.

## 12. Component Language

### Buttons

Primary CTA:

- dark metal body or brass-inflected highlight state
- tight radius
- compact vertical height
- high-contrast label
- no candy gradient unless it serves a very specific campaign area

Secondary CTA:

- ghost-metal or glass-chip style
- strong border
- restrained fill

Avoid giant soft orange blobs or glossy startup buttons.

### Navigation

The navbar should feel like a precision instrument bar.

Use:

- tighter spacing
- strong active states
- material contrast
- fewer decorative effects

The brand mark should feel stamped or machined, not floating and cute.

### Cards

Cards should not all look the same.

There should be at least three visual weights:

- structural cards
- story cards
- product cards

Structural cards:

- minimal
- mostly function
- thin border

Story cards:

- richer contrast
- stronger editorial hierarchy

Product cards:

- more tactile
- deeper shadows
- closer to packaging or premium product page presentation

### Form fields

Form fields should feel tool-grade:

- darker shells
- crisp outlines
- strong focus states
- compact labels
- deliberate spacing

The user should feel like they are configuring something valuable, not filling out a generic web form.

## 13. Motion Direction

Motion should feel mechanical, gliding, and intentional.

Not floaty. Not playful. Not over-animated.

### Good motion references for Linket

- panel lock-in
- brushed-surface shimmer
- slow camera-like parallax
- scan pulse
- snap-to-place transitions
- controlled sheet reveals

### Motion rules

- one strong movement at a time
- fast in utility flows
- slower and richer in hero/product storytelling
- hover states should feel like pressure or lift, not bounce

### Avoid

- whimsical float loops
- too many staggered animations
- flashy glowing gradients everywhere

## 14. Copy And Voice

The interface copy should sound like a sharp, self-aware brand.

### Voice qualities

- direct
- compact
- confident
- low-fluff
- stylish without being dramatic

### Good copy behavior

- short headlines
- clear verbs
- restrained metaphors
- concrete benefits

### Words to lean into

- carry
- tap
- open
- meet
- ready
- signal
- profile
- presence
- ambition
- connection

### Words to avoid

- empowering
- seamless
- revolutionary
- all-in-one
- next-gen
- supercharge

Those words flatten the brand.

## 15. Specific Frontend Recommendations By Surface

### Marketing pages

Marketing should feel more like a premium campaign site than a warm startup homepage.

Recommended shift:

- darker hero
- stronger product photography
- fewer pastel sections
- fewer soft peach gradients
- more editorial contrast
- more visual emphasis on the Linket object itself

The site should open with object, attitude, and real-world use.

### Auth

The auth flow should feel like secure access to a premium system.

Recommended tone:

- compact
- darker
- calmer
- more controlled

Think:

- private member access
- premium product account
- modern secure terminal wrapped in good taste

### Dashboard

The dashboard should feel less like "premium SaaS" and more like a command surface for a carried identity product.

Recommended shift:

- cleaner chrome
- stronger dark mode baseline
- more material contrast
- less decorative softness
- more disciplined use of accent

The dashboard should feel like the back office of personal presence.

### Public profile

The public profile should feel like a digital calling card with real style.

It should not resemble a generic link page.

Recommended direction:

- taller hero presence
- clearer materiality
- stronger logo/avatar integration
- better distinction between contact action and outgoing links
- more status in the page top

The public page should feel like:

**a modern identity plate**

not

**a stacked links list**

## 16. What The Brand Should Stop Doing

If the goal is this new identity, Linket should reduce:

- peach-first page framing as the dominant mood
- overly soft, friendly gradients
- rounded playful typography in major brand moments
- generic startup section patterns
- visual softness that makes the product feel lighter than it is
- treating the software UI as the hero instead of the carried object

None of those choices are bad on their own. They are just not the strongest expression of this brand.

## 17. What The Brand Should Double Down On

Linket should double down on:

- product-as-accessory storytelling
- compact, high-control UI
- dark surfaces with warm metallic intelligence
- sharper typography
- object-first hero design
- real-world connection scenes
- premium utility instead of decorative luxury

The most important shift is this:

**Linket should feel like something you carry with pride, not just something you sign into.**

## 18. A Stronger One-Line Design Standard

When reviewing future frontend work, use this standard:

**Does this look like premium everyday-carry technology for ambitious people who meet the world in person?**

If not, it needs to be sharper, more tactile, more grounded, or more disciplined.

## 19. Final Direction In One Sentence

Linket should look like a modern identity accessory built for people in motion: dark, precise, tactile, ambitious, and quietly expensive.
