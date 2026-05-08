import type { Context } from "hono";

import type { AppBindings } from "../types/app-bindings";

type ExecutionContextLike = {
  waitUntil: (promise: Promise<unknown>) => void;
};

type HonoExecutionContext = {
  executionCtx?: ExecutionContextLike;
};

export function createBackgroundTaskHandler(c: Context<AppBindings>) {
  const handleRejection = (error: unknown) => {
    console.error("Failed to run deferred Better Auth task:", error);
  };

  return (promise: Promise<unknown>) => {
    const guardedPromise = promise.catch((error) => {
      handleRejection(error);
    });

    const executionCtx = (c as Context<AppBindings> & HonoExecutionContext)
      .executionCtx;

    if (executionCtx) {
      executionCtx.waitUntil(guardedPromise);
      return;
    }

    void guardedPromise;
  };
}
