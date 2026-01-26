import {describe, it, expect, beforeEach, vi} from "vitest";
import {setConfig} from "../src/core/config";
import {sessionMiddleware} from "../src/core/sessionMiddleware";
import type {SessionContext} from "../src";

describe("Context Store Setter and Validation", () => {
    beforeEach(() => {
        setConfig({});
    });

    it("throws error if only getContextStore is provided", () => {
        expect(() => {
            setConfig({
                getContextStore: () => ({session: null})
            } as any);
        }).toThrow('[SessionKit] Both getContextStore and setContextStore must be provided together if using custom context storage.');
    });

    it("throws error if only setContextStore is provided", () => {
        expect(() => {
            setConfig({
                setContextStore: (_: any) => {}
            } as any);
        }).toThrow('[SessionKit] Both getContextStore and setContextStore must be provided together if using custom context storage.');
    });

    it("does not throw if both are provided", () => {
        expect(() => {
            setConfig({
                getContextStore: () => ({session: null}),
                setContextStore: (_: any) => {}
            });
        }).not.toThrow();
    });

    it("calls setContextStore during middleware execution when no custom runner is present", async () => {
        let internalStore: SessionContext | undefined;
        const customSetter = vi.fn((ctx: SessionContext) => {
            internalStore = ctx;
        });
        const customGetter = vi.fn(() => internalStore);

        const mockSession = {userId: "test-user"};
        
        setConfig({
            getContextStore: customGetter,
            setContextStore: customSetter,
        });

        const next = vi.fn(() => Promise.resolve(new Response("ok")));
        const context: any = {
            session: {
                get: () => mockSession
            }
        };

        await sessionMiddleware(context, next);

        expect(customSetter).toHaveBeenCalledWith(expect.objectContaining({
            session: mockSession
        }));
        expect(customGetter).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });
});
