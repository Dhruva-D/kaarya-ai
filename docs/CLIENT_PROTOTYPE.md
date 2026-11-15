# Client prototype walkthrough

Open `/prototype`. The banner identifies the scripted prototype, and each local reference starts with `PROTOTYPE-`. Sample employer, utility and recipient details are fictional. No external action is submitted from this page. Use `/app` for the separate connected application.

## Presenter's opening

“This is a scripted prototype of the proposed experience. I will show the conversation, the review step, and a simulated confirmation. The connected Calendar, Tasks and email application is separate; the job and complaint flows shown here use sample data.”

## Using the prototype

1. Choose a scenario from the left menu.
2. Choose English, Kannada or Hindi for the on-screen script. Every scenario has two user lines and two fixed replies. **Copy full script** copies the complete selected-language dialogue.
3. For a fast text walkthrough, use **Send this line** twice. Alternatively, read the two lines through the blue voice button. Voice requires Google sign-in and available Gnani credits; spoken replies use the actual speech provider and its latency applies. The text walkthrough needs no model inference or external write.
4. Review the sample details and press **Simulate action**. The confirmation explicitly describes a prototype result. The reference is a local sample, not a provider receipt.
5. Use Restart or choose another scenario to reset. Reloading clears this session's prototype history.

The selected scenario advances after each spoken or typed turn; this is a scripted sequence, not open-ended intent recognition. Responses do not validate whether the user's speech matches the suggested line. Stick to the script for a repeatable walkthrough. Unsupported details are never silently sent to a provider.

## English recording script

### Calendar and invitation

**You:** “Schedule a project review tomorrow at five PM.”

**Kaarya:** “How long should the meeting last? Who should I invite, and should I add a Meet link?”

**You:** “Thirty minutes. Invite demo.guest@example.com and add a Meet link.”

**Kaarya:** “The project review is ready for your review: five to five thirty PM, with the guest and Meet option. Check the preview before continuing.”

**Presenter:** “I can inspect the exact sample details before simulating the action.” Click **Simulate action**.

**Kaarya:** “The prototype meeting flow is complete. The simulated event and invitation are shown in the receipt.”

### Google Task

**You:** “Add a task to prepare my project notes.”

**Kaarya:** “What date should it be due? A Google Task saves a date, without a timed alarm.”

**You:** “Make it due tomorrow.”

**Kaarya:** “Prepare project notes is ready, due tomorrow. Please review the task card.”

Click **Simulate action**. Kaarya confirms the prototype task flow, with a simulated receipt.

### Email

**You:** “Prepare an email with a project update.”

**Kaarya:** “Who is it for, and what subject and message should I use?”

**You:** “To demo.recipient@example.com. Subject: Project update. Say the prototype is ready for review.”

**Kaarya:** “The email is ready. Please check the exact recipient, subject and body in the preview.”

Click **Simulate action**. Kaarya says the prototype flow is complete and no email was sent.

### Two actions

**You:** “Schedule a design review and remind me to prepare notes.”

**Kaarya:** “When and for how long? Do you want guests or Meet? What date should the notes be due?”

**You:** “Tomorrow at five PM for thirty minutes, no guests and no Meet. Notes due tomorrow, date only.”

**Kaarya:** “Both actions are ready: the design review and the notes task. Review both before continuing.”

Click **Simulate action** to show the sample batch confirmation.

### Job application

**You:** “Find a software internship and prepare my application using my resume.”

**Kaarya:** “For this walkthrough I have a sample developer internship and a sample resume. Should I use them, and when can you start?”

**You:** “Use the sample developer internship and the sample resume. I can start next month.”

**Kaarya:** “The sample application is filled for your review, including skills, availability and a cover note. Please check it before simulating submission.”

Click **Simulate action**. Kaarya explains the reference is simulated and no employer received an application.

### Electricity complaint

**You:** “There is a problem with my electricity bill. Help me raise a complaint.”

**Kaarya:** “What is the account reference and what looks wrong on the bill? Please use the sample account for this prototype.”

**You:** “Use sample account DEMO-1001. The bill is double the usual amount. Request a meter reading check.”

**Kaarya:** “The complaint requests a meter reading and billing review. Please check the account reference and complaint text.”

Click **Simulate action**. Kaarya explains the reference is simulated and no utility was contacted.

## Presenter's close

“That demonstrates the proposed guided experience. Live employer applications and utility submissions require provider integrations and verification before they can be offered as operational features.”
