# Remaining Implementation Tasks - Stage 2+

## Current Status
✅ **Completed (via prior commits):**
- Fixed reversed category audio to derive text at runtime
- Applied branding (dark brown title #3E2723 + "Montaser's Cool Edition" subtitle)
- Changed footer to "نسخة منتصر المحسنة"
- Expanded ordering to 50 questions (17/17/16 distribution)
- Expanded closestnumber to 50 questions (17/17/16)
- Expanded audiencechoice to 50 questions (17/17/16)
- Verified audiencechoice hide percentages before reveal
- Verified whoami scoring (first clue is free)
- Verified double-answer lifeline works everywhere
- Verified all existing modes functional

## Remaining Critical Work

### 1. Split علوم/طب Category
**Status:** NOT STARTED  
**Files:** `client/src/data/questions.ts`, `client/src/pages/Setup.tsx`

1. Replace the mixed science/medicine category with:
   - **علوم (science)**: 50 questions (17@200, 17@400, 16@600)
     - Key: `science`
     - IDs: `science-1` through `science-50`
     - Topics: Physics, chemistry, astronomy, biology, environment, technology
   
   - **طب (medicine)**: 50 questions (17@200, 17@400, 16@600)
     - Key: `medicine`  
     - IDs: `medicine-1` through `medicine-50`
     - Topics: Anatomy, organs, medical discoveries, public health, nutrition, first aid

2. Move existing suitable questions from current mixed category
3. Add ~50 new questions per category to reach 50 each
4. Update `Setup.tsx` to recognize both new category keys
5. Used-question localStorage automatically tracks via ID-based system

### 2. Add أفلام مصرية بدون كلام Category (QR-based)
**Status:** NOT STARTED  
**Files:** `client/src/data/questions.ts`, `client/src/game/Question.tsx`

1. Create category with 50 Egyptian film titles (17@200, 17@400, 16@600)
   - Key: `silentfilms`
   - Display name: `أفلام مصرية بدون كلام`
   - Emoji: 🎬
   - IDs: `silentfilms-1` through `silentfilms-50`

2. Implement QR code generation (use `qrcode.react` library):
   - Generate locally at runtime (no external services)
   - QR payload: plain text movie title only
   - Large enough to scan from TV distance

3. Question rendering in `Question.tsx`:
   - Show QR code on TV screen
   - Show Arabic instruction: `امسح الرمز بالهاتف لمعرفة اسم الفيلم — ممنوع الكلام`
   - Never display movie title on TV before normal reveal (including alt text, title, console)
   - After normal answer reveal, display the film title

4. Timer behavior:
   - 200/400 points: 90 seconds
   - 600 points: 60 seconds
   - Show large countdown
   - At zero: `انتهى الوقت`
   - Preserve timer state on mobile/AirPlay resume

### 3. Add ارسم وخمّن Category (QR-based)
**Status:** NOT STARTED  
**Files:** `client/src/data/questions.ts`, `client/src/game/Question.tsx`

1. Create category with 50 drawing prompts (17@200, 17@400, 16@600)
   - Key: `drawguess`
   - Display name: `ارسم وخمّن`
   - Emoji: 🎨
   - IDs: `drawguess-1` through `drawguess-50`
   - Prompts: Concrete, drawable, family-friendly nouns/actions/places/objects/animals

2. Implement QR code generation:
   - Same as silentfilms: local, plain-text payload only
   - QR payload: the exact drawing prompt

3. Question rendering in `Question.tsx`:
   - Show QR code on TV screen
   - Show Arabic instruction: `امسح الرمز بالهاتف لمعرفة ما سترسمه`
   - Never display drawing prompt on TV before normal reveal
   - After normal reveal, display the correct prompt

4. Timer behavior:
   - All questions: 60 seconds (regardless of point value)
   - Show large countdown
   - At zero: `انتهى الوقت`
   - Preserve timer state on mobile/AirPlay resume

### 4. QR Code Component (Shared)
**Status:** NOT STARTED  
**Files:** New component in `client/src/game/` (e.g., `QRDisplay.tsx`)

Requirements:
- Generate QR codes locally at runtime using `qrcode.react` or similar
- Accept plaintext payload (no URL encoding)
- Return large, scannable QR image
- Ensure answer payload never leaks to TV before normal reveal
- Check console, DevTools, accessible text, alt attributes

### 5. Update Setup Category Selection
**Status:** NOT STARTED  
**Files:** `client/src/pages/Setup.tsx`

- Add logic to recognize new category keys: `science`, `medicine`, `silentfilms`, `drawguess`
- Ensure board generation includes all new categories
- Test category selection UI/UX

### 6. Update Validation Script
**Status:** NOT STARTED  
**Files:** `scripts/validate_questions.js`

Add validators for:
- علوم (science): exactly 50 questions, 17/17/16 distribution, unique `science-*` IDs
- طب (medicine): exactly 50 questions, 17/17/16 distribution, unique `medicine-*` IDs
- أفلام مصرية (silentfilms): exactly 50 questions, 17/17/16 distribution, unique `silentfilms-*` IDs, non-empty movie titles
- ارسم وخمّن (drawguess): exactly 50 questions, 17/17/16 distribution, unique `drawguess-*` IDs, non-empty drawing prompts
- Reversed consistency: verify `q` before suffix = exact character reversal of `a`

Preserve existing validators for truefalse, moving, ordering, etc.

### 7. Mobile/AirPlay Resume Enhancements
**Status:** Likely already implemented (verify)  
**Files:** `client/src/game/state.tsx`, `client/src/pages/game.tsx`

Required:
- Active-game snapshot restoration must handle new category keys
- Timer state must restore correctly for silentfilms/drawguess QR modes
- Used-question persistence works automatically via ID-based localStorage

## Implementation Order
1. Add split categories data (علوم + طب = 100 questions) to questions.ts
2. Add silentfilms data (50 questions) to questions.ts
3. Add drawguess data (50 questions) to questions.ts
4. Create QRDisplay component
5. Update Question.tsx rendering for silentfilms/drawguess
6. Implement timer restoration for QR-based modes
7. Update Setup.tsx for new categories
8. Update validate_questions.js
9. Static-check all imports, category keys, QR component usage
10. Commit all changes

## Testing Checklist
- [ ] Build passes with no TypeScript errors
- [ ] All 50 questions appear for each new category
- [ ] QR codes generate and scan correctly
- [ ] QR payloads never leak to TV before reveal
- [ ] Timer behavior works for silentfilms (90s/60s) and drawguess (60s all)
- [ ] Active-game restore preserves timer state
- [ ] Used-question tracking works for new categories
- [ ] Board generation includes all 9+ categories
- [ ] Validation script passes (or states it wasn't run due to Node unavailability)

## Known Constraints
- Node.js unavailable for automated testing; validation is manual/static only
- Token budget limited; work must be focused and efficient
- Do not merge to main branch
- Preserve all existing functionality (no breaking changes)

## Data Source Files
- **generate_new_categories.py**: Python script with all 200 new questions organized by category/difficulty (for reference; this file is not executed)

## Branch
`feature/lifelines-and-hard-modes` (do not merge to main)
