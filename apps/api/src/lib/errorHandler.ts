import { ForbiddenError, UnauthenticatedError } from "@gracesoft/auth";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { HolidayBlockedError, OutsideOpeningHoursError } from "../modules/booking/bookingService.js";
import { NoSourcesError } from "../modules/onboarding/onboardingService.js";
import { LlmExtractionError } from "../modules/onboarding/llmProvider.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof UnauthenticatedError) {
      return reply.status(401).send({ error: "Unauthenticated", message: error.message });
    }
    if (error instanceof ForbiddenError) {
      return reply.status(403).send({ error: "Forbidden", message: error.message });
    }
    if (error instanceof HolidayBlockedError) {
      return reply.status(409).send({ error: "HolidayBlocked", message: error.message });
    }
    if (error instanceof OutsideOpeningHoursError) {
      return reply.status(409).send({ error: "OutsideOpeningHours", message: error.message });
    }
    if (error instanceof NoSourcesError) {
      return reply.status(400).send({ error: "NoSources", message: error.message });
    }
    if (error instanceof LlmExtractionError) {
      return reply.status(502).send({ error: "LlmExtractionFailed", message: error.message });
    }
    if (error instanceof ZodError) {
      return reply
        .status(400)
        .send({ error: "BadRequest", message: error.issues.map((i) => i.message).join("; ") });
    }

    request.log.error({ err: error }, "unhandled error");
    const statusCode = "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    return reply
      .status(statusCode)
      .send({ error: "InternalServerError", message: statusCode >= 500 ? "Internal Server Error" : error.message });
  });
}
