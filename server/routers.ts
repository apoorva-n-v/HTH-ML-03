import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { createAllocation, createRouteAdvisory, createSignalAction, listAllocations, listOfficers, setOfficerStatus, updateAllocationStatus } from "./db";
import { reverseGeocode, nearbyPlaces, routeBetween, sendSignalAction, ticketmasterEvents, weatherAt } from "./integrations/intelligence";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const pointInput = z.object({ lat: z.number().finite(), lng: z.number().finite() });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  intelligence: router({
    context: publicProcedure.input(pointInput).query(async ({ input }) => {
      const [mapResult, weatherResult, eventsResult, placesResult] = await Promise.allSettled([
        reverseGeocode(input),
        weatherAt(input),
        ticketmasterEvents(input),
        nearbyPlaces(input, "event venue"),
      ]);
      return {
        generatedAt: new Date(),
        point: input,
        geocode: mapResult.status === "fulfilled" ? mapResult.value : null,
        weather: weatherResult.status === "fulfilled" ? weatherResult.value : null,
        events: eventsResult.status === "fulfilled" ? eventsResult.value : { configured: false, source: "ticketmaster", events: [] },
        places: placesResult.status === "fulfilled" ? placesResult.value : [],
        providerStatus: {
          maps: mapResult.status === "fulfilled" || placesResult.status === "fulfilled",
          weather: weatherResult.status === "fulfilled",
          events: eventsResult.status === "fulfilled" && eventsResult.value.configured,
        },
      };
    }),
  }),

  officers: router({
    list: protectedProcedure.query(() => listOfficers()),
    setStatus: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["available", "assigned", "enroute", "deployed", "offDuty"]) }))
      .mutation(({ input }) => setOfficerStatus(input.id, input.status)),
  }),

  allocations: router({
    list: protectedProcedure.query(() => listAllocations()),
    create: protectedProcedure
      .input(z.object({
        officerId: z.number().int().positive(),
        selectedArea: z.string().min(1).max(180),
        road: z.string().min(1).max(180),
        latitude: z.number().finite(),
        longitude: z.number().finite(),
        horizonMinutes: z.union([z.literal(30), z.literal(60)]),
        predictedOccupancy: z.number().int().min(0).max(100),
        arrivalAt: z.coerce.date(),
        notes: z.string().max(500).optional(),
      }))
      .mutation(({ ctx, input }) => createAllocation({ ...input, createdBy: ctx.user.id, status: "scheduled" })),
    updateStatus: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["proposed", "scheduled", "enroute", "deployed", "complete", "cancelled"]) }))
      .mutation(({ input }) => updateAllocationStatus(input.id, input.status)),
  }),

  routes: router({
    plan: protectedProcedure
      .input(z.object({ origin: z.string().min(2), destination: z.string().min(2), allocationId: z.number().int().positive().optional() }))
      .mutation(async ({ ctx, input }) => {
        const route = await routeBetween(input.origin, input.destination);
        const saved = await createRouteAdvisory({
          allocationId: input.allocationId,
          origin: input.origin,
          destination: input.destination,
          encodedPolyline: route.encodedPolyline,
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationInTrafficSeconds ?? route.durationSeconds,
          status: route.status === "OK" ? "active" : "failed",
          createdBy: ctx.user.id,
        });
        return { route, saved, persisted: Boolean(saved) };
      }),
  }),

  signals: router({
    request: protectedProcedure
      .input(z.object({ selectedArea: z.string().min(1), controllerId: z.string().min(1), action: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const delivery = await sendSignalAction(input);
        const saved = await createSignalAction({
          ...input,
          status: delivery.status === "sent" ? "sent" : delivery.status === "notConfigured" ? "notConfigured" : "failed",
          requestedBy: ctx.user.id,
        });
        return { delivery, saved, persisted: Boolean(saved) };
      }),
  }),
});

export type AppRouter = typeof appRouter;
