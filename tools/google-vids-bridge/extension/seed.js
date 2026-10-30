/* Sanitized settings from the operation-376 capture supplied by the user.
 * No API key, Google account, document ID, image handle, prompt or signed URL.
 * Numeric settings are preserved without guessing their undocumented meaning. */
(function () {
  'use strict';
  const P = globalThis.__affVidsProtocol.PLACEHOLDERS;
  const doc = ['__AFF_DOCUMENT__', 'application/vnd.google-apps.flix', null, null, 1];
  const docReference = Array(8).fill(null);
  docReference[7] = [null, null, [doc]];
  const image = Array(14).fill(null);
  image[8] = [null, null, null, P.image, 1];
  image[13] = 'Image1';
  const imageRecord = Array(12).fill(null);
  imageRecord[11] = image;
  const asset = Array(8).fill(null);
  asset[7] = [P.asset, imageRecord];
  const metadata = Array(41).fill(null);
  metadata[0] = 9;
  metadata[4] = P.request;
  metadata[6] = P.user;
  metadata[8] = [null, null, null, [[docReference]]];
  metadata[11] = [24, 0];
  metadata[13] = 'en';
  metadata[19] = 1;
  metadata[25] = [[asset]];
  metadata[34] = 'Asia/Saigon';
  metadata[40] = 0;
  const settings = Array(16).fill(null);
  settings[15] = [0, 12, null, 0, 2, null, null, null, 4];
  const body = [376, null, metadata, [null, null, null, [[[null, null, P.prompt]]]], settings, [1, null, [[null, '1', 1189]]], 1];
  Object.defineProperty(globalThis, '__affVidsSeed', {value: globalThis.__affVidsProtocol.validateBlueprint({schema: 1, body}), configurable: true});
})();
