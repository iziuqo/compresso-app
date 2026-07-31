/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

/**
 * Everything this app needs is precached: the shell, the fonts, the icons and the
 * compression worker chunk. There is no runtime caching strategy for user content
 * because there is no user content on the network — images never leave the device,
 * so "offline" here is simply the app's normal operating mode.
 */
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Activation is host-driven. A queue mid-flight must not be torn out from under
// the user by an update that happened to finish downloading.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string })?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', () => self.clients.claim());
