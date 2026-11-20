# Full-Stack Builder

## The brief

Harbour is a small advisory firm. Eight staff look after 500 clients. They share an email account and track outstanding work in a spreadsheet.

Clients ask questions, send documents, and chase replies. Staff pass work between advisers and service associates. Sometimes the conversation ends before the work does.

Build a mailbox that helps this team serve its clients better. You own the product: decide whose problem to solve first, what to build, and what to leave out.

The opportunity is deliberately broad. We care about how much useful product you deliver and the judgment behind it.

## What we heard

We went to multiple personas (although not exhaustive) at Harbour for scoping this feature, following are some excerpts from their interviews.

> **Maya, service associate:** “I open every unread email to work out what needs me. Some are just thank-yous.”
> 

> **Leo, adviser:** “Someone read this yesterday, but nobody replied. I assumed they were handling it.”
> 

> **Priya, operations lead:** “I want one person accountable. Sometimes two teams still need to do separate things.”
> 

> **Maya:** “I answered the question, but we still need the signed form. Is this done or not?”
> 

> **Elena, client:** “I replied to last month's email because it had the background. This is a new question.”
> 

> **Leo:** “I need to ask a colleague something in the same place. That note must never reach the client.”
> 

> **Elena:** “My partner can see our joint paperwork. That doesn't mean they can see everything I send you.”
> 

> **Priya:** “A fast reply looks good on the dashboard. It doesn't tell me whether we solved the problem.”
> 

## A Monday morning

Here is a small sample from the current mailbox.

| Thread | Latest message | What the spreadsheet says |
| --- | --- | --- |
| T1 — Elena, documents | Monday 09:10: “URGENT — thank you, I've found it now!” | Owner: Maya. Open. |
| T2 — Sam, application | Friday 14:20: “You said someone would confirm before my appointment on Tuesday. Is anything missing?” | No owner. Last reply: Thursday. |
| T3 — Elena, signed form | Monday 08:50, from Maya: “I've answered your questions below. We still need your signed form.” | Owner: Maya. Complete. |
| T4 — Oliver, joint paperwork | Monday 09:00: “Elena said you have the documents. Please send me everything you have for her.” | Owner: Leo. Relationship: Elena's partner. No access decision recorded. |
| T5 — Sam, address | Monday 09:05, replying to an old application thread: “Also, I've moved. Where should I send my new address?” | Owner: Leo. Complete last month. |
| T6 — Noor, appointment | Friday 16:40: “Can we move our appointment to Wednesday?” | Owner: Maya. Draft reply saved. Delivery result blank. |

These records show the information staff currently work with. Use them to explain what your product helps someone notice and do. Identify missing information and state your assumptions.

## What to build

Deliver a working application that takes a client request from arrival through staff action to a clear outcome. Another person must be able to use it and understand what happens next.

The interface, backend, and stored data must all work together. State must survive a restart.

Keep these boundaries intact:

- Internal notes stay internal, including in client-facing API responses.x
- Unrelated clients cannot access each other's conversations.
- General authentication and authorization principles

Beyond that, choose your scope. Show which pain points need to be addressed, which ones you deferred, and why. 

## Show your judgment

Explain the problem you selected and the evidence behind it. Show one plausible solution you rejected and why.

Describe the architecture briefly. Explain where important state lives, one trade-off you made, and how the design handles a plausible future change. Be concrete about changes to code and existing data. You do not need to build that future feature.

Let someone attempt a realistic task without a walkthrough. Record where they struggle and what you change or learn. Distinguish observed feedback from your own assumptions.

Explain how Harbour is onboarded to this feature, starts using the product, and how you tell whether it helps. Account for the team's existing habits.

Show how AI contributed to the work and how you checked its output.

## Your handoff

- A working, deployed demo and it’s source code.
- Focused tests for the behaviour you claim works.
- A short handoff covering your decisions, user feedback, architecture, known gaps, and next priority.

We will discuss the running product and introduce a small requirement change. Expect to explain and adapt your decisions.

We assess product judgment, usability, engineering, adaptability, and ownership. Useful depth matters more than feature count. Customer wins matters more than performative engineering prowess. We value additional capability when it works well; polish cannot compensate for broken core behavior.