import type { BlueprintContentInput } from "@gracesoft/shared-types";

/**
 * Phase 2 (01-milestones.md, Healthcare Vertical Package): a pre-built starting point for
 * a GP clinic's blueprint, so a pilot clinic doesn't have to write FAQ copy from scratch.
 * Loaded into the same draft/review/publish flow as an LLM-generated draft — an owner
 * still edits and approves it before it goes live, nothing here skips that step.
 *
 * Content here is generic placeholder copy for a typical Singapore GP clinic, not a real
 * business's actual policies — every clinic that starts from this template needs to edit
 * the specifics (fees, exact hours, which insurers they accept) before publishing.
 */
export const CLINIC_BLUEPRINT_TEMPLATE: BlueprintContentInput = {
  services: [
    {
      name: "General Consultation",
      description: "Standard GP consultation for common illnesses and health concerns.",
      durationMinutes: 15,
    },
    {
      name: "Follow-up Consultation",
      description: "Review appointment for an existing condition or recent visit.",
      durationMinutes: 10,
    },
    {
      name: "Health Screening",
      description: "Routine health screening package (blood pressure, BMI, basic blood tests).",
      durationMinutes: 30,
    },
    {
      name: "Vaccination",
      description: "Flu, childhood, and travel vaccinations.",
      durationMinutes: 15,
    },
  ],
  hours: [
    { day: "monday", opens: "09:00", closes: "18:00" },
    { day: "tuesday", opens: "09:00", closes: "18:00" },
    { day: "wednesday", opens: "09:00", closes: "18:00" },
    { day: "thursday", opens: "09:00", closes: "18:00" },
    { day: "friday", opens: "09:00", closes: "18:00" },
    { day: "saturday", opens: "09:00", closes: "13:00" },
    { day: "sunday", closed: true },
  ],
  faqs: [
    {
      question: "Do you accept insurance or a Medisave/CHAS card?",
      answer:
        "Edit this: state which insurers, corporate panels, and government schemes (e.g. CHAS, Medisave) this clinic accepts, and whether a card or referral letter is needed at check-in.",
    },
    {
      question: "What should I bring for my appointment?",
      answer:
        "Please bring your NRIC/FIN and, if applicable, your insurance or CHAS card. Arrive 10 minutes early to complete check-in.",
    },
    {
      question: "What is your cancellation policy?",
      answer:
        "Edit this: state how much notice is required to cancel or reschedule without a fee (e.g. at least 2 hours before the appointment).",
    },
    {
      question: "Is my information kept confidential?",
      answer:
        "Yes. Your booking is identified only by a private token — our booking system and calendar never store your name, phone number, or the reason for your visit alongside the appointment slot. Only authorized staff can look up who a token belongs to, and every lookup is logged.",
    },
    {
      question: "Can I get a diagnosis or prescription through this chat?",
      answer:
        "No. This assistant can only help you book, reschedule, or cancel an appointment — it cannot provide a diagnosis, medical advice, or a prescription. Please speak with a doctor for any clinical questions.",
    },
    {
      question: "What if I need urgent medical attention?",
      answer:
        "This booking assistant is not for emergencies. If you are experiencing a medical emergency, call 995 or go to the nearest A&E immediately.",
    },
  ],
};
