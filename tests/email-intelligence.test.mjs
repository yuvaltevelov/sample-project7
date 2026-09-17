import test from "node:test";
import assert from "node:assert/strict";
import { classifyEmail } from "../netlify/functions/_email-intelligence.mts";

test("PAC messages are always high priority even without action keywords", () => {
  const result = classifyEmail({
    from: "career@pac.ac.il",
    subject: "משרות חמות של השבוע",
    snippet: "עדכון מהמרכז לפיתוח קריירה",
  });
  assert.equal(result.relevant, true);
  assert.equal(result.category, "PAC");
  assert.equal(result.priority, "high");
});

test("security and deadline messages are relevant and explain why", () => {
  const security = classifyEmail({
    from: "no-reply@accounts.google.com",
    subject: "Security alert: new device signed in",
    snippet: "Review activity now",
  });
  assert.equal(security.relevant, true);
  assert.equal(security.category, "אבטחה");
  assert.equal(security.priority, "critical");

  const deadline = classifyEmail({
    from: "school@example.com",
    subject: "Action required",
    snippet: "Please submit the form by 22/09",
  });
  assert.equal(deadline.relevant, true);
  assert.match(deadline.why, /deadline|דדליין|פעולה/i);
});

test("routine promotions are ignored unless they are strong technology deals", () => {
  const routine = classifyEmail({
    from: "shop@example.com", subject: "Weekend sale", snippet: "10% off shoes",
  });
  assert.equal(routine.relevant, false);

  const tech = classifyEmail({
    from: "software@example.com", subject: "Ends today: 40% off AI Pro annual plan", snippet: "Save 40% on your subscription",
  });
  assert.equal(tech.relevant, true);
  assert.equal(tech.category, "דיל טכנולוגיה");
});
