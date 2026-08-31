# High & Low

**High & Low** is an easy-to-use, private mood tracker designed specifically for individuals navigating bipolar
and unipolar mood cycles (both depressive lows and manic/hypomanic highs).

---

## What It Is

High & Low is a lightweight, easy-to-use web app built to make mood tracking feel effortless—especially on exhausting
or low-energy days. It uses simple 1–5 rating scales and quick Yes/No questions presented one card at a time,
keeping mental effort as low as possible.

---

## Key Features

- **One Question at a Time**: Large, easy-to-read cards so you never feel overwhelmed.
- **"Skip the Rest" Button**: Finish a check-in at any point without guilt or broken stats.
- **Visual History Timeline**: See how your moods change over time and revisit past notes.
- **Custom Questions**: Create, tag, and organize custom questions with customizable color schemes and Yes/No toggles.
- **100% Private & Stored on Your Device**: Your personal data stays on your phone or computer. There are no accounts
  to create, no tracking cookies, and no outside servers collecting your information.
- **Comfortable & Accessible**: Designed for easy one-handed use (with left- or right-handed menu positioning),
  light and dark modes, and high-contrast options for easy reading.
- **Full Control of Your Data**: Save a backup of your entire history to your device anytime, restore it whenever
  you want, or combine multiple backups seamlessly.

---

## Why It Exists

Most mood tracking apps demand too much effort: long lists of questions, mandatory journal entries, visual clutter,
or required cloud accounts. During deep depressive lows or restless manic phases, these hurdles often cause tracking
habits to stop completely.

High & Low was created to remove those obstacles. By focusing on quick one-tap answers, comfortable one-handed
controls, guilt-free skip buttons, and complete privacy, High & Low helps you keep track of your well-being even on
your hardest days.

---

## Donations and Funding

### Not for Sale
High & Low is not for sale, and it never will be. It is free, open source, and stores data directly on your device
because my sole goal is to provide a safe, private way for people to track their moods. Thus, I will not accept any
offers to buy or commercialize this project, regardless of amount. I would rather the tool cease to exist than betray
that principle.

### Donation Terms
If you would like to donate money, products, or services to help keep High & Low going, I would humbly accept,
as long as you agree with the following:
- I cannot in good conscience place advertisements in this application or this repository. This application is
  designed for people who may be experiencing mental distress or fatigue. No attempts at manipulation or commercial
  targeting can be tolerated, as there is simply too much potential for harm, intentional or otherwise.
- Donors, no matter how much they have given, have no influence on how the app functions or is developed.
- I may refuse a donation or sponsorship if it is too large for me to be comfortable with, or if I feel I have more
  resources than I can reasonably use.
- I will not make special versions, custom builds, or exclusive editions for donors. I will consider feature
  suggestions from anyone, but decisions will never be driven by money.
- There will be no tiered perks or early access. Everyone gets the exact same application, regardless of what
  someone has or hasn't donated.
- The 'Thank You' section here and in the about section of the app will only include real-world names. Internet
  pseudonyms can sometimes be inappropriate in ways that make my weak stomach queasy. I apologize for my weak
  constitution. If you wish to remain anonymous, you only have to ask.

### Donation Sources
Donations are accepted from the following sources:
- GitHub Sponsors
- [Ko-fi](https://ko-fi.com/cactusbonessoftware)

### Funding Goals
Funding will be spent on the following:
- **Mental Health & Design Consultation:** I am not a psychologist or medical practitioner. I want the guidance of a
  qualified mental health professional to ensure that the questions and design choices in the app are safe and
  supportive. I consider this my moral obligation to fellow humans.
  - Initial self-assessments based on American Psychiatric Association app evaluation guidelines look promising,
    but I want a formal review conducted with a licensed psychologist.
  - Quote needed
- **Accessibility & Usability Review:** A core principle of the app is that it should be usable by anyone, including
  those in the lowest of low moods. I want a professional accessibility and usability audit to ensure the app is
  truly effortless for everyone.
  - Quote needed
- **Domain Names:** I have reserved the domain names `high-and-low.app` (primary, easy to read) and `highandlow.app`
  (secondary, easy to type and remember) to provide easy web access to the app.
  - Cost: about USD $60 per year.

Secondary or stretch goals include:
- **Dedicated Development Computer:** A dedicated computer to run local AI development assistants to help build,
  test, and maintain this project and future tools.
  - The total cost is not to exceed USD $5,500, depending on hardware market conditions.
  - I will assemble the hardware myself, as I have formal training and experience with computer hardware.
- **Non-Profit Organization:** I would like to establish a small non-profit organization to hold the project assets
  and safeguard High & Low, ensuring it remains freely available and useful for decades to come regardless of my
  own circumstances.
  - Needs legal consultation (and an estimated cost quote)
  - Needs a formal organizational charter.

## Project Outlook
I cannot promise to maintain High & Low forever. However, the app is designed so that it does not need endless
updates to stay useful. Just as you do not need continuous updates for a screwdriver to remain effective, my goal is
to complete the core design and then step back from adding unnecessary new features.

If it is ever no longer possible for me to maintain the app, I will do my best to post an update here in this README
file. The app will continue working on your device because it runs locally in your browser and does not depend on
central servers to function.

Because High & Low is released under an open-source license (the AGPL), anyone or any group is free to inspect,
improve, or continue maintaining this work, provided their changes are also shared openly under the same license
terms. If I ever have to step aside, others can pick up where I left off. It also means that if anyone wants a
feature that I chose not to include (such as cloud syncing), they are free to build their own version as long as
their code remains publicly accessible.

## How It Works Under the Hood

High & Low is built to be straightforward, fast, and completely independent of the cloud:

- **Plain Web Standards**: Built using standard HTML, CSS, and modern JavaScript without complex runtime
  dependencies.
- **Saved on Your Device**: All your entries, notes, and settings are saved directly inside your browser's private
  storage on your device.
- **Works Everywhere Offline**: You can install it on your home screen or desktop like an app, and it works
  seamlessly without an internet connection.

For technical contributors who want to explore the architecture, data structures, and design history:
- **[`docs/state.md`](docs/state.md)**: Current technical specifications, storage schemas, and settings keys.
- **[`docs/decisions.md`](docs/decisions.md)**: Chronological record of architectural decisions and rationale.

