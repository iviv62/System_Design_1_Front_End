import test from "node:test";
import assert from "node:assert";
import { shouldAutoScrollForUserMessage } from "./chat-room-unread.ts";

test("shouldAutoScrollForUserMessage", async (t) => {
  await t.test("should return true if it is own message", () => {
    const result = shouldAutoScrollForUserMessage({
      isOwnMessage: true,
      isLoadingHistory: false,
      isPageActive: false,
      isNearBottom: false,
      hasUnseenMessages: true,
    });
    assert.strictEqual(result, true);
  });

  await t.test("should return true if loading history", () => {
    const result = shouldAutoScrollForUserMessage({
      isOwnMessage: false,
      isLoadingHistory: true,
      isPageActive: false,
      isNearBottom: false,
      hasUnseenMessages: true,
    });
    assert.strictEqual(result, true);
  });

  await t.test("should return true if page is active, near bottom and no unseen messages", () => {
    const result = shouldAutoScrollForUserMessage({
      isOwnMessage: false,
      isLoadingHistory: false,
      isPageActive: true,
      isNearBottom: true,
      hasUnseenMessages: false,
    });
    assert.strictEqual(result, true);
  });

  await t.test("should return false if not own message, not loading history, and page is not active", () => {
    const result = shouldAutoScrollForUserMessage({
      isOwnMessage: false,
      isLoadingHistory: false,
      isPageActive: false,
      isNearBottom: true,
      hasUnseenMessages: false,
    });
    assert.strictEqual(result, false);
  });

  await t.test("should return false if not own message, not loading history, and not near bottom", () => {
    const result = shouldAutoScrollForUserMessage({
      isOwnMessage: false,
      isLoadingHistory: false,
      isPageActive: true,
      isNearBottom: false,
      hasUnseenMessages: false,
    });
    assert.strictEqual(result, false);
  });

  await t.test("should return false if not own message, not loading history, and has unseen messages", () => {
    const result = shouldAutoScrollForUserMessage({
      isOwnMessage: false,
      isLoadingHistory: false,
      isPageActive: true,
      isNearBottom: true,
      hasUnseenMessages: true,
    });
    assert.strictEqual(result, false);
  });
});
