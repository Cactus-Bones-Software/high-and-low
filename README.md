# High & Low

**High & Low** is a local-first, zero-friction mood tracker designed specifically for individuals navigating bipolar
and unipolar mood cycles (both depressive lows and manic/hypomanic highs).

---

## What It Is

High & Low is a lightweight, offline-capable web application built to make mood tracking effort-free—especially on
severe low-energy days. It uses simple 1–5 rating scales and binary Yes/No check-ins presented one card at a time,
keeping the cognitive load to a minimum.

---

## Key Features

- **Low-Energy Tracker Deck**: One, easy-to-answer question on screen at a time.
- **"Skip the Rest" Escape Hatch**: Complete a check-in instantly at any point without feeling guilty or
  breaking things.
- **Mood History Timeline**: See how your answers have changed over time and read your notes.
- **Custom Question Library**: Create, tag, and organize custom questions with several color schemes, or Yes/No toggles.
- **100% Private & Local-First**: Your data never leaves your device until you decide it should. No accounts, external
  servers, or tracking cookies.
- **Ergonomics & Handedness Support**: Configurable left- or right-handed drawer positioning, dark/light theme
  switching, and high-contrast modes.
- **Full Data Ownership**: Export or import your entire tracking history anytime or even merge multiple backups

---

## Why It Exists

Most mood tracking tools demand high cognitive effort: overwhelming amounts of questions, mandatory journal entries,
clutter, or cloud accounts. During intense depressive lows or hyperactive manic phases, these barriers often cause
tracking habits to collapse entirely.

High & Low exists to eliminate that friction. By prioritizing rapid tap choices, touch-safe ergonomics, forgiving skip
options, and strict privacy, High & Low ensures that you can still track your mood when you need it most.

---

## Donations and Funding

### Not for Sale
High & Low is not for sale, and it never will be. It is open source and local-first, specifically because my main goal
is the existence of a tool to track moods privately. Thus, I will not accept any offers of sale, ever, regardless of
amount. I would rather the tool cease to exist than betray that principal.

### Donation Terms
If you would like to donate money, products, or services to make High and Low possible, I would humbly accept, as long
as you agree with the following:
- I cannot in good conscience advertise with this application, or this repository. By definition, this application is 
  aimed at users who are psychologically vulnerable. No attempts at manipulation can be tolerated, as there is simply 
  too much potential for harm, intentional or otherwise.
- Donors, no matter how much they have given, have no influence on how the app functions or is developed.
- I may refuse a donation or sponsorship if it is too large for me to be comfortable with, or if I feel I have more
  resources than I can reasonably be expected to use.
- I will not be distributing custom builds or making custom versions. I will consider feature requests, but my
  motivation cannot be money.
- There will be no perk-tiers or early access. Everyone gets the same application, regardless of what someone has or
  hasn't donated.
- The 'Thank You' section here and in the about section of the app will only include real-world names. Internet names 
  are often wild in ways that make my weak stomach queasy. I apologize for my weak constitution. If you wish to be 
  anonymous, you only have to ask. 

### Donation Sources
Donations are accepted from the following sources:
- GitHub Sponsors
- [Ko-fi](https://ko-fi.com/cactusbonessoftware)

### Funding Goals
Funding will be spent on the following:
- **Psychological Harm Audit/Consultation:** I am not a psychologist or a medical practitioner of any kind. I need the
  help of an expert to make reasonably certain that the design decisions and questions I put into the app will not
  cause harm. I am morally obligated to my fellow humans to do my due diligence in this matter.
    - Preliminary results from the APA App Evaluation Model are promising, but I need to carry out the evaluation
      myself and by a licensed psychologist.
    - Quote needed
- **Accessibility and Friction Audit:** A core principal of the app is that it should be usable by anyone, including
  those in the lowest of low moods. I am not experienced enough in user experience (UX) to perform such an audit, so I
  need the help of an expert.
    - Quote needed
- **Domain Names:** I have reserved the domain names `high-and-low.app` (primary, easy to read) and `highandlow.app`
  (secondary, easy to type and remember) for access to this app.
    - Cost: about USD $60 per year.

Secondary, or stretch goals include the following:
- **AI Server:** Headless large language model (LLM, or AI) computer for use in developing this and other projects
    - The total cost is not to exceed USD $5500, depending on PC Market conditions.
    - I will be building the machine myself, as I have schooling and experience in such projects.
- **Non-Profit Organization:** I would like to establish a small non-profit to accept donations and hold the
  intellectual property of High & Low, safeguarding it so that it can be useful for decades to come regardless of my
  own condition.
    - Needs legal consultation (and quote for such)
    - Needs a comprehensive charter written.

## Project Outlook
I cannot promise to care for and maintain High & Low forever. However, it is my goal not to need to. After all, you do
not need continuous research and development to make a screwdriver. Thus, one of my goals is to be finished with this
project one day. While this might not be completely possible due to changes in the Web landscape beyond my control, I
hope to meet the scope of this project and then stop developing new features.

If it is no longer possible for me to continue maintaining the app, I will do my utmost to let you know here, in this
README file. The app should continue working, as there is no backend to shut down, just static files. However, in such a
case, High & Low will no longer be updated by me.

That being said, if I stop maintaining the app, it doesn't have to be the end of High & Low. This project is licensed
AGPL, which means that anyone or any group can continue this work, as long as their work is licensed AGPL as well, and
they abide by the license agreement. So if I have to bow out, then others will be able to pick up where I left off. The
license also means that if someone wants a feature that I am unwilling to implement, such as syncing, they may make that
feature themselves, provided their code remains a matter of public record.

## Technical Overview

High & Low is built as a zero-dependency, local-first Progressive Web Application (PWA). It executes entirely in the
client browser with no external network requests, third-party trackers, or cloud backend dependencies.

- **Stack**: Vanilla HTML5, Vanilla CSS3 (Custom Properties), Vanilla JavaScript (native ES6+ modules).
- **Storage Layer**: IndexedDB (`HighAndLowDB`) for transactional on-device persistence and `sessionStorage` for active
  session state.
- **Offline First**: Service Worker cache layer (`sw.js`) and PWA web app manifest (`manifest.json`).

For complete, live technical specifications, data schemas, configuration keys, and module architecture, consult
**[`docs/state.md`](docs/state.md)**. For the chronological record of locked architectural decisions and rationale, see
**[`docs/decisions.md`](docs/decisions.md)**.
