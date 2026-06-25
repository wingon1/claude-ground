# Tiny Dew Valley Act 2 Plan

## Core Direction

Act 2 starts when the player obtains the suspicious seed from the floor 10 mine boss.

The suspicious seed should not be a normal one-time crop. It is the original specimen for restoring forbidden mint chocolate. The player should feel that the early farm loop was preparation, and that the real secret project starts after this item is found.

## Design Pillars

- The suspicious seed is a key item, not an ordinary seed.
- It cannot be sold, lost, or consumed by normal planting.
- It unlocks a new story progression track.
- The player should research and propagate mint instead of simply planting the seed once.
- Mint progression should create repeatable loops: research, failed experiments, usable byproducts, better mint quality, and higher-value cooking.

## Act 1 To Act 2 Transition

1. The player clears mine floor 10.
2. The mine guardian drops the suspicious seed.
3. Picking it up triggers:
   - Player speech: "수상한 씨앗을 얻었다! 이게 뭐지..?"
   - Jump animation
   - Red alert marker
   - Act 2 objective track
4. The active objective changes to seed investigation.

## Progression Stages

### 1. Identify Suspicious Seed

Goal: Make the player understand that this seed should not be planted in a normal field.

Suggested interaction:
- Blacksmith or a new plant-focused NPC comments on the seed.
- The seed is identified as a mint-family forbidden specimen.

Unlock:
- Secret greenhouse construction.

### 2. Build Secret Greenhouse

Goal: Give the player a new mid-game construction target.

Suggested cost baseline:
- Wood 80
- Stone 60
- Iron ore 20
- Gold cost to be tuned after playtesting

Function:
- Dedicated Act 2 facility.
- Suspicious seed and mint experiments happen here, not in normal farm plots.

Unlock:
- Germination research.

### 3. Germination Research

Goal: Turn the original seed into a renewable system.

The original seed remains safe. Research produces unstable mint seeds.

Suggested inputs:
- Milk
- Corn
- Iron ore

Outputs:
- Chance to create unstable mint seed.
- Failure byproducts can become sellable or usable materials later.

Unlock:
- Mint propagation.

### 4. Mint Propagation

Goal: Make mint farming repeatable without making the original seed disposable.

Loop:
- Use unstable mint seed in greenhouse.
- Harvest unstable mint leaf.
- Use leaves and farm ingredients to craft better research batches.

Possible byproducts:
- Bitter leaf
- Wilted mint
- Strange herb
- Mint extract residue

Unlock:
- Mint quality stabilization.

### 5. Mint Quality Stabilization

Goal: Add long-term progression after the first mint harvest.

Quality ladder:
- Unstable mint
- Fragrant mint
- Cold mint
- Legendary mint

Each tier should require:
- Prior tier mint material
- Higher mine resource
- Higher-value farm/cooking material
- Time investment

Unlock:
- Legendary mint chocolate recipe chain.

### 6. Legendary Mint Chocolate

Goal: Deliver the story fantasy.

The final recipe should require several systems:
- Legendary mint
- Milk or cream
- Butter or cheese-adjacent dairy product
- Chocolate base ingredient added in a later update
- Possibly a rare passive or boss drop as a late-game catalyst

This should be expensive and slow enough to feel like a finale, but still sit inside repeatable production.

## Code Structure

New progression definitions live in:

```text
src/projects/tiny-dew-valley/data/act2Progression.ts
```

This module owns:
- Act 2 flags
- Act 2 key item ids
- Act 2 stage definitions
- The helper that returns the first available incomplete Act 2 stage

Current connections:
- `seed_suspicious` is marked as an important story item.
- The mine guardian clear flag is referenced through Act 2 constants.
- Picking up the suspicious seed sets the Act 2 found flag.
- The active objective can now switch to the Act 2 objective track.

Future systems should consume the same Act 2 stage definitions instead of adding more hard-coded string checks in `game.ts`.

## Implementation Order

1. Add secret greenhouse build option and map placement.
2. Add greenhouse interaction button and modal.
3. Add seed identification interaction.
4. Add germination research queue.
5. Add unstable mint seed and mint leaf items.
6. Add propagation and failure byproducts.
7. Add mint quality stabilization recipes.
8. Add chocolate ingredient chain.
9. Add legendary mint chocolate final recipe and finale objective.

## Balance Notes

Act 2 should ask for resources the player already understands, but in combinations that make the older systems matter again.

Recommended early Act 2 pressure:
- Wood and stone for greenhouse.
- Iron ore to make mine progression relevant.
- Milk/corn/strawberry/butter to reuse farm and cooking systems.

Recommended pacing:
- Identifying the seed should be quick.
- Building the greenhouse should be a clear resource goal.
- Germination should take time, but not feel punishing.
- Propagation can include failures, as long as failure byproducts have value.
